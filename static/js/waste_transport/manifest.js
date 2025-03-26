/**
 * 醫療廢棄物暨資源管理系統 - 聯單管理模組前端腳本
 * 提供聯單列表、詳細內容顯示、CSV匯入等功能
 */

// 全局變數
let isImporting = false;
let currentConflictIndex = 0;
let csvData = null;
let importResults = { success: 0, skipped: 0, failed: [], total: 0 };
let allConflicts = [];
let applyToAll = false;
let currentResolution = '';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// 頁面載入完成後初始化
document.addEventListener('DOMContentLoaded', function() {
    // 初始化篩選表單顯示/隱藏
    initFilterToggle();
    
    // 初始化聯單卡片點擊事件
    initManifestCardEvents();
    
    // 初始化詳細視圖標籤切換
    initDetailTabs();
    
    // 初始化全選功能
    initSelectAllCheckbox();
    
    // 初始化模態視窗關閉事件
    initModalCloseEvents();
    
    // 初始化匯入按鈕事件
    const importBtn = document.getElementById('btn-import-csv');
    if (importBtn) {
        importBtn.addEventListener('click', openImportModal);
    }
    
    // 初始化匯入表單的檔案選擇事件
    initFileInputHandler();
    
    // 初始化自動完成功能
    initAutocomplete();
    
    console.log('聯單管理模組初始化完成');
});

/**
 * 初始化篩選表單的顯示/隱藏功能
 */
function initFilterToggle() {
    const filterToggleBtn = document.getElementById('filter-toggle');
    const filterForm = document.getElementById('filter-form');
    
    if (!filterToggleBtn || !filterForm) return;
    
    // 一開始隱藏篩選表單
    filterForm.style.display = 'none';
    filterToggleBtn.innerHTML = '<span class="ts-icon is-filter-icon"></span> 顯示篩選條件';
    
    filterToggleBtn.addEventListener('click', function() {
        const isExpanded = filterForm.style.display !== 'none';
        
        if (isExpanded) {
            filterForm.style.display = 'none';
            filterToggleBtn.innerHTML = '<span class="ts-icon is-filter-icon"></span> 顯示篩選條件';
        } else {
            filterForm.style.display = 'block';
            filterToggleBtn.innerHTML = '<span class="ts-icon is-filter-slash-icon"></span> 隱藏篩選條件';
        }
    });
}

/**
 * 初始化聯單卡片點擊事件，加載詳細內容
 */
function initManifestCardEvents() {
    const manifestCards = document.querySelectorAll('.manifest-card');
    
    manifestCards.forEach(card => {
        card.addEventListener('click', function(event) {
            // 如果點擊的是複選框或複選框標籤，不要載入詳細資料
            if (event.target.type === 'checkbox' || event.target.tagName === 'LABEL') {
                return;
            }
            
            // 移除所有卡片的活動狀態
            manifestCards.forEach(c => c.classList.remove('is-active'));
            
            // 設置當前卡片為活動狀態
            this.classList.add('is-active');
            
            // 獲取聯單資訊
            const manifestId = this.dataset.manifestId;
            const wasteId = this.dataset.wasteId;
            const type = this.dataset.type;
            
            // 根據類型載入對應的詳細內容
            loadManifestDetail(type, manifestId, wasteId);
        });
    });
}

/**
 * 初始化詳細視圖標籤切換
 */
function initDetailTabs() {
    document.addEventListener('click', function(event) {
        if (event.target.matches('[data-tab-detail]')) {
            const tabs = document.querySelectorAll('[data-tab-detail]');
            const tabIndex = event.target.getAttribute('data-tab-detail');
            
            // 移除所有標籤頁的活動狀態
            tabs.forEach(tab => tab.classList.remove('is-active'));
            
            // 設置當前標籤頁為活動狀態
            event.target.classList.add('is-active');
            
            // 隱藏所有內容區塊
            const segments = document.querySelectorAll('[data-detail-name]');
            segments.forEach(segment => {
                segment.style.display = 'none';
            });
            
            // 顯示對應的內容區塊
            const targetSegment = document.querySelector(`[data-detail-name="${tabIndex}"]`);
            if (targetSegment) {
                targetSegment.style.display = 'block';
            }
        }
    });
}

/**
 * 初始化模態視窗關閉事件
 */
function initModalCloseEvents() {
    // 匯入模態視窗關閉按鈕
    const closeImportBtn = document.getElementById('close-import-modal');
    if (closeImportBtn) {
        closeImportBtn.addEventListener('click', closeImportModal);
    }
    
    // 點擊匯入模態視窗外部關閉
    const importModal = document.getElementById('import-csv-modal');
    if (importModal) {
        importModal.addEventListener('click', function(e) {
            if (e.target === this) {
                closeImportModal();
            }
        });
    }
}

/**
 * 初始化全選功能
 */
