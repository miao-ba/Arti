// Define color swatches globally
// Reference: https://www.heavy.ai/blog/12-color-palettes-for-telling-better-stories-with-your-data
const swatches = [
    "#ea5545", "#f46a9b", "#ef9b20", "#edbf33", "#ede15b", "#bdcf32", "#87bc45", "#27aeef", "#b33dc6",
    "#e60049", "#0bb4ff", "#50e991", "#e6d800", "#9b19f5", "#ffa300", "#dc0ab4", "#b3d4ff", "#00bfa0",
    "#b30000", "#7c1158", "#4421af", "#1a53ff", "#0d88e6", "#00b7c7", "#5ad45a", "#8be04e", "#ebdc78",
    "#fd7f6f", "#7eb0d5", "#b2e061", "#bd7ebe", "#ffb55a", "#ffee65", "#beb9db", "#fdcce5", "#8bd3c7",
    "#d7e1ee", "#cbd6e4", "#bfcbdb", "#b3bfd1", "#a4a2a8", "#df8879", "#c86558", "#b04238", "#991f17",
    "#2e2b28", "#3b3734", "#474440", "#54504c", "#6b506b", "#ab3da9", "#de25da", "#eb44e8", "#ff80ff",
    "#1984c5", "#22a7f0", "#63bff0", "#a7d5ed", "#e2e2e2", "#e1a692", "#de6e56", "#e14b31", "#c23728",
    "#54bebe", "#76c8c8", "#98d1d1", "#badbdb", "#dedad2", "#e4bcad", "#df979e", "#d7658b", "#c80064",
];
let colorIndex = 0;

// Get next color from swatches or random
function getNextColor() {
    return colorIndex < swatches.length ? swatches[colorIndex++] : '#' + Math.random().toString(16).substr(2, 6);
}

// Initialize data selection logic
document.addEventListener('DOMContentLoaded', () => {
    const addDataBtn = document.getElementById('addDataBtn');
    const dataList = document.getElementById('dataList');
    const xAxisSelect = document.getElementById('xAxis');
    const yAxisSelect = document.getElementById('yAxis');
    const fields = window.visualizeConfig ? window.visualizeConfig.fields : {};
    let previousYAxis = yAxisSelect.value;

    new Sortable(dataList, {
        handle: '.ts-icon.is-bars-icon',
        animation: 150,
    });

    // Initialize Coloris with swatches as reference and full picker enabled
    Coloris({
        el: '.color-picker',
        wrap: true,
        format: 'hex',
        swatches: swatches,
        swatchesOnly: false,
        defaultColor: '#000000',
        alpha: false,
        theme: 'large',
        onChange: (color, input) => {
            input.style.backgroundColor = color;
            input.value = color;
            console.log(`Color changed to: ${color} for input ID: ${input.id}`);
        }
    });

    // Fix swatches layout and adjust sizes after Coloris renders
    setTimeout(() => {
        const picker = document.querySelector('#clr-picker.clr-picker');
        const swatchesContainer = document.querySelector('#clr-picker .clr-swatches');
        if (swatchesContainer && picker) {
            const wrapperDiv = swatchesContainer.querySelector('div');
            if (wrapperDiv) {
                while (wrapperDiv.firstChild) {
                    swatchesContainer.appendChild(wrapperDiv.firstChild);
                }
                wrapperDiv.remove();
            }

            swatchesContainer.style.display = 'grid';
            swatchesContainer.style.gridTemplateColumns = 'repeat(9, 1fr)';
            swatchesContainer.style.gridTemplateRows = 'repeat(8, 1fr)';
            swatchesContainer.style.width = '275px';
            swatchesContainer.style.height = '290px';
            swatchesContainer.style.maxWidth = 'none';

            swatchesContainer.style.position = 'relative';
            swatchesContainer.style.margin = '0 auto';

            swatchesContainer.style.justifyItems = 'center';

            const buttons = swatchesContainer.querySelectorAll('button');
            buttons.forEach(button => {
                button.style.width = '24px';
                button.style.height = '24px';
                button.style.margin = '0';
                button.style.padding = '0';
                button.style.boxSizing = 'border-box';
                button.style.fontSize = '0';
            });

            picker.style.width = '300px';
            picker.style.minHeight = '475px';
            picker.style.maxWidth = 'none';
            picker.style.overflow = 'visible';
        }
    }, 100);

    addDataBtn.addEventListener('click', () => addDataRow(fields, getNextColor()));
    xAxisSelect.addEventListener('change', () => updateDataInputs(xAxisSelect.value, yAxisSelect.value, fields));
    yAxisSelect.addEventListener('change', () => {
        const currentYAxis = yAxisSelect.value;
        const isUnitSwitch =
            (['metric_ton', 'kilogram'].includes(previousYAxis) && currentYAxis === 'new_taiwan_dollar') ||
            (previousYAxis === 'new_taiwan_dollar' && ['metric_ton', 'kilogram'].includes(currentYAxis));
        if (isUnitSwitch) {
            document.querySelectorAll('#dataList .data-field').forEach(select => {
                select.value = '';
                $(select).trigger('change');
            });
        }
        updateDataInputs(xAxisSelect.value, yAxisSelect.value, fields);
        previousYAxis = currentYAxis;
    });
});

