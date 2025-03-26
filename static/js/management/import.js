document.addEventListener('DOMContentLoaded', () => {
    const importBtn = document.getElementById('importDataBtn');
    const importModal = document.getElementById('importModal');
    const loadingModal = document.getElementById('loadingModal');
    const overrideModal = document.getElementById('overrideModal');
    const saveUrl = window.databaseConfig.saveUrl;
    const csrfToken = window.databaseConfig.csrfToken;

    let applyToAllOverride = false;

    let isProcessing = false;
    const requestQueue = [];

    async function processQueue() {
        if (isProcessing || requestQueue.length === 0) return;
        isProcessing = true;
        const { method, url, data, resolve, reject } = requestQueue.shift();
        try {
            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken
                },
                body: method === 'POST' ? JSON.stringify(data) : undefined
            });
            const result = await response.json();
            resolve(result);
        } catch (error) {
            console.error(`Request failed: ${method} ${url}`, error);
            reject(error);
        } finally {
            isProcessing = false;
            processQueue();
        }
    }

    function queueRequest(method, url, data) {
        return new Promise((resolve, reject) => {
            requestQueue.push({ method, url, data, resolve, reject });
            processQueue();
        });
    }

    importBtn.addEventListener('click', () => {
        importModal.hidden = false;
        importModal.showModal();
    });

    const fileInput = document.getElementById('importFileInput');
    const uploadBtn = document.getElementById('uploadBtn');
    const importCloseBtn = document.getElementById('importCloseBtn');

    importCloseBtn.addEventListener('click', () => {
        importModal.close();
        importModal.hidden = true;
    });

    uploadBtn.addEventListener('click', () => {
        const file = fileInput.files[0];
        if (!file) {
            showAlert('請選擇一個 CSV 檔案');
            return;
        }
        if (!file.name.endsWith('.csv')) {
            showAlert('請上傳 CSV 格式的檔案');
            return;
        }
        importModal.close();
        importModal.hidden = true;
        processFile(file);
    });

    function processFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target.result;
            const rows = text.split('\n').map(row => row.trim()).filter(row => row);
            if (rows.length <= 1) {
                showAlert('檔案內容為空或缺少數據');
                return;
            }
            const headers = rows[0].split(',').map(h => h.trim());
            const dataRows = rows.slice(1).map(row => row.split(',').map(v => v.trim()));
            validateAndUpload(headers, dataRows);
        };
        reader.readAsText(file);
    }

    const fieldMap = {
        '日期': 'date',
        '南區一般事業廢棄物產量': { field: 'tainan', table: 'general_waste_production' },
        '仁武一般事業廢棄物產量': { field: 'renwu', table: 'general_waste_production' },
        '一般事業廢棄物總產量': { field: 'total', table: 'general_waste_production' },
        '紅袋生物醫療廢棄物產量': { field: 'red_bag', table: 'biomedical_waste_production' },
        '黃袋生物醫療廢棄物產量': { field: 'yellow_bag', table: 'biomedical_waste_production' },
        '生物醫療廢棄物總產量': { field: 'total', table: 'biomedical_waste_production' },
        '洗腎桶產出': { field: 'produced_dialysis_bucket', table: 'dialysis_bucket_soft_bag_production_and_disposal_costs' },
        '軟袋產出': { field: 'produced_soft_bag', table: 'dialysis_bucket_soft_bag_production_and_disposal_costs' },
        '洗腎桶軟袋處理費用': { field: 'cost', table: 'dialysis_bucket_soft_bag_production_and_disposal_costs' },
        '藥用玻璃產量': { field: 'produced', table: 'pharmaceutical_glass_production_and_disposal_costs' },
        '藥用玻璃處理費用': { field: 'cost', table: 'pharmaceutical_glass_production_and_disposal_costs' },
        '紙產量': { field: 'paper_produced', table: 'paper_iron_aluminum_can_plastic_and_glass_production_and_recycling_revenue' },
        '鐵鋁罐產量': { field: 'iron_aluminum_can_produced', table: 'paper_iron_aluminum_can_plastic_and_glass_production_and_recycling_revenue' },
        '塑膠產量': { field: 'plastic_produced', table: 'paper_iron_aluminum_can_plastic_and_glass_production_and_recycling_revenue' },
        '玻璃產量': { field: 'glass_produced', table: 'paper_iron_aluminum_can_plastic_and_glass_production_and_recycling_revenue' },
        '回收收入': { field: 'recycling_revenue', table: 'paper_iron_aluminum_can_plastic_and_glass_production_and_recycling_revenue' }
    };

    async function validateAndUpload(headers, dataRows) {
        loadingModal.hidden = false;
        loadingModal.showModal();
        let lastResult = null;
        const progressText = document.getElementById('progressText');
        const progressBar = loadingModal.querySelector('.bar');

        const requiredHeaders = ['日期'];
        const results = { success: 0, skipped: 0, failed: [], total: dataRows.length };
        let processed = 0;
        let cancelled = false;

        if (!requiredHeaders.every(h => headers.includes(h))) {
            loadingModal.close();
            loadingModal.hidden = true;
            showAlert('CSV 檔案必須包含「日期」欄位');
            return;
        }

        for (const row of dataRows) {
            if (cancelled) break;

            const rawData = {};
            headers.forEach((header, i) => {
                rawData[header] = row[i] || '';
            });

            if (!validate_date_format(rawData['日期'])) {
                results.failed.push({ row: processed + 2, reason: '日期格式錯誤' });
            } else {
                const dataByTable = {};
                for (const [header, value] of Object.entries(rawData)) {
                    const mapping = fieldMap[header];
                    if (mapping && header !== '日期') {
                        if (!dataByTable[mapping.table]) {
                            dataByTable[mapping.table] = { date: rawData['日期'] };
                        }
                        dataByTable[mapping.table][mapping.field] = value;
                    }
                }

                let rowSuccess = true;
                let rowSkipped = false;
                for (const [table, data] of Object.entries(dataByTable)) {
                    let result;
                    if (applyToAllOverride && lastResult?.error === '略過此筆資料') {
                        result = { success: false, error: '略過此筆資料' };
                    } else if (applyToAllOverride && lastResult?.success) {
                        result = await overrideData(table, data); // Override all if last was successful override
                        updateProgress(processed + 1, dataRows.length); // Update progress after each override
                    } else {
                        result = await uploadRow(table, data);
                    }
                    lastResult = result;
                    if (!result.success) {
                        if (result.error === '略過此筆資料') {
                            rowSkipped = true;
                        } else if (result.error === '取消上傳') {
                            cancelled = true;
                            break;
                        } else {
                            rowSuccess = false;
                            results.failed.push({ row: processed + 2, reason: result.error });
                        }
                    }
                }
                if (rowSuccess && !rowSkipped) results.success++;
                if (rowSkipped) {
                    results.skipped++;
                    updateProgress(processed + 1, dataRows.length); // Update progress for skipped rows
                }
            }

            processed++;
            if (!applyToAllOverride || (applyToAllOverride && lastResult?.error === '取消上傳')) {
                updateProgress(processed, dataRows.length); // Normal progress update
            }
        }

        loadingModal.close();
        loadingModal.hidden = true;
        showUploadResult(results);
    }

    async function uploadRow(table, data) {
        try {
            const result = await queueRequest('POST', saveUrl, {
                table,
                date: data['date'],
                original_date: '',
                ...data
            });
            console.log(`uploadRow result for ${table}, ${data['date']}:`, result);
            if (!result.success && result.error.includes('已存在')) {
                return await handleConflict(table, data);
            }
            return result;
        } catch (error) {
            console.error('Upload error:', error);
            return { success: false, error: '上傳失敗' };
        }
    }

    async function handleConflict(table, data) {
        overrideModal.hidden = false;
        overrideModal.showModal();

        try {
            console.log(`Fetching data: /management/get_data/?table=${table}&date=${data['date']}`);
            const existingData = await queueRequest('GET', `/management/get_data/?table=${table}&date=${data['date']}`, {});
            console.log('Response from get_data:', existingData);

            if (existingData.error) {
                throw new Error(existingData.error || '未知錯誤');
            }

            const reverseFieldMap = Object.fromEntries(Object.entries(fieldMap).map(([k, v]) => [v.field || v, k]));
            const displayExistingData = {};
            const displayNewData = {};
            for (const [key, value] of Object.entries(existingData)) {
                displayExistingData[reverseFieldMap[key] || key] = value;
            }
            for (const [key, value] of Object.entries(data)) {
                displayNewData[reverseFieldMap[key] || key] = value;
            }

            document.getElementById('overrideHeader').textContent = `「${data['date']}」已存在於資料庫 ${table} 中`;
            buildTable('existingDataTable', displayExistingData, true);
            buildTable('newDataTable', displayNewData, false);
        } catch (error) {
            console.error('Failed to fetch existing data:', error);
            overrideModal.close();
            overrideModal.hidden = true;
            return { success: false, error: `無法獲取現有資料: ${error.message}` };
        }

        return new Promise((resolve) => {
            const overrideBtn = document.getElementById('overrideBtn');
            const skipBtn = document.getElementById('skipBtn');
            const cancelBtn = document.getElementById('cancelBtn');
            const applyToAllCheckbox = document.getElementById('applyToAll');

            overrideBtn.onclick = async () => {
                applyToAllOverride = applyToAllCheckbox.checked;
                const result = await overrideData(table, data);
                overrideModal.close();
                overrideModal.hidden = true;
                resolve(result);
            };

            skipBtn.onclick = () => {
                applyToAllOverride = applyToAllCheckbox.checked;
                overrideModal.close();
                overrideModal.hidden = true;
                resolve({ success: false, error: '略過此筆資料' });
            };

            cancelBtn.onclick = () => {
                applyToAllOverride = applyToAllCheckbox.checked;
                overrideModal.close();
                overrideModal.hidden = true;
                resolve({ success: false, error: '取消上傳' });
            };
        });
    }

    async function overrideData(table, data) {
        try {
            const result = await queueRequest('POST', saveUrl, {
                table,
                date: data['date'],
                original_date: data['date'],
                ...data
            });
            console.log(`overrideData result for ${table}, ${data['date']}:`, result);
            return result;
        } catch (error) {
            console.error('Override error:', error);
            return { success: false, error: '覆寫失敗' };
        }
    }

    function updateProgress(processed, total) {
        const percentage = ((processed / total) * 100).toFixed(2);
        const progressBar = loadingModal.querySelector('.bar');
        progressBar.style.setProperty('--value', percentage);
        document.getElementById('progressText').textContent = `${percentage}% (${processed}/${total})`;
    }

    function buildTable(tableId, data, showDate = true) {
        const table = document.getElementById(tableId);
        table.innerHTML = `
            <thead><tr>${buildTableHeaders(data, showDate)}</tr></thead>
            <tbody><tr>${buildTableRow(data, showDate)}</tr></tbody>
        `;
    }

    function buildTableHeaders(data, showDate) {
        const keys = Object.keys(data).filter(k => k !== '日期');
        return `<td style="width: 6em">${showDate ? '日期' : ''}</td>` + keys.map(k => `<td>${k}</td>`).join('');
    }

    function buildTableRow(data, showDate) {
        const keys = Object.keys(data).filter(k => k !== '日期');
        const dateValue = data['日期'] || '';
        const dateCell = `<td${dateValue === '' ? ' class="is-empty"' : ''}>${dateValue}</td>`;
        const otherCells = keys.map(k => {
            const value = data[k] || '';
            return `<td${value === '' ? ' class="is-empty"' : ''}>${value}</td>`;
        }).join('');
        return dateCell + otherCells;
    }

    function showAlert(message, success = false) {
        const modal = document.createElement('dialog');
        modal.className = 'ts-modal';
        modal.innerHTML = `
            <div class="content">
                <div class="ts-content is-center-aligned is-padded">
                    <div class="ts-header is-icon">
                        <span class="ts-icon ${success ? 'is-check-circle-icon' : 'is-triangle-exclamation-icon'}"></span>
                        ${success ? '上傳成功' : '上傳失敗'}
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

    function showUploadResult(results) {
        const modal = document.createElement('dialog');
        modal.className = 'ts-modal is-big';
        let failedDetails = '';
        if (results.failed.length > 0) {
            failedDetails = '<div class="ts-content"><h3>失敗詳情：</h3><ul>' +
                results.failed.map(f => `<li>第 ${f.row} 行：${f.reason}</li>`).join('') +
                '</ul></div><div class="ts-divider"></div>';
        }
        modal.innerHTML = `
            <div class="content">
                <div class="ts-content is-center-aligned is-padded">
                    <div class="ts-header is-icon">
                        <span class="ts-icon ${results.failed.length === 0 && results.skipped === 0 ? 'is-check-circle-icon' : 'is-triangle-exclamation-icon'}"></span>
                        上傳結果
                    </div>
                    <p>總共 ${results.total} 筆資料，成功 ${results.success} 筆，略過 ${results.skipped} 筆，失敗 ${results.failed.length} 筆</p>
                </div>
                ${failedDetails}
                <div class="ts-content">
                    <button class="ts-button is-fluid reload-btn">確認</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        modal.showModal();
        modal.querySelector('.reload-btn').addEventListener('click', () => {
            modal.close();
            document.body.removeChild(modal);
            location.reload();
        });
    }

    function validate_date_format(date_str) {
        if (!date_str || typeof date_str !== 'string') return false;
        const regex = /^\d{4}-\d{2}$/;
        if (!regex.test(date_str)) return false;
        const [year, month] = date_str.split('-').map(Number);
        return year >= 1970 && year <= 9999 && month >= 1 && month <= 12;
    }

    document.getElementById('loadingCloseBtn').addEventListener('click', () => {
        loadingModal.close();
        loadingModal.hidden = true;
    });
});