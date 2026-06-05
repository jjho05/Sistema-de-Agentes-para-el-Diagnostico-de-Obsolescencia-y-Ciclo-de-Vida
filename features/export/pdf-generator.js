// features/export/pdf-generator.js
import { formatYears } from '../../core/utils.js';

/**
 * Genera y descarga un PDF del análisis
 */
export async function generatePDF(analysis) {
    const { jsPDF } = window.jspdf;

    if (!jsPDF) {
        throw new Error('jsPDF no está cargado');
    }

    // Crear documento PDF (A4)
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - (margin * 2);

    let yPosition = margin;

    // === HEADER ===
    doc.setFillColor(37, 99, 235); // Azul primario
    doc.rect(0, 0, pageWidth, 40, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('🔬 Análisis Forense de Producto', margin, 20);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('SADOC • Diagnóstico de Obsolescencia y Ciclo de Vida', margin, 30);

    yPosition = 50;

    // === INFORMACIÓN GENERAL ===
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(analysis.productName, margin, yPosition);
    yPosition += 10;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    const currentDate = new Date().toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    doc.text(`Fecha del análisis: ${currentDate}`, margin, yPosition);
    yPosition += 12;

    // === RESUMEN EJECUTIVO ===
    doc.setFillColor(240, 249, 255);
    doc.roundedRect(margin, yPosition, contentWidth, 35, 3, 3, 'F');

    yPosition += 7;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(37, 99, 235);
    doc.text('Resumen Ejecutivo', margin + 5, yPosition);

    yPosition += 7;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);

    // Vida útil estimada
    doc.setFont('helvetica', 'bold');
    doc.text('Vida Útil Estimada:', margin + 5, yPosition);
    doc.setFont('helvetica', 'normal');
    const lifespanColor = getLifespanColor(analysis.estimatedLifespan);
    doc.setTextColor(lifespanColor.r, lifespanColor.g, lifespanColor.b);
    doc.text(formatYears(analysis.estimatedLifespan), margin + 55, yPosition);

    yPosition += 6;
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text('Eslabón Más Débil:', margin + 5, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(239, 68, 68);
    doc.text(analysis.weakestLink, margin + 55, yPosition);

    yPosition += 8;
    doc.setTextColor(0, 0, 0);
    const summaryLines = doc.splitTextToSize(analysis.summary, contentWidth - 10);
    doc.text(summaryLines, margin + 5, yPosition);
    yPosition += summaryLines.length * 5 + 6;

    // Consensus Log
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(100, 100, 100);
    const consensusLines = doc.splitTextToSize(`Consenso Agentes: ${analysis.consensusLog}`, contentWidth - 10);
    doc.text(consensusLines, margin + 5, yPosition);
    yPosition += consensusLines.length * 4 + 10;

    // === FUENTES Y VERIFICABILIDAD ===
    yPosition += 5;
    if (yPosition > pageHeight - 40) { doc.addPage(); yPosition = margin; }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(37, 99, 235);
    doc.text('🔍 Fuentes y Verificabilidad', margin, yPosition);
    yPosition += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);

    doc.setFont('helvetica', 'bold');
    doc.text('Nivel de Confianza:', margin, yPosition);
    doc.setFont('helvetica', 'normal');

    const confScore = analysis.confidenceScore || 'No evaluado';
    if (confScore.toLowerCase().includes('alto')) doc.setTextColor(16, 185, 129); // success
    else if (confScore.toLowerCase().includes('medio')) doc.setTextColor(245, 158, 11); // warning
    else doc.setTextColor(239, 68, 68); // danger

    doc.text(confScore, margin + 35, yPosition);
    yPosition += 8;

    doc.setTextColor(0, 0, 0);
    if (analysis.sources && analysis.sources.length > 0) {
        analysis.sources.forEach(source => {
            if (yPosition > pageHeight - 20) {
                doc.addPage();
                yPosition = margin;
            }
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            const titleLines = doc.splitTextToSize(`• ${source.title}`, contentWidth);
            doc.text(titleLines, margin, yPosition);
            yPosition += titleLines.length * 4 + 1;

            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100, 100, 100);
            const contextLines = doc.splitTextToSize(source.urlOrContext, contentWidth - 5);
            doc.text(contextLines, margin + 5, yPosition);
            yPosition += contextLines.length * 4 + 4;
            doc.setTextColor(0, 0, 0);
        });
    } else {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'italic');
        doc.text("No se proporcionaron fuentes específicas.", margin, yPosition);
        yPosition += 8;
    }
    // === REPARABILIDAD PREMIUM ===
    yPosition += 5;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, yPosition, contentWidth, 25, 2, 2, 'FD');
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(37, 99, 235);
    doc.text('Índice de Reparabilidad (EN 45554)', margin + 5, yPosition + 7);
    
    doc.setFontSize(14);
    doc.text(`${analysis.reparabilityIndex.score}/10`, margin + contentWidth - 20, yPosition + 12);
    
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text(analysis.reparabilityIndex.label, margin + 5, yPosition + 14);
    
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(analysis.reparabilityIndex.details, margin + 5, yPosition + 20);
    yPosition += 35;

    // === MATRIZ RIAM ===
    if (yPosition > pageHeight - 60) { doc.addPage(); yPosition = margin; }
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(37, 99, 235);
    doc.text('📊 Matriz de Evaluación RIAM', margin, yPosition);
    yPosition += 8;
    
    const riamData = [
        ['Categoría', 'Puntaje', 'Justificación'],
        ['Físico/Químico (PC)', analysis.riamMapping.physicalChemical.score, analysis.riamMapping.physicalChemical.reason],
        ['Biológico/Ecológico (BE)', analysis.riamMapping.biologicalEcological.score, analysis.riamMapping.biologicalEcological.reason],
        ['Social/Cultural (SC)', analysis.riamMapping.socialCultural.score, analysis.riamMapping.socialCultural.reason],
        ['Económico/Operacional (EO)', analysis.riamMapping.economicOperational.score, analysis.riamMapping.economicOperational.reason]
    ];
    
    doc.autoTable({
        startY: yPosition,
        head: [riamData[0]],
        body: riamData.slice(1),
        theme: 'grid',
        styles: { fontSize: 8 },
        columnStyles: { 1: { halign: 'center', fontStyle: 'bold' } },
        margin: { left: margin, right: margin }
    });
    
    yPosition = doc.lastAutoTable.finalY + 10;

    // === TABLA DE COMPONENTES ===
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('Desglose de Componentes', margin, yPosition + 5);

    const sortedComponents = [...analysis.components].sort((a, b) => {
        if (a.isCritical !== b.isCritical) return b.isCritical - a.isCritical;
        return a.lifespanYears - b.lifespanYears;
    });

    const tableData = sortedComponents.map(comp => [
        comp.isCritical ? `⚙️ ${comp.name}` : comp.name,
        comp.material,
        `${comp.lifespanYears} años`,
        `${comp.repairabilityScore}/10`,
        translateImpact(comp.environmentalImpact)
    ]);

    doc.autoTable({
        startY: yPosition + 10,
        head: [['Componente', 'Material', 'Vida Útil', 'Reparabilidad', 'Impacto Amb.']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255] },
        styles: { font: 'helvetica', fontSize: 9, cellPadding: 3 },
        margin: { left: margin, right: margin },
        didParseCell: function (data) {
            if (data.section === 'body') {
                const isCritical = sortedComponents[data.row.index].isCritical;
                if (isCritical) {
                    data.cell.styles.fillColor = [240, 249, 255]; // Azul claro
                }

                // Colorear textos según valores
                if (data.column.index === 2) {
                    const years = sortedComponents[data.row.index].lifespanYears;
                    const color = getLifespanColor(years);
                    data.cell.styles.textColor = [color.r, color.g, color.b];
                    data.cell.styles.fontStyle = 'bold';
                }
                if (data.column.index === 3) {
                    const score = sortedComponents[data.row.index].repairabilityScore;
                    const color = getRepairabilityColor(score);
                    data.cell.styles.textColor = [color.r, color.g, color.b];
                    data.cell.styles.fontStyle = 'bold';
                }
                if (data.column.index === 4) {
                    const impact = sortedComponents[data.row.index].environmentalImpact;
                    const color = getImpactColor(impact);
                    data.cell.styles.textColor = [color.r, color.g, color.b];
                    data.cell.styles.fontStyle = 'bold';
                }
            }
        }
    });

    yPosition = doc.lastAutoTable.finalY + 10;

    // === GRÁFICO ===
    // Capturar el gráfico como imagen
    const chartCanvas = document.getElementById('lifespan-chart');
    if (chartCanvas && yPosition < pageHeight - 80) {
        try {
            // Asegurarnos que el canvas tiene contenido
            if (chartCanvas.width === 0 || chartCanvas.height === 0) {
                console.warn('El gráfico no tiene dimensiones válidas');
            } else {
                const chartImage = chartCanvas.toDataURL('image/png');
                yPosition += 5;

                if (yPosition > pageHeight - 70) {
                    doc.addPage();
                    yPosition = margin;
                }

                doc.setFontSize(14);
                doc.setFont('helvetica', 'bold');
                doc.text('Gráfico de Vida Útil', margin, yPosition);
                yPosition += 8;

                const imgWidth = contentWidth;
                const imgHeight = 60;
                doc.addImage(chartImage, 'PNG', margin, yPosition, imgWidth, imgHeight);
                yPosition += imgHeight + 10;
            }
        } catch (error) {
            console.warn('No se pudo capturar el gráfico:', error);
        }
    }

    // === RECOMENDACIONES ===
    if (yPosition > pageHeight - 60) {
        doc.addPage();
        yPosition = margin;
    }

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('💡 Recomendaciones de Ecodiseño', margin, yPosition);
    yPosition += 8;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');

    analysis.recommendations.forEach((rec, idx) => {
        if (yPosition > pageHeight - 20) {
            doc.addPage();
            yPosition = margin;
        }

        doc.setFillColor(254, 243, 199);
        doc.roundedRect(margin, yPosition, contentWidth, 12, 2, 2, 'F');

        const recLines = doc.splitTextToSize(`${idx + 1}. ${rec}`, contentWidth - 8);
        doc.text(recLines, margin + 4, yPosition + 4);

        yPosition += 12 + (recLines.length > 1 ? (recLines.length - 1) * 4 : 0) + 3;
    });

    // === FOOTER EN TODAS LAS PÁGINAS ===
    const totalPages = doc.internal.getNumberOfPages();

    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(
            `Página ${i} de ${totalPages} • Generado por SADOC`,
            pageWidth / 2,
            pageHeight - 10,
            { align: 'center' }
        );
    }

    // === GUARDAR PDF ===
    // Sanitizar nombre del archivo
    const safeName = analysis.productName
        .replace(/[^a-z0-9]/gi, '_') // Reemplazar caracteres no alfanuméricos por _
        .replace(/_+/g, '_')         // Evitar múltiples guiones bajos
        .substring(0, 50);           // Limitar longitud

    const fileName = `Analisis_${safeName}_${new Date().toISOString().split('T')[0]}.pdf`;

    try {
        doc.save(fileName);
    } catch (error) {
        console.error('Error al guardar PDF con nombre sanitizado:', error);
        doc.save('Analisis_Producto_RIAM.pdf'); // Fallback seguro
    }
}

// Funciones auxiliares
function getLifespanColor(years) {
    if (years < 3) return { r: 239, g: 68, b: 68 }; // Rojo
    if (years < 7) return { r: 251, g: 146, b: 60 }; // Naranja
    return { r: 34, g: 197, b: 94 }; // Verde
}

function getRepairabilityColor(score) {
    if (score >= 7) return { r: 34, g: 197, b: 94 }; // Verde
    if (score >= 4) return { r: 251, g: 146, b: 60 }; // Naranja
    return { r: 239, g: 68, b: 68 }; // Rojo
}

function getImpactColor(impact) {
    if (impact === 'Low') return { r: 34, g: 197, b: 94 };
    if (impact === 'Medium') return { r: 251, g: 146, b: 60 };
    return { r: 239, g: 68, b: 68 };
}

function translateImpact(impact) {
    const translations = {
        'Low': 'Bajo',
        'Medium': 'Medio',
        'High': 'Alto'
    };
    return translations[impact] || impact;
}
