import os
import requests
import json

def fetch_babbitt_dataset():
    print("⏳ Consultando API de Figshare para el dataset de Babbitt et al. (2020)...")
    article_id = "11306792"
    url = f"https://api.figshare.com/v2/articles/{article_id}"
    
    try:
        response = requests.get(url, timeout=15)
        if response.status_code == 200:
            data = response.json()
            os.makedirs("raw_data", exist_ok=True)
            print(f"✅ Artículo encontrado: {data.get('title')}")
            
            # Buscar archivos adjuntos
            files = data.get("files", [])
            print(f"📦 Se encontraron {len(files)} archivos en el repositorio de Figshare.")
            
            for file_info in files:
                file_name = file_info.get("name")
                download_url = file_info.get("download_url")
                
                # Descargar solo los archivos clave o el primer Excel para demostración
                if "Excel" in file_name or ".xlsx" in file_name or ".zip" in file_name:
                    print(f"📥 Descargando {file_name}...")
                    file_response = requests.get(download_url, stream=True)
                    dest_path = os.path.join("raw_data", file_name)
                    
                    with open(dest_path, "wb") as f:
                        for chunk in file_response.iter_content(chunk_size=8192):
                            if chunk:
                                f.write(chunk)
                    print(f"💾 Guardado en: {dest_path}")
        else:
            print(f"⚠️ Error al consultar Figshare: HTTP {response.status_code}")
    except Exception as e:
        print(f"❌ Error durante la descarga: {e}")

def fetch_ifixit_sample():
    print("⏳ Descargando estructura de referencia del MyFixit Dataset desde GitHub...")
    # Descargar un archivo de ejemplo del MyFixit Dataset de GitHub
    url = "https://raw.githubusercontent.com/rub-ksv/MyFixit-Dataset/master/data/raw/manuals.json"
    os.makedirs("raw_data", exist_ok=True)
    
    try:
        response = requests.get(url, stream=True, timeout=15)
        if response.status_code == 200:
            dest_path = os.path.join("raw_data", "ifixit_manuals_sample.json")
            with open(dest_path, "wb") as f:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
            print(f"💾 Guardado iFixit Manuals Sample en: {dest_path}")
        else:
            print(f"⚠️ No se pudo descargar el sample de iFixit: HTTP {response.status_code}")
    except Exception as e:
        print(f"❌ Error al descargar iFixit: {e}")

if __name__ == "__main__":
    fetch_babbitt_dataset()
    fetch_ifixit_sample()
