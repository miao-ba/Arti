from django import template

register = template.Library()

@register.filter
def get_icon(dictionary, key):
    return dictionary.get(key, 'question')  # 默認圖示

@register.filter
def permission_name(value): # 將名字從en-US翻譯成zh-Hant-TW，但不使用i18n，因為我懶。
    translations = {
        'root': '根帳號',
        'moderator': '管理者',
        'staff': '行政人員',
        'registrar': '登錄者',
        'importer': '匯入者'
    }
    return translations.get(value, value.capitalize())  # 如果沒有翻譯，則返回首字母大寫的原始值