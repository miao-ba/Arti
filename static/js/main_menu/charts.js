// charts.js
import { baseOptions } from './chart_options.js';
import { alignDataWithLabels } from './utils.js';

// Recycle Charts
export const renderRecycleCharts = (recycleData, xAxisLabels) => {
    if (recycleData.lastMonth && Array.isArray(recycleData.lastMonth.data)) {
        new ApexCharts(document.getElementById('barChartRecycleProductionCurrent'), {
            ...baseOptions,
            chart: {
                ...baseOptions.chart, // Preserve toolbar and animations
                type: 'bar' // Set type without overriding other properties
            },
            series: [{ name: '產量 (公斤)', data: recycleData.lastMonth.data.filter(val => val != null) }],
            xaxis: { ...baseOptions.xaxis, categories: recycleData.lastMonth.labels || [], title: { text: '類別' } },
            yaxis: { ...baseOptions.yaxis, title: { text: '公斤' }, min: 0 }
        }).render();
    } else {
        console.error("Invalid last month recycle data:", recycleData.lastMonth);
    }

    if (recycleData.last12Months && Array.isArray(recycleData.last12Months.labels)) {
        new ApexCharts(document.getElementById('lineChartRecycleProduction'), {
            ...baseOptions,
            chart: {
                ...baseOptions.chart, // Preserve toolbar and animations
                type: 'line'
            },
            series: Object.keys(recycleData.last12Months.datasets || {}).map(key => ({
                name: key,
                data: alignDataWithLabels(recycleData.last12Months.labels, recycleData.last12Months.datasets[key].data || [], xAxisLabels)
            })),
            xaxis: { ...baseOptions.xaxis, categories: xAxisLabels, title: { text: '年月份' } },
            yaxis: { ...baseOptions.yaxis, title: { text: '公斤' }, min: 0 },
            colors: Object.values(recycleData.last12Months.datasets || {}).map(d => d.color || '#000000')
        }).render();

        let recycleStackedBarChart;
        window.updateRecycleStackedBar = (period) => {
            if (recycleStackedBarChart) recycleStackedBarChart.destroy();
            const isTotal = period === 'total';
            const datasets = recycleData.last12Months.datasets || {};
            const labels = xAxisLabels;

            if (!Object.keys(datasets).length || !labels.length) {
                console.error("Recycle stacked bar chart data missing:", { datasets, labels });
                return;
            }

            const validDatasets = {};
            Object.keys(datasets).forEach(key => {
                const alignedData = alignDataWithLabels(recycleData.last12Months.labels, datasets[key].data || [], labels);
                const filteredData = alignedData.filter(val => val != null);
                if (filteredData.length) validDatasets[key] = { data: filteredData, color: datasets[key].color || '#000000' };
            });

            const seriesData = isTotal
                ? Object.values(validDatasets).map(d => d.data.reduce((a, b) => a + b, 0))
                : Object.keys(validDatasets).map(key => ({
                    name: key,
                    data: validDatasets[key].data.map((val, i) => {
                        const total = Object.values(validDatasets).reduce((sum, d) => sum + (d.data[i] || 0), 0);
                        return total ? (val / total * 100) : 0;
                    })
                }));

            const chartOptions = {
                ...baseOptions, // Apply full base theme
                chart: {
                    ...baseOptions.chart, // Preserve toolbar and animations
                    type: isTotal ? 'pie' : 'bar',
                    stacked: !isTotal
                },
                series: seriesData,
                ...(isTotal ? {
                    labels: Object.keys(validDatasets),
                    dataLabels: { enabled: true, formatter: val => Number(val).toFixed(2) }
                } : {
                    xaxis: { ...baseOptions.xaxis, categories: labels, title: { text: '年月份' } },
                    yaxis: {
                        ...baseOptions.yaxis, // Preserve Y-axis theme
                        title: { text: '百分比' },
                        min: 0,
                        max: 100,
                        labels: { formatter: val => Math.floor(val) + '%' }
                    }
                }),
                colors: Object.values(validDatasets).map(d => d.color)
            };

            console.log("Recycle stacked bar chart config:", chartOptions);
            if (seriesData.length && (isTotal || labels.length)) {
                recycleStackedBarChart = new ApexCharts(document.getElementById('stackedBarChartRecycleProductionPercentage'), chartOptions);
                recycleStackedBarChart.render();
            }
        };
        window.updateRecycleStackedBar('monthly');
    }

    if (recycleData.revenue12Months && Array.isArray(recycleData.revenue12Months.data)) {
        new ApexCharts(document.getElementById('lineChartRecycleRevenue'), {
            ...baseOptions,
            chart: {
                ...baseOptions.chart, // Preserve toolbar and animations
                type: 'line'
            },
            series: [{ name: '收入 (新台幣)', data: alignDataWithLabels(recycleData.revenue12Months.labels, recycleData.revenue12Months.data, xAxisLabels) }],
            xaxis: { ...baseOptions.xaxis, categories: xAxisLabels, title: { text: '年月份' } },
            yaxis: { ...baseOptions.yaxis, title: { text: '新台幣' }, min: 0 },
            colors: ['#36A2EB']
        }).render();
    }
};

