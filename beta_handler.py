import asyncio
from pyrogram.types import InlineKeyboardMarkup, InlineKeyboardButton
from database import url_storage
from sniffer import detectar_video_real

# // -----------------------------------------------------------
# // MANEJADOR DEL BOTÓN "INVESTIGACIÓN HTML" (BETA)
# // -----------------------------------------------------------
async def iniciar_escaneo_html(client, callback_query):
    msg = callback_query.message
    cid = msg.chat.id
    
    # 1. Verificar si el enlace sigue en memoria
    d_storage = url_storage.get(cid)
    if not d_storage:
        return await callback_query.answer("⚠️ La sesión expiró. Envía el enlace de nuevo.", show_alert=True)

    url_target = d_storage['url']
    
    # 2. Avisar al usuario que el proceso inició
    await callback_query.answer("🚀 Iniciando Navegador Espía... (20s aprox)")
    await msg.edit_text(
        f"🕵️ **Ejecutando Investigación HTML (Beta)...**\n"
        f"🔗 Analizando: `{url_target}`\n\n"
        f"📸 _El bot tomará capturas y probará clics automáticos..._\n"
        f"⏳ **Por favor espere...**"
    )
    
    try:
        # 3. Ejecutar el Sniffer (sniffer.py)
        # Le pasamos 'client' y 'cid' para que pueda enviar las fotos de debug
        html_links_data = await detectar_video_real(url_target, client, cid)
        
        # 4. Actualizar la base de datos temporal con los nuevos resultados
        d_storage['html_links_data'] = html_links_data
        
        # 5. Construir los nuevos botones
        # Recuperamos los botones originales de YT-DLP (si había)
        old_markup = d_storage.get('original_markup', [])
        new_btns = []
        reporte_extra = ""
        
        if html_links_data:
            reporte_extra = "\n\n✅ **Resultados de Investigación HTML:**\n"
            for i, res in enumerate(html_links_data):
                btn_txt = res['res'] # Ya viene formateado (Ej: 1080x1920 (Stream)...)
                icon = "📺" if "m3u8" in res['url'] else "📥"
                
                # Agregamos el botón al inicio de la lista
                new_btns.append([InlineKeyboardButton(f"{icon} {btn_txt}", callback_data=f"dl|html_{i}")])
                
                # Agregamos texto al reporte
                reporte_extra += f"🔹 {btn_txt}\n"
        else:
            reporte_extra = "\n\n⚠️ **El escaneo no encontró resultados nuevos.**"

        # 6. Fusionar botones (Nuevos + Antiguos)
        # Si old_markup es un objeto InlineKeyboardMarkup, sacamos su lista .inline_keyboard
        lista_antigua = old_markup.inline_keyboard if hasattr(old_markup, 'inline_keyboard') else old_markup
        if not isinstance(lista_antigua, list): lista_antigua = []
        
        final_keyboard = new_btns + lista_antigua
        
        # Asegurar botón cancelar
        if not any("cancel" in b.callback_data for row in final_keyboard for b in row):
            final_keyboard.append([InlineKeyboardButton("❌ Cancelar", callback_data="cancel")])

        # 7. Mostrar resultado final
        tit = d_storage.get('titulo', 'Video')
        await msg.edit_text(
            f"🎬 **{tit}** (Actualizado)\n{reporte_extra}\n👇 **Selecciona Calidad:**",
            reply_markup=InlineKeyboardMarkup(final_keyboard)
        )

    except Exception as e:
        print(f"Error en Beta Handler: {e}")
        await msg.edit_text(
            f"❌ **Error en el Módulo Beta:**\n`{str(e)}`", 
            reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("🔙 Volver", callback_data="cancel")]])
        )