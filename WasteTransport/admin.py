from django.contrib import admin
from .models import DisposalManifest, ReuseManifest, ImportHistory

@admin.register(DisposalManifest)
class DisposalManifestAdmin(admin.ModelAdmin):
    list_display = ('manifest_id', 'company_name', 'report_date', 'waste_code', 'waste_name', 'reported_weight')
    search_fields = ('manifest_id', 'company_name', 'waste_code', 'waste_name')
    list_filter = ('report_date', 'manifest_confirmation', 'carrier_confirmation', 'processor_confirmation')
    date_hierarchy = 'report_date'
    readonly_fields = ('created_at', 'updated_at')

@admin.register(ReuseManifest)
class ReuseManifestAdmin(admin.ModelAdmin):
    list_display = ('manifest_id', 'company_name', 'report_date', 'substance_code', 'substance_name', 'reported_weight')
    search_fields = ('manifest_id', 'company_name', 'substance_code', 'substance_name')
    list_filter = ('report_date', 'manifest_confirmation', 'carrier_confirmation', 'reuser_confirmation')
    date_hierarchy = 'report_date'
    readonly_fields = ('created_at', 'updated_at')

@admin.register(ImportHistory)
class ImportHistoryAdmin(admin.ModelAdmin):
    list_display = ('filename', 'import_date', 'import_type', 'total_records', 'imported_records', 'skipped_records')
    list_filter = ('import_date', 'import_type')
    readonly_fields = ('import_date',)