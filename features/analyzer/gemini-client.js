// features/analyzer/gemini-client.js
import { CONFIG, getAPIKey, getAPIEndpoint } from '../../core/config.js';
import { SYSTEM_PROMPT, buildUserPrompt } from '../../core/prompts.js';
import { extractBase64, getMimeType, safeJSONParse } from '../../core/utils.js';

/**
 * Llama a Gemini API para analizar un producto
 */
export async function analyzeProduct(productData) {
    const apiKey = getAPIKey() || '';
    const { productName, description, imageData } = productData;
    
    // Cambiamos el endpoint para apuntar a nuestro backend de forma relativa o local
    const endpoint = window.location.protocol === 'file:' ? 'http://127.0.0.1:8000/api/analyze' : '/api/analyze';
    
    const requestBody = {
        productName,
        description,
        imageData
    };
    
    try {
        const headers = {
            'Content-Type': 'application/json'
        };
        if (apiKey) {
            headers['X-Gemini-API-Key'] = apiKey;
        }
        
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = errorData.detail || `Error HTTP ${response.status}`;
            throw new Error(`Error en Backend Multi-Agente: ${errorMessage}`);
        }
        
        const analysis = await response.json();
        
        // Validar estructura
        validateAnalysis(analysis);
        
        return analysis;
        
    } catch (error) {
        console.error('Error en el análisis multi-agente:', error);
        throw error;
    }
}

/**
 * Construye el array de contenidos para la petición
 */
function buildRequestContents(productName, description, imageData) {
    const parts = [];
    
    // Agregar prompt de usuario
    const userPrompt = buildUserPrompt(productName, description, !!imageData);
    parts.push({ text: userPrompt });
    
    // Si hay imagen, agregarla
    if (imageData) {
        const base64Data = extractBase64(imageData);
        const mimeType = getMimeType(imageData);
        
        parts.push({
            inlineData: {
                mimeType: mimeType,
                data: base64Data
            }
        });
    }
    
    return [{
        role: 'user',
        parts: parts
    }];
}

/**
 * Extrae el texto de la respuesta de Gemini
 */
function extractTextFromResponse(data) {
    if (!data.candidates || data.candidates.length === 0) {
        throw new Error('No se recibió respuesta válida de Gemini');
    }
    
    const candidate = data.candidates[0];
    
    if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
        throw new Error('Respuesta vacía de Gemini');
    }
    
    return candidate.content.parts[0].text;
}

/**
 * Valida que el análisis tenga la estructura correcta
 */
function validateAnalysis(analysis) {
    const requiredFields = [
        'productName', 'estimatedLifespan', 'weakestLink', 'summary', 
        'recommendations', 'components', 'consensusLog', 
        'reparabilityIndex', 'riamMapping'
    ];
    
    for (const field of requiredFields) {
        if (!(field in analysis)) {
            throw new Error(`Análisis incompleto: falta el campo '${field}'`);
        }
    }
    
    if (!Array.isArray(analysis.components) || analysis.components.length === 0) {
        throw new Error('El análisis debe contener al menos un componente');
    }
    
    // Validar cada componente
    const componentFields = ['name', 'material', 'lifespanYears', 'failureMode', 'repairabilityScore', 'environmentalImpact', 'isCritical', 'normativeReference'];
    
    analysis.components.forEach((comp, idx) => {
        for (const field of componentFields) {
            if (!(field in comp)) {
                // Warning en lugar de error para normativa
                console.warn(`Componente ${idx + 1} no tiene campo '${field}'`);
            }
        }
    });
    
    return true;
}
