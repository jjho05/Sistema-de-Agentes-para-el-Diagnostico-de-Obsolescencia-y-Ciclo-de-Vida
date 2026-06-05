# 📖 Instrucciones de Uso

## Inicio Rápido (5 minutos)

### 1. Abrir la Aplicación
```bash
# Opción A: Doble click en index.html
# Opción B: Desde terminal
open index.html   # macOS
start index.html  # Windows
xdg-open index.html  # Linux
```

### 2. Configurar API Key

**Primera vez:**
1. Se abrirá un prompt pidiendo tu Gemini API Key
2. Ingresa tu key (formato: `AIzaSy...`)
3. Se guardará automáticamente en tu navegador

**Obtener API Key:**
- Visita: https://makersuite.google.com/app/apikey
- Inicia sesión con tu cuenta Google
- Crea un nuevo API Key
- Copia la key

**Cambiar API Key después:**
```javascript
// Abre la consola del navegador (F12) y ejecuta:
localStorage.removeItem('GEMINI_API_KEY');
// Recarga la página
```

### 3. Probar con Ejemplos

#### Ejemplo 1: Modo Texto
```
Nombre: Lavadora Samsung WF45R6100AC
Descripción: Lavadora de carga frontal, capacidad 18kg, motor inverter digital
```

#### Ejemplo 2: Modo Imagen
- Descarga una imagen de un electrodoméstico de Google Images
- Arrástrala al área de upload
- Click en "Analizar Producto"

#### Ejemplo 3: Modo Híbrido
```
Nombre: iPhone 13 Pro
Imagen: [foto del dispositivo]
Descripción: Smartphone de gama alta, batería de 3095mAh
```

---

## Solución de Problemas

### Error: "API Key no configurada"
**Causa:** No se ha ingresado la API Key
**Solución:**
1. Abre la consola del navegador (F12)
2. Ve a la pestaña "Console"
3. Ejecuta: `localStorage.setItem('GEMINI_API_KEY', 'TU_KEY_AQUÍ')`
4. Recarga la página

### Error: "Error en la petición a Gemini API"
**Posibles causas:**
1. API Key inválida o expirada
2. Cuota excedida (límite gratuito de Gemini)
3. Problemas de red

**Solución:**
- Verifica tu API Key en Google AI Studio
- Revisa el límite de uso en tu cuenta
- Intenta con una imagen más pequeña (< 2MB)

### La imagen no se carga
**Causa:** Formato no soportado o archivo muy grande
**Solución:**
- Usa formatos: JPG, PNG o WebP
- Tamaño máximo: 5MB
- Reduce la resolución si es necesario

### JSON inválido en la respuesta
**Causa:** Gemini devolvió texto en lugar de JSON
**Solución:**
- Reintenta el análisis (a veces ocurre aleatoriamente)
- Simplifica la descripción del producto
- El sistema tiene auto-limpieza de respuestas en `utils.js:safeJSONParse()`

---

## Configuración Avanzada

### Cambiar el Modelo de Gemini
Edita `core/config.js`:
```javascript
export const CONFIG = {
    GEMINI_MODEL: 'gemini-2.0-flash-exp',  // Cambia aquí
    // Otras opciones:
    // 'gemini-1.5-pro-latest'
    // 'gemini-1.5-flash-latest'
};
```

### Ajustar el System Prompt
Edita `core/prompts.js` para personalizar el comportamiento de la IA.

### Modificar Estilos
- `assets/css/main.css`: Variables CSS y estilos globales
- `assets/css/components.css`: Componentes específicos

---

## Estructura de la Respuesta JSON

La IA devuelve este formato:
```json
{
  "productName": "string",
  "estimatedLifespan": number,
  "weakestLink": "string",
  "summary": "string",
  "confidenceScore": "Alto | Medio | Bajo",
  "sources": [
    {
      "title": "string (nombre de la normativa o estudio)",
      "urlOrContext": "string (contexto técnico)"
    }
  ],
  "recommendations": ["string"],
  "components": [
    {
      "name": "string",
      "material": "string",
      "lifespanYears": number,
      "failureMode": "string (término técnico exacto)",
      "repairabilityScore": number,
      "environmentalImpact": "Low|Medium|High",
      "isCritical": boolean
    }
  ]
}
```

---

## Integración con RIAM

Esta herramienta está diseñada para complementar la metodología RIAM:

1. **Análisis del Producto** → Genera datos de durabilidad
2. **Componentes Críticos** → Identifica impactos ambientales
3. **Recomendaciones** → Medidas de mitigación para la matriz RIAM

### Exportar Resultados para RIAM (Próximamente)
- Botón "Generar Informe PDF"
- Incluirá secciones compatibles con EIA

---

## Mejores Prácticas

### Para Análisis Precisos:
1. **Modo Híbrido** siempre da mejores resultados
2. Proporciona marcas y modelos específicos
3. Incluye especificaciones técnicas cuando sea posible
4. Usa imágenes claras, bien iluminadas

### Para Productos Complejos:
- Divide en subsistemas si es muy grande
- Analiza cada módulo por separado
- Luego compara los "eslabones más débiles"

---

## Límites del Sistema

### Precisión de Estimaciones:
- Las estimaciones se basan en promedios industriales
- No sustituyen pruebas de laboratorio
- Son orientativas para decisiones de diseño

### Limitaciones Técnicas:
- Requiere conexión a internet
- Depende de la disponibilidad de Gemini API
- No funciona offline

---

## Contacto y Contribuciones

¿Encontraste un bug? ¿Tienes una idea?
- Reporta issues en el repositorio
- Abre Pull Requests con mejoras
- Documenta tus casos de uso

---

**¡Listo para analizar productos! 🚀**