function initSelectAllCheckbox() {
    const selectAllCheckbox = document.getElementById('select-all-manifests');
    if (!selectAllCheckbox) return;
    
    // 儲存所有選中的聯單
    let selectedManifests = new Set();
    
    // 更新批量刪除按鈕狀態函數
    function updateBatchDeleteButton() {
        const batchDeleteBtn = document.getElementById('batch-delete-btn');
        if (!batchDeleteBtn) return;
        
        if (selectedManifests.size > 0) {
            batchDeleteBtn.classList.remove('is-disabled');
            batchDeleteBtn.disabled = false;
        } else {
            batchDeleteBtn.classList.add('is-disabled');
            batchDeleteBtn.disabled = true;
        }
    }
    
    // 全選/取消全選
    selectAllCheckbox.addEventListener('change', function() {
        const isChecked = this.checked;
        
        if (isChecked) {
            // 獲取所有符合當前篩選條件的聯單
            fetch('/transport/get_all_manifest_ids/?' + new URLSearchParams(window.location.search))
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        // 清空當前選擇
                        selectedManifests.clear();
                        
                        // 將所有符合條件的聯單添加到選擇集合中
                        data.manifests.forEach(manifest => {
                            const key = `${manifest.type}|${manifest.manifest_id}|${manifest.waste_id}`;
                            selectedManifests.add(key);
                        });
                        
                        // 更新頁面上的勾選框狀態
                        document.querySelectorAll('.manifest-checkbox').forEach(checkbox => {
                            const card = checkbox.closest('.manifest-card');
                            if (!card) return;
                            
                            const manifestId = card.dataset.manifestId;
                            const wasteId = card.dataset.wasteId;
                            const type = card.dataset.type;
                            const key = `${type}|${manifestId}|${wasteId}`;
                            
                            checkbox.checked = selectedManifests.has(key);
                        });
                        
                        // 更新批量刪除按鈕狀態
                        updateBatchDeleteButton();
                        
                        // 顯示通知
                        showNotification(`已選擇 ${selectedManifests.size} 筆聯單`, 'info');
                    }
                })
                .catch(error => {
                    console.error('獲取聯單ID時發生錯誤:', error);
                    showNotification('獲取聯單ID時發生錯誤，請重試', 'negative');
                });
        } else {
            // 取消全選
            selectedManifests.clear();
            
            // 更新頁面上的勾選框狀態
            document.querySelectorAll('.manifest-checkbox').forEach(checkbox => {
                checkbox.checked = false;
            });
            
            // 更新批量刪除按鈕狀態
            updateBatchDeleteButton();
        }
    });
    
    // 單個勾選改變時更新全選狀態
    document.addEventListener('change', function(event) {
        if (event.target.matches('.manifest-checkbox')) {
            const checkbox = event.target;
            const card = checkbox.closest('.manifest-card');
            if (!card) return;
            
            const manifestId = card.dataset.manifestId;
            const wasteId = card.dataset.wasteId;
            const type = card.dataset.type;
            const key = `${type}|${manifestId}|${wasteId}`;
            
            if (checkbox.checked) {
                selectedManifests.add(key);
            } else {
                selectedManifests.delete(key);
                
                // 如果有取消勾選，則全選框也取消勾選
                selectAllCheckbox.checked = false;
            }
            
            // 如果所有聯單都被勾選，則全選框也勾選
            const allCheckboxes = document.querySelectorAll('.manifest-checkbox');
            const allChecked = Array.from(allCheckboxes).every(cb => cb.checked);
            
            selectAllCheckbox.checked = allChecked;
            
            updateBatchDeleteButton();
        }
    });
    
    // 批量刪除按鈕
    const batchDeleteBtn = document.getElementById('batch-delete-btn');
    if (batchDeleteBtn) {
        batchDeleteBtn.addEventListener('click', function() {
            if (selectedManifests.size === 0) return;
            
            if (confirm(`確定要移除 ${selectedManifests.size} 筆選取的聯單嗎？`)) {
                const manifestsToDelete = Array.from(selectedManifests).map(key => {
                    const [type, manifestId, wasteId] = key.split('|');
                    return { type, manifestId, wasteId };
                });
                
                deleteSelectedManifests(manifestsToDelete);
            }
        });
    }
}

/**
 * 刪除選取的聯單
 * @param {Array} manifestsToDelete - 要刪除的聯單陣列
 */
function deleteSelectedManifests(manifestsToDelete) {
    // 發送AJAX請求到後端執行刪除操作
    fetch('/transport/delete_manifests/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken')
        },
        body: JSON.stringify({ manifests: manifestsToDelete })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showNotification(`已成功移除 ${data.deleted_count} 筆聯單`, 'positive');
            
            // 刪除後重新載入頁面以更新統計資訊
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } else {
            showNotification(data.error || '刪除聯單失敗', 'negative');
        }
    })
    .catch(error => {
        console.error('刪除聯單時發生錯誤:', error);
        showNotification('刪除聯單時發生錯誤，請重試', 'negative');
    });
}

/**
 * 初始化匯入表單的檔案選擇事件
 */
