// core/utils.js

/**
 * Convierte una imagen File a Base64
 */
export async function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/**
 * Valida el tamaño y formato de una imagen
 */
export function validateImage(file, maxSize = 5 * 1024 * 1024) {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    
    if (!validTypes.includes(file.type)) {
        throw new Error('Formato no soportado. Usa JPG, PNG o WebP.');
    }
    
    if (file.size > maxSize) {
        throw new Error(`La imagen debe ser menor a ${maxSize / 1024 / 1024}MB`);
    }
    
    return true;
}

/**
 * Extrae solo la parte Base64 de un data URL
 */
export function extractBase64(dataUrl) {
    return dataUrl.split(',')[1];
}

/**
 * Obtiene el MIME type de un data URL
 */
export function getMimeType(dataUrl) {
    const match = dataUrl.match(/data:([^;]+);/);
    return match ? match[1] : 'image/jpeg';
}

/**
 * Muestra/oculta elementos con animación
 */
export function toggleElement(element, show, animationClass = 'fade-in') {
    if (show) {
        element.style.display = 'block';
        element.classList.add(animationClass);
    } else {
        element.classList.remove(animationClass);
        element.style.display = 'none';
    }
}

/**
 * Muestra un mensaje de error
 */
export function showError(message, details = '') {
    const errorSection = document.getElementById('error-section');
    const errorMessage = document.getElementById('error-message');
    
    errorMessage.textContent = message;
    if (details) {
        errorMessage.textContent += `\n\nDetalles: ${details}`;
    }
    
    toggleElement(errorSection, true);
}

/**
 * Limpia mensajes de error
 */
export function clearError() {
    const errorSection = document.getElementById('error-section');
    toggleElement(errorSection, false);
}

/**
 * Parsea JSON de forma segura, extrayendo el objeto JSON de cualquier texto
 */
export function safeJSONParse(text) {
    try {
        // 1. Intentar parseo directo (camino feliz)
        return JSON.parse(text);
    } catch (e) {
        // 2. Limpiar bloques de código markdown comunes
        let cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '');
        
        try {
            return JSON.parse(cleaned);
        } catch (e2) {
            // 3. Extracción Quirúrgica: Buscar el primer '{' y el último '}'
            const firstBrace = text.indexOf('{');
            const lastBrace = text.lastIndexOf('}');
            
            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                const jsonCandidate = text.substring(firstBrace, lastBrace + 1);
                try {
                    return JSON.parse(jsonCandidate);
                } catch (e3) {
                    // Si falla, puede haber problemas de escape en el JSON generado por la IA
                    console.error('JSON candidato inválido:', jsonCandidate);
                    throw new Error('La IA generó una estructura JSON malformada.');
                }
            }
            
            console.error('Texto recibido:', text);
            throw new Error('No se encontró una estructura JSON válida en la respuesta.');
        }
    }
}

/**
 * Formatea números con unidades
 */
export function formatYears(years) {
    if (years === 1) return '1 año';
    return `${years} años`;
}

/**
 * Obtiene clase CSS según el impacto ambiental
 */
export function getImpactClass(impact) {
    const classes = {
        'Low': 'impact-low',
        'Medium': 'impact-medium',
        'High': 'impact-high'
    };
    return classes[impact] || 'impact-medium';
}

/**
 * Obtiene clase CSS según el score de reparabilidad
 */
export function getRepairabilityClass(score) {
    if (score >= 7) return 'repair-high';
    if (score >= 4) return 'repair-medium';
    return 'repair-low';
}

/**
 * Debounce function para optimizar eventos
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Sistema de Notificaciones Toast
 */
export function showToast(message, type = 'info', title = '') {
    // Buscar o crear contenedor
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    
    // Crear elemento toast
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    // Icono según tipo
    let icon = 'ℹ️';
    let defaultTitle = 'Información';
    
    if (type === 'success') {
        icon = '✅';
        defaultTitle = 'Éxito';
    } else if (type === 'error') {
        icon = '❌';
        defaultTitle = 'Error';
    }
    
    const finalTitle = title || defaultTitle;
    
    toast.innerHTML = `
        <div class="toast-icon">${icon}</div>
        <div class="toast-content">
            <div class="toast-title">${finalTitle}</div>
            <div class="toast-message">${message}</div>
        </div>
    `;
    
    // Agregar al contenedor
    container.appendChild(toast);
    
    // Auto-eliminar después de 5 segundos
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.5s forwards';
        setTimeout(() => {
            if (toast.parentElement) {
                toast.parentElement.removeChild(toast);
            }
        }, 500);
    }, 5000);
    
    // Eliminar al click
    toast.addEventListener('click', () => {
        toast.style.animation = 'fadeOut 0.3s forwards';
        setTimeout(() => {
            if (toast.parentElement) {
                toast.parentElement.removeChild(toast);
            }
        }, 300);
    });
}
