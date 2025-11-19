import requests
import re
import http.cookiejar

# Nombre de tu archivo de cookies (debe estar en la misma carpeta)
COOKIES_FILE = 'cookies.txt'

def get_session_with_cookies():
    """
    Crea una sesión de navegador cargando tus cookies.txt.
    Es vital para descargar imágenes de FB o Twitter +18.
    """
    session = requests.Session()
    session.headers.update({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.google.com/'
    })
    
    try:
        # Intenta cargar cookies formato Netscape/Mozilla
        cj = http.cookiejar.MozillaCookieJar(COOKIES_FILE)
        cj.load(ignore_discard=True, ignore_expires=True)
        session.cookies = cj
    except Exception as e:
        print(f"⚠️ utils_img: No se cargaron cookies ({e}). Usando modo anónimo.")
    
    return session

def resolver_redirect(url, session):
    try:
        # Sigue redirecciones para enlaces cortos (pin.it, t.co, etc)
        r = session.head(url, allow_redirects=True, timeout=10)
        return r.url
    except:
        return url

# --- SCRAPERS INDIVIDUALES ---

def _scraper_x_twitter(url, session):
    # Usa vxtwitter API para obtener info limpia de JSON
    clean_url = url.split('?')[0]
    api_url = clean_url.replace("x.com", "api.vxtwitter.com").replace("twitter.com", "api.vxtwitter.com")
    
    try:
        r = session.get(api_url, timeout=10)
        if r.status_code != 200: return None, None, []
        
        data = r.json()
        tit = f"{data.get('user_name', 'X')} (@{data.get('user_screen_name', 'user')})"
        desc = data.get('text', '')
        
        imgs = []
        if 'media_extended' in data:
            for m in data['media_extended']:
                if m['type'] == 'image':
                    imgs.append(m['url'])
        return tit, desc, imgs
    except: return None, None, []

def _scraper_pinterest(url, session):
    try:
        if "pin.it" in url:
            url = resolver_redirect(url, session)
            
        r = session.get(url, timeout=10)
        html = r.text
        
        tit = "Pinterest"
        match_t = re.search(r'<title>(.*?)</title>', html)
        if match_t: tit = match_t.group(1).replace(" | Pinterest", "")
        
        imgs = []
        # Busca og:image
        match_img = re.search(r'<meta property="og:image" content="([^"]+)"', html)
        if match_img:
            raw = match_img.group(1)
            # Forzar calidad original reemplazando 236x/474x/etc por originals
            hd = re.sub(r'/\d+x/', '/originals/', raw)
            imgs.append(hd)
            
        return tit, "", imgs
    except: return None, None, []

def _scraper_facebook(url, session):
    try:
        # Facebook es complejo, intentamos sacar la og:image principal
        r = session.get(url, timeout=10)
        html = r.text
        
        tit = "Facebook"
        desc = ""
        imgs = []
        
        match_img = re.search(r'<meta property="og:image" content="([^"]+)"', html)
        if match_img:
            clean_url = match_img.group(1).replace("&amp;", "&")
            imgs.append(clean_url)
            
        match_desc = re.search(r'<meta property="og:description" content="([^"]+)"', html)
        if match_desc: desc = match_desc.group(1)
        
        return tit, desc, imgs
    except: return None, None, []

# --- FUNCIÓN MAESTRA ---

def obtener_imagenes(url):
    """
    Detecta el sitio y devuelve (título, descripción, [lista_urls])
    """
    session = get_session_with_cookies()
    
    if "x.com" in url or "twitter.com" in url:
        return _scraper_x_twitter(url, session)
    
    elif "pinterest" in url or "pin.it" in url:
        return _scraper_pinterest(url, session)
    
    elif "facebook.com" in url or "fb.watch" in url:
        return _scraper_facebook(url, session)
        
    # Si quieres agregar Instagram en el futuro, iría aquí
    
    return None, None, []