document.addEventListener('DOMContentLoaded', () => {
    // DOM element references
    const exportPngBtn = document.getElementById('exportPngBtn');
    const exportPdfBtn = document.getElementById('exportPdfBtn');
    const printChartBtn = document.getElementById('printChartBtn');
    const includeTable = document.getElementById('includeTable');
    const chartPreview = document.getElementById('chartPreview');
    const dataTable = document.getElementById('dataTable');

    // Configure pdfMake fonts with Noto Sans TC for Chinese support using TTF files
    pdfMake.fonts = {
        'NotoSansTC': {
            normal: 'https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-tc@latest/chinese-traditional-400-normal.ttf',
            bold: 'https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-tc@latest/chinese-traditional-700-normal.ttf'
        }
    };

    // Show error modal with a custom message using a TS-styled dialog
    function showErrorModal(message) {
        const modal = document.createElement('dialog');
        modal.className = 'ts-modal';

        modal.innerHTML = `
            <div class="content">
                <div class="ts-content is-center-aligned is-padded">
                    <div class="ts-header is-icon">
                        <span class="ts-icon is-triangle-exclamation-icon"></span>
                        錯誤
                    </div>
                    <p>${message}</p>
                </div>
                <div class="ts-divider"></div>
                <div class="ts-content">
                    <button class="ts-button is-fluid close-modal">確定</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        modal.showModal();
        modal.querySelector('.close-modal').addEventListener('click', () => {
            modal.close();
            document.body.removeChild(modal);
        });
    }

    // Generate table content for PDF/Print with pdfMake
    function generateTableContent(data) {
        const yAxis = document.getElementById('yAxis').value;
        const isPercentageMode = yAxis.includes('percentage');
        const isPieOrDonut = ['pie', 'donut'].includes(data.chart_type);
        const tableUnit = yAxis === 'weight_percentage_metric_ton' ? 'metric_ton' :
                         yAxis === 'weight_percentage_kilogram' ? 'kilogram' :
                         yAxis === 'cost_percentage_new_taiwan_dollar' ? 'new_taiwan_dollar' :
                         data.series[0]?.unit || 'kilogram'; // Default to original unit if not specified

        // Calculate total sum of all raw data for percentage calculation in pie/donut charts
        const totalRawSum = isPieOrDonut ? data.series.reduce((sum, s) =>
            sum + s.raw_data.reduce((a, b) => a + b, 0), 0) : 0;

        const headers = [{ text: '日期', bold: true, font: 'NotoSansTC' }]
            .concat(data.series.map(s => ({ text: String(s.name), bold: true, font: 'NotoSansTC' })));

        const body = data.x_axis_labels.map(label => {
            const row = [String(label)];
            data.series.forEach(s => {
                const idx = data.x_axis_labels.indexOf(label);
                const rawValue = standardizeValue(s.unit, s.raw_data[idx], tableUnit); // Convert to table unit
                // Format value with thousand separators if unit is New Taiwan Dollar
                const displayValue = tableUnit === 'new_taiwan_dollar' ?
                    rawValue.toLocaleString('zh-TW') : formatNumber(rawValue);
                let percentage;
                if (isPieOrDonut) {
                    // Calculate percentage based on total raw sum for pie/donut charts
                    percentage = totalRawSum ? formatNumber((rawValue / totalRawSum) * 100) : '0';
                } else if (isPercentageMode) {
                    // Use chart percentage for stacked bar charts
                    percentage = formatNumber(s.data[idx]);
                } else {
                    percentage = null; // No percentage for non-percentage modes
                }
                const unitText = tableUnit === 'metric_ton' ? '公噸' :
                                tableUnit === 'kilogram' ? '公斤' :
                                tableUnit === 'new_taiwan_dollar' ? '新台幣' : '';
                const cellText = (isPercentageMode || isPieOrDonut) && percentage !== null ?
                    `${percentage}% (${displayValue} ${unitText})` :
                    `${displayValue} ${unitText}`;
                row.push({ text: cellText, font: 'NotoSansTC' });
            });
            return row;
        });
        return [headers].concat(body);
    }

    // Export chart as PNG
    exportPngBtn.addEventListener('click', () => {
        if (!window.chart) {
            showErrorModal('請先生成圖表');
            return;
        }
        const exportContainer = document.createElement('div');
        exportContainer.style.position = 'absolute';
        exportContainer.style.left = '-9999px';
        exportContainer.appendChild(chartPreview.cloneNode(true));
        if (includeTable.checked) {
            dataTable.innerHTML = generateTableHtml(window.chartData);
            dataTable.style.display = 'block';
            exportContainer.appendChild(dataTable.cloneNode(true));
        }
        document.body.appendChild(exportContainer);

        html2canvas(exportContainer).then(canvas => {
            const link = document.createElement('a');
            link.download = `${window.chartData.title || '圖表'}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
            document.body.removeChild(exportContainer);
        }).catch(err => console.error('Export PNG failed:', err));
    });

    // Export chart and optional table as PDF
    exportPdfBtn.addEventListener('click', () => {
        if (!window.chart) {
            showErrorModal('請先生成圖表');
            return;
        }
        window.chart.dataURI().then(({ imgURI }) => {
            const docDefinition = {
                pageSize: 'A4',
                pageOrientation: 'portrait',
                content: [
                    { image: imgURI, width: 567.142857, height: 214.285714, alignment: 'center', margin: [0, 0, 0, 12] },
                ],
                defaultStyle: {
                    font: 'NotoSansTC'
                },
                styles: {
                    tableStyle: {
                        font: 'NotoSansTC',
                        fontSize: 8
                    }
                }
            };
            if (includeTable.checked) {
                const tableData = generateTableContent(window.chartData);
                console.log('Table Data for PDF:', tableData);
                docDefinition.content.push({
                    table: {
                        headerRows: 1,
                        widths: ['*'].concat(window.chartData.series.map(() => '*')),
                        body: tableData
                    },
                    layout: 'lightHorizontalLines',
                    style: 'tableStyle',
                });
            }
            pdfMake.createPdf(docDefinition).download(`${window.chartData.title || '圖表'}.pdf`);
        }).catch(err => console.error('Export PDF failed:', err));
    });

    // Print chart and optional table
    printChartBtn.addEventListener('click', () => {
        if (!window.chart) {
            showErrorModal('請先生成圖表');
            return;
        }
        window.chart.dataURI().then(({ imgURI }) => {
            const docDefinition = {
                pageSize: 'A4',
                pageOrientation: 'portrait',
                content: [
                    { image: imgURI, width: 567.142857, height: 214.285714, alignment: 'center', margin: [0, 0, 0, 12] },
                ],
                defaultStyle: {
                    font: 'NotoSansTC'
                },
                styles: {
                    tableStyle: {
                        font: 'NotoSansTC',
                        fontSize: 8
                    }
                }
            };
            if (includeTable.checked) {
                const tableData = generateTableContent(window.chartData);
                console.log('Table Data for PDF:', tableData);
                docDefinition.content.push({
                    table: {
                        headerRows: 1,
                        widths: ['*'].concat(window.chartData.series.map(() => '*')),
                        body: tableData
                    },
                    layout: 'lightHorizontalLines',
                    style: 'tableStyle',
                });
            }
            pdfMake.createPdf(docDefinition).print();
        }).catch(err => console.error('Print failed:', err));
    });
});