// General Waste Charts
export const renderGeneralWasteCharts = (generalData, xAxisLabels) => {
    if (generalData.last12Months && Array.isArray(generalData.last12Months.labels)) {
        new ApexCharts(document.getElementById('lineChartGeneralWasteProduction'), {
            ...baseOptions,
            chart: {
                ...baseOptions.chart, // Preserve toolbar and animations
                type: 'line'
            },
            series: Object.keys(generalData.last12Months.datasets || {}).map(key => ({
                name: key,
                data: alignDataWithLabels(generalData.last12Months.labels, generalData.last12Months.datasets[key].data || [], xAxisLabels)
            })),
            xaxis: { ...baseOptions.xaxis, categories: xAxisLabels, title: { text: '年月份' } },
            yaxis: { ...baseOptions.yaxis, title: { text: '公噸' }, min: 0 },
            colors: Object.values(generalData.last12Months.datasets || {}).map(d => d.color || '#000000')
        }).render();

        let generalStackedBarChart;
        window.updateGeneralStackedBar = (period) => {
            if (generalStackedBarChart) generalStackedBarChart.destroy();
            const isTotal = period === 'total';
            const datasets = generalData.last12Months.datasets || {};
            const labels = xAxisLabels;

            if (!Object.keys(datasets).length || !labels.length) {
                console.error("General waste stacked bar chart data missing:", { datasets, labels });
                return;
            }

            const validDatasets = {};
            Object.keys(datasets).forEach(key => {
                const alignedData = alignDataWithLabels(generalData.last12Months.labels, datasets[key].data || [], labels);
                const filteredData = alignedData.filter(val => val != null);
                if (filteredData.length) validDatasets[key] = { data: filteredData, color: datasets[key].color || '#000000' };
            });

            const seriesData = isTotal
                ? Object.values(validDatasets).map(d => d.data.reduce((a, b) => a + b, 0))
                : Object.keys(validDatasets).map(key => ({
                    name: key,
                    data: validDatasets[key].data.map((val, i) => {
                        const total = Object.values(validDatasets).reduce((sum, d) => sum + (d.data[i] || 0), 0);
                        return total ? (val / total * 100) : 0;
                    })
                }));

            const chartOptions = {
                ...baseOptions, // Apply full base theme
                chart: {
                    ...baseOptions.chart, // Preserve toolbar and animations
                    type: isTotal ? 'pie' : 'bar',
                    stacked: !isTotal
                },
                series: seriesData,
                ...(isTotal ? {
                    labels: Object.keys(validDatasets),
                    dataLabels: { enabled: true, formatter: val => Number(val).toFixed(2) }
                } : {
                    xaxis: { ...baseOptions.xaxis, categories: labels, title: { text: '年月份' } },
                    yaxis: {
                        ...baseOptions.yaxis, // Preserve Y-axis theme
                        title: { text: '百分比' },
                        min: 0,
                        max: 100,
                        labels: { formatter: val => Math.floor(val) + '%' }
                    }
                }),
                colors: Object.values(validDatasets).map(d => d.color)
            };

            console.log("General waste stacked bar chart config:", chartOptions);
            if (seriesData.length && (isTotal || labels.length)) {
                generalStackedBarChart = new ApexCharts(document.getElementById('stackedBarChartGeneralWastProductionPercentage'), chartOptions);
                generalStackedBarChart.render();
            }
        };
        window.updateGeneralStackedBar('monthly');

        new ApexCharts(document.getElementById('lineChartGeneralWasteProductionTotal'), {
            ...baseOptions,
            chart: {
                ...baseOptions.chart, // Preserve toolbar and animations
                type: 'line'
            },
            series: [{ name: '總產量 (公噸)', data: alignDataWithLabels(generalData.last12Months.labels, generalData.last12Months.total || [], xAxisLabels) }],
            xaxis: { ...baseOptions.xaxis, categories: xAxisLabels, title: { text: '年月份' } },
            yaxis: { ...baseOptions.yaxis, title: { text: '公噸' }, min: 0 },
            colors: ['#4BC0C0']
        }).render();
    }
};

