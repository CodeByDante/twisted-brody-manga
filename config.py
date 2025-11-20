import os
import shutil

# // -----------------------------------------
# // TUS CREDENCIALES DE TELEGRAM (API)
# // -----------------------------------------
API_ID = 33226415
API_HASH = "01999dae3e5348c7ab0dbcc6f7f4edc5"
BOT_TOKEN = "8584312169:AAHQjPutXzS6sCPQ-NxIKp_5GsmjmvI9TEw"

# // -----------------------------------------
# // MAPA DE COOKIES
# // Asigna un archivo de texto con cookies a cada sitio web
# // para poder descargar videos premium o +18.
# // -----------------------------------------
COOKIE_MAP = {
    # // Agregado para que lea las cookies que creaste
    'javxxx': 'cookies_jav.txt', 
    
    # // Otros sitios comunes
    'tiktok': 'cookies_tiktok.txt',
    'facebook': 'cookies_facebook.txt',
    'pornhub': 'cookies_pornhub.txt',
    'x.com': 'cookies_x.txt',
    'twitter': 'cookies_x.txt',
    'xvideos': 'cookies_xvideos.txt',
    'instagram': 'cookies_instagram.txt'
}

# // Archivo donde se guardan los FileID (Cache) para no resubir lo mismo
DB_FILE = 'descargas.json'

# // Limite de subida de Telegram (2 Gigabytes exactos)
LIMIT_2GB = 2000 * 1024 * 1024 

# // -----------------------------------------
# // VERIFICACIÓN DE SOFTWARE
# // Comprueba si el servidor tiene instalados ffmpeg y aria2c
# // -----------------------------------------
HAS_ARIA2 = shutil.which("aria2c") is not None
HAS_FFMPEG = shutil.which("ffmpeg") is not None