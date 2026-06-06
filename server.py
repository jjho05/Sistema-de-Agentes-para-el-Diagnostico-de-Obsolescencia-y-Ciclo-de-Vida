import os
import json
import base64
import re
import random
from datetime import datetime
from typing import Optional
from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
import google.generativeai as genai
import chromadb
import pandas as pd
from sentence_transformers import SentenceTransformer
import urllib.request
import urllib.parse
from bs4 import BeautifulSoup

app = FastAPI(title="SADOC - Sistema de Agentes para el Diagnóstico de Obsolescencia y Ciclo de Vida", version="4.0")

# Permitir CORS para desarrollo local (incluyendo páginas abiertas por file://)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Servir archivos estáticos del frontend
app.mount("/assets", StaticFiles(directory="assets"), name="assets")
app.mount("/features", StaticFiles(directory="features"), name="features")
app.mount("/core", StaticFiles(directory="core"), name="core")

@app.get("/")
async def read_index():
    return FileResponse("index.html")

# Historial de Ensayos (Fotos Clasificadas de la Red)
history_file = os.path.join("data", "analysis_history.json")
analysis_history = []

# Crear carpeta data si no existe
os.makedirs("data", exist_ok=True)

if os.path.exists(history_file):
    try:
        with open(history_file, "r", encoding="utf-8") as f:
            analysis_history = json.load(f)
        print(f"📖 Historial cargado con {len(analysis_history)} ensayos registrados.")
    except Exception as e:
        print(f"⚠️ Error cargando historial: {e}")

def save_to_history(analysis: dict, image_data: Optional[str] = None):
    # carbonFootprint ahora viene directo del JSON del A-Agent
    carbon_footprint = analysis.get("carbonFootprint", "N/D")
    if carbon_footprint == "N/D" and "riamMapping" in analysis:
        reason = analysis.get("riamMapping", {}).get("physicalChemical", {}).get("reason", "")
        match = re.search(r"([\d\.]+)\s*kg", reason)
        if match:
            carbon_footprint = f"{match.group(1)} kg CO₂"
            
    history_entry = {
        "id": str(random.randint(100000, 999999)),
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "productName": analysis.get("productName", "Producto Desconocido"),
        "estimatedLifespan": analysis.get("estimatedLifespan", 0.0),
        "weakestLink": analysis.get("weakestLink", "N/D"),
        "reparabilityIndex": analysis.get("reparabilityIndex", {}),
        "carbonFootprint": carbon_footprint,
        "summary": analysis.get("summary", ""),
        "imageData": image_data
    }
    
    analysis_history.insert(0, history_entry)
    
    if len(analysis_history) > 50:
        analysis_history.pop()
        
    try:
        with open(history_file, "w", encoding="utf-8") as f:
            json.dump(analysis_history, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"⚠️ Error guardando historial: {e}")

