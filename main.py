import asyncio
import yt_dlp
from pyrogram import Client, filters
from pyrogram.types import InlineKeyboardMarkup, InlineKeyboardButton

from config import API_ID, API_HASH, BOT_TOKEN, COOKIE_MAP
from database import get_config, url_storage
from utils import limpiar_url, format_bytes, sel_cookie
from downloader import procesar_descarga
from beta_handler import iniciar_escaneo_html 

app = Client("mi_bot_pro", api_id=API_ID, api_hash=API_HASH, bot_token=BOT_TOKEN, workers=16)

# LISTA SITIOS RÁPIDOS
SITIOS_RAPIDOS = [
    'tiktok.com', 'douyin.com', 'facebook.com', 'fb.watch', 'fb.com', 
    'twitter.com', 'x.com', 'instagram.com', 'youtube.com', 'youtu.be', 
    'twitch.tv', 'reddit.com'
]

def estimar_peso(duration, height):
    if not duration: return 0
    bitrate = 1000 
    if height >= 1080: bitrate = 4500
    elif height >= 720: bitrate = 2500
    return int((bitrate * 1024 * duration) / 8)

def gen_kb(conf):
    c_html = "🟢" if conf['html_mode'] else "🔴"
    c_meta = "🟢" if conf['meta'] else "🔴"
    s_auto = "Off"
    if conf['q_auto'] == 'max': s_auto = "Best"
    elif conf['q_auto'] == 'min': s_auto = "Worst"
    s_fixed = f"{conf['q_fixed']}p" if conf['q_fixed'] else "Off"

    return InlineKeyboardMarkup([
        [InlineKeyboardButton(f"🕵️ Inv. HTML: {c_html}", callback_data="toggle|html"),
         InlineKeyboardButton(f"📝 Metadatos: {c_meta}", callback_data="toggle|meta")],
        [InlineKeyboardButton(f"🤖 Auto: {s_auto}", callback_data="menu|auto"),
         InlineKeyboardButton(f"📌 Fija: {s_fixed}", callback_data="menu|fixed")],
        [InlineKeyboardButton(f"🌎 Lang: {conf['lang'].upper()}", callback_data="toggle|lang"),
         InlineKeyboardButton(f"🎵 Fmt: {conf['fmt'].upper()}", callback_data="toggle|fmt")]
    ])

@app.on_message(filters.command("start"))
async def start(c, m):
    await m.reply_text("⚙️ **Configuración Bot Pro**", reply_markup=gen_kb(get_config(m.chat.id)))

@app.on_callback_query()
async def cb(c, q):
    data = q.data
    msg = q.message
    cid = msg.chat.id
    conf = get_config(cid)

    if data == "cancel": await msg.delete(); return

    if data.startswith("dl|"):
        d_storage = url_storage.get(cid)
        if not d_storage: return await q.answer("⚠️ Expirado", show_alert=True)
        await procesar_descarga(c, cid, d_storage['url'], data.split("|")[1], d_storage, msg)
        return

    if data == "run_beta_sniffer":
        await iniciar_escaneo_html(c, q)
        return

    # ... (Lógica de menús configuración igual que antes) ...
    # ... Copia tus menús de configuración aquí ...
    if data == "menu|auto":
        await msg.edit_text("🤖 **Calidad Automática**", reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton("🔥 Máxima (Best)", callback_data="set_auto|max")],
            [InlineKeyboardButton("📉 Mínima (Worst)", callback_data="set_auto|min")],
            [InlineKeyboardButton("❌ Desactivar", callback_data="set_auto|off")],
            [InlineKeyboardButton("🔙 Volver", callback_data="menu|main")]
        ]))
        return

    if "set_auto" in data:
        val = data.split("|")[1]
        conf['q_auto'] = None if val == "off" else val
        if val != "off": conf['q_fixed'] = None
        await msg.edit_text("⚙️ **Panel**", reply_markup=gen_kb(conf))
        return

    if data == "menu|main":
        await msg.edit_text("⚙️ **Panel**", reply_markup=gen_kb(conf))
        return

