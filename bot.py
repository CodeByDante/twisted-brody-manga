import os
import time
import asyncio
import subprocess
import json
import requests
import re
import shutil
from pyrogram import Client, filters
from pyrogram.types import InlineKeyboardMarkup, InlineKeyboardButton
from pyrogram.errors import FloodWait, MessageNotModified
from deep_translator import GoogleTranslator
import yt_dlp

# --- TUS DATOS ---
API_ID = 33226415
API_HASH = "01999dae3e5348c7ab0dbcc6f7f4edc5"
BOT_TOKEN = "8584312169:AAHQjPutXzS6sCPQ-NxIKp_5GsmjmvI9TEw"

# Configuración
COOKIES_FILE = 'cookies.txt'
LIMIT_2GB = 2147483648

# Dependencias
HAS_ARIA2 = shutil.which("aria2c") is not None
HAS_FFMPEG = shutil.which("ffmpeg") is not None

# Almacenamiento
url_storage = {}
user_config = {} 

print("🚀 Iniciando Bot Pro (Fixed: Menú Auto)...")

app = Client(
    "mi_bot_pro", 
    api_id=API_ID, 
    api_hash=API_HASH, 
    bot_token=BOT_TOKEN,
    workers=16,
    max_concurrent_transmissions=8
)

# --- 1. FUNCIONES HELPER ---

def get_config(chat_id):
    if chat_id not in user_config:
        user_config[chat_id] = {
            'lang': 'orig', 'fmt': 'mp4',
            'q_fixed': None, 'q_auto': None, 'meta': True
        }
    return user_config[chat_id]

def format_bytes(size):
    if not size: return ""
    power = 2**10
    n = 0
    power_labels = {0 : '', 1: 'K', 2: 'M', 3: 'G', 4: 'T'}
    while size > power:
        size /= power
        n += 1
    return f" (~{size:.1f} {power_labels[n]}B)"

def limpiar_enlace_youtube(url):
    if "youtube.com" in url or "youtu.be" in url:
        patron = r'(?:v=|\/|shorts\/)([0-9A-Za-z_-]{11})'
        match = re.search(patron, url)
        if match: return f"https://www.youtube.com/watch?v={match.group(1)}"
    return url

async def resolver_url_redirect(url):
    try:
        return requests.get(url, headers={'User-Agent': 'Mozilla/5.0'}, allow_redirects=True, timeout=10).url
    except: return url

async def traducir_texto(texto):
    if not texto or len(texto) < 2: return texto
    try:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, lambda: GoogleTranslator(source='auto', target='es').translate(texto))
    except: return texto

# --- 2. FUNCIONES FFMPEG ---

