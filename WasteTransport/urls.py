# 在 WasteTransport/urls.py 文件中添加新的路由

from django.urls import path
from . import views

app_name = 'waste_transport'

urlpatterns = [
    # 現有的路由
    path('', views.manifest_list, name='manifest_list'),
    path('disposal/<str:manifest_id>/<str:waste_id>', views.disposal_manifest_detail, name='disposal_manifest_detail'),
    path('reuse/<str:manifest_id>/<str:waste_id>', views.reuse_manifest_detail, name='reuse_manifest_detail'),
    path('import/', views.import_csv, name='import_csv'),
    path('export/', views.export_manifests_csv, name='export_csv'),
    path('resolve_conflicts/', views.handle_conflict_resolution, name='resolve_conflicts'),
    
    # 刪除聯單
    path('delete_manifests/', views.delete_manifests, name='delete_manifests'),
    
    # 獲取所有符合條件的聯單ID，用於全選功能
    path('get_all_manifest_ids/', views.get_all_manifest_ids, name='get_all_manifest_ids'),
    
    # 自動完成 API
    path('autocomplete/company_name/', views.autocomplete_company_name, name='autocomplete_company_name'),
    path('autocomplete/waste_name/', views.autocomplete_waste_name, name='autocomplete_waste_name'),
    path('autocomplete/waste_code/', views.autocomplete_waste_code, name='autocomplete_waste_code'),
]