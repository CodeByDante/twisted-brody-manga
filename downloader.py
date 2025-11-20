import os
import time
import asyncio
import json
import subprocess
import yt_dlp
from pyrogram import enums
from config import LIMIT_2GB, HAS_ARIA2, HAS_FFMPEG
from database import get_config, downloads_db, guardar_db
from utils import sel_cookie, traducir_texto, generar_barra, format_bytes

# // Mantiene el estado "Enviando..." activo
async def mantener_accion(client, chat_id, action):
    while True:
        try:
            await client.send_chat_action(chat_id, action)
            await asyncio.sleep(4)
        except asyncio.CancelledError:
            break
        except:
            pass

# // Barra de progreso para YT-DLP
class YTProgress:
    def __init__(self, msg, loop):
        self.msg = msg
        self.loop = loop
        self.last_time = 0
        
    def __call__(self, d):
        if d['status'] == 'downloading':
            now = time.time()
            if now - self.last_time > 4:
                self.last_time = now
                total = d.get('total_bytes') or d.get('total_bytes_estimate') or 0
                downloaded = d.get('downloaded_bytes', 0)
                bar = generar_barra(downloaded, total)
                speed = d.get('speed_str', 'N/A')
                eta = d.get('eta_str', 'N/A') 
                text = (
                    f"📥 **Descargando al Servidor...**\n"
                    f"{bar}\n"
                    f"📦 {format_bytes(downloaded)} / {format_bytes(total)}\n"
                    f"⚡ Vel: {speed} | ⏳ Resta: {eta}"
                )
                try:
                    asyncio.run_coroutine_threadsafe(self.msg.edit(text), self.loop)
                except: pass

# // Progreso de subida a Telegram
async def progreso(cur, tot, msg, times, act):
    now = time.time()
    if (now - times[1]) > 4 or cur == tot:
        times[1] = now
        try:
            bar = generar_barra(cur, tot)
            txt = (
                f"☁️ **Subiendo a Telegram...**\n"
                f"{bar}\n"
                f"📦 {format_bytes(cur)} / {format_bytes(tot)}"
            )
            await msg.edit_text(txt)
        except: pass

# // Helpers
async def get_thumb(path, cid, ts):
    out = f"t_{cid}_{ts}.jpg"
    if HAS_FFMPEG:
        try:
            await (await asyncio.create_subprocess_exec("ffmpeg", "-i", path, "-ss", "00:00:02", "-vframes", "1", out, "-y", stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)).wait()
            if os.path.exists(out): return out
        except: pass
    return None

async def get_meta(path):
    if not HAS_FFMPEG: return 0,0,0
    try:
        p = await asyncio.create_subprocess_exec("ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,duration", "-of", "json", path, stdout=subprocess.PIPE)
        d = json.loads((await p.communicate())[0])
        s = d['streams'][0]
        return int(s.get('width',0)), int(s.get('height',0)), int(float(s.get('duration',0)))
    except: return 0,0,0

async def get_audio_dur(path):
    try:
        p = await asyncio.create_subprocess_exec("ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", path, stdout=subprocess.PIPE)
        return int(float(json.loads((await p.communicate())[0])['format']['duration']))
    except: return 0