// Generate HTML table for preview and PNG export with TS theme
function generateTableHtml(data) {
    const yAxis = document.getElementById('yAxis').value;
    const isPercentageMode = yAxis.includes('percentage');
    const isPieOrDonut = ['pie', 'donut'].includes(data.chart_type);
    // Determine table unit based on Y-axis selection
    const tableUnit = yAxis === 'weight_percentage_metric_ton' ? 'metric_ton' :
                     yAxis === 'weight_percentage_kilogram' ? 'kilogram' :
                     yAxis === 'cost_percentage_new_taiwan_dollar' ? 'new_taiwan_dollar' :
                     data.series[0]?.unit || 'kilogram'; // Default to original unit

    // Calculate total sum of all raw data for percentage calculation in pie/donut charts
    const totalRawSum = isPieOrDonut ? data.series.reduce((sum, s) =>
        sum + s.raw_data.reduce((a, b) => a + b, 0), 0) : 0;

    let html = `
        <div class="ts-box">
            <table class="ts-table is-celled" id="dataTable">
                <thead>
                    <tr>
                        <th class="date-column">日期</th>
    `;
    data.series.forEach(s => {
        html += `<th class="data-column" data-series="${s.name}">${s.name}</th>`;
    });
    html += `
                    </tr>
                </thead>
                <tbody>
    `;
    data.x_axis_labels.forEach(label => {
        html += `<tr data-date="${label}">`;
        html += `<td class="date-cell">${label}</td>`;
        data.series.forEach(s => {
            const idx = data.x_axis_labels.indexOf(label);
            const rawValue = standardizeValue(s.unit, s.raw_data[idx], tableUnit); // Convert to table unit
            // Format value with thousand separators if unit is New Taiwan Dollar
            const displayValue = tableUnit === 'new_taiwan_dollar' ?
                rawValue.toLocaleString('zh-TW') : formatNumber(rawValue);
            let percentage;
            if (isPieOrDonut) {
                // Calculate percentage based on total raw sum for pie/donut charts
                percentage = totalRawSum ? formatNumber((rawValue / totalRawSum) * 100) : '0';
            } else if (isPercentageMode) {
                // Use chart percentage for stacked bar charts
                percentage = formatNumber(s.data[idx]);
            } else {
                percentage = null; // No percentage for non-percentage modes
            }
            const unitText = tableUnit === 'metric_ton' ? '公噸' :
                            tableUnit === 'kilogram' ? '公斤' :
                            tableUnit === 'new_taiwan_dollar' ? '新台幣' : '';
            const cellText = (isPercentageMode || isPieOrDonut) && percentage !== null ?
                `${percentage}% (${displayValue} ${unitText})` :
                `${displayValue} ${unitText}`;
            html += `<td class="data-cell">${cellText}</td>`;
        });
        html += `</tr>`;
    });
    html += `
                </tbody>
            </table>
        </div>
    `;
    return html;
}

// Format numbers to remove trailing zeros while preserving decimal precision
function formatNumber(num) {
    const rounded = Number(num).toFixed(2);
    const [integer, decimal] = rounded.split('.');
    if (!decimal || decimal === '00') {
        return integer;
    }
    const trimmedDecimal = decimal.replace(/0+$/, '');
    return `${integer}.${trimmedDecimal}`;
}

// Standardize value to target unit (reused from views.py logic)
function standardizeValue(fromUnit, value, toUnit) {
    if (fromUnit === toUnit || !value) return value;
    if (fromUnit === 'metric_ton' && toUnit === 'kilogram') return value * 1000;
    if (fromUnit === 'kilogram' && toUnit === 'metric_ton') return value / 1000;
    return value;
}