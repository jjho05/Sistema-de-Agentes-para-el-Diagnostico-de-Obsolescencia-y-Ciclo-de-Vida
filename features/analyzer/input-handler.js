// features/analyzer/input-handler.js
import { initializeAPIKey, updateAPIKey } from '../../core/config.js';
import { fileToBase64, validateImage, showError, clearError, toggleElement, showToast } from '../../core/utils.js';
import { analyzeProduct } from './gemini-client.js';
import { renderResults } from '../results/ui-results.js';

let currentMode = 'hybrid';
let currentImageData = null;

/**
 * Inicializa la aplicación
 */
export function initializeApp() {
    // Inicializar API Key desde el formulario o config
    setupApiKeyInput();
    
    // Setup tabs
    setupTabs();
    
    // Setup upload areas
    setupUploadArea('upload-area', 'image-input', 'image-preview', 'preview-container', 'remove-image');
    setupUploadArea('hybrid-upload-area', 'hybrid-image-input', 'hybrid-image-preview', 'hybrid-preview-container', 'hybrid-remove-image');
    
    // Setup analyze button
    setupAnalyzeButton();
    
    // Setup search button
    setupSearch();
    
    // Setup repositories button and actions
    setupRepositoryTab();
    
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
            
            // Ocultar botón de analizar si estamos en pestaña buscar o repositorio
            if (analyzeBtnSection) {
                analyzeBtnSection.style.display = (targetTab === 'search' || targetTab === 'repository') ? 'none' : 'block';
            }
            
            // Cargar historial de ensayos al activar la pestaña de repositorio
            if (targetTab === 'repository') {
                loadTrialsHistory();
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
                             <strong>Reparabilidad (Norma Europea):</strong> ${item.repairabilityScore}/10 | 
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

/**
 * Configura los botones de descarga de repositorios y actualizadores
 */
function setupRepositoryTab() {
    const downloadStandardBtn = document.getElementById('download-standard-btn');
    const downloadStandardExcelBtn = document.getElementById('download-standard-excel-btn');
    const downloadTrialsBtn = document.getElementById('download-trials-btn');
    const downloadTrialsExcelBtn = document.getElementById('download-trials-excel-btn');
    const baseUrl = window.location.protocol === 'file:' ? 'http://127.0.0.1:8000' : '';

    downloadStandardBtn?.addEventListener('click', () => {
        window.open(`${baseUrl}/api/download/standard`, '_blank');
    });

    downloadStandardExcelBtn?.addEventListener('click', () => {
        window.open(`${baseUrl}/api/download/standard/excel`, '_blank');
    });

    downloadTrialsBtn?.addEventListener('click', () => {
        window.open(`${baseUrl}/api/download/trials`, '_blank');
    });

    downloadTrialsExcelBtn?.addEventListener('click', () => {
        window.open(`${baseUrl}/api/download/trials/excel`, '_blank');
    });
}

/**
 * Carga el historial de ensayos clasificados desde el backend y los dibuja en la UI
 */
async function loadTrialsHistory() {
    const trialsList = document.getElementById('trials-list');
    const noTrialsMsg = document.getElementById('no-trials-message');
    if (!trialsList) return;

    try {
        const baseUrl = window.location.protocol === 'file:' ? 'http://127.0.0.1:8000' : '';
        const response = await fetch(`${baseUrl}/api/history`);
        if (!response.ok) throw new Error('Error al cargar historial del servidor');
        
        const data = await response.json();
        const history = data.history || [];

        // Limpiar lista
        trialsList.innerHTML = '';

        if (history.length === 0) {
            if (noTrialsMsg) {
                trialsList.appendChild(noTrialsMsg);
            } else {
                trialsList.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem 0; font-style: italic;">No se han realizado ensayos aún.</p>';
            }
            return;
        }

        history.forEach(trial => {
            const card = document.createElement('div');
            card.className = 'card';
            card.style.padding = '1.2rem';
            card.style.marginBottom = '0.8rem';
            card.style.border = '1px solid var(--border-color)';
            card.style.background = 'rgba(255, 255, 255, 0.01)';
            card.style.display = 'flex';
            card.style.gap = '1.2rem';
            card.style.alignItems = 'flex-start';

            // Imagen del producto si existe
            if (trial.imageData) {
                const imgContainer = document.createElement('div');
                imgContainer.style.width = '100px';
                imgContainer.style.height = '100px';
                imgContainer.style.borderRadius = '8px';
                imgContainer.style.overflow = 'hidden';
                imgContainer.style.border = '1px solid var(--border-color)';
                imgContainer.style.flexShrink = '0';
                imgContainer.style.display = 'flex';
                imgContainer.style.alignItems = 'center';
                imgContainer.style.justifyContent = 'center';
                imgContainer.style.background = '#090d16';

                const img = document.createElement('img');
                img.src = trial.imageData;
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.objectFit = 'cover';
                imgContainer.appendChild(img);
                card.appendChild(imgContainer);
            }

            // Info del ensayo
            const infoContainer = document.createElement('div');
            infoContainer.style.flex = '1';

            const title = document.createElement('h4');
            title.style.margin = '0 0 0.5rem 0';
            title.style.fontSize = '1.05em';
            title.style.color = '#fff';
            title.textContent = `🔬 ${trial.productName}`;

            const meta = document.createElement('p');
            meta.style.margin = '0 0 0.8rem 0';
            meta.style.fontSize = '0.8em';
            meta.style.color = 'var(--text-muted, #9ca3af)';
            meta.textContent = `Ensayo ID: ${trial.id} • Fecha: ${trial.timestamp}`;

            const stats = document.createElement('div');
            stats.style.display = 'flex';
            stats.style.flexWrap = 'wrap';
            stats.style.gap = '0.8rem';
            stats.style.marginBottom = '0.8rem';
            stats.style.fontSize = '0.85em';

            const lifespanBadge = document.createElement('span');
            lifespanBadge.style.padding = '0.2rem 0.6rem';
            lifespanBadge.style.borderRadius = '20px';
            lifespanBadge.style.background = 'rgba(59, 130, 246, 0.1)';
            lifespanBadge.style.color = '#60a5fa';
            lifespanBadge.style.border = '1px solid rgba(59, 130, 246, 0.2)';
            lifespanBadge.textContent = `⏱️ Vida útil: ${trial.estimatedLifespan} años`;

            const repBadge = document.createElement('span');
            repBadge.style.padding = '0.2rem 0.6rem';
            repBadge.style.borderRadius = '20px';
            repBadge.style.background = 'rgba(16, 185, 129, 0.1)';
            repBadge.style.color = '#34d399';
            repBadge.style.border = '1px solid rgba(16, 185, 129, 0.2)';
            repBadge.textContent = `⚙️ Reparabilidad: ${trial.reparabilityIndex?.score || 'N/D'}/10`;

            const co2Badge = document.createElement('span');
            co2Badge.style.padding = '0.2rem 0.6rem';
            co2Badge.style.borderRadius = '20px';
            co2Badge.style.background = 'rgba(245, 158, 11, 0.1)';
            co2Badge.style.color = '#fbbf24';
            co2Badge.style.border = '1px solid rgba(245, 158, 11, 0.2)';
            co2Badge.textContent = `🌱 Huella: ${trial.carbonFootprint}`;

            stats.appendChild(lifespanBadge);
            stats.appendChild(repBadge);
            stats.appendChild(co2Badge);

            const summary = document.createElement('p');
            summary.style.margin = '0';
            summary.style.fontSize = '0.85em';
            summary.style.color = 'var(--text-secondary)';
            summary.style.lineHeight = '1.4';
            summary.textContent = trial.summary;

            infoContainer.appendChild(title);
            infoContainer.appendChild(meta);
            infoContainer.appendChild(stats);
            infoContainer.appendChild(summary);
            card.appendChild(infoContainer);

            trialsList.appendChild(card);
        });

    } catch (error) {
        console.error('Error cargando historial de ensayos:', error);
        trialsList.innerHTML = `<p style="text-align: center; color: #ef4444; padding: 2rem 0; font-style: italic;">Error al conectar con el servidor para obtener los ensayos.</p>`;
    }
}

function setupApiKeyInput() {
    const apiInput = document.getElementById('api-key-input');
    const saveBtn = document.getElementById('save-api-key');
    const keyStatus = document.getElementById('api-key-status');
    
    // Cargar clave guardada de localStorage
    const savedKey = localStorage.getItem('sadoc_gemini_api_key');
    if (savedKey) {
        if (apiInput) apiInput.value = savedKey;
        updateAPIKey(savedKey);
        if (keyStatus) {
            keyStatus.style.display = 'inline';
            keyStatus.textContent = '✓ Guardada';
        }
    } else {
        // Fallback a config.local.js
        const apiKey = initializeAPIKey();
        if (apiKey) {
            if (apiInput) apiInput.value = apiKey;
            if (keyStatus) {
                keyStatus.style.display = 'inline';
                keyStatus.textContent = '✓ Configurada';
            }
        } else if (window.location.protocol === 'file:') {
            showToast('Ingresa tu API Key en la barra lateral para continuar.', 'warning', 'Clave API Pendiente');
        }
    }
    
    if (saveBtn && apiInput) {
        saveBtn.addEventListener('click', () => {
            const newKey = apiInput.value.trim();
            if (newKey) {
                localStorage.setItem('sadoc_gemini_api_key', newKey);
                updateAPIKey(newKey);
                showToast('API Key guardada correctamente', 'success');
                if (keyStatus) {
                    keyStatus.style.display = 'inline';
                    keyStatus.textContent = '✓ Guardada';
                }
            } else {
                localStorage.removeItem('sadoc_gemini_api_key');
                updateAPIKey('');
                showToast('API Key eliminada', 'info');
                if (keyStatus) keyStatus.style.display = 'none';
            }
        });
    }
}