function initFileInputHandler() {
    const fileInput = document.querySelector('#import-csv-modal input[type="file"]');
    const feedbackElement = document.getElementById('file-feedback');
    const submitBtn = document.getElementById('import-submit-btn');
    
    if (!fileInput || !feedbackElement || !submitBtn) return;
    
    // 設置禁用狀態
    submitBtn.disabled = true;
    
    fileInput.addEventListener('change', function() {
        const file = this.files[0];
        
        if (!file) {
            feedbackElement.textContent = '請選擇CSV檔案';
            feedbackElement.className = 'ts-text is-description has-top-spaced-small';
            submitBtn.disabled = true;
            return;
        }
        
        // 檢查檔案類型
        if (!file.name.endsWith('.csv')) {
            feedbackElement.textContent = '檔案格式錯誤，僅支援 .csv 檔案';
            feedbackElement.className = 'ts-text is-description has-top-spaced-small color-negative';
            submitBtn.disabled = true;
            return;
        }
        
        // 檢查檔案大小
        if (file.size > MAX_FILE_SIZE) {
            feedbackElement.textContent = `檔案大小超過限制 (最大 ${MAX_FILE_SIZE / 1024 / 1024}MB)`;
            feedbackElement.className = 'ts-text is-description has-top-spaced-small color-negative';
            submitBtn.disabled = true;
            return;
        }
        
        // 檔案有效
        feedbackElement.textContent = `已選擇: ${file.name} (${formatFileSize(file.size)})`;
        feedbackElement.className = 'ts-text is-description has-top-spaced-small status-confirmed';
        submitBtn.disabled = false;
    });
}

/**
 * 加載聯單詳細內容
 * @param {string} type - 聯單類型 (disposal|reuse)
 * @param {string} manifestId - 聯單編號
 * @param {string} wasteId - 廢棄物ID
 */
function loadManifestDetail(type, manifestId, wasteId) {
    const detailContainer = document.getElementById('manifest-detail');
    if (!detailContainer) return;
    
    // 顯示載入中訊息
    detailContainer.innerHTML = `
        <div class="ts-loading is-centered">
            <div class="image"></div>
            <div class="text">加載中...</div>
        </div>
    `;
    
    // 根據類型決定API路徑
    const url = type === 'disposal' 
        ? `/transport/disposal/${manifestId}/${wasteId}`
        : `/transport/reuse/${manifestId}/${wasteId}`;
    
    // 發送AJAX請求
    fetch(url, {
        headers: {
            'X-Requested-With': 'XMLHttpRequest'
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('網路錯誤');
        }
        return response.json();
    })
    .then(data => {
        // 更新詳細內容容器
        detailContainer.innerHTML = data.html;
        
        // 初始化詳細視圖標籤功能
        initDetailTabs();
    })
    .catch(error => {
        console.error('載入詳細資料失敗:', error);
        detailContainer.innerHTML = `
            <div class="ts-notice is-negative">
                <div class="content">
                    <div class="header">載入失敗</div>
                    <div class="description">無法載入聯單詳細資料，請重試或聯絡系統管理員。</div>
                </div>
            </div>
        `;
    });
}

/**
 * 清空篩選表單
 */
function clearFilterForm() {
    const form = document.getElementById('manifest-filter-form');
    if (!form) return;
    
    // 重置下拉選單
    form.querySelectorAll('select').forEach(select => {
        select.selectedIndex = 0;
    });
    
    // 清空輸入框
    form.querySelectorAll('input[type="text"], input[type="number"], input[type="date"]').forEach(input => {
        input.value = '';
    });
    
    // 提交表單以重新載入
    form.submit();
}

/**
 * 打開匯入CSV模態視窗
 */
function openImportModal() {
    // 獲取模態視窗元素
    const modal = document.getElementById('import-csv-modal');
    if (!modal) {
        console.error('找不到匯入模態視窗元素');
        return;
    }
    
    // 顯示模態視窗
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden'; // 防止背景滾動
    
    // 顯示表單區塊，隱藏其他區塊
    document.getElementById('import-form-container').style.display = 'block';
    document.getElementById('import-progress-container').style.display = 'none';
    document.getElementById('import-conflict-container').style.display = 'none';
    document.getElementById('import-result-container').style.display = 'none';
    
    // 重置表單
    const form = document.getElementById('csv-import-form');
    if (form) {
        form.reset();
    }
    
    // 重置進度條
    resetProgressBar();
    
    // 重置匯入相關變數
    isImporting = false;
    currentConflictIndex = 0;
    csvData = null;
    importResults = { success: 0, skipped: 0, failed: [], total: 0 };
    allConflicts = [];
    applyToAll = false;
    currentResolution = '';
    
    // 重置提交按鈕
    const submitBtn = document.getElementById('import-submit-btn');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '匯入';
    }
    
    // 重置檔案反饋
    const feedbackElement = document.getElementById('file-feedback');
    if (feedbackElement) {
        feedbackElement.textContent = '請選擇要匯入的 CSV 檔案 (最大 5MB)';
        feedbackElement.className = 'ts-text is-description has-top-spaced-small';
    }
}

/**
 * 關閉匯入CSV模態視窗
 */
function closeImportModal() {
    const modal = document.getElementById('import-csv-modal');
    if (!modal) return;
    
    // 如果正在匯入，確認是否要取消
    if (isImporting) {
        if (!confirm('匯入正在進行中，確定要取消嗎？')) {
            return;
        }
    }
    
    // 隱藏模態視窗
    modal.style.display = 'none';
    document.body.style.overflow = ''; // 恢復背景滾動
    
    // 重置匯入狀態
    isImporting = false;
}

