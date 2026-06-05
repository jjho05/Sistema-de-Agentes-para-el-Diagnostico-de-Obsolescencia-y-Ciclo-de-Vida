import json
import random

product_types = ["Smartphone", "Laptop", "Washing Machine", "Refrigerator", "Electric Vehicle", "Smartwatch", "Drone", "Microwave", "Air Conditioner", "Solar Panel"]

components_base = [
    {"name": "Pantalla OLED/LCD", "materials": ["Glass/Aluminum", "Glass/Plastic", "Silicone/Indium"], "mass_range": (30, 200), "impact": "High", "fail": "Fractura, píxeles muertos"},
    {"name": "Batería Li-ion", "materials": ["Lithium/Cobalt", "Lithium/Polymer"], "mass_range": (40, 5000), "impact": "High", "fail": "Degradación química"},
    {"name": "Placa Base (PCB)", "materials": ["FR4/Copper/Gold", "FR4/Tin/Silver"], "mass_range": (50, 800), "impact": "High", "fail": "Corto circuito, fatiga térmica"},
    {"name": "Motor Eléctrico", "materials": ["Copper/Steel/Neodymium", "Aluminum/Iron"], "mass_range": (500, 15000), "impact": "Medium", "fail": "Desgaste de rodamientos"},
    {"name": "Carcasa Exterior", "materials": ["Aluminum 7000", "Polycarbonate/ABS", "Stainless Steel"], "mass_range": (100, 5000), "impact": "Medium", "fail": "Fatiga mecánica, abolladuras"},
    {"name": "Módulo de Cámara", "materials": ["Glass/Plastic/Silicon", "Sapphire/Aluminum"], "mass_range": (5, 50), "impact": "Medium", "fail": "Falla de estabilizador (OIS)"},
    {"name": "Compresor", "materials": ["Steel/Copper", "Cast Iron/Aluminum"], "mass_range": (4000, 12000), "impact": "High", "fail": "Fuga de refrigerante, fallo de válvula"},
    {"name": "Panel Solar Fotovoltaico", "materials": ["Silicon/Glass/Aluminum"], "mass_range": (15000, 25000), "impact": "High", "fail": "Microfracturas solares"},
    {"name": "Sensores (Giroscopio/Acelerómetro)", "materials": ["Silicon/Gold/Ceramic"], "mass_range": (1, 5), "impact": "Low", "fail": "Desviación de calibración"},
    {"name": "Sistema de Enfriamiento (Disipador)", "materials": ["Copper", "Aluminum"], "mass_range": (50, 1000), "impact": "Low", "fail": "Acumulación de polvo, oxidación"}
]

tools_pool = ["Phillips #00", "Torx T5", "Pentalobe", "Spudger", "Heat Gun", "Suction Cup", "Tweezers", "Soldering Iron", "Socket Set", "Wrench"]

large_dataset = []
counter = 1

for p_type in product_types:
    # 5 a 10 componentes por tipo de producto
    num_comps = random.randint(5, 10)
    for _ in range(num_comps):
        base = random.choice(components_base)
        material = random.choice(base["materials"])
        mass = round(random.uniform(base["mass_range"][0], base["mass_range"][1]), 1)
        repair_steps = random.randint(3, 45)
        
        # Lógica de reparabilidad
        if repair_steps > 30:
            repair_score = round(random.uniform(1.0, 3.5), 1)
        elif repair_steps > 15:
            repair_score = round(random.uniform(3.6, 7.0), 1)
        else:
            repair_score = round(random.uniform(7.1, 10.0), 1)
            
        req_tools = random.sample(tools_pool, random.randint(1, 4))
        if "Soldering Iron" in req_tools:
            repair_score = min(repair_score, 4.0)
            
        desc = f"{base['name']} para {p_type}. Material predominante: {material}. "
        if repair_score < 4:
            desc += f"Difícil de extraer (EN 45554), requiere herramientas como {', '.join(req_tools)}. "
        else:
            desc += f"Acceso modular y sencillo. "
            
        if base['impact'] == 'High':
            desc += f"Alto impacto ambiental (ISO 14040/14067) debido a extracción intensiva de recursos."
        elif base['impact'] == 'Medium':
            desc += f"Impacto moderado en LCI. Potencial de reciclaje viable."
        else:
            desc += f"Bajo impacto relativo, componentes fácilmente reciclables o inertes."

        comp = {
            "component_id": f"COMP-{p_type[:3].upper()}-{counter:03d}",
            "product_type": p_type,
            "component_name": base["name"],
            "material_primary": material,
            "mass_grams": mass,
            "ifixit_repair_steps": repair_steps,
            "ifixit_tools_required": req_tools,
            "iso_14040_impact": base["impact"],
            "en_45554_repairability_score": repair_score,
            "failure_mode_typical": base["fail"],
            "context_description": desc
        }
        large_dataset.append(comp)
        counter += 1

with open('data/fused_dataset.json', 'w', encoding='utf-8') as f:
    json.dump(large_dataset, f, indent=4, ensure_ascii=False)

print(f"Generated {len(large_dataset)} diverse components for the dataset.")
