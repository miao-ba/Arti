from django.shortcuts import redirect
from django.urls import reverse

# 統一的權限層級定義
GROUP_HIERARCHY = {
    "root": 40,
    "moderator": 30,
    "staff": 20,
    "registrar": 10,
    "importer": 10,
}

def get_permission_hi(user, id=False):
    """Return the highest permission level or group name for a user."""
    user_groups = user.groups.all() if user.is_authenticated else []
    if not user_groups:
        return 0 if id else "not-defined"

    highest_level = max(
        (GROUP_HIERARCHY.get(group.name, 0) for group in user_groups),
        default=0
    )
    if id:
        return highest_level

    # 返回最高等級的第一個組名（按字典順序排序以確保一致性）
    matching_groups = [name for name, level in GROUP_HIERARCHY.items()
                       if level == highest_level and any(g.name == name for g in user_groups)]
    return sorted(matching_groups)[0] if matching_groups else "not-defined"

def get_permission_lo(user, id=False):
    """Return the lowest permission level or group name for a user."""
    user_groups = user.groups.all() if user.is_authenticated else []
    if not user_groups:
        return 0 if id else "not-defined"

    lowest_level = min(
        (GROUP_HIERARCHY.get(group.name, 0) for group in user_groups),
        default=0
    )
    if id:
        return lowest_level

    # 返回最低等級的第一個組名（按字典順序排序以確保一致性）
    matching_groups = [name for name, level in GROUP_HIERARCHY.items()
                       if level == lowest_level and any(g.name == name for g in user_groups)]
    return sorted(matching_groups)[0] if matching_groups else "not-defined"

def get_permission_all(user, id=False):
    """Return all permissions as a list of levels or group names."""
    user_groups = user.groups.all() if user.is_authenticated else []
    if not user_groups:
        return [] if id else ["not-defined"]
    if id:
        return [GROUP_HIERARCHY.get(group.name, 0) for group in user_groups]
    return [group.name for group in user_groups]

# 權限裝飾器
def permission_required(min_group, exact_group=None):
    def decorator(view_func):
        def _wrapped_view(request, *args, **kwargs):
            # 未認證用戶跳轉到登入頁面
            if not request.user.is_authenticated:
                message = "Not login yet, please log in."
                response = redirect(reverse('login'))
                response['X-Message'] = message
                return response

            # 獲取用戶最高權限等級
            user_level = get_permission_hi(request.user, id=True)

            # 檢查是否滿足最低權限要求
            if user_level < GROUP_HIERARCHY[min_group]:
                message = "Unauthorized: Insufficient group membership."
                response = redirect(reverse('main'))
                response['X-Message'] = message
                return response

            # 如果指定了 exact_group，檢查具體身份組
            if exact_group and exact_group not in get_permission_all(request.user):
                message = f"Unauthorized: This view requires '{exact_group}' group."
                response = redirect(reverse('main'))
                response['X-Message'] = message
                return response

            return view_func(request, *args, **kwargs)

        # 附加權限查詢函數到裝飾器
        _wrapped_view.permission_hi = lambda user, id=False: get_permission_hi(user, id)
        _wrapped_view.permission_lo = lambda user, id=False: get_permission_lo(user, id)
        _wrapped_view.permission_all = lambda user, id=False: get_permission_all(user, id)

        return _wrapped_view
    return decorator

# 上下文處理器(context processors)，已經設置於settings.py。
def user_group_define(request):
    # 根據認證狀態獲取用戶組
    user = request.user
    user_groups = user.groups.all() if user.is_authenticated else []

    # 定義上下文使用的權限查詢函數（封裝以避免每次調用都傳遞 user）
    def permission_hi(id=False):
        return get_permission_hi(user, id)

    def permission_lo(id=False):
        return get_permission_lo(user, id)

    def permission_all(id=False):
        return get_permission_all(user, id)

    # 判斷用戶身份標誌
    is_root = user.groups.filter(name='root').exists() if user.is_authenticated else False
    is_moderator = user.groups.filter(name='moderator').exists() if user.is_authenticated else False
    is_staff = user.groups.filter(name='staff').exists() if user.is_authenticated else False
    is_registrar = user.groups.filter(name='registrar').exists() if user.is_authenticated else False
    is_importer = user.groups.filter(name='importer').exists() if user.is_authenticated else False

    is_over_mod = is_root or is_moderator
    is_over_staff = is_root or is_moderator or is_staff
    is_over_reg = is_root or is_moderator or is_staff or is_registrar
    is_over_imp = is_root or is_moderator or is_staff or is_importer

    # 返回上下文數據
    return {
        'user_is_root': is_root,
        'user_is_moderator': is_moderator,
        'user_is_staff': is_staff,
        'user_is_registrar': is_registrar,
        'user_is_importer': is_importer,

        'user_is_over_mod': is_over_mod,
        'user_is_over_staff': is_over_staff,
        'user_is_over_reg': is_over_reg,
        'user_is_over_imp': is_over_imp,

        'permission_hi': permission_hi,
        'permission_lo': permission_lo,
        'permission_all': permission_all,
    }

# 示例用法：
#
# 裝飾器：
# @permission_required("moderator", exact_group="moderator")
# def some_view(request):
#     highest_level = some_view.permission_hi(request.user, id=True)
#     return HttpResponse(f"Highest permission: {highest_level}")
#
# 模板：
# {% if permission_hi %}
#     <p>Highest Permission: {{ permission_hi.id }}</p>
#     <p>Highest Group: {{ permission_hi }}</p>
# {% endif %}