/**
 * 醫療廢棄物暨資源管理系統 - 聯單管理模組前端腳本
 * 提供聯單列表、詳細內容顯示、CSV匯入等功能
 */

// 全局變數
let importSessionData = null;
let selectedManifests = new Set();
let isImporting = false;
let progressInterval = null;
let applyToAll = false;
let currentConflictResolution = 'skip';
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
    
    // 初始化CSV標籤切換
    initCSVFormatTabs();
    
    // 初始化模態視窗關閉事件
    initModalCloseEvents();
    
    // 初始化匯入按鈕事件
    const importBtn = document.getElementById('btn-import-csv');
    if (importBtn) {
        importBtn.addEventListener('click', openImportModal);
    }
    
    // 初始化匯入表單的檔案選擇事件
    initFileInputHandler();
    
    // 初始化幫助按鈕
    const helpBtn = document.getElementById('help-button');
    if (helpBtn) {
        helpBtn.addEventListener('click', openHelpModal);
    }
    
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
 * 初始化CSV格式標籤切換
 */
function initCSVFormatTabs() {
    document.addEventListener('click', function(event) {
        if (event.target.matches('[data-tab="csv-disposal"], [data-tab="csv-reuse"]')) {
            const csvTabs = document.querySelectorAll('[data-tab="csv-disposal"], [data-tab="csv-reuse"]');
            
            // 移除所有標籤頁的活動狀態
            csvTabs.forEach(t => t.classList.remove('is-active'));
            
            // 設置當前標籤頁為活動狀態
            event.target.classList.add('is-active');
            
            // 隱藏所有CSV格式說明區塊
            document.querySelectorAll('[data-name="csv-disposal"], [data-name="csv-reuse"]').forEach(segment => {
                segment.style.display = 'none';
            });
            
            // 顯示對應的CSV格式說明區塊
            const targetSegment = document.querySelector(`[data-name="${event.target.getAttribute('data-tab')}"]`);
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
    
    // 幫助模態視窗關閉按鈕
    const closeHelpBtn = document.getElementById('close-help-modal');
    if (closeHelpBtn) {
        closeHelpBtn.addEventListener('click', closeHelpModal);
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
    
    // 點擊幫助模態視窗外部關閉
    const helpModal = document.getElementById('help-modal');
    if (helpModal) {
        helpModal.addEventListener('click', function(e) {
            if (e.target === this) {
                closeHelpModal();
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
    
    // 更新批量刪除按鈕狀態函數
    function updateBatchDeleteButton() {
        const batchDeleteBtn = document.getElementById('batch-delete-btn');
        if (!batchDeleteBtn) return;
        
        if (selectedManifests.size > 0) {
            batchDeleteBtn.classList.remove('is-disabled');
        } else {
            batchDeleteBtn.classList.add('is-disabled');
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
                deleteSelectedManifests();
            }
        });
    }
}

/**
 * 刪除選取的聯單
 */
function deleteSelectedManifests() {
    // 收集要刪除的聯單ID
    const manifestsToDelete = Array.from(selectedManifests).map(key => {
        const [type, manifestId, wasteId] = key.split('|');
        return { type, manifestId, wasteId };
    });
    
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
            
            // 從UI中移除已刪除的聯單
            manifestsToDelete.forEach(manifest => {
                const card = document.querySelector(`.manifest-card[data-type="${manifest.type}"][data-manifest-id="${manifest.manifestId}"][data-waste-id="${manifest.wasteId}"]`);
                if (card) {
                    card.remove();
                }
            });
            
            // 清空選取
            selectedManifests.clear();
            
            // 重置全選框和所有勾選框
            const selectAllCheckbox = document.getElementById('select-all-manifests');
            if (selectAllCheckbox) {
                selectAllCheckbox.checked = false;
            }
            
            document.querySelectorAll('.manifest-checkbox').forEach(checkbox => {
                checkbox.checked = false;
            });
            
            // 更新批量刪除按鈕狀態
            const batchDeleteBtn = document.getElementById('batch-delete-btn');
            if (batchDeleteBtn) {
                batchDeleteBtn.classList.add('is-disabled');
            }
            
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
    
    // 重置匯入資料
    importSessionData = null;
    isImporting = false;
    applyToAll = false;
    currentConflictResolution = 'skip';
    
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
    
    // 停止進度條更新
    if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
    }
    
    // 重置匯入狀態
    isImporting = false;
}

/**
 * 取消解決衝突
 */
function cancelResolve() {
    // 返回表單區塊
    document.getElementById('import-form-container').style.display = 'block';
    document.getElementById('import-conflict-container').style.display = 'none';
}

/**
 * 打開使用說明模態視窗
 */
function openHelpModal() {
    const modal = document.getElementById('help-modal');
    if (!modal) {
        console.error('找不到使用說明模態視窗元素');
        return;
    }
    
    // 顯示模態視窗
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden'; // 防止背景滾動
}

/**
 * 關閉使用說明模態視窗
 */
function closeHelpModal() {
    const modal = document.getElementById('help-modal');
    if (!modal) return;
    
    // 隱藏模態視窗
    modal.style.display = 'none';
    document.body.style.overflow = ''; // 恢復背景滾動
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
    
    // 停止進度條更新
    if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
    }
}

/**
 * 啟動模擬進度條
 */
function startProgressBar() {
    const progressBar = document.getElementById('import-progress-bar');
    const progressText = document.getElementById('import-progress-text');
    
    if (!progressBar || !progressText) return;
    
    let progress = 0;
    
    // 重置進度條
    resetProgressBar();
    
    // 每100毫秒更新進度，直到達到95%
    progressInterval = setInterval(() => {
        if (progress >= 95) {
            clearInterval(progressInterval);
            return;
        }
        
        // 進度增加速度隨進度增加而減慢
        if (progress < 30) {
            progress += 1.5;
        } else if (progress < 60) {
            progress += 0.8;
        } else if (progress < 80) {
            progress += 0.3;
        } else {
            progress += 0.1;
        }
        
        // 更新進度條
        progressBar.style.width = `${progress}%`;
        progressText.textContent = `處理中... ${Math.floor(progress)}%`;
    }, 100);
}

/**
 * 完成進度條
 */
function completeProgressBar() {
    const progressBar = document.getElementById('import-progress-bar');
    const progressText = document.getElementById('import-progress-text');
    
    if (!progressBar || !progressText) return;
    
    // 停止進度條更新
    if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
    }
    
    // 設置進度條為100%
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
    
    // 獲取CSRF令牌
    const csrfToken = getCookie('csrftoken');
    if (!csrfToken) {
        showNotification('無法獲取CSRF令牌，請重新整理頁面', 'negative');
        return;
    }
    
    const formData = new FormData(form);
    
    // 設置匯入狀態
    isImporting = true;
    
    // 顯示進度區塊
    document.getElementById('import-form-container').style.display = 'none';
    document.getElementById('import-progress-container').style.display = 'block';
    
    // 啟動進度條
    startProgressBar();
    
    // 發送AJAX請求
    fetch('/transport/import/', {
        method: 'POST',
        body: formData,
        headers: {
            'X-CSRFToken': csrfToken
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`網路錯誤: ${response.status} ${response.statusText}`);
        }
        return response.json();
    })
    .then(data => {
        // 完成進度條
        completeProgressBar();
        
        // 設置匯入狀態
        isImporting = false;
        
        if (data.success) {
            // 匯入成功
            document.getElementById('import-progress-container').style.display = 'none';
            document.getElementById('import-result-container').style.display = 'block';
            
            // 顯示結果
            document.getElementById('import-result-container').innerHTML = `
                <div class="ts-notice is-positive">
                    <div class="content">
                        <div class="header">匯入成功</div>
                        <div class="description">${data.message || '已成功匯入資料'}</div>
                    </div>
                </div>
                <div class="ts-statistic has-top-spaced">
                    <div class="value">${data.imported}</div>
                    <div class="label">成功匯入筆數</div>
                </div>
                <div class="ts-statistic">
                    <div class="value">${data.skipped}</div>
                    <div class="label">略過筆數</div>
                </div>
                <div class="ts-statistic">
                    <div class="value">${data.total}</div>
                    <div class="label">總筆數</div>
                </div>
                
                <div class="ts-grid is-relaxed has-top-spaced-large">
                    <div class="column is-12-wide">
                        <button class="ts-button is-fluid is-primary" onclick="closeImportModal()">完成</button>
                    </div>
                </div>
            `;
            
            // 2秒後重新載入頁面以顯示新資料
            setTimeout(() => {
                window.location.reload();
            }, 2000);
        } else if (data.conflict) {
            // 有衝突，顯示衝突解決對話框
            importSessionData = data.import_data;
            
            document.getElementById('import-progress-container').style.display = 'none';
            document.getElementById('import-conflict-container').style.display = 'block';
            
            // 設置衝突記錄
            const recordsContainer = document.getElementById('conflict-records-container');
            if (recordsContainer) {
                // 構建衝突記錄HTML
                let html = `<p>以下 ${data.conflicting_records.length} 筆記錄與現有資料發生衝突：</p>`;
                
                data.conflicting_records.forEach((record, index) => {
                    html += `
                        <div class="ts-box has-top-spaced conflict-record" data-index="${index}">
                            <div class="ts-content">
                                <div class="ts-header is-heavy">${index + 1}. 聯單編號: ${record.manifest_id} (廢棄物ID: ${record.waste_id})</div>
                                <div class="ts-text">事業機構名稱: ${record.company_name}</div>
                                <div class="ts-text has-bottom-spaced-small">申報日期: ${record.report_date}</div>
                                
                                <table class="conflict-table">
                                    <thead>
                                        <tr>
                                            <th>欄位名稱</th>
                                            <th>現有資料</th>
                                            <th>匯入資料</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                    `;
                    
                    // 對比現有資料和新資料
                    const allFields = new Set([
                        ...Object.keys(record.existing_data || {}),
                        ...Object.keys(record.new_data || {})
                    ]);
                    
                    for (const field of allFields) {
                        const existingValue = (record.existing_data && record.existing_data[field]) || '-';
                        const newValue = (record.new_data && record.new_data[field]) || '-';
                        const isDifferent = existingValue !== newValue && existingValue !== '-' && newValue !== '-';
                        
                        html += `
                            <tr>
                                <td>${field}</td>
                                <td ${isDifferent ? 'class="different-value"' : ''}>${existingValue}</td>
                                <td ${isDifferent ? 'class="different-value"' : ''}>${newValue}</td>
                            </tr>
                        `;
                    }
                    
                    html += `
                                    </tbody>
                                </table>
                                
                                <div class="conflict-resolution-container" id="resolution-container-${index}">
                                    <div class="conflict-resolution-title">選擇處理方式：</div>
                                    <div class="conflict-resolution-options">
                                        <div class="conflict-resolution-option">
                                            <input type="radio" name="conflict_resolution_${index}" value="skip" id="resolution-skip-${index}" checked>
                                            <label for="resolution-skip-${index}">略過</label>
                                        </div>
                                        <div class="conflict-resolution-description">保留資料庫中的現有資料，放棄匯入的新資料。</div>
                                        
                                        <div class="conflict-resolution-option">
                                            <input type="radio" name="conflict_resolution_${index}" value="replace" id="resolution-replace-${index}">
                                            <label for="resolution-replace-${index}">覆蓋</label>
                                        </div>
                                        <div class="conflict-resolution-description">覆蓋資料庫中的現有資料，使用匯入的新資料。</div>
                                        
                                        <div class="conflict-resolution-option">
                                            <input type="radio" name="conflict_resolution_${index}" value="cancel" id="resolution-cancel-${index}">
                                            <label for="resolution-cancel-${index}">取消</label>
                                        </div>
                                        <div class="conflict-resolution-description">取消整個匯入過程。</div>
                                    </div>
                                    
                                    <div class="apply-to-all-checkbox">
                                        <div class="ts-checkbox">
                                            <input type="checkbox" id="apply-to-all-${index}" class="apply-to-all" data-index="${index}">
                                            <label for="apply-to-all-${index}">套用到所有衝突</label>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="ts-grid is-relaxed has-top-spaced">
                                    <div class="column is-6-wide">
                                        <button class="ts-button is-fluid" onclick="processNextConflict(${index}, 'prev')">上一筆</button>
                                    </div>
                                    <div class="column is-6-wide">
                                        <button class="ts-button is-fluid is-primary" onclick="processNextConflict(${index}, 'next')">下一筆</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                });
                
                // 添加底部操作按鈕
                html += `
                    <div class="ts-grid is-relaxed has-top-spaced-large">
                        <div class="column is-6-wide">
                            <button class="ts-button is-fluid" onclick="cancelResolve()">取消</button>
                        </div>
                        <div class="column is-6-wide">
                            <button class="ts-button is-fluid is-primary" onclick="resolveConflicts()">完成處理</button>
                        </div>
                    </div>
                `;
                
                recordsContainer.innerHTML = html;
                
                // 隱藏除了第一個以外的所有衝突記錄
                const conflictRecords = document.querySelectorAll('.conflict-record');
                if (conflictRecords.length > 0) {
                    conflictRecords.forEach((record, index) => {
                        if (index > 0) {
                            record.style.display = 'none';
                        }
                    });
                }
                
                // 初始化 "套用到所有" 複選框處理
                document.querySelectorAll('.apply-to-all').forEach(checkbox => {
                    checkbox.addEventListener('change', function() {
                        if (this.checked) {
                            const index = this.getAttribute('data-index');
                            const selectedResolution = document.querySelector(`input[name="conflict_resolution_${index}"]:checked`).value;
                            
                            // 設置全局變數
                            applyToAll = true;
                            currentConflictResolution = selectedResolution;
                            
                            // 更新所有其他衝突的選擇
                            document.querySelectorAll(`[name^="conflict_resolution_"]`).forEach(radio => {
                                if (radio.value === selectedResolution) {
                                    radio.checked = true;
                                }
                            });
                            
                            // 勾選所有 "套用到所有" 複選框
                            document.querySelectorAll('.apply-to-all').forEach(cb => {
                                cb.checked = true;
                            });
                            
                            showNotification(`已設定所有衝突都使用：${getResolutionDisplayName(selectedResolution)}`, 'info');
                        }
                    });
                });
                
                // 監聽單選按鈕變更
                document.addEventListener('change', function(e) {
                    if (e.target.name && e.target.name.startsWith('conflict_resolution_')) {
                        const index = e.target.name.split('_')[2];
                        const applyToAllCheckbox = document.getElementById(`apply-to-all-${index}`);
                        
                        if (applyToAllCheckbox && applyToAllCheckbox.checked) {
                            // 更新所有複選框，使用當前選擇的解決方案
                            currentConflictResolution = e.target.value;
                            
                            document.querySelectorAll(`[name^="conflict_resolution_"]`).forEach(radio => {
                                if (radio.value === currentConflictResolution) {
                                    radio.checked = true;
                                }
                            });
                        }
                    }
                });
            }
        } else {
            // 其他錯誤
            document.getElementById('import-progress-container').style.display = 'none';
            document.getElementById('import-result-container').style.display = 'block';
            
            // 顯示錯誤結果
            document.getElementById('import-result-container').innerHTML = `
                <div class="ts-notice is-negative">
                    <div class="content">
                        <div class="header">匯入失敗</div>
                        <div class="description">${data.error || '匯入過程中發生錯誤'}</div>
                    </div>
                </div>
                <div class="ts-grid is-relaxed has-top-spaced-large">
                    <div class="column is-12-wide">
                        <button class="ts-button is-fluid" onclick="closeImportModal()">關閉</button>
                    </div>
                </div>
            `;
        }
    })
    .catch(error => {
        console.error('匯入失敗:', error);
        
        // 設置匯入狀態
        isImporting = false;
        
        // 顯示錯誤結果
        document.getElementById('import-progress-container').style.display = 'none';
        document.getElementById('import-result-container').style.display = 'block';
        
        // 顯示錯誤結果
        document.getElementById('import-result-container').innerHTML = `
            <div class="ts-notice is-negative">
                <div class="content">
                    <div class="header">匯入失敗</div>
                    <div class="description">匯入過程中發生錯誤: ${error.message}</div>
                </div>
            </div>
            <div class="ts-grid is-relaxed has-top-spaced-large">
                <div class="column is-12-wide">
                    <button class="ts-button is-fluid" onclick="closeImportModal()">關閉</button>
                </div>
            </div>
        `;
    });
}

/**
 * 處理下一個或上一個衝突
 * @param {number} currentIndex - 當前衝突索引
 * @param {string} direction - 方向 ('next' | 'prev')
 */
function processNextConflict(currentIndex, direction) {
    const conflictRecords = document.querySelectorAll('.conflict-record');
    const totalConflicts = conflictRecords.length;
    
    if (totalConflicts === 0) return;
    
    // 隱藏當前衝突
    conflictRecords[currentIndex].style.display = 'none';
    
    // 計算下一個或上一個衝突的索引
    let nextIndex;
    if (direction === 'next') {
        nextIndex = currentIndex + 1;
        if (nextIndex >= totalConflicts) {
            // 如果是最後一個，直接呼叫解決衝突函數
            resolveConflicts();
            return;
        }
    } else {
        nextIndex = currentIndex - 1;
        if (nextIndex < 0) {
            nextIndex = 0; // 如果已經是第一個，維持在第一個
        }
    }
    
    // 顯示下一個或上一個衝突
    conflictRecords[nextIndex].style.display = 'block';
    
    // 如果有啟用「套用到所有」選項，則更新下一個衝突的選擇
    if (applyToAll) {
        const radios = document.querySelectorAll(`input[name="conflict_resolution_${nextIndex}"]`);
        radios.forEach(radio => {
            radio.checked = (radio.value === currentConflictResolution);
        });
        
        // 勾選「套用到所有」複選框
        const applyToAllCheckbox = document.getElementById(`apply-to-all-${nextIndex}`);
        if (applyToAllCheckbox) {
            applyToAllCheckbox.checked = true;
        }
    }
}

/**
 * 取得衝突解決方式的顯示名稱
 * @param {string} resolution - 解決方式代碼
 * @returns {string} - 顯示名稱
 */
function getResolutionDisplayName(resolution) {
    switch(resolution) {
        case 'skip':
            return '略過';
        case 'replace':
            return '覆蓋';
        case 'cancel':
            return '取消';
        default:
            return resolution;
    }
}

/**
 * 解決衝突並繼續匯入
 */
function resolveConflicts() {
    if (!importSessionData) {
        document.getElementById('import-conflict-container').style.display = 'none';
        document.getElementById('import-form-container').style.display = 'block';
        return;
    }
    
    // 如果啟用了「套用到所有」，則使用當前的解決方案
    if (applyToAll) {
        // 準備請求資料
        const requestData = {
            ...importSessionData,
            conflict_resolution: currentConflictResolution,
            apply_to_all: true
        };
        
        submitResolution(requestData);
        return;
    }
    
    // 檢查是否有任何衝突被標記為「取消」
    const cancelResolutions = document.querySelectorAll('input[value="cancel"]:checked');
    if (cancelResolutions.length > 0) {
        if (confirm('有衝突被標記為「取消」，這將取消整個匯入過程。確定要繼續嗎？')) {
            // 準備請求資料
            const requestData = {
                ...importSessionData,
                conflict_resolution: 'cancel',
                apply_to_all: true
            };
            
            submitResolution(requestData);
        }
        return;
    }
    
    // 獲取所有衝突的解決方式
    let conflictResolutions = [];
    const conflictRecords = document.querySelectorAll('.conflict-record');
    
    conflictRecords.forEach((record, index) => {
        const resolution = document.querySelector(`input[name="conflict_resolution_${index}"]:checked`).value;
        conflictResolutions.push(resolution);
    });
    
    // 如果所有衝突都使用相同的解決方式，則設置為套用到所有
    const allSameResolution = conflictResolutions.every(r => r === conflictResolutions[0]);
    
    // 準備請求資料
    const requestData = {
        ...importSessionData,
        conflict_resolution: allSameResolution ? conflictResolutions[0] : 'skip',
        apply_to_all: allSameResolution
    };
    
    submitResolution(requestData);
}

/**
 * 提交衝突解決結果
 * @param {Object} requestData - 請求資料
 */
function submitResolution(requestData) {
    // 設置匯入狀態
    isImporting = true;
    
    // 顯示進度區塊
    document.getElementById('import-conflict-container').style.display = 'none';
    document.getElementById('import-progress-container').style.display = 'block';
    
    // 啟動進度條
    startProgressBar();
    
    // 發送AJAX請求
    fetch('/transport/resolve_conflicts/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken')
        },
        body: JSON.stringify(requestData)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('網路錯誤');
        }
        return response.json();
    })
    .then(data => {
        // 完成進度條
        completeProgressBar();
        
        // 設置匯入狀態
        isImporting = false;
        
        // 顯示結果區塊
        document.getElementById('import-progress-container').style.display = 'none';
        document.getElementById('import-result-container').style.display = 'block';
        
        if (data.success) {
            // 處理成功
            document.getElementById('import-result-container').innerHTML = `
                <div class="ts-notice is-positive">
                    <div class="content">
                        <div class="header">衝突解決成功</div>
                        <div class="description">${data.message || '已成功處理衝突並匯入資料'}</div>
                    </div>
                </div>
                <div class="ts-statistic has-top-spaced">
                    <div class="value">${data.imported}</div>
                    <div class="label">成功匯入筆數</div>
                </div>
                <div class="ts-statistic">
                    <div class="value">${data.skipped}</div>
                    <div class="label">略過筆數</div>
                </div>
                <div class="ts-statistic">
                    <div class="value">${data.total}</div>
                    <div class="label">總筆數</div>
                </div>
                
                <div class="ts-grid is-relaxed has-top-spaced-large">
                    <div class="column is-12-wide">
                        <button class="ts-button is-fluid is-primary" onclick="closeImportModal()">完成</button>
                    </div>
                </div>
            `;
            
            // 2秒後重新載入頁面以顯示新資料
            setTimeout(() => {
                window.location.reload();
            }, 2000);
        } else {
            // 處理失敗
            document.getElementById('import-result-container').innerHTML = `
                <div class="ts-notice is-negative">
                    <div class="content">
                        <div class="header">衝突解決失敗</div>
                        <div class="description">${data.error || '處理衝突時發生錯誤'}</div>
                    </div>
                </div>
                <div class="ts-grid is-relaxed has-top-spaced-large">
                    <div class="column is-12-wide">
                        <button class="ts-button is-fluid" onclick="closeImportModal()">關閉</button>
                    </div>
                </div>
            `;
        }
    })
    .catch(error => {
        console.error('處理衝突失敗:', error);
        
        // 設置匯入狀態
        isImporting = false;
        
        // 顯示錯誤結果
        document.getElementById('import-progress-container').style.display = 'none';
        document.getElementById('import-result-container').style.display = 'block';
        
        document.getElementById('import-result-container').innerHTML = `
            <div class="ts-notice is-negative">
                <div class="content">
                    <div class="header">衝突解決失敗</div>
                    <div class="description">處理衝突時發生錯誤: ${error.message}</div>
                </div>
            </div>
            <div class="ts-grid is-relaxed has-top-spaced-large">
                <div class="column is-12-wide">
                    <button class="ts-button is-fluid" onclick="closeImportModal()">關閉</button>
                </div>
            </div>
        `;
    });
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