// core/config.js

export const CONFIG = {
    // API Configuration
    GEMINI_API_KEY: '', // La clave la gestiona el backend (variable de entorno GEMINI_API_KEY en HF Secrets)
    GEMINI_MODEL: 'gemini-3.5-flash',
    API_VERSION: 'v1beta',
    API_ENDPOINT: 'https://generativelanguage.googleapis.com/',
    
    // App Settings
    MAX_IMAGE_SIZE: 5 * 1024 * 1024, // 5MB
    SUPPORTED_FORMATS: ['image/jpeg', 'image/png', 'image/webp'],
    
    // UI Settings
    ANIMATION_DURATION: 300,
};

// Construye el endpoint completo
export function getAPIEndpoint() {
    return `${CONFIG.API_ENDPOINT}${CONFIG.API_VERSION}/models/`;
}

// Inicializar API Key
export function initializeAPIKey() {
    if (!CONFIG.GEMINI_API_KEY || CONFIG.GEMINI_API_KEY.trim() === '') {
        return null;
    }
    return CONFIG.GEMINI_API_KEY;
}

// Función para actualizar API Key
export function updateAPIKey(newKey) {
    CONFIG.GEMINI_API_KEY = newKey;
}

// Función para obtener API Key actual
export function getAPIKey() {
    return CONFIG.GEMINI_API_KEY;
}
