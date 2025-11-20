import asyncio
import re
import os
import time
from playwright.async_api import async_playwright
from config import COOKIE_MAP

# // -----------------------------------------
# // UTILS
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

def extract_quality(text):
    # Busca 1080p, 720p, etc.
    match = re.search(r'(\d{3,4})[pP]', text)
    if match: return f"{match.group(1)}p"
    
    # Busca resoluciones tipo 1920x1080
    match_dim = re.search(r'(\d{3,4})[xX](\d{3,4})', text)
    if match_dim:
        h = int(match_dim.group(2))
        return f"{h}p"
    
    return "UNK"

# // -----------------------------------------
# // LÓGICA JAV SNIFFER
# // -----------------------------------------
async def detectar_video_real(url, client=None, chat_id=None):
    print(f"🕵️ JAV Sniffer iniciado en: {url}")
    detected_links = []
    seen_urls = set()
    
    async with async_playwright() as p:
        # 1. ABRIR CHROMIUM HEADLESS
        browser = await p.chromium.launch(
            headless=True, 
            args=[
                '--no-sandbox',
                '--disable-web-security', # Para leer iframes de video
                '--disable-features=IsolateOrigins,site-per-process',
                '--disable-blink-features=AutomationControlled',
                '--mute-audio',
                '--window-size=1920,1080' # Resolución PC para que cargue HD
            ]
        )
        
        # Contexto de PC Windows para evitar versiones móviles recortadas
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
            viewport={'width': 1920, 'height': 1080},
            locale='es-ES'
        )

        # 2. CARGA DE COOKIES (JAVXXX y otros)
        cookie_injected = False
        for key, cookie_file in COOKIE_MAP.items():
            if key in url:
                clist = parse_cookie_file(cookie_file)
                if clist: 
                    try: 
                        await context.add_cookies(clist)
                        cookie_injected = True
                        print(f"🍪 Cookies de {key} inyectadas.")
                    except: pass
                break
        
        page = await context.new_page()

        # Función Debug
        async def enviar_captura(texto):
            if client and chat_id:
                try:
                    path = f"debug_{chat_id}_{int(time.time())}.jpg"
                    await page.screenshot(path=path)
                    await client.send_photo(chat_id, path, caption=f"📸 **Debug:** {texto}")
                    os.remove(path)
                except: pass

        # Bloqueo de Ads para acelerar y limpiar clicks
        await page.route("**/*", lambda route: route.abort() if any(x in route.request.url for x in ['googleads', 'doubleclick', 'adservice', 'banner', 'pop', 'juicy']) else route.continue_())

        # 6. CAPTURA DE PETICIONES DE RED
        async def handle_request(request):
            r_url = request.url
            
            # Filtro específico para JAV/Streaming
            keywords = ['.m3u8', '.mp4', '.ts', 'master', 'playlist', 'chunk', 'segment', 'video']
            if not any(k in r_url.lower() for k in keywords): return
            
            # Ignorar basura
            if any(x in r_url.lower() for x in ['.png', '.jpg', '.css', '.js', 'favicon']): return
            if r_url in seen_urls: return
            
            # Priorizar Master y Playlists
            priority = 0
            label = "Video"
            
            if '.m3u8' in r_url:
                label = "HLS Stream"
                priority = 2
            elif 'master' in r_url:
                label = "Master List"
                priority = 3
            elif '.mp4' in r_url:
                label = "MP4 Directo"
                priority = 1
            
            # 7. DETECTAR CALIDAD EN URL
            quality = extract_quality(r_url)
            if quality == "UNK": 
                # Si no dice calidad, asumimos HD por defecto en JAVs
                quality = "Auto/HD"

            seen_urls.add(r_url)
            
            detected_links.append({
                'url': r_url,
                'quality': quality,
                'type': label,
                'priority': priority
            })
            print(f"✅ Link capturado: {quality} - {r_url[:40]}...")

        page.on("request", handle_request)

        try:
            # 3. ENTRAR A LA URL
            print("⏳ Cargando página...")
            await page.goto(url, wait_until="domcontentloaded", timeout=60000)
            await asyncio.sleep(5) # Esperar a que carguen los scripts del player

            if cookie_injected:
                await enviar_captura("Página cargada (Con Cookies).")
            else:
                await enviar_captura("Página cargada (Sin Cookies).")

            # 4. CLICK AUTOMÁTICO EN PLAY O VIDEO
            print("▶️ Buscando reproductor para dar Play...")
            
            # Estrategia de Clic Masivo en Elementos de Video
            await page.evaluate("""() => {
                // 1. Borrar Iframes de publicidad primero
                document.querySelectorAll('iframe').forEach(i => {
                    if (i.src.includes('ad') || i.src.includes('banner')) i.remove();
                });

                // 2. Click en etiquetas de video
                const vids = document.querySelectorAll('video');
                vids.forEach(v => {
                    v.muted = true;
                    v.click(); // Clic fisico
                    v.play().catch(e => {}); // Play por codigo
                });

                // 3. Click en botones comunes de JAV Players
                const selectors = [
                    '.vjs-big-play-button', 
                    '.play', '.start', 
                    'div[id*="player"]', 
                    '.cover', '.overlay'
                ];
                
                selectors.forEach(sel => {
                    document.querySelectorAll(sel).forEach(el => {
                        if(el.offsetWidth > 20) el.click();
                    });
                });
            }""")

            # Clic Físico Central (Por si acaso)
            if page.viewport_size:
                w = page.viewport_size['width']
                h = page.viewport_size['height']
                await page.mouse.click(w/2, h/2)
                await asyncio.sleep(0.5)
                await page.mouse.click(w/2, h/2 + 50)

            await enviar_captura("Clics realizados. Escuchando red...")

            # 5. ESPERA DE 10-15 SEGUNDOS
            print("⏳ Esperando streams (12s)...")
            # Esperamos un buen rato para que carguen los segmentos .ts o el m3u8
            for _ in range(12):
                await asyncio.sleep(1)
                # Si ya encontramos un Master, podemos salir antes para ser más rápidos
                if any(d['priority'] == 3 for d in detected_links):
                    print("⚡ Master encontrado. Saliendo temprano.")
                    break

        except Exception as e:
            print(f"⚠️ Error Sniffer: {e}")
            await enviar_captura(f"Error: {e}")
        finally:
            await browser.close()

    # Ordenar: Primero los Master, luego HLS, luego MP4, luego TS
    return sorted(detected_links, key=lambda x: x['priority'], reverse=True)