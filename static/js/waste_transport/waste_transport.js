/**
 * 聯單管理功能脚本
 */
// 修正聯單列表點擊事件
function initializeManifestList() {
    const manifestItems = document.querySelectorAll('.manifest-item');
    const detailContainer = document.getElementById('manifest-detail-container');
    
    if (manifestItems.length > 0 && detailContainer) {
        manifestItems.forEach(item => {
            // 使用原生點擊事件而非委託
            item.onclick = function(e) {
                e.preventDefault();
                
                // 移除之前的活動狀態
                manifestItems.forEach(i => i.classList.remove('is-active'));
                this.classList.add('is-active');
                
                // 獲取聯單資訊
                const manifestId = this.getAttribute('data-manifest-id');
                const wasteId = this.getAttribute('data-waste-id');
                const manifestType = this.getAttribute('data-manifest-type');
                
                // 顯示載入中提示
                detailContainer.innerHTML = '<div class="ts-loading is-centered"></div>';
                
                // 使用fetch API獲取詳細資訊
                fetch(`/transport/?data_type=manifest_detail&manifest_id=${manifestId}&waste_id=${wasteId}&manifest_type=${manifestType}`, {
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest'
                    }
                })
                .then(response => response.json())
                .then(data => {
                    detailContainer.innerHTML = data.html;
                    initializeDetailTabs();
                })
                .catch(error => {
                    detailContainer.innerHTML = `
                        <div class="ts-notice is-negative">
                            <div class="content">
                                <div class="header">載入失敗</div>
                                <div class="description">無法載入聯單詳情，請重試</div>
                            </div>
                        </div>
                    `;
                    console.error('載入聯單詳情失敗:', error);
                });
            };
        });
    }
}
// 修正CSV匯入功能
function fixImportCSVFunctionality() {
    const importBtn = document.getElementById('import-csv-btn');
    const importModal = document.getElementById('import-csv-modal');
    const cancelBtn = document.getElementById('import-cancel-btn');
    
    if (importBtn && importModal) {
        // 直接使用onclick而非addEventListener
        importBtn.onclick = function() {
            // 確保模態視窗正確初始化
            if (typeof ts !== 'undefined' && ts.modal) {
                ts.modal(importModal).show();
            } else {
                // 備用方案：直接顯示
                importModal.classList.add('is-visible');
            }
        };
        
        // 取消按鈕處理
        if (cancelBtn) {
            cancelBtn.onclick = function() {
                if (typeof ts !== 'undefined' && ts.modal) {
                    ts.modal(importModal).hide();
                } else {
                    importModal.classList.remove('is-visible');
                }
            };
        }
        
        // 確保表單提交正常工作
        const importForm = document.getElementById('csv-import-form');
        const submitBtn = document.getElementById('import-submit-btn');
        
        if (importForm && submitBtn) {
            submitBtn.onclick = function(e) {
                e.preventDefault();
                // 表單提交邏輯...
                // 這裡確保使用正確的CSRF令牌和請求路徑
                const formData = new FormData(importForm);
                const csrftoken = document.querySelector('[name=csrfmiddlewaretoken]').value;
                
                // 顯示載入中
                document.getElementById('loading-modal').classList.add('is-visible');
                
                // 發送請求
                fetch('/transport/ajax/import_csv/', {
                    method: 'POST',
                    headers: {
                        'X-CSRFToken': csrftoken,
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    body: formData
                })
                // 處理回應...
            };
        }
    }
}
document.addEventListener('DOMContentLoaded', function() {
    // 初始化事件处理
    initializeFilterForm();
    initializeManifestListEvents();
    initializeManifestRemoval();
    
    // 自动加载第一个联单详情 (如果有)
    const firstManifestItem = document.querySelector('.manifest-item');
    if (firstManifestItem) {
        firstManifestItem.click();
    }
});

/**
 * 初始化过滤表单
 */
function initializeFilterForm() {
    const clearButton = document.getElementById('clear-filter');
    if (clearButton) {
        clearButton.addEventListener('click', function() {
            const inputs = document.querySelectorAll('#filter-form input:not([type="radio"]), #filter-form select');
            inputs.forEach(input => {
                input.value = '';
            });
            
            document.getElementById('filter-form').submit();
        });
    }
}

/**
 * 初始化联单列表事件
 */
function initializeManifestListEvents() {
    const manifestItems = document.querySelectorAll('.manifest-item');
    
    manifestItems.forEach(item => {
        item.addEventListener('click', function(e) {
            // 如果点击的是checkbox或其标签，不触发加载详情
            if (e.target.closest('.ts-checkbox')) {
                return;
            }
            
            // 移除所有项目的活动状态
            manifestItems.forEach(mi => mi.classList.remove('is-active'));
            
            // 添加当前项目的活动状态
            this.classList.add('is-active');
            
            // 获取联单信息
            const manifestId = this.dataset.id;
            const wasteId = this.dataset.wasteId;
            const manifestType = this.dataset.type;
            
            // 加载详情
            loadManifestDetail(manifestId, wasteId, manifestType);
        });
    });
}

/**
 * 初始化联单移除功能
 */
function initializeManifestRemoval() {
    const selectAllCheckbox = document.getElementById('select-all');
    const manifestCheckboxes = document.querySelectorAll('.manifest-checkbox');
    const removeSelectedButton = document.getElementById('remove-selected');
    
    if (selectAllCheckbox && manifestCheckboxes.length > 0 && removeSelectedButton) {
        // 全选/取消全选
        selectAllCheckbox.addEventListener('change', function() {
            const isChecked = this.checked;
            manifestCheckboxes.forEach(checkbox => {
                checkbox.checked = isChecked;
            });
            
            // 启用或禁用移除按钮
            removeSelectedButton.disabled = !isChecked && !Array.from(manifestCheckboxes).some(cb => cb.checked);
        });
        
        // 个别checkbox变化
        manifestCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', function() {
                // 检查是否所有checkbox都被选中
                const allChecked = Array.from(manifestCheckboxes).every(cb => cb.checked);
                selectAllCheckbox.checked = allChecked;
                
                // 检查是否有任何checkbox被选中
                const anyChecked = Array.from(manifestCheckboxes).some(cb => cb.checked);
                removeSelectedButton.disabled = !anyChecked;
            });
        });
        
        // 移除选中联单
        removeSelectedButton.addEventListener('click', function() {
            if (confirm('確定要移除選中的聯單嗎？移除後將不會顯示在列表中，但資料仍保留在資料庫。')) {
                const selectedManifests = [];
                manifestCheckboxes.forEach(checkbox => {
                    if (checkbox.checked) {
                        selectedManifests.push({
                            id: checkbox.dataset.id,
                            waste_id: checkbox.dataset.wasteId
                        });
                    }
                });
                
                // 发送AJAX请求移除联单
                removeManifests(selectedManifests);
            }
        });
    }
}

