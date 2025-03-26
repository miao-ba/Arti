document.addEventListener("DOMContentLoaded", () => {
    // 預設顯示目前使用者資料
    const accountInfoContent = document.getElementById('account-info-content');
    const currentAccount = accountInfoContent.getAttribute("current-account");
    // 初始化時抓取帳號資料
    fetchAccountData(currentAccount, accountInfoContent);
});

const permission_types = {
    'root': { name: '根帳號', color: 'color-root' },
    'moderator': { name: '管理者', color: 'color-moderator' },
    'staff': { name: '行政人員', color: 'color-staff' },
    'registrar': { name: '登錄者', color: 'color-registrar' },
    'importer': { name: '匯入者', color: 'color-importer' }
};

// 獲取帳號資料的函數
function fetchAccountData(currentAccount, contentBox) {
    const url = `/account/manage/${currentAccount}/`; // 假設這是獲取當前用戶資料的API端點

    fetch(url, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken')
        }
    })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                contentBox.innerHTML = `
                <div class="ts-text is-error">
                    無法加載使用者資料：${data.error}
                </div>
            `;
            } else {
                // 顯示帳號資訊
                const perm = permission_types[data.group] || { name: '未知身份', color: 'color-not-defined' };
                contentBox.innerHTML = `
                <table class="ts-table is-basic has-top-padded-small">
                    <tbody>
                        <tr><td><strong>帳號ID</strong></td><td><span class="ts-text is-code monospace">${data.username}</span></td></tr>
                        <tr><td><strong>姓名</strong></td><td>${data.first_name} ${data.last_name}</td></tr>
                        <tr><td><strong>身份</strong></td><td><span class="ts-text ${perm.color}">${perm.name}</span></td></tr>
                        <tr><td><strong>註冊時間</strong></td><td>${data.date_joined}</td></tr>
                        <tr><td><strong>最近登入時間</strong></td><td>${data.last_login}</td></tr>
                    </tbody>
                </table>
            `;
            }
        })
        .catch(error => {
            contentBox.innerHTML = `
            <div class="ts-text is-error">
                發生錯誤：${error.message}
            </div>
        `;
        });
}

// 獲取 CSRF Token 的函式

function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.startsWith(name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}