import asyncio
import yt_dlp
from pyrogram import Client, filters
from pyrogram.types import InlineKeyboardMarkup, InlineKeyboardButton

from config import API_ID, API_HASH, BOT_TOKEN
from database import get_config, url_storage
from utils import limpiar_url, format_bytes
from sniffer import detectar_video_real
from downloader import procesar_descarga

app = Client("mi_bot_pro", api_id=API_ID, api_hash=API_HASH, bot_token=BOT_TOKEN, workers=16)

print("🚀 Bot Modular Iniciado (Links Normales)...")

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

    if data == "cancel": 
        await msg.delete()
        return

    if data.startswith("dl|"):
        d_storage = url_storage.get(cid)
        if not d_storage: return await q.answer("⚠️ Expirado", show_alert=True)
        await msg.delete() 
        await procesar_descarga(c, cid, d_storage['url'], data.split("|")[1], d_storage, msg)
        return

    if data == "menu|auto":
        await msg.edit_text("🤖 **Calidad Automática**", reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton("🔥 Máxima (Best)", callback_data="set_auto|max")],
            [InlineKeyboardButton("📉 Mínima (Worst)", callback_data="set_auto|min")],
            [InlineKeyboardButton("❌ Desactivar", callback_data="set_auto|off")],
            [InlineKeyboardButton("🔙 Volver", callback_data="menu|main")]
        ]))
        return

    if data == "menu|fixed":
        await msg.edit_text("📌 **Resolución Fija**", reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton("1080p", callback_data="set_q|1080"), InlineKeyboardButton("720p", callback_data="set_q|720")],
            [InlineKeyboardButton("480p", callback_data="set_q|480"), InlineKeyboardButton("360p", callback_data="set_q|360")],
            [InlineKeyboardButton("❌ Desactivar", callback_data="set_q|off")],
            [InlineKeyboardButton("🔙 Volver", callback_data="menu|main")]
        ]))
        return

    if "set_auto" in data:
        val = data.split("|")[1]
        conf['q_auto'] = None if val == "off" else val
        if val != "off": conf['q_fixed'] = None
        await msg.edit_text("⚙️ **Panel**", reply_markup=gen_kb(conf))
        return

    if "set_q" in data:
        val = data.split("|")[1]
        conf['q_fixed'] = None if val == "off" else val
        if val != "off": conf['q_auto'] = None
        await msg.edit_text("⚙️ **Panel**", reply_markup=gen_kb(conf))
        return

    if data == "menu|main":
        await msg.edit_text("⚙️ **Panel**", reply_markup=gen_kb(conf))
        return

    if data == "toggle|html": conf['html_mode'] = not conf['html_mode']
    elif data == "toggle|meta": conf['meta'] = not conf['meta']
    elif data == "toggle|lang": conf['lang'] = 'es' if conf['lang'] == 'orig' else 'orig'
    elif data == "toggle|fmt": conf['fmt'] = 'mp3' if conf['fmt'] == 'mp4' else 'mp4'

    await msg.edit_text("⚙️ **Panel**", reply_markup=gen_kb(conf))

@app.on_message(filters.text & (filters.regex("http") | filters.regex("www")))
async def analyze(c, m):
    cid = m.chat.id
    url = limpiar_url(m.text.strip())
    conf = get_config(cid)
    
    # // Respondemos haciendo Reply al usuario
    wait_msg = await m.reply("🔎 **Analizando...**", quote=True)
    
    btns = []
    html_links_data = []
    info = {}
    yt_dlp_error = None
    
    reporte_html = ""

    # // 1. FASE INVESTIGACIÓN HTML
    if conf['html_mode']:
        await wait_msg.edit("🕵️ **Investigación HTML...**")
        try:
            html_links_data = await detectar_video_real(url)
        except Exception as e: print(f"Investigación HTML: {e}")
        
        if html_links_data:
            reporte_html = "\n\n🕵️ **Enlaces Encontrados (Inv. HTML):**\n"
            for i, data in enumerate(html_links_data):
                # // Texto del Botón
                btn_txt = data['res']
                icon = "📺" if "m3u8" in data['url'] else "📥"
                btns.append([InlineKeyboardButton(f"{icon} {btn_txt}", callback_data=f"dl|html_{i}")])
                
                # // CAMBIO AQUÍ: Quitamos las comillas ` ` para que sea link normal
                reporte_html += f"🔹 **Opción {i+1}:** {data['url']}\n\n"

    # // 2. FASE YT-DLP
    try:
        opts = {'quiet':True, 'noplaylist':True, 'http_headers':{'User-Agent':'Mozilla/5.0'}}
        if "eporner" in url: opts['nocheckcertificate']=True
        
        info = await asyncio.get_running_loop().run_in_executor(None, lambda: yt_dlp.YoutubeDL(opts).extract_info(url, download=False))
        if 'entries' in info: info = info['entries'][0]
        
        formats = info.get('formats', [])
        unique_formats = {}
        
        for f in formats:
            w, h = f.get('width'), f.get('height')
            if not h or not w: continue
            res_key = f"{w}x{h}"
            sz = f.get('filesize') or f.get('filesize_approx') or 0
            if res_key not in unique_formats or sz > unique_formats[res_key]['size']:
                unique_formats[res_key] = {'size': sz, 'h': h, 'w': w}
        
        sorted_fmts = sorted(unique_formats.items(), key=lambda x: x[1]['h'], reverse=True)

        for res_key, data in sorted_fmts[:6]:
            sz_str = format_bytes(data['size'])
            w, h = data['w'], data['h']
            
            min_side = min(w, h)
            label = "LD"
            if min_side >= 2160: label = "4K"
            elif min_side >= 1440: label = "2K"
            elif min_side >= 1080: label = "FHD"
            elif min_side >= 720: label = "HD"
            elif min_side >= 480: label = "SD"
            
            icon = "🌟" if min_side >= 1080 else "📹"
            btn_txt = f"{icon} {w} x {h} ({sz_str}) {label}"
            btns.append([InlineKeyboardButton(btn_txt, callback_data=f"dl|{res_key}")])

        btns.append([InlineKeyboardButton("🎵 MP3 Audio", callback_data="dl|mp3")])

    except Exception as e: yt_dlp_error = str(e)

    btns.append([InlineKeyboardButton("❌ Cancelar", callback_data="cancel")])
    
    url_storage[cid] = {
        'url': url, 'id': info.get('id') if info else None, 
        'titulo': info.get('title', 'Video Detectado'),
        'tags': info.get('tags', []), 'html_links_data': html_links_data 
    }

    if not html_links_data and not info:
        msg_error = f"❌ **No se pudo detectar video.**\n\n"
        msg_error += f"⚠️ YT-DLP Error: `{str(yt_dlp_error)[:100]}...`\n\n"
        msg_error += "💡 **Solución:** Activa el botón **[🕵️ Inv. HTML]** en el menú /start y vuelve a enviar el enlace."
        await wait_msg.edit(msg_error)
        return

    await wait_msg.delete()
    tit = str(info.get('title', 'Resultado'))[:50]
    
    texto_final = f"🎬 **{tit}**{reporte_html}\n👇 **Selecciona Calidad:**"
    
    # // Enviamos mensaje con Reply y desactivamos preview para que no sature el chat
    await m.reply(texto_final, reply_markup=InlineKeyboardMarkup(btns), quote=True, disable_web_page_preview=True)

if __name__ == "__main__":
    app.run()