/**
 * 重置進度條
 */
function resetProgressBar() {
    const progressBar = document.getElementById('import-progress-bar');
    const progressText = document.getElementById('import-progress-text');
    
    if (progressBar) {
        progressBar.style.width = '0%';
    }
    
    if (progressText) {
        progressText.textContent = '準備中...';
    }
}

/**
 * 更新進度條
 * @param {number} current - 當前處理的項目數
 * @param {number} total - 總項目數
 */
function updateProgressBar(current, total) {
    const progressBar = document.getElementById('import-progress-bar');
    const progressText = document.getElementById('import-progress-text');
    
    if (!progressBar || !progressText) return;
    
    const percentage = Math.min(Math.floor((current / total) * 100), 100);
    progressBar.style.width = `${percentage}%`;
    progressText.textContent = `處理中... ${percentage}% (${current}/${total})`;
}

/**
 * 完成進度條
 */
function completeProgressBar() {
    const progressBar = document.getElementById('import-progress-bar');
    const progressText = document.getElementById('import-progress-text');
    
    if (!progressBar || !progressText) return;
    
    progressBar.style.width = '100%';
    progressText.textContent = '完成！100%';
}

/**
 * 提交匯入表單
 */
function submitImport() {
    const form = document.getElementById('csv-import-form');
    if (!form) {
        showNotification('找不到匯入表單', 'negative');
        return;
    }
    
    // 檢查是否選擇了文件
    const fileInput = form.querySelector('input[type="file"]');
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        showNotification('請選擇一個CSV檔案', 'negative');
        return;
    }
    
    const file = fileInput.files[0];
    const importType = form.querySelector('select[name="import_type"]').value;
    
    // 設置匯入狀態
    isImporting = true;
    
    // 顯示進度區塊
    document.getElementById('import-form-container').style.display = 'none';
    document.getElementById('import-progress-container').style.display = 'block';
    
    // 重置進度條
    resetProgressBar();
    
    // 讀取CSV文件
    const reader = new FileReader();
    
    reader.onload = function(e) {
        csvData = e.target.result;
        
        // 解析CSV數據
        parseCSV(csvData, importType);
    };
    
    reader.onerror = function() {
        showNotification('讀取CSV檔案失敗', 'negative');
        isImporting = false;
        document.getElementById('import-progress-container').style.display = 'none';
        document.getElementById('import-form-container').style.display = 'block';
    };
    
    reader.readAsText(file);
}

/**
 * 解析CSV數據
 * @param {string} csvData - CSV字符串
 * @param {string} importType - 匯入類型 (disposal|reuse)
 */
function parseCSV(csvData, importType) {
    // 分割行
    const lines = csvData.split(/\r\n|\n/);
    
    // 至少需要標題行和一行數據
    if (lines.length < 2) {
        showNotification('CSV檔案格式無效或沒有數據', 'negative');
        isImporting = false;
        document.getElementById('import-progress-container').style.display = 'none';
        document.getElementById('import-form-container').style.display = 'block';
        return;
    }
    
    // 分析標題行
    const headers = parseCSVLine(lines[0]);
    
    // 檢查必要的欄位
    const requiredFields = ['聯單編號', '廢棄物ID'];
    const missingFields = requiredFields.filter(field => !headers.includes(field));
    
    if (missingFields.length > 0) {
        showNotification(`CSV檔案缺少必要欄位: ${missingFields.join(', ')}`, 'negative');
        isImporting = false;
        document.getElementById('import-progress-container').style.display = 'none';
        document.getElementById('import-form-container').style.display = 'block';
        return;
    }
    
    // 檢查匯入類型
    if (importType === 'disposal' && !headers.includes('廢棄物代碼')) {
        showNotification('清除單必須包含「廢棄物代碼」欄位', 'negative');
        isImporting = false;
        document.getElementById('import-progress-container').style.display = 'none';
        document.getElementById('import-form-container').style.display = 'block';
        return;
    }
    
    if (importType === 'reuse' && !headers.includes('物質代碼')) {
        showNotification('再利用單必須包含「物質代碼」欄位', 'negative');
        isImporting = false;
        document.getElementById('import-progress-container').style.display = 'none';
        document.getElementById('import-form-container').style.display = 'block';
        return;
    }
    
    // 解析數據行
    const dataRows = [];
    for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim() === '') continue;
        
        const rowData = parseCSVLine(lines[i]);
        const row = {};
        
        for (let j = 0; j < headers.length; j++) {
            row[headers[j]] = rowData[j] || '';
        }
        
        dataRows.push(row);
    }
    
    // 開始處理數據
    importResults.total = dataRows.length;
    processImportRows(dataRows, importType, 0);
}

/**
 * 解析CSV行數據
 * @param {string} line - CSV行
 * @returns {Array} 分割後的數據
 */
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    
    result.push(current);
    return result;
}

/**
 * 處理匯入行數據
 * @param {Array} rows - 數據行
 * @param {string} importType - 匯入類型
 * @param {number} currentIndex - 當前處理的索引
 */
