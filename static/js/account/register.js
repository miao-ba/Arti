document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('data-register');
    const requiredInputs = document.querySelectorAll('.input-required');
    const submitButton = document.getElementById('send');

    // 驗證必填項目
    function validateRequiredFields() {
        let allValid = true;
        requiredInputs.forEach(inputWrapper => {
            const input = inputWrapper.querySelector('input, select');  // 獲取input或select元素
            if (!input.value.trim()) {
                inputWrapper.classList.add('is-negative');  // 如果輸入框為空，添加 is-negative 類別
                allValid = false;
            } else {
                inputWrapper.classList.remove('is-negative');  // 如果有值，移除 is-negative 類別
            }
        });
        return allValid;
    }

    // 提交表單
    submitButton.addEventListener('click', function (e) {
        e.preventDefault();  // 阻止表單默認提交

        // 驗證必填項目
        if (!validateRequiredFields()) {
            alert('請填寫所有必填項目！');
            return;
        }

        const confirmation = confirm('您確定要提交此表單嗎？');
        if (confirmation) {
            const formData = new FormData(form);

            // 使用 fetch 發送表單資料
            fetch(form.action, {
                method: 'POST',
                headers: {
                    'X-CSRFToken': form.querySelector('input[name="csrfmiddlewaretoken"]').value,
                },
                body: formData,
            })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        alert('註冊成功！');
                        window.location.href = '/account/manage/';
                    } else {
                        alert(`註冊失敗：${data.error}`);
                    }
                })
                .catch(error => {
                    alert(`發生錯誤：${error.message}`);
                });
        }
    });

    // 即時檢查輸入框的狀態
    requiredInputs.forEach(inputWrapper => {
        const input = inputWrapper.querySelector('input, select');
        input.addEventListener('input', function () {
            if (input.value.trim()) {
                inputWrapper.classList.remove('is-negative');
            } else {
                inputWrapper.classList.add('is-negative');
            }
        });
    });
});
