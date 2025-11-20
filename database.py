import json
import os
from config import DB_FILE

# // Variables en memoria
url_storage = {}
user_config = {}
downloads_db = {}

def cargar_db():
    global downloads_db
    if os.path.exists(DB_FILE):
        try:
            with open(DB_FILE, 'r') as f: downloads_db = json.load(f)
        except: downloads_db = {}

def guardar_db():
    try:
        with open(DB_FILE, 'w') as f: json.dump(downloads_db, f, indent=4)
    except: pass

def get_config(chat_id):
    if chat_id not in user_config:
        user_config[chat_id] = {
            'lang': 'orig', 
            'fmt': 'mp4',
            'q_fixed': None, 
            'q_auto': None, 
            'meta': True,
            
            # // CAMBIO AQUÍ: Ahora empieza APAGADO (False)
            'html_mode': False 
        }
    return user_config[chat_id]

cargar_db()