function processImportRows(rows, importType, currentIndex) {
    // 如果已處理完所有行，顯示結果
    if (currentIndex >= rows.length) {
        completeProgressBar();
        showImportResults();
        return;
    }
    
    // 更新進度條
    updateProgressBar(currentIndex + 1, rows.length);
    
    // 獲取當前行數據
    const row = rows[currentIndex];
    
    // 檢查必要欄位
    if (!row['聯單編號'] || !row['廢棄物ID']) {
        importResults.failed.push({
            row: currentIndex + 1,
            reason: '缺少必要欄位: 聯單編號或廢棄物ID'
        });
        
        // 處理下一行
        processImportRows(rows, importType, currentIndex + 1);
        return;
    }
    
    // 檢查匯入類型與數據類型是否匹配
    if (importType === 'disposal' && !row['廢棄物代碼']) {
        importResults.failed.push({
            row: currentIndex + 1,
            reason: '清除單必須包含廢棄物代碼'
        });
        
        // 處理下一行
        processImportRows(rows, importType, currentIndex + 1);
        return;
    }
    
    if (importType === 'reuse' && !row['物質代碼']) {
        importResults.failed.push({
            row: currentIndex + 1,
            reason: '再利用單必須包含物質代碼'
        });
        
        // 處理下一行
        processImportRows(rows, importType, currentIndex + 1);
        return;
    }
    
    // 發送請求檢查是否存在衝突
    fetch('/transport/check_manifest_conflict/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken')
        },
        body: JSON.stringify({
            manifest_id: row['聯單編號'],
            waste_id: row['廢棄物ID'],
            import_type: importType
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.conflict) {
            // 有衝突
            if (applyToAll) {
                // 如果已設置套用到所有，直接使用設定的解決方式
                handleConflictResolution(rows, importType, currentIndex, row, data.existing_data, currentResolution);
            } else {
                // 顯示衝突解決對話框
                showConflictDialog(rows, importType, currentIndex, row, data.existing_data);
            }
        } else {
            // 無衝突，直接匯入
            importManifest(rows, importType, currentIndex, row);
        }
    })
    .catch(error => {
        console.error('檢查衝突失敗:', error);
        
        importResults.failed.push({
            row: currentIndex + 1,
            reason: '檢查衝突失敗: ' + error.message
        });
        
        // 處理下一行
        processImportRows(rows, importType, currentIndex + 1);
    });
}

/**
 * 顯示衝突解決對話框
 * @param {Array} rows - 數據行
 * @param {string} importType - 匯入類型
 * @param {number} currentIndex - 當前處理的索引
 * @param {Object} newData - 新數據
 * @param {Object} existingData - 現有數據
 */
