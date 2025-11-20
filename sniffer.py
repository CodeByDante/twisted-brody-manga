import asyncio
import re
import os
import time
from playwright.async_api import async_playwright
from config import COOKIE_MAP

# // UTILS
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

# // --- FORMATEADOR INTELIGENTE ---
def generar_titulo_boton(url, size, is_hls=False):
    # 1. Resolución
    w, h = "?", "?"
    match_dim = re.search(r'(\d{3,4})[xX](\d{3,4})', url)
    match_p = re.search(r'(\d{3,4})[pP]', url)
    
    if match_dim:
        w, h = match_dim.group(1), match_dim.group(2)
    elif match_p:
        h_val = int(match_p.group(1))
        h = str(h_val)
        w = str(int(h_val * 1.777))
    
    # 2. Etiqueta
    label = "UNK"
    try:
        h_int = int(h)
        if h_int >= 1080: label = "FHD"
        elif h_int >= 720: label = "HD"
        elif h_int >= 480: label = "SD"
        else: label = "LD"
    except: pass

    # 3. Lógica de Peso (FIX)
    if is_hls or '.m3u8' in url:
        sz_str = "Stream" 
        label = f"HLS {label}"
    elif size > 0:
        sz_str = format_bytes_simple(size)
    else:
        # Si no sabemos el peso y no es HLS, es un link directo
        sz_str = "Link"

    return f"{w} x {h} ({sz_str}) {label}"

# // -----------------------------------------
# // SNIFFER
# // -----------------------------------------
async def detectar_video_real(url, client=None, chat_id=None):
    print(f"🕵️ Sniffer (Fix Peso) en: {url}")
    detected_videos = []
    seen_urls = set()
    video_found_event = asyncio.Event()

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True, 
            args=['--no-sandbox', '--disable-web-security', '--disable-features=IsolateOrigins,site-per-process', '--mute-audio', '--window-size=1920,1080']
        )
        
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
            viewport={'width': 1920, 'height': 1080},
            locale='es-ES'
        )

        for key, cookie_file in COOKIE_MAP.items():
            if key in url:
                clist = parse_cookie_file(cookie_file)
                if clist: 
                    try: await context.add_cookies(clist)
                    except: pass
                break
        
        page = await context.new_page()

        async def enviar_captura(texto):
            if client and chat_id:
                try:
                    path = f"debug_{chat_id}_{int(time.time())}.jpg"
                    await page.screenshot(path=path)
                    await client.send_photo(chat_id, path, caption=f"📸 **Debug:** {texto}")
                    os.remove(path)
                except: pass

        await page.route("**/*", lambda route: route.abort() if any(x in route.request.url for x in ['googleads', 'doubleclick', 'adservice', 'banner', 'pop']) else route.continue_())

        async def handle_response(response):
            try:
                r_url = response.url
                if not any(x in r_url for x in ['.m3u8', '.mp4', 'master', 'hls', 'video']):
                    try:
                        ct = response.headers.get('content-type', '').lower()
                        if 'video' not in ct and 'mpegurl' not in ct: return
                    except: return

                if any(x in r_url.lower() for x in ['favicon', '.png', '.jpg']): return
                if r_url in seen_urls: return

                try:
                    headers = await response.all_headers()
                    clen = int(headers.get('content-length', 0))
                except: clen = 0

                is_hls = '.m3u8' in r_url or 'mpegurl' in response.headers.get('content-type', '')
                if not is_hls and clen < 2 * 1024 * 1024: return

                seen_urls.add(r_url)
                
                sort_size = clen
                if is_hls: sort_size += 99999999999

                res_txt = generar_titulo_boton(r_url, clen, is_hls)
                
                detected_videos.append({'url': r_url, 'size': sort_size, 'res': res_txt})
                video_found_event.set()
            except: pass

        page.on("response", handle_response)

        try:
            print("⏳ Cargando...")
            await page.goto(url, wait_until="domcontentloaded", timeout=60000)
            await asyncio.sleep(4) 

            async def escanear_html():
                found = False
                content = await page.content()
                regex = r'(https?://[^\s"\'<>]+?\.(?:m3u8|mp4)[^\s"\'<>]*)'
                for match in re.findall(regex, content):
                    clean = match.replace('\\/', '/')
                    if clean not in seen_urls and not any(x in clean for x in ['.jpg', '.png', '.css']):
                        seen_urls.add(clean)
                        # Aquí mandamos 0 de peso, la función pondrá "Link"
                        res_txt = generar_titulo_boton(clean, 0, '.m3u8' in clean)
                        detected_videos.append({'url': clean, 'size': 5000000000, 'res': res_txt})
                        found = True
                
                for frame in ([page] + page.frames):
                    try:
                        src = await frame.evaluate("() => { const v = document.querySelector('video'); return v ? v.src || v.currentSrc : null; }")
                        if src and src.startswith('http') and src not in seen_urls:
                            seen_urls.add(src)
                            res_txt = generar_titulo_boton(src, 0, '.m3u8' in src)
                            detected_videos.append({'url': src, 'size': 6000000000, 'res': res_txt})
                            found = True
                    except: pass
                return found

            html_found = await escanear_html()

            if not html_found and len(detected_videos) == 0:
                await enviar_captura("⚠️ Buscando botón Play...")
                
                # Click center
                async def click_play_area():
                    best_target = await page.evaluate("""() => {
                        let maxArea = 0;
                        let bestRect = null;
                        const candidates = document.querySelectorAll('video, iframe, canvas, .player, #player');
                        candidates.forEach(el => {
                            const r = el.getBoundingClientRect();
                            const area = r.width * r.height;
                            if (area > maxArea && r.width > 300) {
                                maxArea = area;
                                bestRect = { x: r.x, y: r.y, width: r.width, height: r.height };
                            }
                        });
                        return bestRect;
                    }""")

                    if best_target:
                        cx = best_target['x'] + best_target['width'] / 2
                        cy = best_target['y'] + best_target['height'] / 2
                        await page.mouse.click(cx, cy)
                        await asyncio.sleep(0.5)
                        await page.mouse.click(cx, cy)
                    else:
                        if page.viewport_size:
                            await page.mouse.click(page.viewport_size['width']/2, page.viewport_size['height']/2)

                await click_play_area()

                start_wait = time.time()
                while time.time() - start_wait < 20:
                    if video_found_event.is_set(): break
                    await escanear_html()
                    await asyncio.sleep(1)

        except Exception as e: print(f"Error: {e}")
        finally: await browser.close()

    return sorted(detected_videos, key=lambda x: x['size'], reverse=True)