// features/results/ui-results.js
import { formatYears, toggleElement, showToast } from '../../core/utils.js';
import { renderComponentsTable } from './components-table.js';
import { renderLifespanChart } from './charts.js';
import { generatePDF } from '../export/pdf-generator.js';
import { saveAnalysis } from '../../core/storage.js';

// Variable global para almacenar el último análisis
let currentAnalysis = null;

/**
 * Renderiza todos los resultados del análisis
 */
export function renderResults(analysis) {
    const resultsSection = document.getElementById('results-section');

    // Guardar análisis actual
    currentAnalysis = analysis;

    // Renderizar resumen ejecutivo
    renderSummary(analysis);

    // Renderizar tabla de componentes
    renderComponentsTable(analysis.components);

    // Renderizar gráfico
    renderLifespanChart(analysis.components);

    // Renderizar fuentes
    renderSources(analysis);

    // ⭐ NUEVO: Renderizar Consensus Log
    renderConsensus(analysis.consensusLog);

    // ⭐ NUEVO: Renderizar Reparabilidad Premium
    renderReparability(analysis.reparabilityIndex);

    // ⭐ NUEVO: Renderizar RIAM Matrix
    renderRIAM(analysis.riamMapping);

    // Renderizar recomendaciones
    renderRecommendations(analysis.recommendations);

    // Habilitar botón de exportación PDF
    setupPDFExport();

    // Mostrar sección de resultados
    toggleElement(resultsSection, true);

    // Scroll suave a resultados
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Renderiza el resumen ejecutivo
 */
function renderSummary(analysis) {
    const productTitle = document.getElementById('product-title');
    const lifespanValue = document.getElementById('lifespan-value');
    const weakestLink = document.getElementById('weakest-link');
    const summaryText = document.getElementById('summary-text');

    productTitle.textContent = analysis.productName;
    lifespanValue.textContent = formatYears(analysis.estimatedLifespan);
    weakestLink.textContent = analysis.weakestLink;
    summaryText.textContent = analysis.summary;

    // Aplicar color según la vida útil
    const lifespanBadge = document.querySelector('.lifespan-badge');
    lifespanBadge.classList.remove('lifespan-short', 'lifespan-medium', 'lifespan-long');

    if (analysis.estimatedLifespan < 3) {
        lifespanBadge.classList.add('lifespan-short');
    } else if (analysis.estimatedLifespan < 7) {
        lifespanBadge.classList.add('lifespan-medium');
    } else {
        lifespanBadge.classList.add('lifespan-long');
    }
}

/**
 * Renderiza las recomendaciones
 */
function renderRecommendations(recommendations) {
    const list = document.getElementById('recommendations-list');
    list.innerHTML = '';

    recommendations.forEach(rec => {
        const li = document.createElement('li');
        li.textContent = rec;
        list.appendChild(li);
    });
}

/**
 * Renderiza las fuentes y la confianza
 */
function renderSources(analysis) {
    const confidenceValue = document.getElementById('confidence-value');
    const sourcesList = document.getElementById('sources-list');

    if (!confidenceValue || !sourcesList) return;

    // Nivel de confianza
    if (analysis.confidenceScore) {
        confidenceValue.textContent = analysis.confidenceScore;

        // Color basado en nivel
        const val = analysis.confidenceScore.toLowerCase();
        if (val.includes('alto')) {
            confidenceValue.style.color = 'var(--success-color, #10b981)';
        } else if (val.includes('medio')) {
            confidenceValue.style.color = 'var(--warning-color, #f59e0b)';
        } else {
            confidenceValue.style.color = 'var(--danger-color, #ef4444)';
        }
    } else {
        confidenceValue.textContent = 'No evaluado';
        confidenceValue.style.color = 'inherit';
    }

    // Fuentes
    sourcesList.innerHTML = '';

    if (analysis.sources && analysis.sources.length > 0) {
        analysis.sources.forEach(source => {
            const li = document.createElement('li');
            li.style.marginBottom = '0.5rem';

            const title = document.createElement('strong');
            title.textContent = source.title;

            const context = document.createElement('p');
            context.textContent = source.urlOrContext;
            context.style.margin = '0.2rem 0 0 0';
            context.style.fontSize = '0.9em';
            context.style.color = 'var(--text-light, #6b7280)';

            li.appendChild(title);
            li.appendChild(context);
            sourcesList.appendChild(li);
        });
    } else {
        const li = document.createElement('li');
        li.textContent = "No se proporcionaron fuentes específicas.";
        li.style.fontStyle = 'italic';
        sourcesList.appendChild(li);
    }
}

/**
 * Configura el botón de exportación a PDF
 */
function setupPDFExport() {
    const exportBtn = document.getElementById('export-pdf-btn');

    if (!exportBtn) return;

    // Habilitar el botón
    exportBtn.disabled = false;
    exportBtn.textContent = '📄 Generar Informe PDF';

    // Remover listeners anteriores (si existen)
    const newBtn = exportBtn.cloneNode(true);
    exportBtn.parentNode.replaceChild(newBtn, exportBtn);

    // Agregar nuevo listener
    newBtn.addEventListener('click', async () => {
        if (!currentAnalysis) {
            showToast('No hay análisis disponible para exportar', 'error');
            return;
        }

        try {
            newBtn.disabled = true;
            newBtn.textContent = '⏳ Generando PDF...';

            // Esperar un momento para que el gráfico se renderice completamente
            await new Promise(resolve => setTimeout(resolve, 500));

            await generatePDF(currentAnalysis);
            showToast('Informe PDF generado correctamente', 'success');

            newBtn.disabled = false;
            newBtn.textContent = '📄 Generar Informe PDF';

        } catch (error) {
            console.error('Error al generar PDF:', error);
            showToast(`Error al generar PDF: ${error.message}`, 'error');
            newBtn.disabled = false;
            newBtn.textContent = '📄 Generar Informe PDF';
        }
    });
}
/**
 * Renderiza el log de consenso multi-agente
 */
function renderConsensus(log) {
    const logEl = document.getElementById('consensus-log');
    if (logEl) {
        logEl.textContent = log || 'Consenso alcanzado sin disputas significativas.';
    }
}

/**
 * Renderiza el índice de reparabilidad premium
 */
function renderReparability(data) {
    if (!data) return;
    
    const scoreEl = document.getElementById('reparability-score');
    const labelEl = document.getElementById('reparability-label');
    const mathEl = document.getElementById('reparability-math');
    
    if (scoreEl) scoreEl.textContent = data.score;
    if (labelEl) labelEl.textContent = data.label;
    if (mathEl) mathEl.textContent = data.details;
}

/**
 * Renderiza la matriz RIAM
 */
function renderRIAM(mapping) {
    if (!mapping) return;
    
    const categories = {
        'riam-pc': mapping.physicalChemical,
        'riam-be': mapping.biologicalEcological,
        'riam-sc': mapping.socialCultural,
        'riam-eo': mapping.economicOperational
    };
    
    for (const [id, data] of Object.entries(categories)) {
        const item = document.getElementById(id);
        if (item && data) {
            const scoreEl = item.querySelector('.riam-score');
            const reasonEl = item.querySelector('.riam-reason');
            
            scoreEl.textContent = data.score > 0 ? `+${data.score}` : data.score;
            reasonEl.textContent = data.reason;
            
            // Colores según puntaje
            scoreEl.classList.remove('riam-score-pos', 'riam-score-neg', 'riam-score-neu');
            if (data.score > 0) scoreEl.classList.add('riam-score-pos');
            else if (data.score < 0) scoreEl.classList.add('riam-score-neg');
            else scoreEl.classList.add('riam-score-neu');
        }
    }
}
