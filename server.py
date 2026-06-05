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
from sentence_transformers import SentenceTransformer
import pandas as pd

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
    carbon_footprint = "N/D"
    if "riamMapping" in analysis:
        reason = analysis.get("riamMapping", {}).get("physicalChemical", {}).get("reason", "")
        match = re.search(r"([\d\.]+)\s*kg", reason)
        if match:
            carbon_footprint = f"{match.group(1)} kg CO2"
            
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
    Analiza la imagen de este producto e identifica los componentes físicos visibles.
    Para cada componente detectado, especifica:
    1. Nombre del componente (ej: Pantalla, Carcasa frontal, Botones, Conector).
    2. Material estimado (ej: Plástico ABS, Vidrio de borosilicato, Aluminio, Cobre).
    3. Tipo de fijación/ensamblaje estimado (ej: Adhesivo, Tornillos de estrella, Clips de presión, Soldadura).
    
    Devuelve la información estrictamente en un formato JSON plano como el siguiente:
    {
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
        print(f"✅ [V-Agent] Componentes visuales extraídos: {len(result.get('visual_components', []))}")
        return result
    except Exception as e:
        print(f"⚠️ [V-Agent] Error en análisis de visión: {e}. Continuando con análisis vacío.")
        return {"visual_components": []}


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
            
    # 3. Calcular AHP del Índice de Reparabilidad EN 45554
    # Definimos puntuaciones ficticias basadas en herramientas detectadas
    # Criterios: Desensamblaje (S1), Herramientas (S2), Disponibilidad (S3)
    s1 = 8.0  # Por defecto asumimos tornillos
    s2 = 7.0  # Herramientas estándar
    s3 = 6.0  # Repuestos moderados
    
    # Buscar elementos que penalicen
    visual_assemblies = [c.get('assembly', '').lower() for c in visual_data.get('visual_components', [])]
    for assembly in visual_assemblies:
        if 'pegamento' in assembly or 'adhesivo' in assembly or 'pegado' in assembly:
            s1 -= 2.0  # Penalización de desensamblaje por pegamento
            s2 -= 1.0  # Requiere pistola de calor
            
    # Evitar puntuaciones negativas o mayores a 10
    s1 = max(1.0, min(10.0, s1))
    s2 = max(1.0, min(10.0, s2))
    s3 = max(1.0, min(10.0, s3))
    
    # Ecuación AHP de EN 45554:
    # IR = 0.50 * S1 + 0.30 * S2 + 0.20 * S3
    ir_score = round((0.50 * s1) + (0.30 * s2) + (0.20 * s3), 1)
    
    # Clasificación de la etiqueta de reparabilidad
    if ir_score >= 8.0:
        label = "Alta Reparabilidad (Ecodiseño Excelente)"
    elif ir_score >= 5.0:
        label = "Reparabilidad Media (Diseño Convencional)"
    else:
        label = "Baja Reparabilidad (Obsolescencia Programada)"
        
    math_details = f"AHP Ponderado: 0.50 * [Desensamblaje: {s1}] + 0.30 * [Herramientas: {s2}] + 0.20 * [Repuestos: {s3}] = {ir_score}/10."
    
    print(f"✅ [C-Agent] Cálculos completados. Huella de Carbono: {round(total_carbon, 2)} kg CO2, Índice AHP: {ir_score}")
    
    return {
        "fused_components": fused_components,
        "carbon_footprint_total_kg": round(total_carbon, 2),
        "reparability": {
            "score": ir_score,
            "label": label,
            "details": math_details
        }
    }


# 4. A-Agent (Adversarial Auditor & Consensus)
def run_a_agent(product_name: str, description: str, visual_data: dict, rag_data: dict, math_data: dict, api_key: str) -> dict:
    print("🤖 [A-Agent] Ejecutando debate de consenso, auditoría adversaria y formateando JSON...")
    genai.configure(api_key=api_key)
    
    model = genai.GenerativeModel('gemini-3.5-flash')
    
    # Construimos el prompt de debate
    debate_prompt = f"""
    Actúas como el Agente Auditor Adversario (A-Agent) en un sistema multi-agente de sustentabilidad.
    Tu tarea es auditar y reconciliar las salidas de los otros agentes para generar un reporte de Análisis de Ciclo de Vida y Reparabilidad científico y estructurado de un producto.
    
    DATOS DEL PRODUCTO:
    - Nombre del Producto: {product_name}
    - Descripción del Usuario: {description}
    
    DATOS DE ENTRADA DE LOS OTROS AGENTES (Blackboard):
    1. V-Agent (Vision): {json.dumps(visual_data, ensure_ascii=False)}
    2. N-Agent (RAG Científico): {json.dumps(rag_data, ensure_ascii=False)}
    3. C-Agent (Cálculo): {json.dumps(math_data, ensure_ascii=False)}
    
    PROTOCOLO DE CONSENSO:
    Resuelve cualquier discrepancia de materiales entre V-Agent (lo visual) y N-Agent (el RAG científico de Babbitt et al. 2020) utilizando esta regla de confiabilidad bayesiana:
    - RAG Científico (Peso 50%): Los datos de laboratorio son la autoridad primaria.
    - Vision (Peso 30%): Lo detectado visualmente aporta estado físico actual.
    - Text (Peso 20%): La descripción del usuario.
    Explica brevemente este debate en el campo 'consensusLog' (máximo 150 palabras).
    
    FORMATO DE SALIDA EXIGIDO (JSON DE ALTA FIDELIDAD):
    Debes devolver un JSON exacto que cumpla este esquema:
    {{
      "productName": "Nombre oficial del producto",
      "estimatedLifespan": 8.5, // Número en años. La vida útil total estimada del dispositivo (generalmente el mínimo de los componentes críticos no reparables)
      "weakestLink": "Nombre del componente crítico que fallará primero y limitará la vida útil",
      "summary": "Resumen ejecutivo del ciclo de vida y análisis técnico del producto, integrando las normas ISO 14040 y EN 45554.",
      "confidenceScore": "Alto | Medio | Bajo", // Nivel de confianza basado en la coincidencia con datos del RAG
      "consensusLog": "Bitácora del debate de agentes. Ej: V-Agent detectó pegamento en carcasa pero RAG de Babbitt estipula tornillos Torx. Se aplicó peso probabilístico (RAG 0.5 vs Vision 0.3) determinando metal en carcasa y penalizando el desensamblaje por presencia de pegamento superficial.",
      "reparabilityIndex": {{
        "score": 6.8, // Usar el score calculado por C-Agent
        "label": "Clasificación EN 45554", // Usar la etiqueta calculada por C-Agent
        "details": "Justificación matemática AHP calculada por C-Agent"
      }},
      "riamMapping": {{
        "physicalChemical": {{ "score": -2, "reason": "Justificación del impacto físico/químico, citando emisiones estimadas de CO2 de {math_data['carbon_footprint_total_kg']} kg." }}, // Puntuación de -3 a +3
        "biologicalEcological": {{ "score": -1, "reason": "Justificación del impacto biológico/ecológico, ej: minería de litio/tierras raras si tiene batería o PCBs." }}, // Puntuación de -3 a +3
        "socialCultural": {{ "score": 1, "reason": "Justificación del impacto social/cultural (obsolescencia percibida)." }}, // Puntuación de -3 a +3
        "economicOperational": {{ "score": 2, "reason": "Justificación económica, vida útil esperada vs costo de reparación." }} // Puntuación de -3 a +3
      }},
      "components": [
        {{
          "name": "Nombre de componente limpio (ej: Batería de Iones de Litio)",
          "material": "Material final decidido por el consenso",
          "lifespanYears": 4.0, // Vida útil estimada del componente
          "failureMode": "Mecanismo físico-químico de falla (ej: Pérdida de capacidad por degradación de celdas)",
          "repairabilityScore": 3.5, // Puntuación de reparabilidad del componente (0-10)
          "environmentalImpact": "Low | Medium | High", // Nivel de impacto
          "isCritical": true, // true si su falla inutiliza el aparato
          "normativeReference": "Cláusula aplicable de EN 45554 u otra norma (ej: EN 45554 Clause 6.4)"
        }}
      ],
      "recommendations": [
        "Recomendación industrial de ecodiseño 1",
        "Recomendación industrial de ecodiseño 2"
      ],
      "sources": [
        {{ "title": "Referencia Científica", "urlOrContext": "Estudio de Babbitt et al. (2020) u otra referencia del RAG" }}
      ]
    }}
    
    Genera el JSON final en español. Devuelve ÚNICAMENTE el JSON puro sin marcas de markdown ni introducciones.
    """
    
    try:
        response = model.generate_content(debate_prompt)
        text = response.text.strip()
        
        # Limpieza robusta del JSON devuelto
        if text.startswith("```json"):
            text = text.replace("```json", "", 1).replace("```", "", 1).strip()
        elif text.startswith("```"):
            text = text.replace("```", "", 1).replace("```", "", 1).strip()
            
        # Parsear para asegurar validez
        analysis = json.loads(text)
        print("✅ [A-Agent] Reporte final validado y estructurado con éxito.")
        return analysis
    except Exception as e:
        print(f"❌ [A-Agent] Error formateando o generando salida del A-Agent: {e}")
        raise HTTPException(status_code=500, detail=f"Fallo en la síntesis del A-Agent: {str(e)}")


# --- ENDPOINT DEL BACKEND ---

@app.post("/api/analyze")
async def analyze_product(request: AnalysisRequest, x_gemini_api_key: Optional[str] = Header(None)):
    api_key = x_gemini_api_key or os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=400, detail="Gemini API Key faltante. Por favor configúrala en el cliente o como variable de entorno (GEMINI_API_KEY) en el servidor.")
        
    print("\n--- ⚡ INICIANDO FLUJO DE ANÁLISIS MULTI-AGENTE (SADOC) ---")
    print(f"Producto: {request.productName}")
    
    # 1. Ejecutar V-Agent (Vision) si hay imagen
    visual_data = {"visual_components": []}
    if request.imageData:
        mime_type, image_bytes = parse_base64_image(request.imageData)
        if mime_type and image_bytes:
            visual_data = run_v_agent(request.productName, request.description, mime_type, image_bytes, api_key)
            
    # 2. Ejecutar N-Agent (RAG local con ChromaDB)
    rag_data = run_n_agent(request.productName, request.description, visual_data)
    
    # 3. Ejecutar C-Agent (Cálculo cuantitativo)
    math_data = run_c_agent(visual_data, rag_data)
    
    # 4. Ejecutar A-Agent (Auditor adversario y Síntesis)
    final_analysis = run_a_agent(
        product_name=request.productName,
        description=request.description,
        visual_data=visual_data,
        rag_data=rag_data,
        math_data=math_data,
        api_key=api_key
    )
    
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
        if "tools_required" in df.columns:
            df["tools_required"] = df["tools_required"].apply(lambda x: ", ".join(x) if isinstance(x, list) else x)
            
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
