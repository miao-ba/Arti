# 在 WasteTransport/urls.py 文件中添加新的路由

from django.urls import path
from . import views

app_name = 'waste_transport'

urlpatterns = [
    # 現有的 URL 配置保持不變
    path('', views.manifest_list, name='manifest_list'),
    path('disposal/<str:manifest_id>/<str:waste_id>/', views.disposal_manifest_detail, name='disposal_manifest_detail'),
    path('reuse/<str:manifest_id>/<str:waste_id>/', views.reuse_manifest_detail, name='reuse_manifest_detail'),
    path('delete_manifests/', views.delete_manifests, name='delete_manifests'),
    path('get_all_manifest_ids/', views.get_all_manifest_ids, name='get_all_manifest_ids'),
    
    # 新增的 URL 配置，支援改進的匯入功能
    path('check_manifest_conflict/', views.check_manifest_conflict, name='check_manifest_conflict'),
    path('get_manifest/', views.get_manifest, name='get_manifest'),
    path('import_manifest/', views.import_manifest, name='import_manifest'),
    
    # 自動完成功能 URL
    path('autocomplete/company_name/', views.autocomplete_company_name, name='autocomplete_company_name'),
    path('autocomplete/waste_name/', views.autocomplete_waste_name, name='autocomplete_waste_name'),
    path('autocomplete/waste_code/', views.autocomplete_waste_code, name='autocomplete_waste_code'),
]