// Add a new data row
function addDataRow(fields, defaultColor) {
    const dataList = document.getElementById('dataList');
    const xAxis = document.getElementById('xAxis').value;
    const yAxis = document.getElementById('yAxis').value;
    const row = document.createElement('div');
    row.className = 'ts-box is-fluid has-padded';
    const uniqueId = `color-picker-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    row.innerHTML = getDataRowHTML(xAxis, yAxis, fields, defaultColor, '', '', '', '', uniqueId);
    dataList.appendChild(row);

    $(row.querySelector('.data-field')).select2({ placeholder: '選擇資料欄位', width: '100%' });

    row.querySelector('.remove-btn').addEventListener('click', () => row.remove());
    row.querySelector('.copy-btn').addEventListener('click', () => copyDataRow(row, fields));
}

// Update existing data rows without rebuilding HTML unless necessary
function updateDataInputs(xAxis, yAxis, fields) {
    const rows = document.querySelectorAll('#dataList .ts-box');
    if (rows.length === 0) return;

    rows.forEach(row => {
        const currentField = row.querySelector('.data-field')?.value || '';
        const currentName = row.querySelector('.data-name')?.value || '';
        const colorInput = row.querySelector('.color-picker');
        const currentColor = colorInput?.value || getNextColor();
        let startDate, endDate;

        if (xAxis.startsWith('year')) {
            startDate = row.querySelector('.start-date')?.value || '';
            endDate = row.querySelector('.end-date')?.value || '';
        } else if (xAxis.startsWith('quarter')) {
            const startYear = row.querySelector('.start-date-year')?.value || '';
            const startQuarter = row.querySelector('.start-date-quarter')?.value || '';
            const endYear = row.querySelector('.end-date-year')?.value || '';
            const endQuarter = row.querySelector('.end-date-quarter')?.value || '';
            startDate = startYear && startQuarter ? `${startYear}-${startQuarter}` : '';
            endDate = endYear && endQuarter ? `${endYear}-${endQuarter}` : '';
        } else {
            startDate = row.querySelector('.start-date')?.value || '';
            endDate = row.querySelector('.end-date')?.value || '';
        }

        console.log(`Updating row with colorPicker ID: ${colorInput?.id}, currentColor: ${currentColor}, startDate: ${startDate}, endDate: ${endDate}`);

        const uniqueId = colorInput?.id || `color-picker-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        row.innerHTML = getDataRowHTML(xAxis, yAxis, fields, currentColor, currentField, currentName, startDate, endDate, uniqueId);
        row.dataset.xAxis = xAxis;
        $(row.querySelector('.data-field')).select2({ placeholder: '選擇資料欄位', width: '100%' });
        if (currentField) {
            const newSelect = row.querySelector('.data-field');
            newSelect.value = currentField;
            $(newSelect).trigger('change');
        }

        row.querySelector('.remove-btn').addEventListener('click', () => row.remove());
        row.querySelector('.copy-btn').addEventListener('click', () => copyDataRow(row, fields));
    });
}