async def generar_thumbnail(ruta_video, chat_id, timestamp):
    if not HAS_FFMPEG: return None
    thumb_path = f"thumb_{chat_id}_{timestamp}.jpg"
    try:
        cmd = ["ffmpeg", "-i", ruta_video, "-ss", "00:00:02", "-vframes", "1", thumb_path, "-y"]
        process = await asyncio.create_subprocess_exec(*cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        await process.wait()
        if os.path.exists(thumb_path): return thumb_path
    except: pass
    return None

async def obtener_metadatos_video(ruta_archivo):
    if not HAS_FFMPEG: return 0, 0, 0
    try:
        cmd = ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,duration", "-of", "json", ruta_archivo]
        raw = await asyncio.create_subprocess_exec(*cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        stdout, _ = await raw.communicate()
        data = json.loads(stdout.decode('utf-8'))
        s = data['streams'][0]
        return int(s.get('width', 0)), int(s.get('height', 0)), int(float(s.get('duration', 0)))
    except: return 0, 0, 0

async def obtener_duracion_audio(ruta_archivo):
    if not HAS_FFMPEG: return 0
    try:
        cmd = ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", ruta_archivo]
        raw = await asyncio.create_subprocess_exec(*cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        stdout, _ = await raw.communicate()
        data = json.loads(stdout.decode('utf-8'))
        return int(float(data['format']['duration']))
    except: return 0

# --- 3. GESTIÓN DE MENSAJES INTELIGENTE ---

async def safe_edit(message, text):
    try:
        await message.edit_text(text)
        return message
    except FloodWait as e:
        await asyncio.sleep(e.value)
        try: await message.edit_text(text)
        except: pass
    except MessageNotModified: pass
    except Exception: pass
    return message

async def clean_and_send(client, chat_id, text, old_msg_to_delete=None):
    if old_msg_to_delete:
        try: await old_msg_to_delete.delete()
        except: pass
    try:
        return await client.send_message(chat_id, text)
    except FloodWait as e:
        await asyncio.sleep(e.value)
        return await client.send_message(chat_id, text)

# --- 4. PROGRESO ---

async def progreso(current, total, message, times_info):
    now = time.time()
    start_time, last_update = times_info
    if (now - last_update) > 5 or current == total:
        times_info[1] = now
        try:
            porc = current * 100 / total
            mb_curr = current / (1024*1024)
            mb_total = total / (1024*1024)
            speed = mb_curr / (now - start_time) if (now - start_time) > 0 else 0
            text = f"📤 **Subiendo...**\n📊 {porc:.1f}% | 📦 {mb_curr:.1f}/{mb_total:.1f} MB\n🚀 {speed:.2f} MB/s"
            await message.edit_text(text)
        except FloodWait: pass 
        except: pass

# --- 5. PROCESO DE DESCARGA ---

async def procesar_descarga_video(client, chat_id, url, calidad, datos_info, origin_message):
    conf = get_config(chat_id)
    timestamp = int(time.time())
    
    tipo_txt = "Audio" if calidad == "mp3" else f"Video"
    msg_status = await clean_and_send(
        client, chat_id, 
        f"⏳ **Descargando...**\n📥 {tipo_txt} | 🚀 Motor: {'Aria2' if HAS_ARIA2 else 'Nativo'}", 
        old_msg_to_delete=origin_message
    )
    
    opciones = {
        'quiet': True, 'max_filesize': LIMIT_2GB, 'no_warnings': True, 
        'noplaylist': True, 'outtmpl': f"dl_{chat_id}_{timestamp}.%(ext)s"
    }
    
    if HAS_ARIA2:
        opciones['external_downloader'] = 'aria2c'
        opciones['external_downloader_args'] = ['-x', '16', '-s', '16', '-k', '1M']
    if os.path.exists(COOKIES_FILE): opciones['cookiefile'] = COOKIES_FILE

    archivo_final = None
    thumb_path = None

    try:
        loop = asyncio.get_running_loop()
        if calidad == "mp3":
            archivo_base = f"a_{chat_id}_{timestamp}"
            opciones.update({
                'format': 'bestaudio/best',
                'outtmpl': f"{archivo_base}.%(ext)s",
                'postprocessors': [{'key': 'FFmpegExtractAudio','preferredcodec': 'mp3','preferredquality': '192'}]
            })
            with yt_dlp.YoutubeDL(opciones) as ydl:
                await loop.run_in_executor(None, lambda: ydl.download([url]))
            archivo_final = f"{archivo_base}.mp3"
        else:
            archivo_final = f"v_{chat_id}_{timestamp}.mp4"
            fmt_str = 'bestvideo+bestaudio/best' if calidad == 'best' else \
                      'worstvideo+bestaudio/worst' if calidad == 'worst' else \
                      f'bestvideo[height<={calidad}]+bestaudio/best[height<={calidad}]/best'
            opciones.update({
                'format': fmt_str, 'outtmpl': archivo_final, 
                'merge_output_format': 'mp4',
                'postprocessor_args': {'ffmpeg': ['-movflags', '+faststart']}
            })
            with yt_dlp.YoutubeDL(opciones) as ydl:
                await loop.run_in_executor(None, lambda: ydl.download([url]))

        if not os.path.exists(archivo_final):
            await safe_edit(msg_status, "❌ Error: Falló la descarga.")
            return

        if os.path.getsize(archivo_final) > LIMIT_2GB:
            os.remove(archivo_final)
            await safe_edit(msg_status, "❌ Archivo > 2GB.")
            return

        await safe_edit(msg_status, "📝 **Procesando metadatos...**")

        width, height, duration = 0, 0, 0
        if calidad != "mp3":
            thumb_path = await generar_thumbnail(archivo_final, chat_id, timestamp)
            width, height, duration = await obtener_metadatos_video(archivo_final)
        else:
            duration = await obtener_duracion_audio(archivo_final)

        caption = ""
        if conf['meta']:
            tit = datos_info.get('titulo', 'Media')
            desc = datos_info.get('descripcion', '')
            all_tags = (datos_info.get('tags') or []) + (datos_info.get('categories') or [])
            if datos_info.get('genre'): all_tags.append(datos_info.get('genre'))
            clean_tags = []
            seen = set()
            for t in all_tags:
                if t and t not in seen:
                    seen.add(t)
                    clean_tags.append(f"#{str(t).strip().replace(' ', '_').replace('-', '_')}")
            
            if conf['lang'] == 'es':
                tit = await traducir_texto(tit)
                desc = await traducir_texto(desc[:800]) if desc else ""
            else:
                desc = (desc[:800] + "...") if desc else ""
            caption = f"🎬 **{tit}**\n\n📝 {desc}\n\n{' '.join(clean_tags[:15])}"[:1024]

        try: await msg_status.edit_text("📤 **Subiendo...**")
        except: 
            await msg_status.delete()
            msg_status = await client.send_message(chat_id, "📤 **Subiendo...**")

        times_info = [time.time(), 0]
        
        if calidad == "mp3":
            await client.send_audio(chat_id, audio=archivo_final, caption=caption,
                title=datos_info.get('titulo') if conf['meta'] else None,
                duration=duration, progress=progreso, progress_args=(msg_status, times_info))
        else:
            await client.send_video(chat_id, video=archivo_final, caption=caption,
                width=width, height=height, duration=duration, thumb=thumb_path,
                supports_streaming=True, progress=progreso, progress_args=(msg_status, times_info))
        
        await msg_status.delete()

    except Exception as e:
        print(f"Error: {e}")
        await clean_and_send(client, chat_id, f"❌ Error: {str(e)[:50]}", msg_status)
    finally:
        if archivo_final and os.path.exists(archivo_final): 
            try: os.remove(archivo_final)
            except: pass
        if thumb_path and os.path.exists(thumb_path): 
            try: os.remove(thumb_path)
            except: pass

# --- 6. CALLBACKS CORREGIDOS ---

@app.on_callback_query()
async def boton_callback(client, callback_query):
    data = callback_query.data
    msg = callback_query.message
    chat_id = msg.chat.id
    conf = get_config(chat_id)

    try:
        if data == "cancel":
            await msg.delete()
            return

        if data.startswith("dl|"):
            parts = data.split("|")
            calidad = parts[1]
            datos = url_storage.get(chat_id)
            if not datos:
                await callback_query.answer("⚠️ Enlace expirado.", show_alert=True)
                return
            await procesar_descarga_video(client, chat_id, datos['url'], calidad, datos, origin_message=msg)
            return

        new_kb = None
        new_txt = None
        
        if data == "menu|main":
            new_txt = "⚙️ **Panel Principal**"
            new_kb = generar_teclado_start(conf)
        elif data == "toggle|fmt":
            conf['fmt'] = 'mp3' if conf['fmt'] == 'mp4' else 'mp4'
            new_kb = generar_teclado_start(conf)
        elif data == "toggle|lang":
            conf['lang'] = 'es' if conf['lang'] == 'orig' else 'orig'
            new_kb = generar_teclado_start(conf)
        elif data == "toggle|meta":
            conf['meta'] = not conf['meta']
            new_kb = generar_teclado_start(conf)
        
        # --- MENÚ CALIDAD FIJA ---
        elif data == "menu|fixed":
            btns = []
            for q in ['1080', '720', '480', '360']:
                mark = "✅" if conf['q_fixed'] == q else ""
                btns.append(InlineKeyboardButton(f"{mark} {q}p", callback_data=f"set_q|{q}"))
            kb_l = [btns[i:i+2] for i in range(0, len(btns), 2)]
            kb_l.append([InlineKeyboardButton("❌ Off", callback_data="set_q|off"), InlineKeyboardButton("🔙", callback_data="menu|main")])
            new_txt = "🎯 **Calidad Fija**"
            new_kb = InlineKeyboardMarkup(kb_l)
        
        # --- MENÚ AUTO (CORREGIDO) ---
        elif data == "menu|auto":
            botones = [
                [InlineKeyboardButton("🌟 Max Calidad (Best)", callback_data="set_auto|max")],
                [InlineKeyboardButton("📉 Min Calidad (Worst)", callback_data="set_auto|min")],
                [InlineKeyboardButton("❌ Desactivar Auto", callback_data="set_auto|off")],
                [InlineKeyboardButton("🔙 Volver", callback_data="menu|main")]
            ]
            new_txt = "🤖 **Modo Automático**\nElige prioridad:"
            new_kb = InlineKeyboardMarkup(botones)

        # --- SETTERS ---
        elif data.startswith("set_q|"):
            val = data.split("|")[1]
            conf['q_fixed'] = None if val == "off" else val
            if val != "off": conf['q_auto'] = None
            new_txt = f"✅ Calidad Fija: {val}p" if val != "off" else "✅ Calidad Fija: OFF"
            new_kb = generar_teclado_start(conf)

        elif data.startswith("set_auto|"):
            val = data.split("|")[1]
            conf['q_auto'] = None if val == "off" else val
            if val != "off": conf['q_fixed'] = None
            new_txt = f"✅ Modo Auto: {val.upper()}" if val != "off" else "✅ Modo Auto: OFF"
            new_kb = generar_teclado_start(conf)

        # Aplicar cambios visuales
        if new_kb:
            try:
                if new_txt: await msg.edit_text(new_txt, reply_markup=new_kb)
                else: await msg.edit_reply_markup(new_kb)
            except FloodWait as e:
                await callback_query.answer(f"⏳ Espera {e.value}s", show_alert=True)

    except Exception as e:
        print(f"Error Callback: {e}")

def generar_teclado_start(conf):
    chk = "✅"
    s_auto = f"{chk} Auto ({conf['q_auto'].upper()})" if conf['q_auto'] else "Auto"
    s_fix = f"{chk} {conf['q_fixed']}p" if conf['q_fixed'] else "Fija"

    return InlineKeyboardMarkup([
        [InlineKeyboardButton(s_fix, callback_data="menu|fixed"),
         InlineKeyboardButton(s_auto, callback_data="menu|auto")],
        [InlineKeyboardButton(f"📝 Info: {'ON' if conf['meta'] else 'OFF'}", callback_data="toggle|meta")],
        [InlineKeyboardButton(f"Fmt: {conf['fmt'].upper()}", callback_data="toggle|fmt"), 
         InlineKeyboardButton(f"Lang: {conf['lang'].upper()}", callback_data="toggle|lang")]
    ])

@app.on_message(filters.command("start"))
async def start(client, message):
    await message.reply_text("⚙️ **Bot Config**", reply_markup=generar_teclado_start(get_config(message.chat.id)))

# --- 7. ANALIZADOR ---

@app.on_message(filters.text & (filters.regex("http") | filters.regex("www")))
async def analizar_enlace(client, message):
    chat_id = message.chat.id
    url = message.text.strip()

    # ================================
    # 🔥 NORMALIZACIÓN MASIVA 2025 (190+ sitios)
    # ================================

    # ---- REDES SOCIALES & GENERALES ----
    if any(dom in url for dom in [
        "tiktok.com", "vm.tiktok.com", "vt.tiktok.com",
        "instagram.com", "threads.net",
        "facebook.com", "fb.com", "fb.watch",
        "x.com", "twitter.com",
        "youtube.com", "youtu.be",
        "onlyfans.com", "fansly.com", "fantrie.com", "patreon.com", "thotshub.tv",
        "reddit.com", "v.redd.it", "redditmedia.com",
        "pinterest.com", "pin.it",
        "discord.com", "discord.gg", "discordapp.com",
        "twitch.tv", "kick.com", "rumble.com", "vimeo.com"
    ]):
        # Limpia parámetros para redes sociales
        url = url.split("?")[0].split("&")[0]

    # Facebook/fb.watch → resolución real (si tienes la función)
    if any(dom in url for dom in ["facebook.com", "fb.com", "fb.watch"]):
        try:
            url = await asyncio.get_running_loop().run_in_executor(None, lambda: resolver_url_redirect(url))
        except:
            pass

    # X.com → twitter.com (compatibilidad)
    if "x.com" in url:
        url = url.replace("x.com", "twitter.com")

    # ---- JAV & ASIÁTICO PURO (los más usados 2025) ----
    if any(dom in url for dom in [
        "missav.com", "missav123.com", "missav.vn",
        "supjav.com", "vjav.com", "jav.guru", "javmost.com",
        "jav.gg", "javgg.net", "javfinder.sh", "javfinder.is",
        "javdb.com", "javbus.com", "javlibrary.com",
        "javtasty.com", "javwhores.com", "bestjavporn.com",
        "91porn.com", "91porny.com", "tokyomotion.net",
        "7mmtv.tv", "7mmtv.sx", "thisav.com", "avple.tv",
        "fc2hub.com", "fc2.com", "dmm.co.jp", "watchjavonline.com",
        "njav.tv", "javdoe.sh", "zerojav.com", "vivamaxph.com"
    ]):
        url = url.split("?")[0]

    # ---- TUBOS PORNO GENERALES + HISPANOS + LEAKS ----
    if any(dom in url for dom in [
        "pornhub.com", "pornhubpremium.com", "phncdn.com",
        "xvideos.com", "xvideos-cdn.com", "xnxx.com", "xnxx-cdn.com",
        "xhamster.com", "xhamster.desi", "xhamster2.com", "xhamster3.com",
        "eporner.com", "spankbang.com", "redtube.com", "youporn.com",
        "youjizz.com", "tube8.com", "beeg.com", "porntrex.com",
        "daftsex.com", "motherless.com", "hclips.com", "thumbzilla.com",
        "serviporno.com", "cerdas.com", "muyzorras.com", "petardashd.com",
        "canalporno.com", "felizporno.com", "vsex.in", "porn.es",
        "hqpomer.com", "yourporn.sexy", "3movs.com", "txxx.com",
        "ok.xxx", "porn300.com", "analdin.com", "siska.tv",
        "upornia.com", "fapnado.com", "porntop.com", "pornxp.com",
        "watchxxxfree.com", "hdporn92.com", "4kporn.xxx", "theporndude.com"
    ]):
        url = url.split("?")[0]

    # ================================
    # ¡¡TU CÓDIGO SIGUE AQUÍ!!
    # ================================
    # Ahora 'url' está limpio y normalizado para todos los sitios
    # await message.reply(f"Enlace limpio: {url}")
    # ... descarga, análisis, etc.
    url = limpiar_enlace_youtube(message.text.strip())
    conf = get_config(chat_id)
    
    msg_status = await client.send_message(chat_id, "🔎 **Analizando...**")
    
    if "pin.it" in url or "t.co" in url: url = await resolver_url_redirect(url)

    ydl_opts = {'quiet': True, 'no_warnings': True, 'ignoreerrors': True, 'noplaylist': True}
    if os.path.exists(COOKIES_FILE): ydl_opts['cookiefile'] = COOKIES_FILE

    try:
        loop = asyncio.get_running_loop()
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = await loop.run_in_executor(None, lambda: ydl.extract_info(url, download=False))
        
        if not info:
            await safe_edit(msg_status, "❌ Enlace inválido.")
            return

        url_storage[chat_id] = {
            'url': url, 'titulo': info.get('title', 'Media'),
            'descripcion': info.get('description', ''),
            'tags': info.get('tags', []), 'categories': info.get('categories', []),
            'genre': info.get('genre'), 'uploader': info.get('uploader')
        }
        datos = url_storage[chat_id]

        if conf['fmt'] == 'mp3':
            await procesar_descarga_video(client, chat_id, url, "mp3", datos, msg_status)
            return
        if conf['q_fixed']:
            await procesar_descarga_video(client, chat_id, url, conf['q_fixed'], datos, msg_status)
            return
        if conf['q_auto']:
            q = 'best' if conf['q_auto'] == 'max' else 'worst'
            await procesar_descarga_video(client, chat_id, url, q, datos, msg_status)
            return

        formatos = info.get('formats', [])
        res_map = {}
        for f in formatos:
            if f.get('vcodec') != 'none' and f.get('height'):
                h = f['height']
                size = f.get('filesize') or f.get('filesize_approx') or 0
                if h not in res_map or size > res_map[h]: res_map[h] = size
        
        sorted_res = sorted(res_map.keys(), reverse=True)
        botones = []
        
        if not sorted_res:
            botones.append([InlineKeyboardButton("⬇️ Descargar", callback_data="dl|best")])
        else:
            for res in sorted_res[:6]:
                peso_str = format_bytes(res_map[res])
                botones.append([InlineKeyboardButton(f"🎥 {res}p{peso_str}", callback_data=f"dl|{res}")])
        
        botones.append([InlineKeyboardButton("❌ Cancelar", callback_data="cancel")])
        
        await msg_status.delete()
        tit = info.get('title', 'Video')[:50]
        await client.send_message(chat_id, f"🎬 **{tit}**\n👇 Selecciona calidad:", reply_markup=InlineKeyboardMarkup(botones))

    except Exception as e:
        print(f"Error Analyzer: {e}")
        await clean_and_send(client, chat_id, "❌ Error al procesar.", msg_status)

if __name__ == "__main__":
    app.run()