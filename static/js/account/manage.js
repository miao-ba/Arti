// 預設顯示目前使用者資料
// 按鈕事件：顯示該使用者所有資料
const accountInfoElement = document.getElementById('account-info');
const currentAccount = accountInfoElement.getAttribute("current-account");
const permission_name = {
    'root': '根帳號',
    'moderator': '管理者',
    'staff': '行政人員',
    'registrar': '登錄者',
    'importer': '匯入者'
}

document.addEventListener("DOMContentLoaded", () => {
    const contentBox = document.querySelector("#account-info");
    const accountItems = document.querySelectorAll(".ts-menu .item");

    // 初始化抓取當前使用者資料
    console.log("Current Account: " + currentAccount);

    if (currentAccount) {
        fetchAccountData(currentAccount, contentBox);

        // 預設高亮當前帳戶的按鈕
        accountItems.forEach(item => {
            if (item.getAttribute("data-account") === currentAccount) {
                item.classList.add("is-active");
            }
        });
    }

    // 為每個帳號項目添加點擊事件
    accountItems.forEach(item => {
        item.addEventListener("click", (event) => {
            // 移除所有按鈕的高亮
            accountItems.forEach(btn => btn.classList.remove("is-active"));

            // 高亮當前點擊的按鈕
            const clickedItem = event.currentTarget;
            clickedItem.classList.add("is-active");

            // 獲取點擊帳號的資料並更新主內容
            const account = clickedItem.getAttribute("data-account");
            fetchAccountData(account, contentBox);
        });
    });
});

let selectedAccount = currentAccount // 全域變數

function selectAccount(account) {
    selectedAccount = account
    console.log('Selected account:', selectedAccount);

    // 你可以在此處將選中的帳號高亮顯示或做其他處理
}

// 定義 fetchAccountData 方法來獲取並更新帳號資訊

function fetchAccountData(account, contentBox) {
    const url = `/account/manage/${account}/`;

    // 發送 AJAX 請求
    fetch(url, {
        method: 'POST',
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
                // 更新右側詳細資訊
                contentBox.innerHTML = `
                <table class="ts-table">
                    <tbody>
                        <tr><td><strong>帳號ID</strong></td><td><span class="ts-text is-code monospace">${data.username}</span></td></tr>
                        <tr><td><strong>姓名</strong></td><td>${data.first_name} ${data.last_name}</td></tr>
                        <tr><td><strong>身份</strong></td><td><span class="ts-text color-${permission_name[data.group]}">${permission_name[data.group]}</span></td></tr>
                        <tr><td><strong>是否為 Superuser</strong></td><td>${data.is_superuser ? '是' : '否'}</td></tr>
                        <tr><td><strong>是否為 Staff</strong></td><td>${data.is_staff ? '是' : '否'}</td></tr>
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

function confirmDelete(username) {
    if (!username) {
        alert('請選擇一個帳號進行刪除！');
        return;
    }

    if (username === currentAccount) {
        alert('你不能刪除自己的帳號！');
        return;
    }

    if (confirm("確定要刪除這個帳戶嗎？這個操作無法撤回！")) {
        const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;

        fetch(`/account/delete/${username}/`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            }
        })
            .then(response => {
                if (!response.ok) {
                    // 嘗試解析伺服器回傳的 JSON
                    return response.json().then(data => {
                        throw new Error(data.error || `HTTP ${response.status}`);
                    });
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    alert("刪除成功！");
                    location.reload();
                } else {
                    alert(`刪除失敗：${data.error}`);
                }
            })
            .catch(error => {
                console.error("刪除帳戶時發生錯誤：", error);
                alert(`操作失敗：${error.message}`);
            });
    }
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