def search_web_ddg(query: str, max_results: int = 5) -> list:
    print(f"🔍 [Search Agent] Buscando en la web: '{query}'...")
    try:
        url = 'https://lite.duckduckgo.com/lite/'
        data = urllib.parse.urlencode({'q': query}).encode('utf-8')
        req = urllib.request.Request(
            url,
            data=data,
            headers={
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        )
        with urllib.request.urlopen(req, timeout=8) as r:
            html = r.read()
        soup = BeautifulSoup(html, 'html.parser')
        links = soup.find_all('a', class_='result-link')
        snippets = soup.find_all('td', class_='result-snippet')
        
        results = []
        for i in range(min(len(links), len(snippets), max_results)):
            results.append({
                "title": links[i].get_text(strip=True),
                "url": links[i].get("href", ""),
                "snippet": snippets[i].get_text(strip=True)
            })
        print(f"✅ [Search Agent] Encontrados {len(results)} resultados de DuckDuckGo.")
        return results
    except Exception as e:
        print(f"⚠️ [Search Agent] Error en búsqueda DDG: {e}")
        return []

# Inicializar modelo de embeddings para ChromaDB
print("🧠 Cargando modelo de embeddings para RAG local...")
embedding_model = SentenceTransformer('all-MiniLM-L6-v2')

# Cargar base de datos vectorial ChromaDB
db_path = os.path.join(os.getcwd(), 'data', 'vector_db')
print(f"📁 Conectando a ChromaDB en: {db_path}")
db_client = chromadb.PersistentClient(path=db_path)

class AnalysisRequest(BaseModel):
    productName: str
    description: Optional[str] = ""
    imageData: Optional[str] = None

# Función auxiliar para decodificar base64 de imagen
def parse_base64_image(data_url: str):
    if not data_url or not data_url.startswith("data:image/"):
        return None, None
    try:
        header, encoded = data_url.split(",", 1)
        mime_type = header.split(";")[0].split(":")[1]
        image_bytes = base64.b64decode(encoded)
        return mime_type, image_bytes
    except Exception as e:
        print(f"❌ Error decodificando imagen: {e}")
        return None, None

# --- AGENTES DEL SISTEMA ---

# 1. V-Agent (Vision Investigator)
def run_v_agent(product_name: str, description: str, mime_type: str, image_bytes: bytes, api_key: str) -> dict:
    print("🤖 [V-Agent] Analizando entrada visual e identificando componentes...")
    genai.configure(api_key=api_key)
    
    # Usar modelo multimodal compatible
    model = genai.GenerativeModel('gemini-3.5-flash')
    
    prompt = """
    Analiza la imagen de este producto. Tu primera tarea es identificar la marca, el modelo específico (ej: iPhone 15, Nintendo Switch OLED, MacBook Pro M3, etc.) y la categoría general (ej: Smartphone, Consola de videojuegos, Laptop, Audífonos, etc.) de la manera más específica posible. Si ves un modelo conocido, indícalo detalladamente en lugar de usar un término genérico.
    
    Tu segunda tarea es identificar los componentes físicos visibles de este producto.
    Para cada componente detectado, especifica:
    1. Nombre del componente (ej: Pantalla de cristal, Carcasa trasera de titanio, Módulo de cámara, Conector USB-C, Batería, etc.).
    2. Material estimado (ej: Titanio, Vidrio Ceramic Shield, Plástico ABS, Cobre, Aluminio).
    3. Tipo de fijación/ensamblaje estimado (ej: Adhesivo, Tornillos Pentalobe, Clips de presión, Soldadura).
    
    Devuelve la información estrictamente en un formato JSON plano como el siguiente:
    {
      "detected_product": {
        "brand": "Marca identificada (ej: Apple, Sony)",
        "model": "Modelo específico (ej: iPhone 15 Pro, WH-1000XM4)",
        "category": "Categoría (ej: Smartphone, Audífonos)"
      },
      "visual_components": [
        {
          "name": "Nombre",
          "material": "Material",
          "assembly": "Fijación"
        }
      ]
    }
    No agregues introducciones ni explicaciones de Markdown, solo el JSON puro.
    """
    
    try:
        response = model.generate_content([
            prompt,
            {'mime_type': mime_type, 'data': image_bytes}
        ])
        
        # Limpiar salida
        text = response.text.strip()
        if text.startswith("```json"):
            text = text.replace("```json", "", 1).replace("```", "", 1).strip()
        elif text.startswith("```"):
            text = text.replace("```", "", 1).replace("```", "", 1).strip()
            
        result = json.loads(text)
        print(f"✅ [V-Agent] Componentes visuales extraídos: {len(result.get('visual_components', []))} | Detectado: {result.get('detected_product', {})}")
        return result
    except Exception as e:
        print(f"⚠️ [V-Agent] Error en análisis de visión: {e}. Continuando con análisis vacío.")
        return {"visual_components": [], "detected_product": None}


# 2. N-Agent (Normative & RAG Analyst)
def run_n_agent(product_name: str, description: str, visual_data: dict) -> dict:
    print("🤖 [N-Agent] Ejecutando consulta RAG sobre ChromaDB (BOM de Babbitt & Standards)...")
    
    # Construir consulta basada en el nombre y los materiales visuales detectados
    visual_materials = [c.get('material', '') for c in visual_data.get('visual_components', [])]
    query_text = f"{product_name} {description} {' '.join(visual_materials)}"
    
    try:
        collection = db_client.get_collection(name="product_lifecycle_rag")
        
        # Generar embedding de consulta
        query_vector = embedding_model.encode([query_text]).tolist()
        
        # Consultar base de datos
        results = collection.query(
            query_embeddings=query_vector,
            n_results=5
        )
        
        retrieved_items = []
        if results and 'documents' in results and len(results['documents'][0]) > 0:
            for i in range(len(results['documents'][0])):
                doc = results['documents'][0][i]
                meta = results['metadatas'][0][i]
                retrieved_items.append({
                    "text": doc,
                    "metadata": meta
                })
                
        print(f"✅ [N-Agent] Recuperados {len(retrieved_items)} registros científicos de ChromaDB.")
        return {"retrieved_records": retrieved_items}
        
    except Exception as e:
        print(f"⚠️ [N-Agent] Error al consultar ChromaDB: {e}. Usando datos vacíos.")
        return {"retrieved_records": []}


# 3. C-Agent (Impact & Math Synthesizer)
def run_c_agent(visual_data: dict, rag_data: dict) -> dict:
    print("🤖 [C-Agent] Calculando Inventario de Masa, Huella de Carbono y puntuación AHP de Reparabilidad...")
    
    # Factores de Emisión de Carbono de Referencia (kg CO2 / kg material)
    emission_factors = {
        'aluminum': 12.2,
        'copper': 4.5,
        'steel': 2.0,
        'plastic': 3.1,
        'li-ion battery': 18.0,
        'pcb': 45.0,
        'flat panel glass': 1.4,
        'crt glass': 2.5,
        'other glass': 1.4,
        'other metals': 5.0,
        'others': 2.5
    }
    
    fused_components = []
    total_carbon = 0.0
    
    # 1. Analizar registros de Babbitt et al. recuperados de ChromaDB para estimar masas
    records = rag_data.get("retrieved_records", [])
    
    # Si tenemos registros de RAG, los mapeamos como la base del BOM
    if records:
        for idx, rec in enumerate(records):
            meta = rec.get("metadata", {})
            doc_text = rec.get("text", "")
            
            # Obtener masa y material del metadata
            mass_g = meta.get("mass_grams", 10.0)
            material = meta.get("material_primary", "Mixed")
            
            # Extraer nombre del componente a partir del texto o metadata si existe
            comp_name = "Componente"
            product_source = "Babbitt et al. 2020"
            
            # Extraer con regex o campos
            match = re.search(r"REAL-BOM-\d+ extraído de (.*?)\.", doc_text)
            if match:
                product_source = f"BOM Babbitt ({match.group(1)})"
            
            # Asignar nombres genéricos limpios según el material
            mat_lower = material.lower()
            if 'battery' in mat_lower or 'batería' in mat_lower:
                comp_name = "Batería de Iones de Litio"
            elif 'pcb' in mat_lower or 'placa' in mat_lower:
                comp_name = "Placa de Circuito Impreso (PCB)"
            elif 'glass' in mat_lower or 'vidrio' in mat_lower:
                comp_name = "Panel de Vidrio"
            elif 'plastic' in mat_lower or 'plástico' in mat_lower:
                comp_name = "Carcasa plástica (ABS/PC)"
            elif 'aluminum' in mat_lower or 'aluminio' in mat_lower:
                comp_name = "Carcasa de Aluminio"
            elif 'steel' in mat_lower or 'acero' in mat_lower:
                comp_name = "Estructura de Acero"
            elif 'copper' in mat_lower or 'cobre' in mat_lower:
                comp_name = "Bobinado de Cobre"
            else:
                comp_name = f"Módulo de {material}"
                
            # Calcular CO2
            factor = emission_factors.get(mat_lower, 2.5)
            # Si el factor no coincide exactamente, buscar subcadenas
            for key, val in emission_factors.items():
                if key in mat_lower:
                    factor = val
                    break
            
            co2_contrib = (mass_g / 1000.0) * factor
            total_carbon += co2_contrib
            
            fused_components.append({
                "name": comp_name,
                "material": material,
                "mass_grams": mass_g,
                "carbon_footprint_kg": round(co2_contrib, 3),
                "source": product_source
            })
    
    # 2. Si no hay RAG, usar componentes visuales detectados e inventar masas genéricas basadas en promedios
    else:
        for comp in visual_data.get("visual_components", []):
            name = comp.get("name", "Componente")
            material = comp.get("material", "Plástico")
            
            # Generar masa típica
            mass_g = 150.0
            mat_lower = material.lower()
            if "vidrio" in mat_lower or "pantalla" in mat_lower:
                mass_g = 250.0
            elif "batería" in mat_lower:
                mass_g = 120.0
            elif "placa" in mat_lower:
                mass_g = 80.0
            elif "acero" in mat_lower or "aluminio" in mat_lower:
                mass_g = 400.0
                
            factor = 2.5
            for key, val in emission_factors.items():
                if key in mat_lower:
                    factor = val
                    break
                    
            co2_contrib = (mass_g / 1000.0) * factor
            total_carbon += co2_contrib
            
            fused_components.append({
                "name": name,
                "material": material,
                "mass_grams": mass_g,
                "carbon_footprint_kg": round(co2_contrib, 3),
                "source": "Inferencia de Vision"
            })
            
    # ── 3. Calcular IOR (Índice de Reparabilidad) AHP según EN 45554
    # Criterios y pesos: Desensamblaje S1=0.50, Herramientas S2=0.30, Repuestos S3=0.20
    # Valores base calibrados con benchmarks iFixit y estudios EN 45554
    s1 = 7.0   # Desensamblaje: base media-alta (tornillos estándar asumidos)
    s2 = 6.5   # Herramientas: accesibles en mercado
    s3 = 6.0   # Disponibilidad de repuestos: moderada

    adhesive_found     = False
    proprietary_found  = False

    visual_assemblies = [c.get('assembly', '').lower() for c in visual_data.get('visual_components', [])]
    for assembly in visual_assemblies:
        if 'pegamento' in assembly or 'adhesivo' in assembly or 'pegado' in assembly or 'glued' in assembly:
            adhesive_found = True
        if 'pentalobe' in assembly or 'torx' in assembly or 'propietari' in assembly or 'proprietary' in assembly:
            proprietary_found = True

    # Penalización única por adhesivo (no acumulativa)
    if adhesive_found:
        s1 -= 1.5   # Requiere herramienta de calor / mayor habilidad
        s2 -= 0.5   # Pistola de calor necesaria

    # Penalización por herramientas propietarias
    if proprietary_found:
        s2 -= 1.5   # Herramientas poco accesibles
        s3 -= 1.0   # Repuestos más difíciles de conseguir

    # Penalización si hay muchos componentes con adhesivo (diseño sellado)
    adhesive_count = sum(1 for a in visual_assemblies if 'pegamento' in a or 'adhesivo' in a)
    if adhesive_count >= 3:
        s1 -= 0.5   # Diseño estructuralmente sellado

    # Limitar entre 1 y 10
    s1 = max(1.0, min(10.0, s1))
    s2 = max(1.0, min(10.0, s2))
    s3 = max(1.0, min(10.0, s3))

    # Ecuación AHP EN 45554: IOR = 0.50·S1 + 0.30·S2 + 0.20·S3
    ir_score = round((0.50 * s1) + (0.30 * s2) + (0.20 * s3), 1)

    # Clasificación de Reparabilidad (Norma Europea EN 45554)
    if ir_score >= 7.5:
        label = "Alta Reparabilidad — Ecodiseño Excelente (Clase A • Norma Europea)"
    elif ir_score >= 5.0:
        label = "Reparabilidad Media — Diseño Convencional (Clase B • Norma Europea)"
    elif ir_score >= 3.0:
        label = "Reparabilidad Baja — Acceso Limitado a Componentes (Clase C • Norma Europea)"
    else:
        label = "Muy Baja Reparabilidad — Obsolescencia Programada (Clase D • Norma Europea)"

    math_details = (
        f"Fórmula AHP (Ecodiseño Europeo): 0.50×S1[Desensamblaje={s1}] + 0.30×S2[Herramientas={s2}] "
        f"+ 0.20×S3[Repuestos={s3}] = {ir_score}/10"
        + (" | Penalización: adhesivo estructural" if adhesive_found else "")
        + (" | Penalización: tornillos propietarios" if proprietary_found else "")
    )

    print(f"✅ [C-Agent] Huella CO₂: {round(total_carbon, 2)} kg | IOR AHP: {ir_score}/10 | Adhesivo: {adhesive_found} | Propietario: {proprietary_found}")

    return {
        "fused_components": fused_components,
        "carbon_footprint_total_kg": round(total_carbon, 2),
        "reparability": {
            "score": ir_score,
            "label": label,
            "details": math_details
        }
    }


def run_a_agent(product_name: str, description: str, visual_data: dict, rag_data: dict, math_data: dict, api_key: str, web_search_data: Optional[list] = None) -> dict:
    print("🤖 [A-Agent] Ejecutando debate de consenso, auditoría adversaria y formateando JSON...")
    genai.configure(api_key=api_key)

    model = genai.GenerativeModel('gemini-3.5-flash')

    # ── Pre-computar variables de reparabilidad fuera del f-string
    #    (evita SyntaxError por {{}} anidado dentro de expresiones {})
    reparability    = math_data.get('reparability') or {}
    rep_score       = reparability.get('score', 5.0)
    rep_label       = reparability.get('label', 'Sin clasificar')
    rep_details     = reparability.get('details', '')
    carbon_total_kg = math_data.get('carbon_footprint_total_kg', 0)
    carbon_str      = f"{carbon_total_kg:.1f} kg CO\u2082-eq (estimado ISO 14067)"

    debate_prompt = f"""
Eres el A-Agent (Agente Auditor Adversario) del sistema SADOC. Reconcilia los datos de los agentes V, N y C para generar un analisis forense tecnico de ciclo de vida y durabilidad de un producto electronico.

PRODUCTO: {product_name}
DESCRIPCION ADICIONAL: {description}

BLACKBOARD DE AGENTES:
- V-Agent (Visual): {json.dumps(visual_data, ensure_ascii=False)}
- N-Agent (RAG Babbitt et al. 2020): {json.dumps(rag_data, ensure_ascii=False)}
- C-Agent (Calculos AHP + CO2): {json.dumps(math_data, ensure_ascii=False)}
- Web Search Data (Especificaciones en tiempo real de Internet): {json.dumps(web_search_data, ensure_ascii=False) if web_search_data else '[]'}

REGLAS DE CONSENSO:
- Reconcilia los datos locales (RAG Babbitt) con los datos en tiempo real de Internet (Web Search). Si hay información específica de internet sobre el modelo (ej: iPhone 15 tiene chasis de aluminio aeroespacial/vidrio infusado, pantalla Ceramic Shield, puerto USB-C, y batería de ~3349 mAh), priorízala sobre los datos genéricos del RAG Babbitt (que provienen de bases de datos de laboratorios de modelos antiguos de los años 90 o 2000).
- Usa lo detectado por V-Agent para contexto de ensamblaje (peso 0.3).
- La descripcion del usuario aporta contexto adicional (peso 0.2).
- La vida util total = minimo lifespanYears de componentes donde isCritical=true Y repairabilityScore < 5.
- Si todos los criticos son reparables (score >= 5), usa la media o segundo minimo.
- La huella de carbono total del C-Agent es: {carbon_total_kg} kg CO2-eq.
- Responde en español (tildes y caracteres especiales incluidos).
- Asegúrate de listar los componentes específicos del producto real (ej: si es un iPhone 15, incluye chasis de aluminio/vidrio, pantalla de vidrio Ceramic Shield, puerto de carga USB-C, placa lógica, batería de litio, etc.) con sus vidas útiles y pesos realistas de acuerdo con los datos encontrados en la búsqueda web y RAG.
- Incluye en la sección 'sources' del JSON de salida tanto el RAG local como las páginas o referencias clave encontradas en la búsqueda web (Web Search Data).

DEVUELVE UNICAMENTE JSON PURO. Sin markdown, sin explicaciones, sin comentarios dentro del JSON.
El JSON debe empezar con {{ y terminar con }}.

IMPORTANTE SOBRE reparabilityIndex:
- El score del C-Agent es {rep_score}/10 y es el valor OFICIAL calculado con AHP EN 45554.
- USA EXACTAMENTE score={rep_score}. NO lo recalcules. NO promedies los repairabilityScore de los componentes.
- Los repairabilityScore de cada componente son valores INDIVIDUALES por componente, no el índice global.

{{
  "productName": "Nombre oficial del producto (especifica marca y modelo completo si se detectó)",
  "estimatedLifespan": 0,
  "weakestLink": "Nombre del componente critico que falla primero",
  "carbonFootprint": "{carbon_str}",
  "confidenceScore": "Alto",
  "summary": "Parrafo tecnico de 3-4 oraciones: ciclo de vida, vida util y huella de carbono, mencionando explícitamente el modelo real analizado.",
  "consensusLog": "2-3 oraciones del debate V/N/C-Agent y los hallazgos de búsqueda web.",
  "reparabilityIndex": {{
    "score": {rep_score},
    "label": "{rep_label}",
    "details": "{rep_details}"
  }},
  "components": [
    {{
      "name": "string",
      "material": "string",
      "massGrams": 0,
      "lifespanYears": 0,
      "failureMode": "Mecanismo fisico-quimico exacto de degradacion",
      "repairabilityScore": 0,
      "environmentalImpact": "Low",
      "isCritical": true,
      "normativeReference": "EN 45554 5.2"
    }}
  ],
  "recommendations": [
    "Recomendacion de ecodiseno 1",
    "Recomendacion de ecodiseno 2",
    "Recomendacion de ecodiseno 3"
  ],
  "sources": [
    {{"title": "Babbitt et al. (2020)", "urlOrContext": "Laboratory Disassembly Dataset - ASU/CMU"}}
  ]
}}
"""

    try:
        response = model.generate_content(debate_prompt)
        text = response.text.strip()
        print(f"📄 [A-Agent] Respuesta recibida ({len(text)} chars). Extrayendo JSON...")

        # ── Limpieza robusta: soporta ```json...```, ```...```, o JSON directo
        json_match = re.search(r'```(?:json)?\s*([\s\S]+?)\s*```', text)
        if json_match:
            text = json_match.group(1).strip()
        else:
            # Extraer el primer objeto JSON completo (del primer { al último })
            start = text.find('{')
            end   = text.rfind('}')
            if start != -1 and end != -1 and end > start:
                text = text[start:end + 1]

        analysis = json.loads(text)
        print("✅ [A-Agent] JSON parseado y validado correctamente.")
        return analysis

    except json.JSONDecodeError as e:
        snippet = text[:600] if 'text' in dir() else '(no text)'
        print(f"❌ [A-Agent] JSONDecodeError: {e}")
        print(f"   Texto recibido: {snippet}")
        raise HTTPException(status_code=500, detail=f"La IA devolvio JSON malformado: {str(e)}")
    except Exception as e:
        print(f"❌ [A-Agent] Error inesperado: {type(e).__name__}: {e}")
        raise HTTPException(status_code=500, detail=f"Fallo en A-Agent: {str(e)}")


# --- ENDPOINT DEL BACKEND ---

@app.post("/api/analyze")
async def analyze_product(request: AnalysisRequest, x_gemini_api_key: Optional[str] = Header(None)):
    api_key = x_gemini_api_key or os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=400, detail="Gemini API Key faltante. Por favor configúrala en el cliente o como variable de entorno (GEMINI_API_KEY) en el servidor.")
        
    print("\n--- ⚡ INICIANDO FLUJO DE ANÁLISIS MULTI-AGENTE (SADOC) ---")
    print(f"Producto recibido del cliente: {request.productName}")
    
    # 1. Ejecutar V-Agent (Vision) si hay imagen
    visual_data = {"visual_components": [], "detected_product": None}
    product_name_to_use = request.productName
    
    if request.imageData:
        mime_type, image_bytes = parse_base64_image(request.imageData)
        if mime_type and image_bytes:
            visual_data = run_v_agent(request.productName, request.description, mime_type, image_bytes, api_key)
            
            # Autocompletar término genérico con modelo detectado por visión
            det = visual_data.get("detected_product")
            if det and det.get("model"):
                detected_name = f"{det.get('brand', '')} {det.get('model', '')}".strip()
                is_generic = not product_name_to_use or product_name_to_use.lower() in [
                    "telefono", "teléfono", "celular", "movil", "móvil", "laptop", "computadora", "pc", 
                    "dispositivo", "producto", "electronic", "electrónico", "objeto", "foto", "imagen"
                ]
                if is_generic:
                    print(f"🔍 [V-Agent] Sobrescribiendo término genérico '{product_name_to_use}' por modelo detectado: '{detected_name}'")
                    product_name_to_use = detected_name

    # 1.5. Ejecutar Agente de Búsqueda Web ( DuckDuckGo Real-time )
    web_search_data = []
    if product_name_to_use and product_name_to_use.lower() not in ["desconocido", "producto genérico", "dispositivo", "objeto"]:
        search_query = f"{product_name_to_use} materials lifespan carbon footprint repairability"
        web_search_data = search_web_ddg(search_query, max_results=4)
            
    # 2. Ejecutar N-Agent (RAG local con ChromaDB)
    rag_data = run_n_agent(product_name_to_use, request.description, visual_data)
    
    # 3. Ejecutar C-Agent (Cálculo cuantitativo)
    math_data = run_c_agent(visual_data, rag_data)
    
    # 4. Ejecutar A-Agent (Auditor adversario y Síntesis)
    final_analysis = run_a_agent(
        product_name=product_name_to_use,
        description=request.description,
        visual_data=visual_data,
        rag_data=rag_data,
        math_data=math_data,
        api_key=api_key,
        web_search_data=web_search_data
    )

    # ── Guardar el score AHP del C-Agent en el resultado final
    # El A-Agent a veces recalcula y baja el score incorrecto — forzamos el valor científico
    c_agent_rep = math_data.get('reparability', {})
    if c_agent_rep.get('score') is not None:
        if 'reparabilityIndex' not in final_analysis or not isinstance(final_analysis.get('reparabilityIndex'), dict):
            final_analysis['reparabilityIndex'] = {}
        # Solo sobrescribir si A-Agent lo bajó significativamente (>1.5 puntos) sin justificación
        a_score = final_analysis['reparabilityIndex'].get('score', 0)
        c_score = c_agent_rep['score']
        if abs(a_score - c_score) > 1.5:
            print(f"⚠️ [Endpoint] A-Agent cambió IOR de {c_score} a {a_score}. Restaurando valor C-Agent.")
            final_analysis['reparabilityIndex']['score']   = c_score
            final_analysis['reparabilityIndex']['label']   = c_agent_rep.get('label', final_analysis['reparabilityIndex'].get('label', ''))
            final_analysis['reparabilityIndex']['details'] = c_agent_rep.get('details', final_analysis['reparabilityIndex'].get('details', ''))
    
    # Guardar en el historial de ensayos (Fotos de la Red)
    try:
        save_to_history(final_analysis, request.imageData)
    except Exception as he:
        print(f"⚠️ Error al guardar ensayo en historial: {he}")
        
    print("--- ✅ FINALIZADO FLUJO MULTI-AGENTE ---")
    return final_analysis

