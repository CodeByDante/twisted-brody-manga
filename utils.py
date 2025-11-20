import re
import os
import asyncio
from deep_translator import GoogleTranslator
from config import COOKIE_MAP

def format_bytes(size):
    if not size or size <= 0: return "0 B"
    power = 2**10
    n = 0
    power_labels = {0 : 'B', 1: 'KB', 2: 'MB', 3: 'GB'}
    while size > power and n < 3:
        size /= power
        n += 1
    return f"{size:.1f} {power_labels[n]}"

# // --- NUEVA FUNCIÓN: BARRA DE CARGA ---
def generar_barra(actual, total):
    # // Si no sabemos el total, devolvemos algo genérico
    if not total or total == 0: return "⏳ Procesando..."
    
    porcentaje = actual / total
    # // Creamos una barra de 10 bloques
    lleno = int(porcentaje * 10)
    # // Usamos caracteres especiales para que se vea bonito
    barra = "▓" * lleno + "░" * (10 - lleno)
    
    return f"[{barra}] {porcentaje*100:.1f}%"

def limpiar_url(url):
    if "youtube.com" in url or "youtu.be" in url:
        match = re.search(r'(?:v=|\/|shorts\/)([0-9A-Za-z_-]{11})', url)
        if match: return f"https://www.youtube.com/watch?v={match.group(1)}"
    if "eporner" in url:
        url = re.sub(r'https?://(es|de|fr|it)\.eporner\.com', 'https://www.eporner.com', url)
    return url.split("?")[0]

def sel_cookie(url):
    for k, v in COOKIE_MAP.items():
        if k in url and os.path.exists(v): return v
    return None

async def traducir_texto(texto):
    if not texto: return ""
    try:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, lambda: GoogleTranslator(source='auto', target='es').translate(texto))
    except: return texto