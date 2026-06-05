// core/storage.js
/**
 * Módulo de persistencia local para guardar análisis
 */

const STORAGE_KEYS = {
    LAST_ANALYSIS: 'plfe_last_analysis',
    ANALYSIS_HISTORY: 'plfe_analysis_history'
};

/**
 * Guarda un análisis en localStorage
 */
export function saveAnalysis(analysis) {
    try {
        // Agregar timestamp
        const analysisWithMeta = {
            ...analysis,
            timestamp: Date.now(),
            date: new Date().toISOString()
        };
        
        // Guardar como último análisis
        localStorage.setItem(STORAGE_KEYS.LAST_ANALYSIS, JSON.stringify(analysisWithMeta));
        
        // Agregar al historial (máximo 5)
        const history = getAnalysisHistory();
        history.unshift(analysisWithMeta);
        
        // Mantener solo los últimos 5
        const trimmedHistory = history.slice(0, 5);
        localStorage.setItem(STORAGE_KEYS.ANALYSIS_HISTORY, JSON.stringify(trimmedHistory));
        
        return true;
    } catch (error) {
        console.error('Error al guardar análisis:', error);
        return false;
    }
}

/**
 * Recupera el último análisis guardado
 */
export function getLastAnalysis() {
    try {
        const data = localStorage.getItem(STORAGE_KEYS.LAST_ANALYSIS);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        console.error('Error al recuperar último análisis:', error);
        return null;
    }
}

/**
 * Recupera el historial de análisis
 */
export function getAnalysisHistory() {
    try {
        const data = localStorage.getItem(STORAGE_KEYS.ANALYSIS_HISTORY);
        return data ? JSON.parse(data) : [];
    } catch (error) {
        console.error('Error al recuperar historial:', error);
        return [];
    }
}

/**
 * Limpia todo el almacenamiento
 */
export function clearStorage() {
    try {
        localStorage.removeItem(STORAGE_KEYS.LAST_ANALYSIS);
        localStorage.removeItem(STORAGE_KEYS.ANALYSIS_HISTORY);
        return true;
    } catch (error) {
        console.error('Error al limpiar almacenamiento:', error);
        return false;
    }
}

/**
 * Verifica si hay un análisis guardado
 */
export function hasStoredAnalysis() {
    return !!localStorage.getItem(STORAGE_KEYS.LAST_ANALYSIS);
}
