/**
 * 聯單篩選功能 - 浮動彈出式視窗
 */

// 初始化篩選浮動視窗功能
function initializeFilterPopup() {
    const filterToggleBtn = document.getElementById('filter-toggle');
    const filterPopup = document.getElementById('filter-popup');
    const clearFilterBtn = document.getElementById('clearFilterBtn');
    
    if (!filterToggleBtn || !filterPopup) {
        console.error('找不到篩選功能相關元素');
        return;
    }
    
    // 將篩選按鈕包裝在相對定位的容器中，以便正確定位浮動視窗
    const toggleWrapper = document.createElement('div');
    toggleWrapper.className = 'filter-toggle-wrapper';
    filterToggleBtn.parentNode.insertBefore(toggleWrapper, filterToggleBtn);
    toggleWrapper.appendChild(filterToggleBtn);
    
    // 調整篩選視窗的位置，使其顯示在按鈕下方
    function positionFilterPopup() {
        const buttonRect = filterToggleBtn.getBoundingClientRect();
        const popupWidth = filterPopup.offsetWidth;
        
        // 計算視窗左側座標，確保不超出視窗右邊界
        const windowWidth = window.innerWidth;
        const rightEdgeOfPopup = buttonRect.left + popupWidth;
        const leftPosition = rightEdgeOfPopup > windowWidth 
            ? Math.max(0, windowWidth - popupWidth - 20) 
            : buttonRect.left;
        
        // 設置彈出視窗的位置
        filterPopup.style.top = (buttonRect.bottom + window.scrollY) + 'px';
        filterPopup.style.left = leftPosition + 'px';
        filterPopup.style.right = 'auto'; // 取消右側固定定位
    }
    
    // 點擊篩選按鈕顯示/隱藏篩選視窗
    filterToggleBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        // 切換篩選視窗顯示狀態
        const isVisible = filterPopup.style.display === 'block';
        
        if (isVisible) {
            hideFilterPopup();
        } else {
            positionFilterPopup(); // 調整視窗位置
            showFilterPopup();
        }
    });
    
    // 視窗調整大小時重新定位篩選視窗
    window.addEventListener('resize', function() {
        if (filterPopup.style.display === 'block') {
            positionFilterPopup();
        }
    });
    
    // 點擊清空條件按鈕
    if (clearFilterBtn) {
        clearFilterBtn.addEventListener('click', function() {
            clearFilterForm();
        });
    }
    
    // 點擊頁面其他區域關閉篩選視窗
    document.addEventListener('click', function(e) {
        const isClickInside = filterPopup.contains(e.target) || filterToggleBtn.contains(e.target);
        
        if (!isClickInside && filterPopup.style.display === 'block') {
            hideFilterPopup();
        }
    });
    
    // 防止點擊篩選視窗內部時關閉視窗
    filterPopup.addEventListener('click', function(e) {
        e.stopPropagation();
    });
    
    // 載入過濾設置
    loadFilterSettings();
    
    console.log('篩選視窗功能初始化完成');
}

// 顯示篩選視窗
function showFilterPopup() {
    const filterPopup = document.getElementById('filter-popup');
    if (!filterPopup) return;
    
    filterPopup.style.display = 'block';
    filterPopup.classList.add('show');
    
    // 更新篩選按鈕狀態
    const filterToggleBtn = document.getElementById('filter-toggle');
    if (filterToggleBtn) {
        filterToggleBtn.classList.add('is-active');
        filterToggleBtn.innerHTML = '<span class="ts-icon is-filter-icon"></span> 關閉篩選';
    }
}

// 隱藏篩選視窗
function hideFilterPopup() {
    const filterPopup = document.getElementById('filter-popup');
    if (!filterPopup) return;
    
    filterPopup.style.display = 'none';
    filterPopup.classList.remove('show');
    
    // 更新篩選按鈕狀態
    const filterToggleBtn = document.getElementById('filter-toggle');
    if (filterToggleBtn) {
        filterToggleBtn.classList.remove('is-active');
        filterToggleBtn.innerHTML = '<span class="ts-icon is-filter-icon"></span> 篩選';
    }
}

// 清空篩選表單
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
    
    // 重置單選按鈕回到「所有條件皆滿足」
    const radioAll = document.getElementById('filter-all');
    if (radioAll) {
        radioAll.checked = true;
    }
    
    // 保存清空後的過濾設置
    saveFilterSettings();
    
    // 提交表單以重新載入
    form.submit();
}

// 儲存篩選設置到 localStorage
function saveFilterSettings() {
    try {
        const form = document.getElementById('manifest-filter-form');
        if (!form) return;
        
        const settings = {
            manifest_type: form.querySelector('[name="manifest_type"]')?.value || '',
            manifest_id: form.querySelector('[name="manifest_id"]')?.value || '',
            company_name: form.querySelector('[name="company_name"]')?.value || '',
            confirmation_status: form.querySelector('[name="confirmation_status"]')?.value || '',
            waste_code: form.querySelector('[name="waste_code"]')?.value || '',
            waste_name: form.querySelector('[name="waste_name"]')?.value || '',
            reported_weight_above: form.querySelector('[name="reported_weight_above"]')?.value || '',
            reported_weight_below: form.querySelector('[name="reported_weight_below"]')?.value || '',
            report_date_from: form.querySelector('[name="report_date_from"]')?.value || '',
            report_date_to: form.querySelector('[name="report_date_to"]')?.value || '',
            filterMode: document.querySelector('input[name="filterMode"]:checked')?.value || 'all'
        };
        
        localStorage.setItem('manifest_filter_settings', JSON.stringify(settings));
        console.log('篩選設置已儲存');
    } catch (error) {
        console.error('儲存篩選設置失敗：', error);
    }
}

// 從 localStorage 載入篩選設置
function loadFilterSettings() {
    try {
        const settingsJson = localStorage.getItem('manifest_filter_settings');
        if (!settingsJson) return;
        
        const settings = JSON.parse(settingsJson);
        const form = document.getElementById('manifest-filter-form');
        if (!form) return;
        
        // 套用儲存的設置
        for (const [key, value] of Object.entries(settings)) {
            if (key === 'filterMode') {
                // 套用篩選模式
                const radio = document.getElementById(`filter-${value}`);
                if (radio) radio.checked = true;
            } else {
                // 套用其他輸入值
                const input = form.querySelector(`[name="${key}"]`);
                if (input && value) input.value = value;
            }
        }
        
        console.log('已套用儲存的篩選設置');
    } catch (error) {
        console.error('載入篩選設置失敗：', error);
    }
}

// 頁面載入時初始化篩選功能
document.addEventListener('DOMContentLoaded', function() {
    initializeFilterPopup();
    
    // 監聽表單變化以保存設置
    const form = document.getElementById('manifest-filter-form');
    if (form) {
        const inputs = form.querySelectorAll('input, select');
        inputs.forEach(input => {
            input.addEventListener('change', saveFilterSettings);
        });
    }
    
    // 監聽單選按鈕變化
    const filterModeRadios = document.querySelectorAll('input[name="filterMode"]');
    filterModeRadios.forEach(radio => {
        radio.addEventListener('change', saveFilterSettings);
    });
});