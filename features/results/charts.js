// features/results/charts.js

let lifespanChart = null;

/**
 * Renderiza el gráfico de vida útil de componentes
 */
export function renderLifespanChart(components) {
    const canvas = document.getElementById('lifespan-chart');
    const ctx = canvas.getContext('2d');
    
    // Destruir gráfico anterior si existe
    if (lifespanChart) {
        lifespanChart.destroy();
    }
    
    // Preparar datos: solo componentes críticos, ordenados por vida útil
    const criticalComponents = components
        .filter(c => c.isCritical)
        .sort((a, b) => a.lifespanYears - b.lifespanYears);
    
    const labels = criticalComponents.map(c => c.name);
    const data = criticalComponents.map(c => c.lifespanYears);
    const colors = criticalComponents.map(c => {
        // Color según vida útil
        if (c.lifespanYears < 3) return 'rgba(239, 68, 68, 0.8)'; // Rojo
        if (c.lifespanYears < 7) return 'rgba(251, 146, 60, 0.8)'; // Naranja
        return 'rgba(34, 197, 94, 0.8)'; // Verde
    });
    
    lifespanChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Vida Útil (años)',
                data: data,
                backgroundColor: colors,
                borderColor: colors.map(c => c.replace('0.8', '1')),
                borderWidth: 2,
                borderRadius: 8,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: true,
                    text: 'Componentes Críticos por Vida Útil',
                    font: {
                        size: 16,
                        weight: 'bold'
                    },
                    padding: {
                        bottom: 20
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const years = context.parsed.y;
                            return `${years} año${years !== 1 ? 's' : ''}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1,
                        callback: function(value) {
                            return value + ' años';
                        }
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        maxRotation: 45,
                        minRotation: 0
                    }
                }
            }
        }
    });
}