@app.on_message(filters.text & (filters.regex("http") | filters.regex("www")))
async def analyze(c, m):
    cid = m.chat.id
    url = limpiar_url(m.text.strip())
    conf = get_config(cid)
    
    wait_msg = await m.reply("🔎 **Analizando...**", quote=True)
    
    btns = []
    info = {}
    
    try:
        opts = {'quiet':True, 'noplaylist':True, 'http_headers':{'User-Agent':'Mozilla/5.0'}}
        if "eporner" in url: opts['nocheckcertificate']=True
        c_path = sel_cookie(url)
        if c_path: opts['cookiefile'] = c_path

        info = await asyncio.get_running_loop().run_in_executor(None, lambda: yt_dlp.YoutubeDL(opts).extract_info(url, download=False))
        if 'entries' in info: info = info['entries'][0]
        
        formats = info.get('formats', [])
        unique_formats = {}
        duration = info.get('duration', 0)

        for f in formats:
            w, h = f.get('width'), f.get('height')
            if not h or not w: continue
            res_key = f"{w}x{h}"
            sz = f.get('filesize') or f.get('filesize_approx') or 0
            if res_key not in unique_formats or sz > unique_formats[res_key]['size']:
                unique_formats[res_key] = {'size': sz, 'h': h, 'w': w}
        
        sorted_fmts = sorted(unique_formats.items(), key=lambda x: x[1]['h'], reverse=True)

        for res_key, data in sorted_fmts[:6]:
            size_val = data['size']
            w, h = data['w'], data['h']
            if size_val <= 0 and duration > 0: size_val = estimar_peso(duration, h)
            sz_str = format_bytes(size_val)
            if size_val == 0: sz_str = "Stream"
            label = "LD"
            if min(w,h) >= 1080: label = "FHD"
            elif min(w,h) >= 720: label = "HD"
            approx = "~" if data['size'] <= 0 else ""
            icon = "🌟" if min(w,h) >= 1080 else "📹"
            btns.append([InlineKeyboardButton(f"{icon} {w} x {h} ({approx}{sz_str}) {label}", callback_data=f"dl|{res_key}")])

        btns.append([InlineKeyboardButton("🎵 MP3 Audio", callback_data="dl|mp3")])

    except Exception: pass

    # BOTÓN BETA
    if conf['html_mode'] or not btns:
        btns.append([InlineKeyboardButton("🧪 Escanear HTML (Beta) 🕵️", callback_data="run_beta_sniffer")])
    btns.append([InlineKeyboardButton("❌ Cancelar", callback_data="cancel")])
    
    url_storage[cid] = {
        'url': url, 'id': info.get('id'), 'titulo': info.get('title', 'Video'),
        'tags': info.get('tags', []), 'html_links_data': [], 'original_markup': btns
    }

    # // LÓGICA DE AUTO-DESCARGA (AQUÍ SE DECIDE)
    target_quality = None
    
    # 1. MODO AUTO (MAX / MIN)
    if conf['q_auto']: 
        target_quality = 'best' if conf['q_auto'] == 'max' else 'worst'
    
    # 2. MODO FIJO (Ej: 1080p)
    elif conf['q_fixed']:
        wanted_h = int(conf['q_fixed'])
        for res_key, data in sorted_fmts:
            if data['h'] == wanted_h: target_quality = res_key; break

    # Si hay info (enlace valido) y hay orden de auto-descarga, EJECUTAMOS
    if target_quality and info:
        await wait_msg.edit(f"⚡ **Auto-Descarga Activada**\n🎯 Objetivo: `{target_quality}`")
        await procesar_descarga(c, cid, url, target_quality, url_storage[cid], wait_msg)
        return

    if not btns and not info and not conf['html_mode']:
        await wait_msg.edit(f"❌ Error: No se detectó nada.\n💡 Activa 'Botón Beta' en /start.")
        return
    
    tit = str(info.get('title', 'Resultado'))[:50]
    await wait_msg.delete()
    await m.reply(f"🎬 **{tit}**\n👇 **Selecciona Calidad:**", reply_markup=InlineKeyboardMarkup(btns), quote=True)

if __name__ == "__main__":
    app.run()