@app.get("/api/search")
async def search_database(q: str):
    print(f"🔍 [Search API] Buscando en ChromaDB por: '{q}'...")
    try:
        collection = db_client.get_collection(name="product_lifecycle_rag")
        query_vector = embedding_model.encode([q]).tolist()
        results = collection.query(
            query_embeddings=query_vector,
            n_results=12
        )
        
        matches = []
        if results and 'documents' in results and len(results['documents'][0]) > 0:
            for i in range(len(results['documents'][0])):
                doc = results['documents'][0][i]
                meta = results['metadatas'][0][i]
                
                # Extraer info amigable
                product_name = meta.get("product_name", "Desconocido")
                product_type = meta.get("product_type", "Electrónico")
                mass = meta.get("mass_grams", 0.0)
                repair_score = meta.get("en_45554_repairability", 5.0)
                impact = meta.get("iso_14040_impact", "Medium")
                comp_id = meta.get("component_id", "REAL-BOM")
                
                matches.append({
                    "id": comp_id,
                    "document": doc,
                    "productName": product_name,
                    "productType": product_type,
                    "massGrams": mass,
                    "repairabilityScore": repair_score,
                    "environmentalImpact": impact
                })
        return {"matches": matches}
    except Exception as e:
        print(f"❌ Error en búsqueda de base de datos: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/history")