function showConflictDialog(rows, importType, currentIndex, newData, existingData) {
    // 顯示衝突解決對話框
    document.getElementById('import-progress-container').style.display = 'none';
    document.getElementById('import-conflict-container').style.display = 'block';
    
    // 構建衝突記錄HTML
    const recordsContainer = document.getElementById('conflict-records-container');
    if (!recordsContainer) return;
    
    // 清空容器
    recordsContainer.innerHTML = '';
    
    // 構建衝突記錄
    const conflictHtml = `
        <div class="ts-box has-top-spaced conflict-record">
            <div class="ts-content">
                <div class="ts-header is-heavy">
                    衝突記錄 ${currentIndex + 1}/${rows.length}
                </div>
                
                <div class="ts-text">聯單編號: ${newData['聯單編號']} (廢棄物ID: ${newData['廢棄物ID']})</div>
                <div class="ts-text has-bottom-spaced-small">事業機構名稱: ${newData['事業機構名稱'] || existingData['事業機構名稱'] || '-'}</div>
                
                <div class="conflict-resolution-container">
                    <div class="conflict-resolution-title">選擇處理方式：</div>
                    <div class="conflict-resolution-options">
                        <div class="conflict-resolution-option">
                            <input type="radio" name="conflict_resolution" value="skip" id="resolution-skip" checked>
                            <label for="resolution-skip">略過</label>
                        </div>
                        <div class="conflict-resolution-description">保留資料庫中的現有資料，放棄匯入的新資料。</div>
                        
                        <div class="conflict-resolution-option">
                            <input type="radio" name="conflict_resolution" value="replace" id="resolution-replace">
                            <label for="resolution-replace">覆蓋</label>
                        </div>
                        <div class="conflict-resolution-description">覆蓋資料庫中的現有資料，使用匯入的新資料。</div>
                        
                        <div class="conflict-resolution-option">
                            <input type="radio" name="conflict_resolution" value="cancel" id="resolution-cancel">
                            <label for="resolution-cancel">取消</label>
                        </div>
                        <div class="conflict-resolution-description">取消整個匯入過程。</div>
                    </div>
                    
                    <div class="apply-to-all-checkbox">
                        <div class="ts-checkbox">
                            <input type="checkbox" id="apply-to-all">
                            <label for="apply-to-all">套用到所有衝突</label>
                        </div>
                    </div>
                </div>
                <div class="ts-grid is-relaxed has-top-spaced-large">
                    <div class="column is-8-wide">
                        <button class="ts-button is-fluid" onclick="cancelImport()">取消匯入</button>
                    </div>
                    <div class="column is-8-wide">
                        <button class="ts-button is-fluid is-primary" onclick="resolveConflict('${importType}', ${currentIndex})">確認</button>
                    </div>
                </div>
                <div class="ts-divider has-top-spaced"></div>
                
                <div class="ts-grid is-relaxed has-top-spaced">
                    <div class="column is-fluid">
                        <div class="ts-header">資料比較</div>
                    </div>
                </div>
                
                <table class="conflict-table">
                    <thead>
                        <tr>
                            <th width="25%">欄位名稱</th>
                            <th width="37.5%">現有資料</th>
                            <th width="37.5%">匯入資料</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${generateComparisonTableRows(newData, existingData)}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    recordsContainer.innerHTML = conflictHtml;
    
    // 初始化套用到所有複選框事件
    document.getElementById('apply-to-all').addEventListener('change', function() {
        applyToAll = this.checked;
    });
}

/**
 * 生成比較表格行
 * @param {Object} newData - 新數據
 * @param {Object} existingData - 現有數據
 * @returns {string} HTML字符串
 */
function generateComparisonTableRows(newData, existingData) {
    let html = '';
    
    // 合併所有欄位
    const allFields = new Set([
        ...Object.keys(newData),
        ...Object.keys(existingData)
    ]);
    
    // 生成表格行
    for (const field of allFields) {
        const existingValue = existingData[field] !== undefined ? existingData[field] : '-';
        const newValue = newData[field] !== undefined ? newData[field] : '-';
        const isDifferent = existingValue !== newValue && existingValue !== '-' && newValue !== '-';
        
        html += `
            <tr>
                <td>${field}</td>
                <td ${isDifferent ? 'class="different-value"' : ''}>${existingValue}</td>
                <td ${isDifferent ? 'class="different-value"' : ''}>${newValue}</td>
            </tr>
        `;
    }
    
    return html;
}

/**
 * 解決衝突
 * @param {string} importType - 匯入類型
 * @param {number} currentIndex - 當前處理的索引
 */
function resolveConflict(importType, currentIndex) {
    const resolution = document.querySelector('input[name="conflict_resolution"]:checked').value;
    currentResolution = resolution;
    
    // 如果選擇取消整個匯入過程
    if (resolution === 'cancel') {
        cancelImport();
        return;
    }
    
    // 獲取所有行數據
    const rows = parseCsvDataToRows();
    
    // 獲取當前行數據
    const row = rows[currentIndex];
    
    // 獲取現有數據
    fetch('/transport/get_manifest/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken')
        },
        body: JSON.stringify({
            manifest_id: row['聯單編號'],
            waste_id: row['廢棄物ID'],
            import_type: importType
        })
    })
    .then(response => response.json())
    .then(data => {
        // 處理衝突解決
        handleConflictResolution(rows, importType, currentIndex, row, data, resolution);
    })
    .catch(error => {
        console.error('獲取現有數據失敗:', error);
        
        importResults.failed.push({
            row: currentIndex + 1,
            reason: '獲取現有數據失敗: ' + error.message
        });
        
        // 繼續顯示進度條
        document.getElementById('import-conflict-container').style.display = 'none';
        document.getElementById('import-progress-container').style.display = 'block';
        
        // 處理下一行
        processImportRows(rows, importType, currentIndex + 1);
    });
}

/**
 * 處理衝突解決
 * @param {Array} rows - 所有數據行
 * @param {string} importType - 匯入類型
 * @param {number} currentIndex - 當前處理的索引
 * @param {Object} row - 當前行數據
 * @param {Object} existingData - 現有數據
 * @param {string} resolution - 解決方式
 */
function handleConflictResolution(rows, importType, currentIndex, row, existingData, resolution) {
    // 顯示進度條
    document.getElementById('import-conflict-container').style.display = 'none';
    document.getElementById('import-progress-container').style.display = 'block';
    
    switch (resolution) {
        case 'skip':
            importResults.skipped++;
            // 處理下一行
            processImportRows(rows, importType, currentIndex + 1);
            break;
        
        case 'replace':
            // 覆蓋現有數據
            importManifest(rows, importType, currentIndex, row, true);
            break;
        
        case 'cancel':
            cancelImport();
            break;
    }
}

/**
 * 將CSV數據解析為行數據
 * @returns {Array} 行數據陣列
 */
function parseCsvDataToRows() {
    if (!csvData) return [];
    
    // 分割行
    const lines = csvData.split(/\r\n|\n/);
    
    // 如果只有標題行或沒有數據，返回空陣列
    if (lines.length < 2) return [];
    
    // 分析標題行
    const headers = parseCSVLine(lines[0]);
    
    // 解析數據行
    const dataRows = [];
    for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim() === '') continue;
        
        const rowData = parseCSVLine(lines[i]);
        const row = {};
        
        for (let j = 0; j < headers.length; j++) {
            row[headers[j]] = rowData[j] || '';
        }
        
        dataRows.push(row);
    }
    
    return dataRows;
}

/**
 * 匯入聯單
 * @param {Array} rows - 所有數據行
 * @param {string} importType - 匯入類型
 * @param {number} currentIndex - 當前處理的索引
 * @param {Object} row - 當前行數據
 * @param {boolean} isOverride - 是否覆蓋現有數據
 */
function importManifest(rows, importType, currentIndex, row, isOverride = false) {
    fetch('/transport/import_manifest/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken')
        },
        body: JSON.stringify({
            import_type: importType,
            data: row,
            override: isOverride
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            importResults.success++;
        } else {
            importResults.failed.push({
                row: currentIndex + 1,
                reason: data.error || '匯入失敗'
            });
        }
        
        // 處理下一行
        processImportRows(rows, importType, currentIndex + 1);
    })
    .catch(error => {
        console.error('匯入失敗:', error);
        
        importResults.failed.push({
            row: currentIndex + 1,
            reason: '匯入失敗: ' + error.message
        });
        
        // 處理下一行
        processImportRows(rows, importType, currentIndex + 1);
    });
}

/**
 * 取消匯入
 */
function cancelImport() {
    // 重置匯入狀態
    isImporting = false;
    
    // 顯示結果區塊
    document.getElementById('import-conflict-container').style.display = 'none';
    document.getElementById('import-progress-container').style.display = 'none';
    document.getElementById('import-result-container').style.display = 'block';
    
    // 顯示結果
    document.getElementById('import-result-container').innerHTML = `
        <div class="ts-notice is-warning">
            <div class="content">
                <div class="header">匯入已取消</div>
                <div class="description">您已取消匯入過程</div>
            </div>
        </div>
        <div class="ts-grid is-relaxed has-top-spaced-large">
            <div class="column is-12-wide">
                <button class="ts-button is-fluid" onclick="closeImportModal()">關閉</button>
            </div>
        </div>
    `;
}

/**
 * 顯示匯入結果
 */
function showImportResults() {
    // 重置匯入狀態
    isImporting = false;
    
    // 顯示結果區塊
    document.getElementById('import-progress-container').style.display = 'none';
    document.getElementById('import-conflict-container').style.display = 'none';
    document.getElementById('import-result-container').style.display = 'block';
    
    // 構建失敗詳情HTML
    let failedDetailsHtml = '';
    if (importResults.failed.length > 0) {
        failedDetailsHtml = `
            <div class="ts-header has-top-spaced">失敗詳情</div>
            <div class="ts-list is-unordered">
                ${importResults.failed.map(failure => `
                    <div class="item">
                        <div class="ts-text">第 ${failure.row} 行：${failure.reason}</div>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    // 顯示結果
    document.getElementById('import-result-container').innerHTML = `
        <div class="ts-notice is-${importResults.success > 0 ? 'positive' : 'warning'}">
            <div class="content">
                <div class="header">${importResults.success > 0 ? '匯入成功' : '匯入完成，但有問題'}</div>
                <div class="description">總共 ${importResults.total} 筆資料，成功 ${importResults.success} 筆，略過 ${importResults.skipped} 筆，失敗 ${importResults.failed.length} 筆</div>
            </div>
        </div>
        
        <div class="ts-wrap is-evenly-divided has-top-spaced">
            <div class="ts-statistic">
                <div class="value">${importResults.success}</div>
                <div class="label">成功匯入筆數</div>
            </div>
            <div class="ts-statistic">
                <div class="value">${importResults.skipped}</div>
                <div class="label">略過筆數</div>
            </div>
            <div class="ts-statistic">
                <div class="value">${importResults.failed.length}</div>
                <div class="label">失敗筆數</div>
            </div>
        </div>
        
        ${failedDetailsHtml}
        
        <div class="ts-grid is-relaxed has-top-spaced-large">
            <div class="column is-12-wide">
                <button class="ts-button is-fluid is-primary" onclick="closeImportModal()">完成</button>
            </div>
        </div>
    `;
    
    // 如果有成功匯入的數據，2秒後重新載入頁面
    if (importResults.success > 0) {
        setTimeout(() => {
            window.location.reload();
        }, 2000);
    }
}

/**
 * 初始化自動完成功能
 */
function initAutocomplete() {
    console.log('初始化自動完成功能');
    
    // 公司名稱自動完成
    setupAutocomplete(
        'company_name',
        '/transport/autocomplete/company_name/',
        'name'
    );
    
    // 廢棄物名稱自動完成
    setupAutocomplete(
        'waste_name',
        '/transport/autocomplete/waste_name/',
        'name'
    );
    
    // 廢棄物代碼自動完成
    setupAutocomplete(
        'waste_code',
        '/transport/autocomplete/waste_code/',
        'code'
    );
}

/**
 * 實現下拉式選單自動完成功能
 * @param {string} inputId - 輸入框ID
 * @param {string} endpointUrl - 後端API URL
 * @param {string} targetField - 顯示在列表中的目標欄位
 */
function setupAutocomplete(inputId, endpointUrl, targetField) {
    const input = document.getElementById(inputId);
    if (!input) {
        console.error(`找不到ID為 ${inputId} 的輸入框`);
        return;
    }
    
    console.log(`設置自動完成 - ${inputId}`);
    
    // 創建下拉菜單容器
    let dropdownContainer = document.getElementById(`${inputId}-dropdown`);
    
    if (!dropdownContainer) {
        dropdownContainer = document.createElement('div');
        dropdownContainer.id = `${inputId}-dropdown`;
        dropdownContainer.className = 'autocomplete-dropdown';
        dropdownContainer.style.position = 'absolute';
        dropdownContainer.style.width = `${input.offsetWidth}px`;
        dropdownContainer.style.maxHeight = '200px';
        dropdownContainer.style.overflowY = 'auto';
        dropdownContainer.style.display = 'none';
        
        // 插入下拉菜單到輸入框之後
        input.parentNode.style.position = 'relative';
        input.parentNode.insertBefore(dropdownContainer, input.nextSibling);
    }
    
    // 輸入事件
    input.addEventListener('input', debounce(function() {
        const query = this.value.trim();
        
        // 無論是否有輸入都顯示下拉選單，但內容會有所不同
        fetch(`${endpointUrl}?q=${encodeURIComponent(query)}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                console.log('自動完成結果:', data);
                
                // 清空下拉菜單
                dropdownContainer.innerHTML = '';
                
                if (data.results && data.results.length > 0) {
                    // 填充下拉菜單
                    data.results.forEach(item => {
                        const option = document.createElement('div');
                        option.className = 'autocomplete-item';
                        option.textContent = item[targetField];
                        
                        option.addEventListener('mouseover', function() {
                            this.classList.add('is-hover');
                        });
                        
                        option.addEventListener('mouseout', function() {
                            this.classList.remove('is-hover');
                        });
                        
                        option.addEventListener('click', function() {
                            input.value = this.textContent;
                            dropdownContainer.style.display = 'none';
                            
                            // 觸發change事件以更新表單狀態
                            const event = new Event('change', { bubbles: true });
                            input.dispatchEvent(event);
                        });
                        
                        dropdownContainer.appendChild(option);
                    });
                    
                    // 調整下拉菜單位置，確保與輸入框對齊
                    const inputRect = input.getBoundingClientRect();
                    dropdownContainer.style.width = `${input.offsetWidth}px`;
                    dropdownContainer.style.top = `${input.offsetHeight}px`;
                    dropdownContainer.style.left = '0';
                    
                    dropdownContainer.style.display = 'block';
                } else {
                    // 如果沒有結果但有查詢，顯示無結果
                    if (query.length > 0) {
                        const noResult = document.createElement('div');
                        noResult.className = 'autocomplete-no-result';
                        noResult.textContent = '無符合項目';
                        dropdownContainer.appendChild(noResult);
                        dropdownContainer.style.display = 'block';
                    } else {
                        // 如果沒有查詢且沒有結果，則隱藏下拉選單
                        dropdownContainer.style.display = 'none';
                    }
                }
            })
            .catch(error => {
                console.error('自動完成請求失敗:', error);
                dropdownContainer.innerHTML = '';
                const errorElement = document.createElement('div');
                errorElement.className = 'autocomplete-error';
                errorElement.textContent = '載入失敗，請重試';
                dropdownContainer.appendChild(errorElement);
                dropdownContainer.style.display = 'block';
            });
    }, 300));
    
    // 點擊外部關閉下拉菜單
    document.addEventListener('click', function(e) {
        if (!input.contains(e.target) && !dropdownContainer.contains(e.target)) {
            dropdownContainer.style.display = 'none';
        }
    });
    
    // 焦點事件
    input.addEventListener('focus', function() {
        const event = new Event('input');
        this.dispatchEvent(event);
    });
}

