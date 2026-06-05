# 🧪 Guía de Pruebas - Product Life Forensics Engine

## ✅ Checklist de Verificación

### 1. Configuración Inicial
- [x] API Key configurada en `config.local.js`
- [x] Modelo configurado: `gemini-3-flash-preview`
- [x] Versión de API: `v1beta`

### 2. Abrir la Aplicación
```bash
# Opción 1: Doble click
Doble click en index.html

# Opción 2: Desde terminal (macOS)
open index.html

# Opción 3: Servidor local (opcional)
python3 -m http.server 8080
# Luego abre: http://localhost:8080
```

---

## 🧪 Pruebas Funcionales

### Test 1: Modo Texto
**Objetivo:** Verificar análisis básico

1. Abre la aplicación
2. Asegúrate de estar en la pestaña "📝 Texto"
3. Ingresa:
   - **Nombre:** `Lavadora LG WM3900HWA`
   - **Descripción:** `Lavadora de carga frontal, capacidad 20kg, motor inverter direct drive, tambor de acero inoxidable`
4. Click en "🚀 Analizar Producto"
5. **Espera ~10-15 segundos**

**Resultado esperado:**
- ✅ Aparece sección de resultados
- ✅ Resumen ejecutivo con vida útil estimada
- ✅ Tabla de componentes (Motor, Tambor, Bomba, etc.)
- ✅ Gráfico de barras colorido
- ✅ Recomendaciones de ecodiseño

---

### Test 2: Modo Imagen
**Objetivo:** Verificar análisis visual

1. Descarga una imagen de prueba:
   - Busca en Google: "washing machine product photo"
   - Guarda una imagen de alta calidad
2. Selecciona pestaña "🖼️ Imagen"
3. Arrastra la imagen al área de upload
4. Verifica que aparezca la vista previa
5. Click en "🚀 Analizar Producto"

**Resultado esperado:**
- ✅ Gemini analiza la imagen
- ✅ Identifica marca/modelo si es visible
- ✅ Componentes detectados visualmente

---

### Test 3: Exportar PDF
**Objetivo:** Verificar generación de documento

1. Después de cualquier análisis exitoso
2. Scroll hasta el final de los resultados
3. Click en "📄 Generar Informe PDF"
4. **Espera ~2-3 segundos**

**Resultado esperado:**
- ✅ Botón cambia a "⏳ Generando PDF..."
- ✅ Se descarga archivo: `Analisis_[Producto]_[timestamp].pdf`
- ✅ El PDF contiene:
  - Header azul con logo
  - Resumen ejecutivo
  - Tabla de componentes con colores
  - Gráfico como imagen
  - Recomendaciones con fondo amarillo
  - Paginación

---

### Test 4: Persistencia
**Objetivo:** Verificar localStorage

1. Realiza un análisis (cualquier modo)
2. **Cierra la pestaña del navegador completamente**
3. Vuelve a abrir `index.html`

**Resultado esperado:**
- ✅ El último análisis aparece automáticamente
- ✅ En consola del navegador (F12): "✅ Último análisis restaurado desde localStorage"

---

### Test 5: Validación de Errores
**Objetivo:** Verificar manejo de errores

**Caso A: Sin API Key**
1. Renombra temporalmente `config.local.js` a `config.local.js.bak`
2. Abre `index.html`

**Resultado esperado:**
- ✅ Alert: "⚠️ Configura tu API Key en config.local.js"

**Caso B: Sin datos de entrada**
1. En modo Texto, deja todo vacío
2. Click en "🚀 Analizar Producto"

**Resultado esperado:**
- ✅ Mensaje de error: "Por favor, ingresa información del producto"

**Caso C: Imagen muy grande**
1. Intenta subir una imagen > 5MB

**Resultado esperado:**
- ✅ Alert: "La imagen debe ser menor a 5MB"

---

## 🔍 Verificación de Consola

Abre DevTools (F12) y revisa:

### Consola (Tab: Console)
Deberías ver:
```
✅ Último análisis restaurado desde localStorage
```

### Network (Tab: Red)
Al hacer un análisis, busca:
```
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent
Status: 200 OK
```

### Application (Tab: Aplicación)
En `Local Storage > file://`:
```
plfe_last_analysis: {...}
plfe_analysis_history: [...]
GEMINI_API_KEY: AIza...
```

---

## 🐛 Troubleshooting

### Error: "API Key no configurada"
**Solución:**
```javascript
// Abre consola (F12) y ejecuta:
localStorage.setItem('GEMINI_API_KEY', 'TU_API_KEY');
location.reload();
```

### Error: "No se recibió respuesta válida de Gemini"
**Posibles causas:**
1. API Key inválida → Verifica en Google AI Studio
2. Cuota excedida → Revisa límites de uso
3. Modelo incorrecto → Cambia a `gemini-1.5-flash` en `core/config.js`

### Error al generar PDF: "jsPDF no está cargado"
**Solución:**
- Verifica conexión a internet (jsPDF se carga vía CDN)
- Refresca la página (Ctrl+F5 / Cmd+Shift+R)

### El gráfico no aparece en el PDF
**Solución:**
- Espera 2-3 segundos antes de exportar (para que Chart.js renderice)
- Ya está implementado un delay de 500ms automático

---

## 📊 Métricas de Rendimiento Esperadas

| Operación | Tiempo Esperado |
|-----------|-----------------|
| Carga inicial | < 1 segundo |
| Análisis (solo texto) | 5-10 segundos |
| Análisis (con imagen) | 10-20 segundos |
| Generación de PDF | 2-3 segundos |
| Restauración de localStorage | < 100ms |

---

## ✅ Checklist Final de Funcionalidades

- [x] Entrada multimodal (texto/imagen/híbrido)
- [x] Integración con Gemini API
- [x] Tabla de componentes con clasificación
- [x] Gráfico de vida útil interactivo
- [x] Recomendaciones de ecodiseño
- [x] Exportación a PDF profesional
- [x] Persistencia automática
- [x] Restauración al recargar
- [x] API versión configurable
- [x] Manejo robusto de errores

---

## 🎯 Casos de Uso Recomendados

### Para Evaluaciones de Impacto Ambiental (EIA)
1. Analiza productos que se instalarán en el proyecto
2. Exporta PDF para anexar al informe RIAM
3. Usa las recomendaciones para medidas de mitigación

### Para Diseño de Productos
1. Analiza prototipos antes de fabricar
2. Identifica componentes de alta falla
3. Mejora el diseño según recomendaciones

### Para Educación
1. Enseña principios de ecodiseño
2. Demuestra la "Ley del Eslabón Más Débil"
3. Compara productos sustentables vs. no sustentables

---

**Si todas las pruebas pasan, la aplicación está lista para uso en producción local.** ✅
