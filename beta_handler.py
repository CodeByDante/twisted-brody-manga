import asyncio
from pyrogram.types import InlineKeyboardMarkup, InlineKeyboardButton
from database import url_storage
from sniffer import detectar_video_real

# // -----------------------------------------------------------
# // MANEJADOR: INVESTIGACIÓN HTML -> LINKS DIRECTOS
# // -----------------------------------------------------------
async def iniciar_escaneo_html(client, callback_query):
    msg = callback_query.message
    cid = msg.chat.id
    
    d_storage = url_storage.get(cid)
    if not d_storage:
        return await callback_query.answer("⚠️ La sesión expiró.", show_alert=True)

    url_target = d_storage['url']
    
    await callback_query.answer("🚀 Iniciando Navegador JAV...")
    await msg.edit_text(
        f"🕵️ **Analizando sitio web...**\n"
        f"🔗 URL: `{url_target}`\n\n"
        f"🍪 Cookies: {'Sí' if 'jav' in url_target else 'No detectadas'}\n"
        f"⏳ _Esperando streams (10-15s)..._"
    )
    
    try:
        # Ejecutar Sniffer
        links_encontrados = await detectar_video_real(url_target, client, cid)
        
        # Crear teclado de enlaces directos
        botones_links = []
        reporte_texto = ""
        
        if links_encontrados:
            reporte_texto = "✅ **Enlaces Directos Encontrados:**\n_Usa IDM o 1DM para descargar_ 👇\n\n"
            
            # Limitamos a los 6 mejores enlaces para no saturar
            for i, link in enumerate(links_encontrados[:6]):
                calidad = link['quality']
                tipo = link['type']
                url_final = link['url']
                
                # Texto del botón
                texto_btn = f"⬇️ Descargar {calidad} ({tipo})"
                
                # Botón URL (Abre navegador externo)
                botones_links.append([InlineKeyboardButton(texto_btn, url=url_final)])
                
                # Opcional: Poner link en texto si es m3u8 para copiar fácil
                if 'm3u8' in url_final:
                    reporte_texto += f"🔹 **{calidad}:** `{url_final}`\n"

        else:
            reporte_texto = "❌ **No se capturaron enlaces de video.**\n_El sitio tiene protección fuerte o requiere captcha._"

        # Botón volver
        botones_links.append([InlineKeyboardButton("🔙 Volver / Cancelar", callback_data="cancel")])

        # Enviar resultado
        tit = d_storage.get('titulo', 'Resultado')
        await msg.edit_text(
            f"🎬 **{tit}**\n\n{reporte_texto}",
            reply_markup=InlineKeyboardMarkup(botones_links),
            disable_web_page_preview=True
        )

    except Exception as e:
        await msg.edit_text(
            f"❌ **Error Crítico:**\n`{str(e)}`", 
            reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("🔙 Cerrar", callback_data="cancel")]])
        )