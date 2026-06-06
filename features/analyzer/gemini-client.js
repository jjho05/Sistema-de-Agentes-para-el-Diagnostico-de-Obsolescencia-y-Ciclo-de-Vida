// features/analyzer/gemini-client.js
import { CONFIG, getAPIKey, getAPIEndpoint } from '../../core/config.js';
import { SYSTEM_PROMPT, buildUserPrompt } from '../../core/prompts.js';
import { extractBase64, getMimeType, safeJSONParse } from '../../core/utils.js';

/**
 * Llama al backend SADOC para analizar un producto
 */
export async function analyzeProduct(productData) {
    const apiKey = getAPIKey() || '';
    const { productName, description, imageData } = productData;

    const endpoint = window.location.protocol === 'file:'
        ? 'http://127.0.0.1:8000/api/analyze'
        : '/api/analyze';

    const requestBody = { productName, description, imageData };

    try {
        const headers = { 'Content-Type': 'application/json' };
        if (apiKey) headers['X-Gemini-API-Key'] = apiKey;

        const response = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `Error HTTP ${response.status}`);
        }

        const analysis = await response.json();
        return normalizeAndValidate(analysis);

    } catch (error) {
        console.error('[SADOC] Error en análisis multi-agente:', error);
        throw error;
    }
}

/**
 * Normaliza y valida el análisis, rellenando campos faltantes con defaults seguros
 */
function normalizeAndValidate(analysis) {
    // Campos requeridos con defaults
    const normalized = {
        productName:        analysis.productName        || 'Producto Sin Nombre',
        estimatedLifespan:  analysis.estimatedLifespan  ?? 0,
        weakestLink:        analysis.weakestLink        || 'No identificado',
        carbonFootprint:    analysis.carbonFootprint    || 'N/D',
        confidenceScore:    analysis.confidenceScore    || 'Medio',
        summary:            analysis.summary            || 'Análisis completado.',
        consensusLog:       analysis.consensusLog       || 'Consenso alcanzado sin disputas.',
        reparabilityIndex:  normalizeReparability(analysis.reparabilityIndex),
        components:         normalizeComponents(analysis.components),
        recommendations:    Array.isArray(analysis.recommendations) ? analysis.recommendations : [],
        sources:            Array.isArray(analysis.sources) ? analysis.sources : [],
    };

    if (normalized.components.length === 0) {
        throw new Error('El análisis no contiene componentes válidos.');
    }

    return normalized;
}

function normalizeReparability(data) {
    if (!data) return { score: 0, label: 'No evaluado', details: '' };
    return {
        score:   typeof data.score === 'number' ? data.score : 0,
        label:   data.label   || 'Sin clasificación',
        details: data.details || '',
    };
}

function normalizeComponents(components) {
    if (!Array.isArray(components)) return [];
    return components.map((c, i) => ({
        name:               c.name               || `Componente ${i + 1}`,
        material:           c.material           || 'Desconocido',
        massGrams:          c.massGrams          ?? null,
        lifespanYears:      typeof c.lifespanYears === 'number' ? c.lifespanYears : 0,
        failureMode:        c.failureMode        || 'No especificado',
        repairabilityScore: typeof c.repairabilityScore === 'number' ? c.repairabilityScore : 5,
        environmentalImpact: c.environmentalImpact || 'Medium',
        isCritical:         c.isCritical         ?? false,
        normativeReference: c.normativeReference || '-',
    }));
}