/**
 * 加载联单详情
 */
function loadManifestDetail(manifestId, wasteId, manifestType) {
    const detailContainer = document.getElementById('manifest-detail-container');
    if (!detailContainer) return;
    
    detailContainer.innerHTML = '<div class="ts-content is-center-aligned"><div class="ts-loading is-large"></div></div>';
    
    let url;
    if (manifestType === 'disposal') {
        url = `/transport/disposal/${manifestId}/${wasteId}/detail/`;
    } else {
        url = `/transport/reuse/${manifestId}/${wasteId}/detail/`;
    }
    
    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error ${response.status}`);
            }
            return response.text();
        })
        .then(html => {
            detailContainer.innerHTML = html;
            
            // 初始化标签页功能
            initializeTabs(detailContainer);
        })
        .catch(error => {
            detailContainer.innerHTML = `
                <div class="ts-content">
                    <div class="ts-notice is-negative">
                        <div class="content">
                            <div class="header">載入失敗</div>
                            <div class="description">無法載入聯單詳情: ${error.message}</div>
                        </div>
                    </div>
                </div>
            `;
            console.error('Error loading manifest detail:', error);
        });
}

/**
 * 初始化标签页功能
 */
function initializeTabs(container) {
    const tabs = container.querySelectorAll('.ts-tabs .item');
    const segments = container.querySelectorAll('.ts-segment');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            tabs.forEach(t => t.classList.remove('is-active'));
            this.classList.add('is-active');
            
            segments.forEach(segment => {
                segment.style.display = 'none';
            });
            
            const tabIndex = this.getAttribute('data-tab');
            const targetSegment = container.querySelector(`.ts-segment[data-name="${tabIndex}"]`);
            if (targetSegment) {
                targetSegment.style.display = 'block';
            }
        });
    });
    
    // 默认选择第一个标签页
    if (tabs.length > 0) {
        tabs[0].click();
    }
}

/**
 * 移除联单
 */
function removeManifests(manifests) {
    const csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');
    
    fetch('/transport/remove/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrfToken
        },
        body: JSON.stringify({ manifests: manifests })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            // 显示成功通知
            showSnackbar('notify-remove-success');
            
            // 重载页面
            setTimeout(() => {
                window.location.reload();
            }, 1500);
        } else {
            alert(`移除失敗：${data.error}`);
        }
    })
    .catch(error => {
        console.error('Error removing manifests:', error);
        alert('移除時發生錯誤，請稍後再試');
    });
}

/**
 * 显示通知栏
 */
function showSnackbar(snackbarId, duration = 3000) {
    const snackbar = document.getElementById(snackbarId);
    if (!snackbar) return;
    
    snackbar.classList.add('is-visible');
    
    setTimeout(() => {
        closeSnackbar(snackbarId);
    }, duration);
}

/**
 * 关闭通知栏
 */
function closeSnackbar(snackbarId) {
    const snackbar = document.getElementById(snackbarId);
    if (!snackbar) return;
    
    snackbar.classList.remove('is-visible');
}