// Copy an existing data row with specific behavior based on xAxis
function copyDataRow(row, fields) {
    const xAxis = document.getElementById('xAxis').value;
    const yAxis = document.getElementById('yAxis').value;
    const dataList = document.getElementById('dataList');
    const newRow = document.createElement('div');
    newRow.className = 'ts-box is-fluid has-padded';

    const currentField = row.querySelector('.data-field')?.value || '';
    const currentName = row.querySelector('.data-name')?.value || '';
    const newColor = getNextColor();
    const uniqueId = `color-picker-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    let startDate, endDate;

    if (xAxis.startsWith('year')) {
        startDate = row.querySelector('.start-date')?.value || '';
        endDate = row.querySelector('.end-date')?.value || '';
    } else if (xAxis.startsWith('quarter')) {
        const startYear = row.querySelector('.start-date-year')?.value || '';
        const startQuarter = row.querySelector('.start-date-quarter')?.value || '';
        const endYear = row.querySelector('.end-date-year')?.value || '';
        const endQuarter = row.querySelector('.end-date-quarter')?.value || '';
        startDate = startYear && startQuarter ? `${startYear}-${startQuarter}` : '';
        endDate = endYear && endQuarter ? `${endYear}-${endQuarter}` : '';
    } else {
        startDate = row.querySelector('.start-date')?.value || '';
        endDate = row.querySelector('.end-date')?.value || '';
        if (xAxis === 'only_month') {
            const startParts = startDate.split('-');
            const endParts = endDate.split('-');
            if (startParts.length === 2 && endParts.length === 2) {
                const newStartYear = (parseInt(startParts[0]) + 1).toString();
                const newEndYear = (parseInt(endParts[0]) + 1).toString();
                startDate = `${newStartYear}-${startParts[1]}`;
                endDate = `${newEndYear}-${endParts[1]}`;
            }
        }
    }

    newRow.innerHTML = getDataRowHTML(xAxis, yAxis, fields, newColor, currentField, currentName, startDate, endDate, uniqueId);
    dataList.appendChild(newRow);

    $(newRow.querySelector('.data-field')).select2({ placeholder: '選擇資料欄位', width: '100%' });
    if (currentField) {
        const newSelect = newRow.querySelector('.data-field');
        newSelect.value = currentField;
        $(newSelect).trigger('change');
    }

    newRow.querySelector('.remove-btn').addEventListener('click', () => newRow.remove());
    newRow.querySelector('.copy-btn').addEventListener('click', () => copyDataRow(newRow, fields));
}

// Generate HTML for a data row with unique ID for color-picker
function getDataRowHTML(xAxis, yAxis, fields, defaultColor, currentField = '', currentName = '', startDate = '', endDate = '', colorPickerId = '') {
    let dateInputs = '';
    if (xAxis.startsWith('year')) {
        dateInputs = `
            <div class="column is-4-wide ts-input">
                <input type="number" class="start-date" min="1970" max="9999" step="1" placeholder="開始年份" value="${startDate}">
            </div>
            <span class="ts-text">至</span>
            <div class="column is-4-wide ts-input">
                <input type="number" class="end-date" min="1970" max="9999" step="1" placeholder="結束年份" value="${endDate}">
            </div>`;
    } else if (xAxis.startsWith('quarter')) {
        const [startYear, startQuarter] = startDate ? startDate.split('-') : ['', ''];
        const [endYear, endQuarter] = endDate ? endDate.split('-') : ['', ''];
        dateInputs = `
            <div class="column is-2-wide ts-input">
                <input type="number" class="start-date-year" min="1970" max="9999" step="1" placeholder="開始年份" value="${startYear}">
            </div>
            <div class="column ts-select is-2-wide">
                <select class="start-date-quarter">
                    <option value="1" ${startQuarter === '1' ? 'selected' : ''}>第一季</option>
                    <option value="2" ${startQuarter === '2' ? 'selected' : ''}>第二季</option>
                    <option value="3" ${startQuarter === '3' ? 'selected' : ''}>第三季</option>
                    <option value="4" ${startQuarter === '4' ? 'selected' : ''}>第四季</option>
                </select>
            </div>
            <span class="ts-text">至</span>
            <div class="column is-2-wide ts-input">
                <input type="number" class="end-date-year" min="1970" max="9999" step="1" placeholder="結束年份" value="${endYear}">
            </div>
            <div class="column ts-select is-2-wide">
                <select class="end-date-quarter">
                    <option value="1" ${endQuarter === '1' ? 'selected' : ''}>第一季</option>
                    <option value="2" ${endQuarter === '2' ? 'selected' : ''}>第二季</option>
                    <option value="3" ${endQuarter === '3' ? 'selected' : ''}>第三季</option>
                    <option value="4" ${endQuarter === '4' ? 'selected' : ''}>第四季</option>
                </select>
            </div>`;
    } else {
        dateInputs = `
            <div class="column is-4-wide ts-input">
                <input type="month" class="start-date" placeholder="開始月份" value="${startDate}">
            </div>
            <span class="ts-text">至</span>
            <div class="column is-4-wide ts-input">
                <input type="month" class="end-date" placeholder="結束月份" value="${endDate}">
            </div>`;
    }

    const tableTranslations = {
        'general_waste_production': '一般事業廢棄物產出',
        'biomedical_waste_production': '生物醫療廢棄物產出',
        'dialysis_bucket_soft_bag_production_and_disposal_costs': '洗腎桶軟袋產出及處理費用表',
        'pharmaceutical_glass_production_and_disposal_costs': '藥用玻璃產出及處理費用表',
        'paper_iron_aluminum_can_plastic_and_glass_production_and_recycling_revenue': '紙鐵鋁罐塑膠玻璃產出及回收收入表',
    };
    const unitTranslations = {
        'metric_ton': '公噸',
        'kilogram': '公斤',
        'new_taiwan_dollar': '新台幣',
    };

    // Determine allowed units based on Y-axis selection
    const allowedUnits = yAxis === 'cost_percentage_new_taiwan_dollar' || yAxis === 'new_taiwan_dollar'
        ? ['new_taiwan_dollar'] // Only NTD-related options for cost percentage or NTD
        : ['metric_ton', 'kilogram']; // Default to weight units otherwise

    let fieldOptions = '';
    for (const [table, fieldInfo] of Object.entries(fields)) {
        let groupOptions = '';
        for (const [field, info] of Object.entries(fieldInfo)) {
            if (allowedUnits.includes(info.unit)) {
                groupOptions += `<option value="${table}:${field}" ${currentField === `${table}:${field}` ? 'selected' : ''}>${info.name} (${unitTranslations[info.unit]})</option>`;
            }
        }
        if (groupOptions) fieldOptions += `<optgroup label="${tableTranslations[table]}">${groupOptions}</optgroup>`;
    }

    return `
        <div class="ts-grid is-middle-aligned">
            <span class="column ts-icon is-bars-icon is-large"></span>
            ${dateInputs}
            <div class="column is-fluid ts-input">
                <input type="text" class="data-name" value="${currentName}" placeholder="線段名稱">
            </div>
            <div class="column ts-input is-1-wide">
                <input type="text" id="${colorPickerId}" class="color-picker" value="${defaultColor}" data-coloris style="background-color: ${defaultColor};">
            </div>
            <button class="column ts-button is-1-wide is-icon is-warning is-outlined is-critical copy-btn">
                <span class="ts-icon is-clipboard-list-icon"></span>
            </button>
            <button class="column ts-button is-1-wide is-icon is-negative is-outlined is-critical remove-btn">
                <span class="ts-icon is-trash-icon"></span>
            </button>
        </div>
        <div class="ts-grid is-end-aligned has-top-padded-small">
            <div class="column" style="width: 58.5em">
                <select class="data-field">
                    <option value="">選擇資料欄位</option>
                    ${fieldOptions}
                </select>
            </div>
        </div>
    `;
}