// features/results/ui-results.js
import { formatYears, toggleElement, showToast } from '../../core/utils.js';
import { renderComponentsTable } from './components-table.js';
import { generatePDF } from '../export/pdf-generator.js';
import { saveAnalysis } from '../../core/storage.js';

let currentAnalysis = null;

/**
 * Renderiza todos los resultados del análisis
 */
export function renderResults(analysis) {
    currentAnalysis = analysis;

    renderSummary(analysis);
    renderReparability(analysis.reparabilityIndex);
    renderComponentsTable(analysis.components);
    renderSources(analysis);
    renderRecommendations(analysis.recommendations);
    renderConsensus(analysis.consensusLog);
    setupPDFExport();

    // Guardar en historial (función síncrona — no devuelve Promise)
    try { saveAnalysis(analysis); } catch (err) { console.warn('[SADOC] No se pudo guardar:', err); }

    const resultsSection = document.getElementById('results-section');
    toggleElement(resultsSection, true);
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Renderiza el resumen ejecutivo con KPIs
 */
function renderSummary(analysis) {
    // Nombre del producto
    setTextById('product-title', analysis.productName);

    // Vida útil con badge de color
    const lifespanBadge = document.querySelector('.lifespan-badge');
    const lifespanEl = document.getElementById('lifespan-value');
    if (lifespanEl) lifespanEl.textContent = formatYears(analysis.estimatedLifespan);
    if (lifespanBadge) {
        lifespanBadge.classList.remove('lifespan-short', 'lifespan-medium', 'lifespan-long');
        if (analysis.estimatedLifespan < 3)      lifespanBadge.classList.add('lifespan-short');
        else if (analysis.estimatedLifespan < 7)  lifespanBadge.classList.add('lifespan-medium');
        else                                       lifespanBadge.classList.add('lifespan-long');
    }

    // KPI: Reparabilidad
    const kpiRep = document.getElementById('kpi-repairability');
    if (kpiRep) {
        const score = analysis.reparabilityIndex?.score ?? '?';
        kpiRep.textContent = `${score} / 10`;
        kpiRep.style.color = score >= 7 ? 'var(--color-success)' : score >= 4 ? 'var(--color-warning)' : 'var(--color-danger)';
    }

    // KPI: Componente Crítico
    const kpiWeak = document.getElementById('weakest-link');
    if (kpiWeak) kpiWeak.textContent = analysis.weakestLink || '—';

    // KPI: Confianza
    const kpiConf = document.getElementById('kpi-confidence');
    if (kpiConf) {
        kpiConf.textContent = analysis.confidenceScore || '—';
        const val = (analysis.confidenceScore || '').toLowerCase();
        if (val.includes('alto'))  kpiConf.style.color = 'var(--color-success)';
        else if (val.includes('medio')) kpiConf.style.color = 'var(--color-warning)';
        else kpiConf.style.color = 'var(--color-danger)';
    }

    // KPI: Huella de carbono (si el badge existe)
    const kpiCo2 = document.getElementById('kpi-carbon');
    if (kpiCo2) kpiCo2.textContent = analysis.carbonFootprint || '—';

    // Texto resumen
    setTextById('summary-text', analysis.summary);

    // Confianza en fuentes (legacy, por si existe el badge)
    const confLegacy = document.getElementById('confidence-value');
    if (confLegacy) {
        confLegacy.textContent = analysis.confidenceScore || '—';
        const val = (analysis.confidenceScore || '').toLowerCase();
        confLegacy.style.color = val.includes('alto') ? 'var(--color-success)' : val.includes('medio') ? 'var(--color-warning)' : 'var(--color-danger)';
    }
}

/**
 * Renderiza el índice de reparabilidad
 */
function renderReparability(data) {
    if (!data) return;
    setTextById('reparability-score', data.score ?? '—');
    setTextById('reparability-label', data.label || '');
    setTextById('reparability-math', data.details || '');

    // Color dinámico del círculo
    const circle = document.querySelector('.reparability-score-circle');
    if (circle) {
        const score = data.score ?? 0;
        if (score >= 7) {
            circle.style.background = 'radial-gradient(circle, #10b981 0%, #059669 100%)';
            circle.style.boxShadow = '0 0 15px rgba(16, 185, 129, 0.4)';
        } else if (score >= 4) {
            circle.style.background = 'radial-gradient(circle, #f59e0b 0%, #d97706 100%)';
            circle.style.boxShadow = '0 0 15px rgba(245, 158, 11, 0.4)';
        } else {
            circle.style.background = 'radial-gradient(circle, #ef4444 0%, #dc2626 100%)';
            circle.style.boxShadow = '0 0 15px rgba(239, 68, 68, 0.4)';
        }
    }
}

/**
 * Renderiza el log de consenso multi-agente
 */
function renderConsensus(log) {
    setTextById('consensus-log', log || 'Consenso alcanzado. Sin disputas significativas entre agentes.');
}

/**
 * Renderiza las fuentes
 */
function renderSources(analysis) {
    const sourcesList = document.getElementById('sources-list');
    if (!sourcesList) return;
    sourcesList.innerHTML = '';

    const sources = analysis.sources && analysis.sources.length > 0
        ? analysis.sources
        : [{ title: 'Benchmark Babbitt et al. (2020)', urlOrContext: 'Laboratory Disassembly Dataset — ASU/CMU' }];

    sources.forEach(source => {
        const li = document.createElement('li');
        li.style.cssText = 'margin-bottom: 0.6rem; padding: 0.5rem 0; border-bottom: 1px solid rgba(255,255,255,0.05);';

        const title = document.createElement('strong');
        title.style.color = 'var(--color-text-cyan)';
        title.textContent = source.title;

        const context = document.createElement('p');
        context.style.cssText = 'margin: 0.2rem 0 0; font-size: 0.85em; color: var(--color-text-muted);';
        context.textContent = source.urlOrContext;

        li.appendChild(title);
        li.appendChild(context);
        sourcesList.appendChild(li);
    });
}

/**
 * Renderiza las recomendaciones de ecodiseño
 */
function renderRecommendations(recommendations) {
    const list = document.getElementById('recommendations-list');
    if (!list) return;
    list.innerHTML = '';

    if (!recommendations || recommendations.length === 0) {
        const li = document.createElement('li');
        li.textContent = 'No se generaron recomendaciones específicas para este producto.';
        li.style.fontStyle = 'italic';
        list.appendChild(li);
        return;
    }

    recommendations.forEach((rec, i) => {
        const li = document.createElement('li');

        const icon = document.createElement('span');
        icon.className = 'rec-icon';
        icon.textContent = getRecIcon(i);

        const text = document.createElement('span');
        text.textContent = rec;

        li.appendChild(icon);
        li.appendChild(text);
        list.appendChild(li);
    });
}

/**
 * Devuelve un ícono para cada recomendación
 */
function getRecIcon(index) {
    const icons = ['♻️', '🔧', '🌱', '⚡', '🔬', '📦', '💡', '🛡️'];
    return icons[index % icons.length];
}

/**
 * Configura el botón de exportación a PDF
 */
function setupPDFExport() {
    const exportBtn = document.getElementById('export-pdf-btn');
    if (!exportBtn) return;

    exportBtn.disabled = false;

    const newBtn = exportBtn.cloneNode(true);
    exportBtn.parentNode.replaceChild(newBtn, exportBtn);

    newBtn.addEventListener('click', async () => {
        if (!currentAnalysis) {
            showToast('No hay análisis disponible para exportar', 'error');
            return;
        }
        try {
            newBtn.disabled = true;
            newBtn.innerHTML = '⏳ Generando PDF...';
            await new Promise(resolve => setTimeout(resolve, 500));
            await generatePDF(currentAnalysis);
            showToast('Informe PDF generado correctamente ✓', 'success');
        } catch (error) {
            console.error('[SADOC] Error PDF:', error);
            showToast(`Error al generar PDF: ${error.message}`, 'error');
        } finally {
            newBtn.disabled = false;
            newBtn.innerHTML = '📄 Generar Informe Técnico PDF';
        }
    });
}

/** Helper para setear texto de forma segura */
function setTextById(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text ?? '';
}
