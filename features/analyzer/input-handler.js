// features/analyzer/input-handler.js
import { initializeAPIKey } from '../../core/config.js';
import { fileToBase64, validateImage, showError, clearError, toggleElement, showToast } from '../../core/utils.js';
import { analyzeProduct } from './gemini-client.js';
import { renderResults } from '../results/ui-results.js';

let currentMode = 'text';
let currentImageData = null;

/**
 * Inicializa la aplicación
 */
export function initializeApp() {
    // Inicializar API Key
    const apiKey = initializeAPIKey();
    if (!apiKey && window.location.protocol === 'file:') {
        showToast('API Key no configurada. Revisa config.local.js', 'error', 'Configuración Faltante');
    }
    
    // Setup tabs
    setupTabs();
    
    // Setup upload areas
    setupUploadArea('upload-area', 'image-input', 'image-preview', 'preview-container', 'remove-image');
    setupUploadArea('hybrid-upload-area', 'hybrid-image-input', 'hybrid-image-preview', 'hybrid-preview-container', 'hybrid-remove-image');
    
    // Setup analyze button
    setupAnalyzeButton();
    
    // Setup search button
    setupSearch();
    
    // Setup retry button
    document.getElementById('retry-btn')?.addEventListener('click', () => {
        clearError();
        toggleElement(document.getElementById('results-section'), false);
    });
}

/**
 * Configura las pestañas de modo de entrada
 */
function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    const analyzeBtnSection = document.getElementById('analyze-btn')?.parentElement;
    
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.dataset.tab;
            
            // Actualizar botones
            tabButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Actualizar contenidos
            tabContents.forEach(content => {
                content.classList.remove('active');
            });
            
            const targetContent = document.getElementById(`${targetTab}-tab`);
            if (targetContent) {
                targetContent.classList.add('active');
            }
            
            currentMode = targetTab;
            currentImageData = null; // Reset imagen al cambiar de modo
            
            // Ocultar botón de analizar si estamos en pestaña buscar
            if (analyzeBtnSection) {
                analyzeBtnSection.style.display = targetTab === 'search' ? 'none' : 'block';
            }
        });
    });
}

/**
 * Configura un área de upload de imágenes
 */
function setupUploadArea(areaId, inputId, previewId, containerId, removeBtnId) {
    const uploadArea = document.getElementById(areaId);
    const imageInput = document.getElementById(inputId);
    const imagePreview = document.getElementById(previewId);
    const previewContainer = document.getElementById(containerId);
    const removeBtn = document.getElementById(removeBtnId);
    
    if (!uploadArea || !imageInput) return;
    
    // Click para abrir selector
    uploadArea.addEventListener('click', (e) => {
        if (e.target !== removeBtn) {
            imageInput.click();
        }
    });
    
    // Drag & Drop
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('drag-over');
    });
    
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('drag-over');
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');
        
        const file = e.dataTransfer.files[0];
        if (file) {
            handleImageUpload(file, imagePreview, previewContainer, uploadArea);
        }
    });
    
    // File input change
    imageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            handleImageUpload(file, imagePreview, previewContainer, uploadArea);
        }
    });
    
    // Botón de remover
    if (removeBtn) {
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            removeImage(imageInput, previewContainer, uploadArea);
        });
    }
}

/**
 * Maneja la carga de una imagen
 */
async function handleImageUpload(file, previewImg, previewContainer, uploadArea) {
    try {
        validateImage(file);
        
        const base64 = await fileToBase64(file);
        currentImageData = base64;
        
        // Mostrar preview
        previewImg.src = base64;
        previewContainer.style.display = 'block';
        uploadArea.querySelector('.upload-placeholder').style.display = 'none';
        
    } catch (error) {
        showToast(error.message, 'error', 'Error de Imagen');
        currentImageData = null;
    }
}

/**
 * Remueve la imagen cargada
 */
function removeImage(inputElement, previewContainer, uploadArea) {
    inputElement.value = '';
    currentImageData = null;
    previewContainer.style.display = 'none';
    uploadArea.querySelector('.upload-placeholder').style.display = 'block';
}

/**
 * Configura el botón de análisis
 */
function setupAnalyzeButton() {
    const analyzeBtn = document.getElementById('analyze-btn');
    
    analyzeBtn.addEventListener('click', async () => {
        clearError();
        
        try {
            const productData = collectProductData();
            
            if (!productData) {
                showError('Por favor, ingresa información del producto');
                return;
            }
            
            // Mostrar estado de carga
            setLoadingState(true);
            
            // Llamar a Gemini API
            const analysis = await analyzeProduct(productData);
            
            // Renderizar resultados
            renderResults(analysis);
            
            // Ocultar estado de carga
            setLoadingState(false);
            
        } catch (error) {
            setLoadingState(false);
            showError('Error al analizar el producto', error.message);
            console.error('Error:', error);
        }
    });
}

/**
 * Recolecta los datos del producto según el modo activo
 */
function collectProductData() {
    let productName = '';
    let description = '';
    let imageData = null;
    
    switch (currentMode) {
        case 'text':
            productName = document.getElementById('product-name').value.trim();
            description = document.getElementById('product-description').value.trim();
            
            if (!productName) return null;
            break;
            
        case 'image':
            imageData = currentImageData;
            
            if (!imageData) {
                showError('Por favor, sube una imagen del producto');
                return null;
            }
            break;
            
        case 'hybrid':
            productName = document.getElementById('hybrid-product-name').value.trim();
            description = document.getElementById('hybrid-description').value.trim();
            
            // En modo híbrido, obtener la imagen del área hybrid
            const hybridPreview = document.getElementById('hybrid-image-preview');
            if (hybridPreview.src && hybridPreview.src.startsWith('data:')) {
                imageData = hybridPreview.src;
            }
            
            if (!productName && !imageData) {
                showError('Por favor, ingresa el nombre del producto o sube una imagen');
                return null;
            }
            break;
    }
    
    return {
        productName,
        description,
        imageData
    };
}

