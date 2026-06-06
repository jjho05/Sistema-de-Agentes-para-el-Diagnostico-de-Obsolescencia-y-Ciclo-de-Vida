// features/results/charts.js

let lifespanChart = null;

/**
 * Renderiza un gráfico de barras horizontal con Chart.js para todos los componentes
 */
export function renderLifespanChart(components) {
    const canvas = document.getElementById('lifespan-chart');
    if (!canvas) return;

    // Ajustar alto dinámico según cantidad de componentes
    const rowHeight = 44;
    const minHeight = 260;
    canvas.style.height = Math.max(minHeight, components.length * rowHeight) + 'px';

    const ctx = canvas.getContext('2d');

    if (lifespanChart) lifespanChart.destroy();

    // Ordenar: críticos primero, luego por vida útil ascendente
    const sorted = [...components].sort((a, b) => {
        if (a.isCritical !== b.isCritical) return b.isCritical - a.isCritical;
        return a.lifespanYears - b.lifespanYears;
    });

    const labels = sorted.map(c => c.isCritical ? `⚙️ ${c.name}` : c.name);
    const data   = sorted.map(c => c.lifespanYears);

    const colors = sorted.map(c => {
        if (c.isCritical) {
            if (c.lifespanYears < 3)  return 'rgba(239, 68, 68, 0.85)';
            if (c.lifespanYears < 7)  return 'rgba(251, 146, 60, 0.85)';
            return 'rgba(59, 130, 246, 0.85)';
        }
        return 'rgba(99, 102, 241, 0.5)';
    });

    const borderColors = colors.map(c => c.replace(/[\d.]+\)$/, '1)'));

    lifespanChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Vida Útil (años)',
                data,
                backgroundColor: colors,
                borderColor: borderColors,
                borderWidth: 1.5,
                borderRadius: 6,
                borderSkipped: false,
            }]
        },
        options: {
            indexAxis: 'y',           // ← barras HORIZONTALES: más legibles
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(2, 6, 23, 0.95)',
                    borderColor: 'rgba(99, 102, 241, 0.4)',
                    borderWidth: 1,
                    padding: 12,
                    titleFont: { family: 'Outfit', size: 13, weight: '600' },
                    bodyFont:  { family: 'Inter',  size: 12 },
                    callbacks: {
                        title: ctx => ctx[0].label.replace('⚙️ ', ''),
                        label: ctx => {
                            const y = ctx.parsed.x;
                            return `  Vida útil: ${y} año${y !== 1 ? 's' : ''}`;
                        },
                        afterLabel: ctx => {
                            const c = sorted[ctx.dataIndex];
                            const lines = [
                                `  Material: ${c.material}`,
                                `  Reparabilidad: ${c.repairabilityScore}/10`,
                            ];
                            if (c.massGrams) lines.push(`  Masa: ${c.massGrams} g`);
                            if (c.isCritical) lines.push('  ⚠ Componente crítico');
                            return lines;
                        }
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: {
                        color: '#94a3b8',
                        font: { family: 'Inter', size: 11 },
                        callback: v => `${v} años`
                    },
                    border: { color: 'rgba(255,255,255,0.08)' }
                },
                y: {
                    grid: { display: false },
                    ticks: {
                        color: ctx => sorted[ctx.index]?.isCritical ? '#f8fafc' : '#94a3b8',
                        font: { family: 'Inter', size: 12 },
                        autoSkip: false,
                    },
                    border: { color: 'rgba(255,255,255,0.08)' }
                }
            }
        }
    });
}
