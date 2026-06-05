import json
import os
import chromadb
from chromadb.config import Settings
from sentence_transformers import SentenceTransformer

# 1. Cargar el Dataset Fusionado (BOM + iFixit + ISO/EN)
json_path = 'data/fused_dataset.json'
if os.path.exists(json_path):
    with open(json_path, 'r', encoding='utf-8') as f:
        fused_dataset = json.load(f)
else:
    print(f"El archivo JSON {json_path} no existe. Por favor, ejecuta generate_large_dataset.py primero.")
    exit(1)

print(f"✅ Cargados {len(fused_dataset)} componentes desde {json_path}")

# 2. Construcción de la Base de Datos Vectorial (RAG)
print("⏳ Inicializando ChromaDB local...")
db_path = os.path.join(os.getcwd(), 'data', 'vector_db')
client = chromadb.PersistentClient(path=db_path)

# Crear o resetear la colección
collection_name = "product_lifecycle_rag"
try:
    client.delete_collection(name=collection_name)
except Exception:
    pass
collection = client.create_collection(name=collection_name)

# 3. Vectorización de Textos
print("🧠 Cargando modelo de embedding (SentenceTransformers)...")
model = SentenceTransformer('all-MiniLM-L6-v2')

docs = []
metadatas = []
ids = []

for idx, item in enumerate(fused_dataset):
    # El texto a vectorizar combina el nombre, material y la descripción de contexto
    text_to_embed = f"{item['component_name']} - {item['material_primary']}. {item['context_description']}"
    docs.append(text_to_embed)
    
    # Metadatos estructurados
    metadatas.append({
        "component_id": item['component_id'],
        "mass_grams": float(item['mass_grams']),
        "iso_14040_impact": item['iso_14040_impact'],
        "en_45554_repairability": float(item['en_45554_repairability_score'])
    })
    
    ids.append(item['component_id'])

print("📊 Vectorizando e insertando en la base de datos...")
# Generar embeddings
embeddings = model.encode(docs).tolist()

# Insertar en Chroma
collection.add(
    embeddings=embeddings,
    documents=docs,
    metadatas=metadatas,
    ids=ids
)

print(f"✅ Base de Datos Vectorial (RAG) creada exitosamente en: {db_path}")
print(f"📦 Total de componentes indexados: {collection.count()}")

# Prueba de búsqueda rápida
results = collection.query(
    query_embeddings=model.encode(["¿Qué componente tiene alto impacto ambiental y baja reparabilidad?"]).tolist(),
    n_results=1
)
print("\n🔍 Test de Recuperación (RAG):")
print("Top Documento:", results['documents'][0][0])
print("Metadatos:", results['metadatas'][0][0])