// Biomedical Waste Charts
export const renderBiomedicalWasteCharts = (biomedicalData, xAxisLabels) => {
    if (biomedicalData.last12Months && Array.isArray(biomedicalData.last12Months.labels)) {
        new ApexCharts(document.getElementById('lineChartBiomedicalWasteProduction'), {
            ...baseOptions,
            chart: {
                ...baseOptions.chart, // Preserve toolbar and animations
                type: 'line'
            },
            series: Object.keys(biomedicalData.last12Months.datasets || {}).map(key => ({
                name: key,
                data: alignDataWithLabels(biomedicalData.last12Months.labels, biomedicalData.last12Months.datasets[key].data || [], xAxisLabels)
            })),
            xaxis: { ...baseOptions.xaxis, categories: xAxisLabels, title: { text: '年月份' } },
            yaxis: { ...baseOptions.yaxis, title: { text: '公噸' }, min: 0 },
            colors: Object.values(biomedicalData.last12Months.datasets || {}).map(d => d.color || '#000000')
        }).render();

        let biomedicalStackedBarChart;
        window.updateBiomedicalStackedBar = (period) => {
            if (biomedicalStackedBarChart) biomedicalStackedBarChart.destroy();
            const isTotal = period === 'total';
            const datasets = biomedicalData.last12Months.datasets || {};
            const labels = xAxisLabels;

            if (!Object.keys(datasets).length || !labels.length) {
                console.error("Biomedical waste stacked bar chart data missing:", { datasets, labels });
                return;
            }

            const validDatasets = {};
            Object.keys(datasets).forEach(key => {
                const alignedData = alignDataWithLabels(biomedicalData.last12Months.labels, datasets[key].data || [], labels);
                const filteredData = alignedData.filter(val => val != null);
                if (filteredData.length) validDatasets[key] = { data: filteredData, color: datasets[key].color || '#000000' };
            });

            const seriesData = isTotal
                ? Object.values(validDatasets).map(d => d.data.reduce((a, b) => a + b, 0))
                : Object.keys(validDatasets).map(key => ({
                    name: key,
                    data: validDatasets[key].data.map((val, i) => {
                        const total = Object.values(validDatasets).reduce((sum, d) => sum + (d.data[i] || 0), 0);
                        return total ? (val / total * 100) : 0;
                    })
                }));

            const chartOptions = {
                ...baseOptions, // Apply full base theme
                chart: {
                    ...baseOptions.chart, // Preserve toolbar and animations
                    type: isTotal ? 'pie' : 'bar',
                    stacked: !isTotal
                },
                series: seriesData,
                ...(isTotal ? {
                    labels: Object.keys(validDatasets),
                    dataLabels: { enabled: true, formatter: val => Number(val).toFixed(2) }
                } : {
                    xaxis: { ...baseOptions.xaxis, categories: labels, title: { text: '年月份' } },
                    yaxis: {
                        ...baseOptions.yaxis, // Preserve Y-axis theme
                        title: { text: '百分比' },
                        min: 0,
                        max: 100,
                        labels: { formatter: val => Math.floor(val) + '%' }
                    }
                }),
                colors: Object.values(validDatasets).map(d => d.color)
            };

            console.log("Biomedical waste stacked bar chart config:", chartOptions);
            if (seriesData.length && (isTotal || labels.length)) {
                biomedicalStackedBarChart = new ApexCharts(document.getElementById('stackedBarChartBiomedicalWastProductionPercentage'), chartOptions);
                biomedicalStackedBarChart.render();
            }
        };
        window.updateBiomedicalStackedBar('monthly');

        new ApexCharts(document.getElementById('lineChartBiomedicalWasteProductionTotal'), {
            ...baseOptions,
            chart: {
                ...baseOptions.chart, // Preserve toolbar and animations
                type: 'line'
            },
            series: [{ name: '總產量 (公噸)', data: alignDataWithLabels(biomedicalData.last12Months.labels, biomedicalData.last12Months.total || [], xAxisLabels) }],
            xaxis: { ...baseOptions.xaxis, categories: xAxisLabels, title: { text: '年月份' } },
            yaxis: { ...baseOptions.yaxis, title: { text: '公噸' }, min: 0 },
            colors: ['#FFCE56']
        }).render();
    }

    if (biomedicalData.dialysis12Months && Array.isArray(biomedicalData.dialysis12Months.labels)) {
        new ApexCharts(document.getElementById('lineChartDialBucketAndSoftBagProduction'), {
            ...baseOptions,
            chart: {
                ...baseOptions.chart, // Preserve toolbar and animations
                type: 'line'
            },
            series: Object.keys(biomedicalData.dialysis12Months.datasets || {}).map(key => ({
                name: key,
                data: alignDataWithLabels(biomedicalData.dialysis12Months.labels, biomedicalData.dialysis12Months.datasets[key].data || [], xAxisLabels)
            })),
            xaxis: { ...baseOptions.xaxis, categories: xAxisLabels, title: { text: '年月份' } },
            yaxis: { ...baseOptions.yaxis, title: { text: '公斤' }, min: 0 },
            colors: Object.values(biomedicalData.dialysis12Months.datasets || {}).map(d => d.color || '#000000')
        }).render();

        new ApexCharts(document.getElementById('lineChartDialBucketAndSoftBagDisposalCosts'), {
            ...baseOptions,
            chart: {
                ...baseOptions.chart, // Preserve toolbar and animations
                type: 'line'
            },
            series: [{ name: '費用 (新台幣)', data: alignDataWithLabels(biomedicalData.dialysis12Months.labels, biomedicalData.dialysis12Months.costs || [], xAxisLabels) }],
            xaxis: { ...baseOptions.xaxis, categories: xAxisLabels, title: { text: '年月份' } },
            yaxis: { ...baseOptions.yaxis, title: { text: '新台幣' }, min: 0 },
            colors: ['#FF6384']
        }).render();
    }
};