/**
 * Controla el estado de carga del botón
 */
function setLoadingState(isLoading) {
    const analyzeBtn = document.getElementById('analyze-btn');
    const btnText = analyzeBtn.querySelector('.btn-text');
    const btnLoader = analyzeBtn.querySelector('.btn-loader');
    const resultsSection = document.getElementById('results-section');
    
    if (isLoading) {
        btnText.style.display = 'none';
        btnLoader.style.display = 'inline-flex';
        analyzeBtn.disabled = true;
        toggleElement(resultsSection, false);
    } else {
        btnText.style.display = 'inline';
        btnLoader.style.display = 'none';
        analyzeBtn.disabled = false;
    }
}

/**
 * Configura el buscador local de base de datos
 */
function setupSearch() {
    const searchBtn = document.getElementById('search-db-btn');
    const searchInput = document.getElementById('search-query');
    
    if (!searchBtn || !searchInput) return;
    
    searchBtn.addEventListener('click', async () => {
        const query = searchInput.value.trim();
        if (!query) {
            showToast('Por favor, ingresa un término de búsqueda', 'error', 'Búsqueda vacía');
            return;
        }
        
        try {
            searchBtn.disabled = true;
            searchBtn.textContent = '⏳ Buscando...';
            const baseUrl = window.location.protocol === 'file:' ? 'http://127.0.0.1:8000' : '';
            const response = await fetch(`${baseUrl}/api/search?q=${encodeURIComponent(query)}`);
            if (!response.ok) {
                throw new Error('Error al conectar con la base de datos');
            }
            
            const data = await response.json();
            renderSearchResults(data.matches);
            
            searchBtn.disabled = false;
            searchBtn.textContent = '🔍 Buscar';
            
        } catch (error) {
            console.error('Error de búsqueda:', error);
            showToast(error.message, 'error', 'Error de Conexión');
            searchBtn.disabled = false;
            searchBtn.textContent = '🔍 Buscar';
        }
    });
    
    // Permitir buscar presionando Enter
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            searchBtn.click();
        }
    });
}

/**
 * Renderiza los resultados de búsqueda de la base de datos
 */
function renderSearchResults(matches) {
    const resultsContainer = document.getElementById('search-results-container');
    const resultsList = document.getElementById('search-results-list');
    
    if (!resultsContainer || !resultsList) return;
    
    resultsList.innerHTML = '';
    
    if (!matches || matches.length === 0) {
        resultsList.innerHTML = '<p style="text-align: center; color: var(--text-light); font-style: italic; padding: 2rem 0;">No se encontraron componentes en la base de datos.</p>';
        resultsContainer.style.display = 'block';
        return;
    }
    
    matches.forEach(item => {
        const card = document.createElement('div');
        card.style.background = 'var(--card-bg, #ffffff)';
        card.style.border = '1px solid var(--border-color, #e5e7eb)';
        card.style.borderRadius = 'var(--border-radius, 8px)';
        card.style.padding = '1rem';
        card.style.display = 'flex';
        card.style.flexDirection = 'column';
        card.style.gap = '0.5rem';
        card.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
        
        // Estilos para modo oscuro
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            card.style.background = '#1e293b';
            card.style.borderColor = '#334155';
        }
        
        const header = document.createElement('div');
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';
        
        const name = document.createElement('h4');
        name.style.margin = '0';
        name.style.fontSize = '1.05em';
        name.style.fontWeight = '600';
        name.textContent = item.productName;
        
        const badge = document.createElement('span');
        badge.style.fontSize = '0.75em';
        badge.style.padding = '0.2rem 0.5rem';
        badge.style.background = 'var(--border-color, #e5e7eb)';
        badge.style.borderRadius = '4px';
        badge.style.fontWeight = '500';
        badge.textContent = item.productType;
        
        header.appendChild(name);
        header.appendChild(badge);
        
        const details = document.createElement('div');
        details.style.fontSize = '0.85em';
        details.style.color = 'var(--text-light, #4b5563)';
        details.style.lineHeight = '1.4';
        
        // Color para impacto
        let impactColor = '#10b981'; // Green
        if (item.environmentalImpact === 'High') impactColor = '#ef4444'; // Red
        else if (item.environmentalImpact === 'Medium') impactColor = '#f59e0b'; // Orange
        
        details.innerHTML = `<strong>Componente:</strong> ${item.document.split(' - ')[1]} <br>
                             <strong>Masa:</strong> ${item.massGrams}g | 
                             <strong>Reparabilidad (EN 45554):</strong> ${item.repairabilityScore}/10 | 
                             <strong>Impacto (ISO 14040):</strong> <span style="color:${impactColor}; font-weight: 600;">${item.environmentalImpact}</span>`;
        
        const source = document.createElement('p');
        source.style.margin = '0';
        source.style.fontSize = '0.8em';
        source.style.color = 'var(--text-muted, #9ca3af)';
        source.style.fontStyle = 'italic';
        source.textContent = `Fuente: Babbitt et al. 2020 Laboratory Disassembly Dataset • ID: ${item.id}`;
        
        card.appendChild(header);
        card.appendChild(details);
        card.appendChild(source);
        resultsList.appendChild(card);
    });
    
    resultsContainer.style.display = 'block';
}
