import asyncio
import re
import os
import random
from playwright.async_api import async_playwright
from config import COOKIE_MAP

# // -----------------------------------------
# // UTILIDADES
# // -----------------------------------------
def parse_cookie_file(file_path):
    cookies = []
    if not os.path.exists(file_path): return []
    with open(file_path, 'r') as f:
        for line in f:
            if line.startswith('#') or not line.strip(): continue
            parts = line.strip().split('\t')
            if len(parts) >= 7:
                cookies.append({
                    'domain': parts[0], 'path': parts[2], 'secure': parts[3] == 'TRUE',
                    'expires': int(parts[4]) if parts[4].isdigit() else 0, 'name': parts[5], 'value': parts[6]
                })
    return cookies

def format_bytes_simple(size):
    if not size or size <= 0: return "N/A"
    power = 2**10
    n = 0
    power_labels = {0 : 'B', 1: 'KB', 2: 'MB', 3: 'GB'}
    while size > power and n < 3:
        size /= power
        n += 1
    return f"{size:.1f} {power_labels[n]}"

# // -----------------------------------------
# // LÓGICA DE SIMULACIÓN DE USUARIO (CPU)
# // -----------------------------------------
async def detectar_video_real(url):
    print(f"🕵️ Sniffer (Simulación Humana Doble Clic) en: {url}")
    detected_videos = []
    seen_urls = set()

    async with async_playwright() as p:
        # // 1. Configuración de Navegador DE ESCRITORIO (Windows)
        browser = await p.chromium.launch(
            headless=True, # Pon False si quieres VER la ventana (solo en tu PC, no servidor)
            args=[
                '--no-sandbox',
                '--disable-web-security',
                '--disable-features=IsolateOrigins,site-per-process',
                '--disable-blink-features=AutomationControlled', # Oculta que es un bot
                '--mute-audio',
                '--window-size=1920,1080',
                '--start-maximized'
            ]
        )
        
        # // Contexto persistente
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            viewport={'width': 1920, 'height': 1080},
            device_scale_factor=1,
            locale='es-ES',
            timezone_id='America/Lima'
        )

        # // Cargar Cookies
        for key, cookie_file in COOKIE_MAP.items():
            if key in url:
                clist = parse_cookie_file(cookie_file)
                if clist: 
                    try: await context.add_cookies(clist)
                    except: pass
                break
        
        page = await context.new_page()

        # // 2. LISTENER DE RED
        async def handle_response(response):
            try:
                r_url = response.url
                
                # Validar extensiones multimedia
                is_media = any(x in r_url for x in ['.m3u8', '.mp4', 'master', 'hls', 'video', '.ts'])
                
                # Validar Content-Type
                try:
                    ct = response.headers.get('content-type', '').lower()
                    if 'video' in ct or 'mpegurl' in ct: is_media = True
                except: pass

                if not is_media: return
                if any(x in r_url.lower() for x in ['favicon', '.png', '.jpg', '.css', '.js', 'thumb', 'preview']): return
                if r_url in seen_urls: return

                # Obtener tamaño
                try:
                    headers = await response.all_headers()
                    clen = int(headers.get('content-length', 0))
                except: clen = 0

                # Filtro anti-GIF (menos de 2MB en MP4 se ignora, m3u8 siempre pasa)
                is_hls = '.m3u8' in r_url or 'mpegurl' in ct
                if not is_hls and clen < 2 * 1024 * 1024: return

                seen_urls.add(r_url)
                
                # Formato visual
                sz = format_bytes_simple(clen)
                if is_hls: 
                    tipo = "Stream HLS"
                    clen += 99999999999 # Prioridad
                else: 
                    tipo = "Video MP4"

                w, h = "?", "?"
                match = re.search(r'(\d{3,4})[xXpP](\d{3,4})?', r_url)
                if match: w = match.group(1)

                label = "UNK"
                try: 
                    if int(w) >= 720 or int(h) >= 720: label = "HD"
                except: pass

                res = f"{w} x {h} ({sz}) [{tipo}] {label}"
                detected_videos.append({'url': r_url, 'size': clen, 'res': res})
                print(f"✅ RED: {r_url[:60]}...")

            except: pass

        page.on("response", handle_response)

        try:
            print("⏳ Cargando página como PC...")
            await page.goto(url, wait_until="domcontentloaded", timeout=60000)
            await asyncio.sleep(3)

            # // -------------------------------------------------
            # // 3. RUTINA DE INTERACCIÓN HUMANA (DOBLE CLIC)
            # // -------------------------------------------------
            
            async def click_center():
                if page.viewport_size:
                    cx = page.viewport_size['width'] / 2
                    cy = page.viewport_size['height'] / 2
                    # Movimiento del mouse (humanizar)
                    await page.mouse.move(cx - 50, cy - 50)
                    await asyncio.sleep(0.2)
                    await page.mouse.move(cx, cy)
                    await asyncio.sleep(0.2)
                    await page.mouse.click(cx, cy)

            # CLICK 1: Quitar overlay / Publicidad
            print("🖱️ Clic 1: Enfocando reproductor / Quitando ads...")
            await click_center()
            
            # Esperar a que la publicidad pase o el sitio reaccione
            await asyncio.sleep(2.5)

            # CLICK 2: Darle Play real
            print("▶️ Clic 2: Forzando Play...")
            await click_center()

            # CLICK 3 (Seguridad): Buscar botones específicos
            print("🖱️ Buscando botones específicos en iframes...")
            for frame in page.frames:
                try:
                    await frame.evaluate("""() => {
                        const btns = document.querySelectorAll('.vjs-big-play-button, .play, .start, video');
                        btns.forEach(b => b.click());
                    }""")
                except: pass
            
            # // 4. ESPERA ACTIVA (BUFFERING)
            print("⏳ Esperando buffering del video...")
            await asyncio.sleep(8)

            # // 5. EXTRACCIÓN DIRECTA DEL DOM (PLAN B)
            # // Si la red falló, le preguntamos al navegador qué está reproduciendo
            print("💉 Extrayendo SRC desde el navegador...")
            
            async def extract_src(frame):
                try:
                    src = await frame.evaluate("""() => {
                        const v = document.querySelector('video');
                        if(v) return v.currentSrc || v.src;
                        return null;
                    }""")
                    if src and src.startswith('http') and src not in seen_urls:
                        seen_urls.add(src)
                        # Detectar si es blob (hay que convertirlo o ignorarlo, Playwright no descarga blobs facilmente)
                        # Pero si es http m3u8 lo guardamos
                        detected_videos.append({'url': src, 'size': 5000000000, 'res': '? x ? (DOM) [Video Tag] FOUND'})
                        print(f"✅ DOM: {src[:60]}...")
                except: pass
                
                for child in frame.child_frames:
                    await extract_src(child)

            await extract_src(page)
            for frame in page.frames:
                await extract_src(frame)

        except Exception as e:
            print(f"⚠️ Error Simulación: {e}")
        finally:
            await browser.close()

    return sorted(detected_videos, key=lambda x: x['size'], reverse=True)