# // -------------------------------------------------------
# // PROCESAMIENTO PRINCIPAL
# // -------------------------------------------------------
async def procesar_descarga(client, chat_id, url, calidad, datos, msg_orig):
    conf = get_config(chat_id)
    vid_id = datos.get('id')
    
    final = None
    thumb = None
    ts = int(time.time())
    status = None
    url_descarga = url
    accion_tarea = None

    # // --- LOGICA DE REPLY (RESPONDER AL USUARIO) ---
    # // msg_orig es el mensaje del bot con botones.
    # // msg_orig.reply_to_message es el mensaje del usuario con el link.
    # // Guardamos ese ID para responderle siempre a ese mensaje.
    id_usuario_link = None
    if msg_orig.reply_to_message:
        id_usuario_link = msg_orig.reply_to_message.id
    else:
        # Si por alguna razón no hay referencia, usamos el chat general
        id_usuario_link = None
    # // ----------------------------------------------

    if calidad.startswith("html_"):
        idx = int(calidad.split("_")[1])
        if 'html_links_data' in datos and len(datos['html_links_data']) > idx:
            url_descarga = datos['html_links_data'][idx]['url']
            ckey = f"html_{idx}" 
        else: return
    else:
        ckey = "mp3" if calidad == "mp3" else calidad
    
    # // Cache
    if vid_id and vid_id in downloads_db and ckey in downloads_db[vid_id]:
        try:
            fid = downloads_db[vid_id][ckey]
            cap = f"🎬 **{datos.get('titulo','Video')}**\n✨ (Cache)"
            # Respondemos al link original
            if calidad == "mp3": await client.send_audio(chat_id, fid, caption=cap, reply_to_message_id=id_usuario_link)
            else: await client.send_video(chat_id, fid, caption=cap, reply_to_message_id=id_usuario_link)
            return
        except: pass

    try:
        tipo_accion = enums.ChatAction.UPLOAD_AUDIO if calidad == "mp3" else enums.ChatAction.UPLOAD_VIDEO
        accion_tarea = asyncio.create_task(mantener_accion(client, chat_id, tipo_accion))

        # // Enviamos el mensaje de estado RESPONDIENDO al link original
        status = await client.send_message(
            chat_id, 
            f"⏳ **Iniciando descarga...**\n📥 {calidad}",
            reply_to_message_id=id_usuario_link
        )
        
        loop = asyncio.get_running_loop()
        opts = {
            'outtmpl': f"dl_{chat_id}_{ts}.%(ext)s",
            'quiet': True, 'no_warnings': True, 'max_filesize': LIMIT_2GB,
            'http_headers': {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'},
            'progress_hooks': [YTProgress(status, loop)] 
        }

        if calidad == "mp3":
            opts.update({'format': 'bestaudio/best', 'postprocessors': [{'key': 'FFmpegExtractAudio','preferredcodec': 'mp3'}]})
        elif calidad.startswith("html_"):
            opts['format'] = 'best'
        else:
            if calidad.isdigit() or "x" in calidad: 
                 h = calidad.split('x')[-1]
                 opts['format'] = f"bv*[height<={h}]+ba/b[height<={h}] / best"
            else: opts['format'] = 'best'
            opts['merge_output_format'] = 'mp4'

        if "eporner" in url_descarga: opts.update({'external_downloader': None, 'nocheckcertificate': True})
        elif "pornhub" in url_descarga: opts.update({'cookiefile': 'cookies_pornhub.txt', 'nocheckcertificate': True})
        else:
            c = sel_cookie(url_descarga)
            if c: opts['cookiefile'] = c
            if HAS_ARIA2 and not calidad.startswith("html_"): 
                opts.update({'external_downloader': 'aria2c', 'external_downloader_args': ['-x','16','-k','1M']})

        with yt_dlp.YoutubeDL(opts) as ydl:
            await loop.run_in_executor(None, lambda: ydl.download([url_descarga]))
        
        base = f"dl_{chat_id}_{ts}"
        if calidad == "mp3": final = f"{base}.mp3"
        else:
            for e in ['.mp4','.mkv','.webm']:
                if os.path.exists(base+e): 
                    final = base+e
                    break
        
        if not final or not os.path.exists(final):
            if status: await status.edit("❌ Error: Fallo descarga.")
            return
        
        if os.path.getsize(final) > LIMIT_2GB:
            os.remove(final)
            if status: await status.edit("❌ Error: > 2GB.")
            return

        if status: await status.edit("📝 **Procesando metadatos...**")
        w, h, dur = 0, 0, 0
        if calidad != "mp3":
            thumb = await get_thumb(final, chat_id, ts)
            w, h, dur = await get_meta(final)
        else:
            dur = await get_audio_dur(final)

        cap = ""
        if conf['meta']:
            t = datos.get('titulo','Video')
            if conf['lang'] == 'es': t = await traducir_texto(t)
            tags = [f"#{x.replace(' ','_')}" for x in (datos.get('tags') or [])[:10]]
            res_str = f"{w}x{h}" if w else "Audio"
            cap = f"🎬 **{t}**\n⚙️ {res_str} | ⏱ {time.strftime('%H:%M:%S', time.gmtime(dur))}\n{' '.join(tags)}"[:1024]

        res = None
        # // Al subir, especificamos reply_to_message_id para mantener el hilo
        if calidad == "mp3":
            res = await client.send_audio(
                chat_id, final, caption=cap, duration=dur, thumb=thumb, 
                progress=progreso, progress_args=(status, [time.time(),0], tipo_accion),
                reply_to_message_id=id_usuario_link
            )
        else:
            res = await client.send_video(
                chat_id, final, caption=cap, width=w, height=h, duration=dur, thumb=thumb, 
                progress=progreso, progress_args=(status, [time.time(),0], tipo_accion),
                reply_to_message_id=id_usuario_link
            )

        if res and vid_id and not calidad.startswith("html_"):
            if vid_id not in downloads_db: downloads_db[vid_id] = {}
            downloads_db[vid_id][ckey] = (res.audio or res.video).file_id
            guardar_db()

    except Exception as e:
        if status: await status.edit(f"❌ Error: {e}")
    finally:
        if accion_tarea: accion_tarea.cancel()
        for f in [final, thumb, f"dl_{chat_id}_{ts}.jpg"]:
            if f and os.path.exists(f):
                try: os.remove(f)
                except: pass
        if status:
            try: await status.delete()
            except: pass