// Pharmaceutical Glass Charts
export const renderPharGlassCharts = (pharGlassData, xAxisLabels) => {
    if (pharGlassData.last12Months && Array.isArray(pharGlassData.last12Months.labels)) {
        new ApexCharts(document.getElementById('lineCharPharGlassProduction'), {
            ...baseOptions,
            chart: {
                ...baseOptions.chart, // Preserve toolbar and animations
                type: 'line'
            },
            series: [{ name: '產量 (公斤)', data: alignDataWithLabels(pharGlassData.last12Months.labels, pharGlassData.last12Months.data || [], xAxisLabels) }],
            xaxis: { ...baseOptions.xaxis, categories: xAxisLabels, title: { text: '年月份' } },
            yaxis: { ...baseOptions.yaxis, title: { text: '公斤' }, min: 0 },
            colors: ['#36A2EB']
        }).render();

        new ApexCharts(document.getElementById('lineChartPharGlassDisposalCosts'), {
            ...baseOptions,
            chart: {
                ...baseOptions.chart, // Preserve toolbar and animations
                type: 'line'
            },
            series: [{ name: '費用 (新台幣)', data: alignDataWithLabels(pharGlassData.last12Months.labels, pharGlassData.last12Months.costs || [], xAxisLabels) }],
            xaxis: { ...baseOptions.xaxis, categories: xAxisLabels, title: { text: '年月份' } },
            yaxis: { ...baseOptions.yaxis, title: { text: '新台幣' }, min: 0 },
            colors: ['#FF6384']
        }).render();
    }
};