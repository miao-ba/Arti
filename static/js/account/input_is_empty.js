document.getElementById('submit-all').addEventListener('click', function () {
    // 獲取所有帶有 `input-required` 類別的父容器
    const requiredInputs = document.querySelectorAll('.input-required');

    // 遍歷每個輸入框的父容器
    requiredInputs.forEach(function (inputWrapper) {
        // 找到輸入框元素
        const input = inputWrapper.querySelector('input');

        // 檢查輸入框是否為空
        if (input.value === '') {
            // 如果為空，加上 `is-negative` 類別
            inputWrapper.classList.add('is-negative');
        } else {
            // 如果有值，移除 `is-negative` 類別
            inputWrapper.classList.remove('is-negative');
        }
    });
});

// 即時偵測
document.querySelectorAll('.input-required input').forEach(function (input) {
    input.addEventListener('input', function () {
        const wrapper = input.closest('.input-required');
        if (input.value !== '') {
            wrapper.classList.remove('is-negative');
        }
    });
});
