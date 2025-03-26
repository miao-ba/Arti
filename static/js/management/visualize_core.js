// Initialize chart generation logic when DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    // Configuration and DOM elements
    const fields = window.visualizeConfig ? window.visualizeConfig.fields : {};
    const csrfToken = window.visualizeConfig ? window.visualizeConfig.csrfToken : '';
    const chartTypeSelect = document.getElementById('chartType');
    const yAxisSelect = document.getElementById('yAxis');
    const xAxisSelect = document.getElementById('xAxis');
    const generateChartBtn = document.getElementById('generateChartBtn');
    const chartPreview = document.getElementById('chartPreview');
    let chart = null;

    // Define Y-axis options with new percentage options (excluding 'weight_percentage')
    const yAxisOptions = [
        { value: 'metric_ton', text: '以重量劃分 - 公噸' },
        { value: 'kilogram', text: '以重量劃分 - 公斤' },
        // Removed 'weight_percentage' option as per requirement
        { value: 'weight_percentage_metric_ton', text: '以重量劃分 - 百分比(公噸)' },
        { value: 'weight_percentage_kilogram', text: '以重量劃分 - 百分比(公斤)' },
        { value: 'new_taiwan_dollar', text: '以金額劃分 - 新台幣' },
        { value: 'cost_percentage_new_taiwan_dollar', text: '以金額劃分 - 百分比(新台幣)' },
    ];

    // Update Y-axis options based on chart type
    function updateYAxisOptions() {
        const percentageCharts = ['stacked_bar']; // Only stacked bar allows all percentage options
        const selectedChartType = chartTypeSelect.value;
        let filteredOptions = yAxisOptions;

        if (['pie', 'donut'].includes(selectedChartType)) {
            // For pie/donut, only allow metric_ton, kilogram, and new_taiwan_dollar
            filteredOptions = yAxisOptions.filter(opt =>
                ['metric_ton', 'kilogram', 'new_taiwan_dollar'].includes(opt.value));
        } else if (!percentageCharts.includes(selectedChartType)) {
            // For other charts (except stacked_bar), exclude percentage options
            filteredOptions = yAxisOptions.filter(opt => !opt.value.includes('percentage'));
        }

        yAxisSelect.innerHTML = filteredOptions
            .map(opt => `<option value="${opt.value}">${opt.text}</option>`)
            .join('');
    }

    chartTypeSelect.addEventListener('change', updateYAxisOptions);
    updateYAxisOptions();

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

    // Common yAxis configuration with dynamic max value
    function getYAxisConfig(showFullGridChecked, seriesData) {
        const isPercentage = yAxisSelect.value.includes('percentage');
        const isPieOrDonut = ['pie', 'donut'].includes(chartTypeSelect.value);
        const isKilogramOrNTD = yAxisSelect.value === 'kilogram' || yAxisSelect.value === 'new_taiwan_dollar';
        let maxValue;

        // Calculate max value only for non-percentage, non-pie/donut charts
        if (!isPercentage && !isPieOrDonut && seriesData) {
            const allDataPoints = seriesData.flatMap(s => s.data);
            const highestValue = Math.max(...allDataPoints);
            if (isKilogramOrNTD) {
                maxValue = Math.ceil(highestValue / 1000) * 1000; // Round up to nearest multiple of 1000
            } else {
                maxValue = Math.ceil(highestValue / 5) * 5; // Round up to nearest multiple of 5
            }
        }

        return {
            title: {
                text: yAxisSelect.value === 'metric_ton' ? '公噸' :
                      yAxisSelect.value === 'kilogram' ? '公斤' :
                      yAxisSelect.value === 'new_taiwan_dollar' ? '新台幣' : '百分比',
                style: {
                    fontSize: '14px',
                    fontFamily: 'Sarasa Mono TC Regular, sans-serif',
                },
            },
            min: 0,
            forceNiceScale: true,
            tickAmount: showFullGridChecked ? 10 : 5,
            max: maxValue,
            labels: {
                formatter: (val) => {
                    if (yAxisSelect.value === 'new_taiwan_dollar') return val.toLocaleString('zh-TW');
                    if (yAxisSelect.value.includes('percentage')) return `${val.toFixed(2)}%`; // Display 2 decimal places for percentage
                    return val;
                },
                style: {
                    fontSize: '14px',
                    fontFamily: 'Sarasa Mono TC Regular, sans-serif',
                },
            },
            ...(isPercentage ? { min: 0, max: 100 } : {})
        };
    }

    // Common grid configuration
    function getGridConfig(showFullGridChecked) {
        return {
            xaxis: {
                lines: {
                    show: showFullGridChecked
                }
            },
            yaxis: {
                lines: {
                    show: true
                }
            },
            borderColor: '#E0E0E0',
            strokeDashArray: 0,
        };
    }

    // Handle chart generation
    generateChartBtn.addEventListener('click', () => {
        const dataBoxes = document.querySelectorAll('#dataList .ts-box');
        if (dataBoxes.length === 0) {
            showErrorModal('請至少新增一條線段');
            return;
        }

        const datasets = Array.from(dataBoxes).map(box => {
            const fieldSelect = box.querySelector('.data-field');
            if (!fieldSelect || !fieldSelect.value) {
                showErrorModal('請為所有線段選擇欄位');
                throw new Error('Missing field');
            }
            const [table, field] = fieldSelect.value.split(':');
            let startDate, endDate;
            if (xAxisSelect.value.startsWith('quarter')) {
                const startYear = box.querySelector('.start-date-year')?.value;
                const startQuarter = box.querySelector('.start-date-quarter')?.value;
                const endYear = box.querySelector('.end-date-year')?.value;
                const endQuarter = box.querySelector('.end-date-quarter')?.value;
                if (!startYear || !startQuarter || !endYear || !endQuarter) {
                    showErrorModal('請填寫完整的季度日期');
                    throw new Error('Incomplete quarter dates');
                }
                startDate = `${startYear}-${(startQuarter * 3 - 2).toString().padStart(2, '0')}-01`;
                endDate = `${endYear}-${(endQuarter * 3).toString().padStart(2, '0')}-01`;
                if (new Date(startDate) > new Date(endDate)) {
                    showErrorModal('結束日期不能早於開始日期');
                    throw new Error('Invalid date range');
                }
            } else if (xAxisSelect.value.startsWith('year')) {
                startDate = box.querySelector('.start-date')?.value;
                endDate = box.querySelector('.end-date')?.value;
                if (!startDate || !endDate) {
                    showErrorModal('請填寫完整的日期範圍');
                    throw new Error('Incomplete dates');
                }
                if (parseInt(startDate) > parseInt(endDate)) {
                    showErrorModal('結束年份不能早於開始年份');
                    throw new Error('Invalid date range');
                }
                startDate = `${startDate}-01-01`;
                endDate = `${endDate}-12-31`;
            } else {
                startDate = box.querySelector('.start-date')?.value;
                endDate = box.querySelector('.end-date')?.value;
                if (!startDate || !endDate) {
                    showErrorModal('請填寫完整的日期範圍');
                    throw new Error('Incomplete dates');
                }
                if (new Date(startDate) > new Date(endDate)) {
                    showErrorModal('結束日期不能早於開始日期');
                    throw new Error('Invalid date range');
                }
                startDate += '-01';
                endDate += '-01';
            }
            const customName = box.querySelector('.data-name')?.value.trim();
            const defaultName = customName || `${fields[table][field].name} (${startDate.slice(0, 7)} 至 ${endDate.slice(0, 7)} 總計)`;
            const name = ['pie', 'donut'].includes(chartTypeSelect.value) ? defaultName : (customName || `${fields[table][field].name} (${startDate.slice(0, 7)} 至 ${endDate.slice(0, 7)})`);
            const colorInput = box.querySelector('.color-picker');
            const color = colorInput ? (colorInput.value || '#000000') : '#000000';
            return { table, field, start_date: startDate, end_date: endDate, name, color };
        });

        const payload = {
            chart_type: chartTypeSelect.value,
            y_axis: yAxisSelect.value,
            x_axis: xAxisSelect.value,
            datasets: datasets,
            title: document.getElementById('chartTitle').value || `廢棄物報表 (${yAxisSelect.options[yAxisSelect.selectedIndex].text} vs ${xAxisSelect.options[xAxisSelect.selectedIndex].text})`,
            show_values: document.getElementById('showValues').checked,
        };

        console.log("Sending payload:", JSON.stringify(payload, null, 2));

        fetch('/management/visualize/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken,
            },
            body: JSON.stringify(payload),
        })
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return response.json();
        })
        .then(data => {
            console.log("Received data:", data);
            if (data.success) {
                if (chart) chart.destroy();

                const showFullGridChecked = document.getElementById('showFullGrid').checked;
                let chartOptions = {
                    chart: {
                        type: chartTypeSelect.value === 'stacked_bar' ? 'bar' : chartTypeSelect.value,
                        height: 600,
                        toolbar: { show: true },
                        zoom: {
                            enabled: true,
                            type: 'x',
                            autoScaleYaxis: false,
                            allowMouseWheelZoom: true
                        },
                        stacked: chartTypeSelect.value === 'stacked_bar',
                    },
                    series: data.series,
                    xaxis: {
                        categories: data.x_axis_labels,
                        tickAmount: 24,
                        labels: {
                            style: {
                                fontSize: '14px',
                                fontFamily: 'Sarasa Mono TC Regular, sans-serif',
                            }
                        },
                        title: {
                            text: xAxisSelect.value.startsWith('year') ? '年度' : xAxisSelect.value.startsWith('quarter') ? '季度' : xAxisSelect.value === 'only_month' ? '月份' : '年月份',
                            style: {
                                fontSize: '14px',
                                fontFamily: 'Sarasa Mono TC Regular, sans-serif',
                            },
                        },
                    },
                    yaxis: getYAxisConfig(showFullGridChecked, data.series),
                    title: {
                        text: data.title,
                        align: 'center',
                        style: {
                            fontSize: '18px',
                            fontFamily: 'Sarasa Mono TC Bold, sans-serif',
                        }
                    },
                    dataLabels: {
                        enabled: document.getElementById('showValues').checked,
                        dropShadow: {
                            enabled: true,
                            left: 2,
                            top: 2,
                            opacity: 0.25
                        },
                        style: {
                            fontSize: '15px',
                            fontFamily: 'Sarasa Mono TC Regular, sans-serif',
                        },
                        formatter: function(val) {
                            return yAxisSelect.value.includes('percentage') ? `${val.toFixed(2)}%` : val; // 2 decimal places for percentage
                        },
                    },
                    legend: {
                        fontSize: '14px',
                        fontFamily: 'Sarasa Mono TC Regular, monospace'
                    },
                    tooltip: {
                        style: {
                            fontSize: '16px',
                            fontFamily: 'Sarasa Mono TC Regular, sans-serif'
                        },
                        y: {
                            formatter: function(value) {
                                if (yAxisSelect.value === 'new_taiwan_dollar') return value.toLocaleString('zh-TW') + ' 元';
                                if (yAxisSelect.value.includes('percentage')) return `${value.toFixed(2)}%`; // 2 decimal places for tooltip
                                if (yAxisSelect.value === 'metric_ton') return `${value} 公噸`;
                                if (yAxisSelect.value === 'kilogram') return `${value} 公斤`;
                                return value;
                            }
                        }
                    },
                    grid: getGridConfig(showFullGridChecked),
                    colors: data.series.map(s => s.color || '#000000'),
                };

                if (['pie', 'donut'].includes(data.chart_type)) {
                    chartOptions.labels = data.series.map(s => s.name);
                    chartOptions.series = data.series.map(s => {
                        const total = s.data.reduce((a, b) => a + b, 0);
                        return total; // Revert to original raw total value for pie/donut charts
                    });
                    chartOptions.yaxis = {
                        title: {
                            text: yAxisSelect.value === 'metric_ton' ? '公噸' :
                                  yAxisSelect.value === 'kilogram' ? '公斤' : '新台幣'
                        }
                    };
                    // Customize pie/donut chart data labels to show original value with percentage
                    chartOptions.dataLabels = {
                        ...chartOptions.dataLabels,
                        formatter: function(val, opts) {
                            const total = opts.w.globals.seriesTotals.reduce((a, b) => a + b, 0);
                            const percentage = (val / total * 100).toFixed(2); // Keep 2 decimal places
                            return `${val.toFixed(2)}%`; // Original value with percentage in parentheses
                        }
                    };
                    delete chartOptions.xaxis;
                }

                chart = new ApexCharts(chartPreview, chartOptions);
                chart.render();
                window.chart = chart;
                window.chartData = data;

                // Render table if includeTable is checked
                const includeTableCheckbox = document.getElementById('includeTable');
                const dataTable = document.getElementById('dataTable');
                if (includeTableCheckbox.checked) {
                    dataTable.innerHTML = generateTableHtml(window.chartData);
                    dataTable.style.display = 'block';
                } else {
                    dataTable.innerHTML = '';
                    dataTable.style.display = 'none';
                }
            } else {
                showErrorModal('生成圖表失敗：' + (data.error || '未知錯誤'));
            }
        })
        .catch(error => {
            console.error('Fetch error:', error);
            showErrorModal('請求失敗：' + error.message);
        });
    });

    // Dynamic update for showFullGrid checkbox
    document.getElementById('showFullGrid').addEventListener('change', function(e) {
        if (window.chart) {
            const showFullGridChecked = e.target.checked;
            window.chart.updateOptions({
                yaxis: getYAxisConfig(showFullGridChecked, window.chartData.series),
                grid: getGridConfig(showFullGridChecked)
            }, false, true);
        }
    });

    // Dynamic update for showValues checkbox
    document.getElementById('showValues').addEventListener('change', function(e) {
        if (window.chart) {
            window.chart.updateOptions({
                dataLabels: {
                    enabled: e.target.checked
                }
            }, false, true);
        }
    });

    // Dynamic update for includeTable checkbox
    document.getElementById('includeTable').addEventListener('change', function(e) {
        const dataTable = document.getElementById('dataTable');
        if (e.target.checked && window.chartData) {
            dataTable.innerHTML = generateTableHtml(window.chartData);
            dataTable.style.display = 'block';
        } else {
            dataTable.innerHTML = '';
            dataTable.style.display = 'none';
        }
    });
});