async def get_history():
    return {"history": analysis_history}

@app.get("/api/download/standard")
async def download_standard():
    file_path = os.path.join("data", "fused_dataset.json")
    if os.path.exists(file_path):
        return FileResponse(file_path, media_type="application/json", filename="SADOC_Standard_Dataset.json")
    else:
        raise HTTPException(status_code=404, detail="Dataset estándar no encontrado.")

@app.get("/api/download/trials")
async def download_trials():
    if os.path.exists(history_file):
        return FileResponse(history_file, media_type="application/json", filename="SADOC_Classified_Trials.json")
    else:
        with open(history_file, "w", encoding="utf-8") as f:
            json.dump([], f)
        return FileResponse(history_file, media_type="application/json", filename="SADOC_Classified_Trials.json")

@app.get("/api/download/standard/excel")
async def download_standard_excel():
    json_path = os.path.join("data", "fused_dataset.json")
    excel_path = os.path.join("data", "SADOC_Standard_Dataset.xlsx")
    
    if not os.path.exists(json_path):
        raise HTTPException(status_code=404, detail="Dataset estándar no encontrado.")
        
    try:
        df = pd.read_json(json_path)
        if "ifixit_tools_required" in df.columns:
            df["ifixit_tools_required"] = df["ifixit_tools_required"].apply(lambda x: ", ".join(x) if isinstance(x, list) else x)
            
        df.to_excel(excel_path, index=False, sheet_name="BOM Estándar Consolidado")
        return FileResponse(excel_path, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", filename="SADOC_Standard_Dataset.xlsx")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al generar archivo de Excel: {str(e)}")

