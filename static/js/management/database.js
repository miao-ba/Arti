// Wait for the DOM to fully load before executing
document.addEventListener('DOMContentLoaded', () => {
    // Destructure configuration from global window object
    const { selectedTable, fields, fieldInfo, saveUrl, deleteUrl, csrfToken } = window.databaseConfig || {};
    if (!window.databaseConfig) {
        console.error("databaseConfig is not defined");
        return;
    }

    // Reference to table body and initial "no data" row
    const tableBody = document.getElementById('tableBody');
    const noDataRow = document.createElement('tr');
    noDataRow.id = 'noDataRow';
    noDataRow.innerHTML = `<td colspan="${fields.length + 3}" class="ts-text is-center">無資料</td>`;
    let editingRow = null; // Track the currently edited row
    let lastDeletedData = null; // Store deleted data for undo functionality

    // Unit display mapping dictionary for placeholders
    const unitDisplayMap = {
        'new_taiwan_dollar': '新台幣',
        'kilogram': '公斤',
        'metric_ton': '公噸'
    };

    // Set column widths dynamically based on fields length
    const table = document.getElementById('dataTable');
    const fieldCount = fields.length;
    table.style.setProperty('--field-count', fieldCount); // Set custom property for CSS calc

    // Custom modal for displaying alerts
    function showModal(message) {
        const modal = document.createElement('dialog');
        modal.className = 'ts-modal';
        modal.innerHTML = `
            <div class="content">
                <div class="ts-content is-center-aligned is-padded">
                    <div class="ts-header is-icon">
                        <span class="ts-icon is-triangle-exclamation-icon"></span>
                        無法登錄資料
                    </div>
                    <p>${message}</p>
                </div>
                <div class="ts-divider"></div>
                <div class="ts-content">
                    <button class="ts-button is-fluid close-modal">行吧</button>
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

    // Snackbar for delete confirmation with undo option
    function showSnackbar(onComplete) {
        const snackbar = document.createElement('div');
        snackbar.className = 'ts-snackbar';
        snackbar.innerHTML = `
            <div class="content">已成功刪除資料</div>
            <button class="action">撤回</button>
        `;
        document.body.appendChild(snackbar);

        // Handle fadeout animation and execute callback
        snackbar.addEventListener('animationend', (event) => {
            if (event.animationName === 'fadeout') {
                if (document.body.contains(snackbar)) {
                    document.body.removeChild(snackbar);
                }
                onComplete(); // Execute callback after fadeout
            }
        });

        // Undo deletion on button click
        const undoBtn = snackbar.querySelector('.action');
        undoBtn.addEventListener('click', () => {
            if (lastDeletedData) {
                Promise.all(lastDeletedData.map(data =>
                    fetch(saveUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRFToken': csrfToken
                        },
                        body: JSON.stringify(data)
                    }).then(response => response.json())
                ))
                .then(results => {
                    const allSuccess = results.every(result => result.success);
                    if (allSuccess) {
                        location.reload(); // Refresh page on successful undo
                    } else {
                        const errorMsg = results.find(r => !r.success)?.error || "未知錯誤";
                        showModal(`撤回失敗：${errorMsg}`);
                        lastDeletedData = null; // Clear to prevent retrying invalid data
                    }
                })
                .catch(error => {
                    console.error("Undo fetch error:", error);
                    showModal("撤回過程中發生錯誤，請稍後再試");
                })
                .finally(() => {
                    if (document.body.contains(snackbar)) {
                        document.body.removeChild(snackbar);
                    }
                });
            } else {
                if (document.body.contains(snackbar)) {
                    document.body.removeChild(snackbar);
                }
            }
        });
    }

    // Load filter settings from sessionStorage
    function loadFilterSettings() {
        const savedFilters = sessionStorage.getItem(`filters_${selectedTable}`);
        if (savedFilters) {
            const filters = JSON.parse(savedFilters);
            document.getElementById('startDate').value = filters.startDate || '';
            document.getElementById('endDate').value = filters.endDate || '';
            document.querySelector(`input[name="filterMode"][value="${filters.filterMode || 'all'}"]`).checked = true;
            fields.forEach(field => {
                document.getElementById(`min_${field}`).value = filters[`min_${field}`] || '';
                document.getElementById(`max_${field}`).value = filters[`max_${field}`] || '';
            });
            applyFilters();
        }
    }

    // Save filter settings to sessionStorage
    function saveFilterSettings() {
        const filters = {
            startDate: document.getElementById('startDate').value,
            endDate: document.getElementById('endDate').value,
            filterMode: document.querySelector('input[name="filterMode"]:checked').value
        };
        fields.forEach(field => {
            filters[`min_${field}`] = document.getElementById(`min_${field}`).value;
            filters[`max_${field}`] = document.getElementById(`max_${field}`).value;
        });
        sessionStorage.setItem(`filters_${selectedTable}`, JSON.stringify(filters));
    }

    // Clear filter settings when switching tables
    document.getElementById('tableSelect').addEventListener('change', () => {
        sessionStorage.removeItem(`filters_${selectedTable}`);
    });

    // Update button states based on editing mode
    function updateButtonStates() {
        const actionButtons = document.querySelectorAll('.action-btn');
        const editButtons = document.querySelectorAll('.edit-btn');
        actionButtons.forEach(btn => {
            if (editingRow) {
                btn.classList.add('is-disabled');
                btn.disabled = true;
            } else {
                btn.classList.remove('is-disabled');
                btn.disabled = btn.id === 'deleteSelectedBtn' && !document.querySelector('.delete-checkbox:checked');
            }
        });
        editButtons.forEach(btn => {
            if (editingRow) {
                btn.classList.add('is-disabled');
                btn.disabled = true;
            } else {
                btn.classList.remove('is-disabled');
                btn.disabled = false;
            }
        });
    }

    // Revert row to its original state
    function revertRow(row) {
        const dateCell = row.querySelector('.date-cell');
        dateCell.textContent = dateCell.dataset.original || '';
        row.querySelectorAll('.data-cell').forEach(cell => {
            const field = cell.dataset.field;
            const originalValue = cell.dataset.original || '';
            let formattedValue = '';
            if (originalValue && !isNaN(parseFloat(originalValue))) {
                formattedValue = fieldInfo[field].unit === 'new_taiwan_dollar'
                    ? parseFloat(originalValue).toLocaleString()
                    : parseFloat(originalValue).toString().replace(/\.0$/, '');
            }
            cell.textContent = formattedValue;
        });
        row.querySelector('td:last-child').innerHTML = `
            <button type="button" class="ts-button is-warning is-start-icon edit-btn">
                <span class="ts-icon is-pencil-icon"></span>
                編輯
            </button>
        `;
        row.classList.remove('editing');
        bindEditButtonEvents(row.querySelector('.edit-btn'));
    }

    // Bind edit button events
    function bindEditButtonEvents(btn) {
        btn.addEventListener('click', () => {
            const row = btn.closest('tr');
            if (!editingRow && row && !row.classList.contains('editing')) {
                editingRow = row;
                row.classList.add('editing');
                const dateCell = row.querySelector('.date-cell');
                const originalDate = dateCell.textContent.trim();
                dateCell.dataset.original = originalDate;
                dateCell.innerHTML = `<div class="ts-input is-basic"><input type="month" value="${originalDate}" placeholder="選擇月份"></div>`;
                row.querySelectorAll('.data-cell').forEach(cell => {
                    const field = cell.dataset.field;
                    const value = cell.textContent.trim().replace(/,/g, '');
                    cell.dataset.original = value;
                    const unit = fieldInfo[field].unit;
                    const inputType = unit === 'new_taiwan_dollar' ? 'number' : 'number" step="any';
                    const displayUnit = unitDisplayMap[unit] || unit;
                    cell.innerHTML = `<div class="ts-input is-basic"><input type="${inputType}" value="${value || ''}" placeholder="${displayUnit}"></div>`;
                });
                btn.outerHTML = `
                    <button type="button" class="ts-button is-positive is-start-icon save-btn">
                        <span class="ts-icon is-check-icon"></span>
                        儲存
                    </button>
                    <button type="button" class="ts-button is-negative is-outlined is-start-icon cancel-btn">
                        <span class="ts-icon is-xmark-icon"></span>
                        取消
                    </button>
                `;
                bindRowEvents(row);
                updateButtonStates();
            }
        });
    }

    // Add row
    document.getElementById('addRowBtn').addEventListener('click', () => {
        if (!editingRow && !document.getElementById('newRow')) {
            const newRow = document.createElement('tr');
            newRow.id = 'newRow';
            newRow.className = 'editing';
            editingRow = newRow;
            let html = `
                <td class="checkbox-cell">
                    <label class="ts-checkbox is-solo is-large">
                        <input type="checkbox" disabled>
                    </label>
                </td>
                <td class="date-cell"><div class="ts-input is-basic"><input type="month" id="new_date" placeholder="選擇月份"></div></td>
            `;
            fields.forEach(field => {
                const unit = fieldInfo[field].unit;
                const inputType = unit === 'new_taiwan_dollar' ? 'number' : 'number" step="any';
                const displayUnit = unitDisplayMap[unit] || unit;
                html += `<td class="data-cell" data-field="${field}"><div class="ts-input is-basic"><input type="${inputType}" id="new_${field}" placeholder="${displayUnit}"></div></td>`;
            });
            html += `
                <td class="action-cell">
                    <button type="button" class="ts-button is-positive is-start-icon save-btn">
                        <span class="ts-icon is-check-icon"></span>
                        儲存
                    </button>
                    <button type="button" class="ts-button is-negative is-outlined is-start-icon cancel-btn">
                        <span class="ts-icon is-xmark-icon"></span>
                        取消
                    </button>
                </td>
            `;
            newRow.innerHTML = html;
            tableBody.appendChild(newRow);
            if (tableBody.contains(noDataRow)) {
                tableBody.removeChild(noDataRow);
            }
            bindRowEvents(newRow);
            updateButtonStates();
        }
    });

    // Initial binding of edit buttons
    document.querySelectorAll('.edit-btn').forEach(bindEditButtonEvents);

    // Bind save and cancel events to rows
    function bindRowEvents(row) {
        const saveBtn = row.querySelector('.save-btn');
        const cancelBtn = row.querySelector('.cancel-btn');

        saveBtn.addEventListener('click', () => {
            const dateInput = row.querySelector('input[type="month"]');
            const date = dateInput.value;
            console.log("Saving date:", date);
            if (!date || !/^\d{4}-\d{2}$/.test(date)) {
                showModal("請輸入有效的 YYYY-MM 日期");
                return;
            }
            const originalDate = row.dataset.date || '';
            const data = {
                table: selectedTable,
                date: date,
                original_date: originalDate
            };
            row.querySelectorAll('.data-cell input').forEach(input => {
                const field = input.closest('td').dataset.field;
                data[field] = input.value || '';
            });

            console.log("Sending data:", data);
            fetch(saveUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken
                },
                body: JSON.stringify(data)
            })
            .then(response => {
                console.log("Response status:", response.status);
                return response.json();
            })
            .then(result => {
                console.log("Server response:", result);
                if (result.success) {
                    location.reload();
                } else {
                    showModal(result.error);
                }
            })
            .catch(error => console.error("Fetch error:", error));
        });

        cancelBtn.addEventListener('click', () => {
            if (row.id === 'newRow') {
                row.remove();
                editingRow = null;
                updateNoDataDisplay();
            } else {
                revertRow(row);
                editingRow = null;
            }
            updateButtonStates();
        });
    }

    // Handle deletion of selected rows
    const deleteBtn = document.getElementById('deleteSelectedBtn');
    const selectAll = document.getElementById('selectAll');
    const checkboxes = document.querySelectorAll('.delete-checkbox');

    selectAll.addEventListener('change', () => {
        const visibleCheckboxes = Array.from(checkboxes).filter(ch => ch.closest('tr').style.display !== 'none');
        visibleCheckboxes.forEach(checkbox => checkbox.checked = selectAll.checked);
        deleteBtn.disabled = !visibleCheckboxes.some(ch => ch.checked);
    });

    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            const visibleCheckboxes = Array.from(checkboxes).filter(ch => ch.closest('tr').style.display !== 'none');
            selectAll.checked = visibleCheckboxes.every(ch => ch.checked);
            deleteBtn.disabled = !visibleCheckboxes.some(ch => ch.checked);
        });
    });

    deleteBtn.addEventListener('click', () => {
        if (!editingRow) {
            const selectedDates = Array.from(checkboxes)
                .filter(ch => ch.checked && ch.closest('tr').style.display !== 'none')
                .map(ch => ch.value);
            console.log("Selected dates to delete:", selectedDates);
            if (selectedDates.length) {
                // Store deleted data for undo
                lastDeletedData = [];
                selectedDates.forEach(date => {
                    const row = tableBody.querySelector(`tr[data-date="${date}"]`);
                    if (row) {
                        const data = { table: selectedTable, date: date, original_date: '' };
                        row.querySelectorAll('.data-cell').forEach(cell => {
                            const field = cell.dataset.field;
                            const value = cell.textContent.trim().replace(/,/g, '');
                            data[field] = value || '';
                        });
                        lastDeletedData.push(data);
                    }
                });

                fetch(deleteUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': csrfToken
                    },
                    body: JSON.stringify({ table: selectedTable, dates: selectedDates })
                })
                .then(response => {
                    console.log("Delete response status:", response.status);
                    return response.json();
                })
                .then(result => {
                    console.log("Delete server response:", result);
                    if (result.success) {
                        selectedDates.forEach(date => {
                            const row = tableBody.querySelector(`tr[data-date="${date}"]`);
                            if (row) row.remove();
                        });
                        updateNoDataDisplay();
                        showSnackbar(() => location.reload());
                    } else {
                        showModal(result.error);
                        lastDeletedData = null; // Clear on failure to prevent invalid undo
                    }
                })
                .catch(error => {
                    console.error("Delete fetch error:", error);
                    showModal("刪除過程中發生錯誤，請稍後再試");
                    lastDeletedData = null; // Clear on error
                });
            } else {
                showModal("請選擇至少一筆資料進行刪除");
            }
        }
    });

    // Apply dynamic filtering based on date and field values
    function applyFilters() {
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        const filterMode = document.querySelector('input[name="filterMode"]:checked').value;
        const rows = document.querySelectorAll('#tableBody tr:not(.editing)');

        let visibleRows = 0;
        rows.forEach(row => {
            if (row.id === 'noDataRow') return;
            const date = row.querySelector('.date-cell').textContent;
            let dateMatch = true;
            if (startDate && date < startDate) dateMatch = false;
            if (endDate && date > endDate) dateMatch = false;

            const fieldMatches = fields.map(field => {
                const min = parseFloat(document.getElementById(`min_${field}`).value) || -Infinity;
                const max = parseFloat(document.getElementById(`max_${field}`).value) || Infinity;
                const value = parseFloat(row.querySelector(`[data-field="${field}"]`).textContent.replace(/,/g, '')) || 0;
                return value >= min && value <= max;
            });

            let show;
            if (filterMode === 'all') {
                show = dateMatch && fieldMatches.every(match => match);
            } else { // 'any'
                show = dateMatch && (fieldMatches.some(match => match) || fieldMatches.length === 0);
            }

            row.style.display = show ? '' : 'none';
            if (show) visibleRows++;
        });

        updateNoDataDisplay(visibleRows);
        const visibleCheckboxes = Array.from(checkboxes).filter(ch => ch.closest('tr').style.display !== 'none');
        selectAll.checked = visibleCheckboxes.every(ch => ch.checked);
        deleteBtn.disabled = !visibleCheckboxes.some(ch => ch.checked);
    }

    // Bind filter input events
    const filterInputs = document.querySelectorAll('#filterMenu input');
    filterInputs.forEach(input => {
        input.addEventListener('input', () => {
            if (!editingRow) {
                applyFilters();
                saveFilterSettings();
            }
        });
    });

    // Clear all filters
    document.getElementById('clearFilterBtn').addEventListener('click', () => {
        if (!editingRow) {
            filterInputs.forEach(input => {
                if (input.type !== 'radio') input.value = ''; // Clear all non-radio inputs
            });
            document.querySelector('input[name="filterMode"][value="all"]').checked = true;
            const rows = tableBody.querySelectorAll('tr:not(.editing):not(#noDataRow)');
            rows.forEach(row => {
                row.style.display = ''; // Show all rows
            });
            selectAll.checked = false; // Reset select all checkbox
            deleteBtn.disabled = true; // Disable delete button
            updateNoDataDisplay(rows.length); // Update no data display with actual row count
            saveFilterSettings(); // Save cleared settings
        }
    });

    // Update "no data" row visibility
    function updateNoDataDisplay(visibleRows = null) {
        const dataRows = tableBody.querySelectorAll('tr:not(#newRow):not(#noDataRow)');
        const visibleCount = visibleRows !== null ? visibleRows : Array.from(dataRows).filter(row => row.style.display !== 'none').length;
        if (visibleCount === 0 && !tableBody.contains(noDataRow) && !document.getElementById('newRow')) {
            tableBody.appendChild(noDataRow);
        } else if (visibleCount > 0 && tableBody.contains(noDataRow)) {
            tableBody.removeChild(noDataRow);
        }
    }

    // Initial setup
    updateNoDataDisplay();
    loadFilterSettings();
    updateButtonStates();
});