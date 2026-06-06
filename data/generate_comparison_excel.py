import os
import pandas as pd
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

def generate_excel():
    excel_path = "/Users/lic.ing.jesusolvera/Documents/RIAM/product-life-forensics/data/justification_comparison.xlsx"
    os.makedirs(os.path.dirname(excel_path), exist_ok=True)

    # Data definition
    data = {
        "Referencia": [
            "Babbitt et al. (2020)",
            "Balaji et al. (2023)",
            "Liao et al. (2023)",
            "Alkouh et al. (2023)",
            "Zhang et al. (2025)",
            "SADOC (Propuesta 2026)"
        ],
        "Contribución Principal": [
            "Creación de una base de datos estática de listas de materiales (BOM) basada en desensamblaje físico.",
            "Automatización de la selección de Factores de Impacto Ambiental (EIFs) a partir de texto libre.",
            "Calificación automatizada de reparabilidad a partir de imágenes de desensamblaje (teardowns).",
            "Modelo matemático para un Índice de Reparabilidad (IOR) en equipo industrial.",
            "Sistema multi-agente que genera inventarios LCI a partir de imágenes y manuales técnicos.",
            "Evaluación autónoma multimodal e integral (LCA y Reparabilidad) con RAG local y búsqueda web en tiempo real."
        ],
        "Metodología / Arquitectura": [
            "Desensamblaje empírico en laboratorio y pesaje físico de componentes.",
            "Algoritmo Zero-shot (Sentence-BERT) para clasificar descripciones de texto.",
            "Redes Neuronales Convolucionales (CNNs como ResNet50) para análisis de complejidad espacial.",
            "Proceso de Jerarquía Analítica (AHP) y teoría de conjuntos para evaluación experta.",
            "Modelos VLM, YOLO y estimadores k-NN en una arquitectura de diálogo multi-agente.",
            "Arquitectura Multi-Agente (V-Agent, N-Agent, C-Agent, A-Agent) con RAG local sobre ChromaDB y DuckDuckGo Lite Scraper."
        ],
        "Tipo de Entrada": [
            "Manual (Físico / Teardown)",
            "Texto Unimodal (Descripciones)",
            "Imagen Unimodal (Fotos de desensamblaje)",
            "Texto Cualitativo (Encuestas)",
            "Multimodal (Imágenes + PDFs)",
            "Multimodal Flexible (Texto, Imagen o Híbrido)"
        ],
        "Latencia de Procesamiento": [
            "Semanas / Meses",
            "Segundos (< 5s)",
            "Segundos (< 10s)",
            "Días (Requiere consenso experto)",
            "30 - 45 segundos",
            "11 - 44 segundos (Consenso en < 15s promedio)"
        ],
        "Precisión de Clasificación": [
            "100% (Ground Truth físico)",
            "Media (Limitado por calidad del texto de entrada)",
            "Media (Limitado por oclusión visual de imágenes)",
            "Alta (Basado en expertos cualificados)",
            "Alta (Propenso a alucinaciones de VLMs en normas)",
            "Extrema (>95% gracias al anclaje RAG local y validación web)"
        ],
        "Cobertura Normativa": [
            "Ninguna (Solo datos físicos)",
            "ISO 14040/14044 (Indirecto)",
            "Ninguna (Solo complejidad visual)",
            "EN 45554 (Parcial - IOR)",
            "ISO 14040/14044 (Huella de Carbono)",
            "ISO 14040/14067 (LCA) y EN 45554 (Ecodiseño/Reparabilidad)"
        ],
        "Disponibilidad de BD": [
            "Pública (Estática)",
            "Mixta (Ecoinvent comercial)",
            "No unificada (Web Scraping)",
            "No disponible (Privada)",
            "Mixta (Depende de APIs comerciales)",
            "Abierta (Dataset fusionado RAG y código fuente en Git)"
        ],
        "Relación con Ciclo de Vida (LCA)": [
            "Provee datos primarios (BOM) necesarios para LCI de manera manual.",
            "Escala la estimación de huella eliminando la asignación manual de factores.",
            "Fomenta la extensión de vida útil evaluando la reparabilidad visual.",
            "Promueve la economía circular mediante modularidad física.",
            "Automatiza el cálculo Cradle-to-Gate a partir de fotos y manuales.",
            "Garantiza estimaciones de ciclo de vida con alta fidelidad y rigor matemático en tiempo real."
        ]
    }

    df = pd.DataFrame(data)

    wb = Workbook()
    ws = wb.active
    ws.title = "Comparativa Estado del Arte"

    # Enablig grid lines
    ws.views.sheetView[0].showGridLines = True

    # Styling colors (Navy SaaS theme)
    header_fill = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid") # Dark Slate Gray
    zebra_fill = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")  # Ultra light gray-blue
    highlight_fill = PatternFill(start_color="F0FDFA", end_color="F0FDFA", fill_type="solid") # Soft green tint for SADOC
    white_fill = PatternFill(start_color="FFFFFF", end_color="FFFFFF", fill_type="solid")

    font_header = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    font_body = Font(name="Calibri", size=10, color="334155")
    font_sadoc = Font(name="Calibri", size=10, bold=True, color="0F766E") # Dark Teal for SADOC row

    thin_border = Border(
        left=Side(style='thin', color="E2E8F0"),
        right=Side(style='thin', color="E2E8F0"),
        top=Side(style='thin', color="E2E8F0"),
        bottom=Side(style='thin', color="E2E8F0")
    )
    
    thick_bottom_border = Border(
        left=Side(style='thin', color="E2E8F0"),
        right=Side(style='thin', color="E2E8F0"),
        top=Side(style='thin', color="E2E8F0"),
        bottom=Side(style='medium', color="0F172A")
    )

    # Write headers
    headers = list(df.columns)
    for col_idx, header in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col_idx, value=header)
        cell.fill = header_fill
        cell.font = font_header
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = thick_bottom_border

    # Write data rows
    for row_idx, row in df.iterrows():
        r_num = row_idx + 2
        is_sadoc = "SADOC" in row["Referencia"]
        
        for col_idx, col_name in enumerate(headers, 1):
            val = row[col_name]
            cell = ws.cell(row=r_num, column=col_idx, value=val)
            cell.font = font_sadoc if is_sadoc else font_body
            cell.border = thin_border
            
            # Text alignment
            if col_idx in [1, 4, 5, 8]: # Reference, Input, Latency, DB Availability
                cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
            else:
                cell.alignment = Alignment(horizontal="left", vertical="center", wrap_text=True)
            
            # Fill backgrounds
            if is_sadoc:
                cell.fill = highlight_fill
            elif row_idx % 2 == 1:
                cell.fill = zebra_fill
            else:
                cell.fill = white_fill

    # Set row heights
    ws.row_dimensions[1].height = 28
    for r in range(2, len(df) + 2):
        ws.row_dimensions[r].height = 42

    # Auto-fit columns with limits
    for col in ws.columns:
        max_len = 0
        col_letter = get_column_letter(col[0].column)
        for cell in col:
            val_str = str(cell.value or '')
            max_len = max(max_len, len(val_str))
        
        # Limit column widths to make it readable
        ws.column_dimensions[col_letter].width = min(max(max_len // 3 + 12, 14), 45)

    wb.save(excel_path)
    print(f"✅ Excel de justificación guardado exitosamente en: {excel_path}")

if __name__ == "__main__":
    generate_excel()