@app.get("/api/download/trials/excel")
async def download_trials_excel():
    excel_path = os.path.join("data", "SADOC_Classified_Trials.xlsx")
    
    try:
        if not analysis_history:
            df = pd.DataFrame(columns=["id", "timestamp", "productName", "estimatedLifespan", "weakestLink", "reparabilityScore", "carbonFootprint", "summary"])
            df.to_excel(excel_path, index=False, sheet_name="Historial de Ensayos")
            return FileResponse(excel_path, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", filename="SADOC_Classified_Trials.xlsx")
            
        df = pd.DataFrame(analysis_history)
        if "imageData" in df.columns:
            df = df.drop(columns=["imageData"])
            
        if "reparabilityIndex" in df.columns:
            df["reparabilityScore"] = df["reparabilityIndex"].apply(lambda x: x.get("score") if isinstance(x, dict) else None)
            df["reparabilityLabel"] = df["reparabilityIndex"].apply(lambda x: x.get("label") if isinstance(x, dict) else None)
            df = df.drop(columns=["reparabilityIndex"])
            
        df.to_excel(excel_path, index=False, sheet_name="Historial de Ensayos")
        return FileResponse(excel_path, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", filename="SADOC_Classified_Trials.xlsx")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al generar archivo de Excel: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=True)
