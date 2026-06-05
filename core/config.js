// core/config.js

export const CONFIG = {
    // API Configuration
    GEMINI_API_KEY: '', // Se carga dinámicamente si existe
    GEMINI_MODEL: 'gemini-3-flash-preview',
    API_VERSION: 'v1beta', // Cambiar a 'v1alpha' si el modelo lo requiere
    API_ENDPOINT: 'https://generativelanguage.googleapis.com/',
    
    // App Settings
    MAX_IMAGE_SIZE: 5 * 1024 * 1024, // 5MB
    SUPPORTED_FORMATS: ['image/jpeg', 'image/png', 'image/webp'],
    
    // UI Settings
    ANIMATION_DURATION: 300,
};

// Cargar la API Key local de forma dinámica para no romper el despliegue en producción
async function loadLocalConfig() {
    try {
        const module = await import('../config.local.js');
        if (module && module.LOCAL_CONFIG) {
            CONFIG.GEMINI_API_KEY = module.LOCAL_CONFIG.GEMINI_API_KEY;
            console.log('✅ API Key cargada desde config.local.js');
        }
    } catch (e) {
        console.warn('⚠️ No se encontró config.local.js o la API Key local está vacía. Se usará el backend con clave de servidor.');
    }
}

loadLocalConfig();

// Construye el endpoint completo
export function getAPIEndpoint() {
    return `${CONFIG.API_ENDPOINT}${CONFIG.API_VERSION}/models/`;
}

// Inicializar API Key (ya cargada desde config.local.js)
export function initializeAPIKey() {
    // Validar que existe la API Key
    if (!CONFIG.GEMINI_API_KEY || CONFIG.GEMINI_API_KEY.trim() === '') {
        console.error('⚠️ API Key no configurada. Edita config.local.js y agrega tu Gemini API Key.');
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