/**
 * 防抖函數
 * @param {Function} func - 要執行的函數
 * @param {number} wait - 等待時間（毫秒）
 * @returns {Function} - 防抖後的函數
 */
function debounce(func, wait) {
    let timeout;
    return function() {
        const context = this;
        const args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            func.apply(context, args);
        }, wait);
    };
}

/**
 * 顯示通知訊息
 * @param {string} message - 訊息內容
 * @param {string} type - 訊息類型 (positive|negative|info)
 */
function showNotification(message, type = 'info') {
    const snackbar = document.getElementById('notification-snackbar');
    if (!snackbar) return;
    
    // 設置樣式
    let bgColor = 'var(--gray-800)';
    if (type === 'positive') {
        bgColor = 'var(--success-color)';
    } else if (type === 'negative') {
        bgColor = 'var(--danger-color)';
    } else if (type === 'info') {
        bgColor = 'var(--primary-color)';
    }
    
    snackbar.style.backgroundColor = bgColor;
    
    // 設置訊息
    const contentElement = snackbar.querySelector('.content');
    if (contentElement) {
        contentElement.textContent = message;
    }
    
    // 顯示通知
    snackbar.classList.add('show');
    
    // 設置自動關閉計時器
    setTimeout(closeNotification, 3000);
}

/**
 * 關閉通知
 */
function closeNotification() {
    const snackbar = document.getElementById('notification-snackbar');
    if (!snackbar) return;
    
    snackbar.classList.remove('show');
}

/**
 * 獲取Cookie值
 * @param {string} name - Cookie名稱
 * @returns {string} Cookie值
 */
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

/**
 * 格式化檔案大小
 * @param {number} bytes - 檔案大小（位元組）
 * @returns {string} 格式化後的檔案大小
 */
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}