// features/results/components-table.js
import { formatYears, getImpactClass, getRepairabilityClass } from '../../core/utils.js';

/**
 * Renderiza la tabla de componentes
 */
export function renderComponentsTable(components) {
    const tbody = document.getElementById('components-tbody');
    tbody.innerHTML = '';
    
    // Ordenar componentes: críticos primero, luego por vida útil ascendente
    const sortedComponents = [...components].sort((a, b) => {
        if (a.isCritical !== b.isCritical) {
            return b.isCritical - a.isCritical; // Críticos primero
        }
        return a.lifespanYears - b.lifespanYears; // Menor vida útil primero
    });
    
    sortedComponents.forEach(component => {
        const row = createComponentRow(component);
        tbody.appendChild(row);
    });
}

/**
 * Crea una fila de componente (Versión Segura XSS)
 */
function createComponentRow(component) {
    const row = document.createElement('tr');
    
    // Marcar como crítico si aplica
    if (component.isCritical) {
        row.classList.add('critical-component');
    }
    
    // Crear celdas de forma segura usando textContent
    
    // 1. Nombre
    const tdName = document.createElement('td');
    const divName = document.createElement('div');
    divName.className = 'component-name';
    divName.textContent = (component.isCritical ? '⚙️ ' : '') + component.name;
    tdName.appendChild(divName);
    row.appendChild(tdName);
    
    // 2. Material
    const tdMaterial = document.createElement('td');
    tdMaterial.textContent = component.material;
    row.appendChild(tdMaterial);
    
    // 3. Vida Útil
    const tdLifespan = document.createElement('td');
    const spanLifespan = document.createElement('span');
    spanLifespan.className = 'lifespan-cell';
    spanLifespan.textContent = formatYears(component.lifespanYears);
    tdLifespan.appendChild(spanLifespan);
    row.appendChild(tdLifespan);
    
    // 4. Modo de Fallo
    const tdFailure = document.createElement('td');
    const divFailure = document.createElement('div');
    divFailure.className = 'failure-mode';
    divFailure.textContent = component.failureMode;
    tdFailure.appendChild(divFailure);
    row.appendChild(tdFailure);
    
    // 5. Reparabilidad
    const tdRepair = document.createElement('td');
    const divRepair = document.createElement('div');
    divRepair.className = `repair-score ${getRepairabilityClass(component.repairabilityScore)}`;
    divRepair.textContent = `${component.repairabilityScore}/10`;
    tdRepair.appendChild(divRepair);
    row.appendChild(tdRepair);
    
    // 6. Impacto Ambiental
    const tdImpact = document.createElement('td');
    const spanImpact = document.createElement('span');
    spanImpact.className = `impact-badge ${getImpactClass(component.environmentalImpact)}`;
    spanImpact.textContent = translateImpact(component.environmentalImpact);
    tdImpact.appendChild(spanImpact);
    row.appendChild(tdImpact);

    // 7. Normativa ⭐ NUEVO
    const tdNorm = document.createElement('td');
    tdNorm.style.fontSize = '0.75rem';
    tdNorm.style.color = 'var(--color-text-muted)';
    tdNorm.textContent = component.normativeReference || '-';
    row.appendChild(tdNorm);
    
    return row;
}

/**
 * Traduce el impacto ambiental
 */
function translateImpact(impact) {
    const translations = {
        'Low': 'Bajo',
        'Medium': 'Medio',
        'High': 'Alto'
    };
    return translations[impact] || impact;
}
