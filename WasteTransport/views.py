import csv
import io
import json
import time
import logging
from datetime import datetime
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from django.db import transaction
from django.http import JsonResponse, HttpResponse
from django.core.paginator import Paginator
from django.db.models import Q
from django.template.loader import render_to_string
from django.views.decorators.csrf import csrf_exempt
from MedicalWasteManagementSystem.permissions import permission_required
from .models import DisposalManifest, ReuseManifest, ImportHistory
from .forms import ManifestFilterForm, CSVImportForm

# 設定日誌
logger = logging.getLogger(__name__)

# 聯單清單頁面 - 主視圖
@permission_required('importer')
def manifest_list(request):
    form = ManifestFilterForm(request.GET)
    
    # 初始化查詢集 - 只查詢可見的資料
    disposal_query = DisposalManifest.objects.filter(is_visible=True)
    reuse_query = ReuseManifest.objects.filter(is_visible=True)
    
    # 套用篩選條件
    if form.is_valid():
        data = form.cleaned_data
        
        # 根據聯單類型篩選
        manifest_type = data.get('manifest_type')
        if manifest_type == 'disposal':
            reuse_query = ReuseManifest.objects.none()
        elif manifest_type == 'reuse':
            disposal_query = DisposalManifest.objects.none()
            
        # 聯單編號篩選
        manifest_id = data.get('manifest_id')
        if manifest_id:
            disposal_query = disposal_query.filter(manifest_id__icontains=manifest_id)
            reuse_query = reuse_query.filter(manifest_id__icontains=manifest_id)
            
        # 事業機構名稱篩選
        company_name = data.get('company_name')
        if company_name:
            disposal_query = disposal_query.filter(company_name__icontains=company_name)
            reuse_query = reuse_query.filter(company_name__icontains=company_name)
            
        # 廢棄物代碼篩選
        waste_code = data.get('waste_code')
        if waste_code:
            disposal_query = disposal_query.filter(waste_code__icontains=waste_code)
            reuse_query = reuse_query.filter(substance_code__icontains=waste_code)
            
        # 廢棄物名稱篩選 - 新增
        waste_name = data.get('waste_name')
        if waste_name:
            disposal_query = disposal_query.filter(waste_name__icontains=waste_name)
            reuse_query = reuse_query.filter(substance_name__icontains=waste_name)
            
        # 申報日期篩選
        report_date_from = data.get('report_date_from')
        if report_date_from:
            disposal_query = disposal_query.filter(report_date__gte=report_date_from)
            reuse_query = reuse_query.filter(report_date__gte=report_date_from)
            
        report_date_to = data.get('report_date_to')
        if report_date_to:
            disposal_query = disposal_query.filter(report_date__lte=report_date_to)
            reuse_query = reuse_query.filter(report_date__lte=report_date_to)
            
        # 申報重量篩選
        reported_weight_below = data.get('reported_weight_below')
        if reported_weight_below:
            disposal_query = disposal_query.filter(reported_weight__lte=reported_weight_below)
            reuse_query = reuse_query.filter(reported_weight__lte=reported_weight_below)
            
        reported_weight_above = data.get('reported_weight_above')
        if reported_weight_above:
            disposal_query = disposal_query.filter(reported_weight__gte=reported_weight_above)
            reuse_query = reuse_query.filter(reported_weight__gte=reported_weight_above)
            
        # 確認狀態篩選 - 新增
        confirmation_status = data.get('confirmation_status')
        if confirmation_status == 'confirmed':
            disposal_query = disposal_query.filter(manifest_confirmation=True)
            reuse_query = reuse_query.filter(manifest_confirmation=True)
        elif confirmation_status == 'unconfirmed':
            disposal_query = disposal_query.filter(manifest_confirmation=False)
            reuse_query = reuse_query.filter(manifest_confirmation=False)
    
    # 合併查詢結果並轉換為列表
    disposal_results = list(disposal_query.order_by('-report_date'))
    reuse_results = list(reuse_query.order_by('-report_date'))
    
    # 將兩種類型的聯單合併，並添加類型標記
    combined_results = []
    for manifest in disposal_results:
        combined_results.append({
            'type': 'disposal',
            'manifest': manifest,
            'type_display': '清除單',
            'manifest_id': manifest.manifest_id,
            'waste_id': manifest.waste_id,
            'company_name': manifest.company_name,
            'report_date': manifest.report_date,
            'waste_code': manifest.waste_code,
            'waste_name': manifest.waste_name,
            'reported_weight': manifest.reported_weight,
            'manifest_confirmation': manifest.manifest_confirmation
        })
    
    for manifest in reuse_results:
        combined_results.append({
            'type': 'reuse',
            'manifest': manifest,
            'type_display': '再利用單',
            'manifest_id': manifest.manifest_id,
            'waste_id': manifest.waste_id,
            'company_name': manifest.company_name,
            'report_date': manifest.report_date,
            'waste_code': manifest.substance_code,
            'waste_name': manifest.substance_name,
            'reported_weight': manifest.reported_weight,
            'manifest_confirmation': manifest.manifest_confirmation
        })
    
    # 根據申報日期排序
    combined_results.sort(key=lambda x: x['manifest'].report_date, reverse=True)
    
    # 分頁處理
    paginator = Paginator(combined_results, 20)  # 每頁20筆
    page_number = request.GET.get('page')
    page_obj = paginator.get_page(page_number)
    
    # 取得最近的匯入歷史
    recent_imports = ImportHistory.objects.all().order_by('-import_date')[:5]
    
    context = {
        'page_obj': page_obj,
        'form': form,
        'disposal_count': len(disposal_results),
        'reuse_count': len(reuse_results),
        'total_count': len(combined_results),
        'manifests': page_obj,  # 為了卡片式顯示添加
        'recent_imports': recent_imports,
        'import_form': CSVImportForm(),
    }
    
    # 如果是AJAX請求，只返回聯單部分的HTML
    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        manifests_html = render_to_string('waste_transport/partials/manifest_cards.html', {'manifests': page_obj})
        return JsonResponse({'html': manifests_html})
    
    return render(request, 'waste_transport/manifest_list.html', context)

# 清除單詳細資訊 - AJAX
@permission_required('importer')
def disposal_manifest_detail(request, manifest_id, waste_id):
    manifest = get_object_or_404(DisposalManifest, manifest_id=manifest_id, waste_id=waste_id, is_visible=True)
    
    # The rest of the function...
    # 如果是AJAX請求，返回HTML片段
    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        html = render_to_string('waste_transport/partials/disposal_detail.html', {'manifest': manifest})
        return JsonResponse({'html': html})
    
    # 否則返回完整頁面
    return render(request, 'waste_transport/disposal_manifest_detail.html', {'manifest': manifest})

# 再利用單詳細資訊 - AJAX
@permission_required('importer')
def reuse_manifest_detail(request, manifest_id, waste_id):
    manifest = get_object_or_404(ReuseManifest, manifest_id=manifest_id, waste_id=waste_id, is_visible=True)
    
    # 如果是AJAX請求，返回HTML片段
    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        html = render_to_string('waste_transport/partials/reuse_detail.html', {'manifest': manifest})
        return JsonResponse({'html': html})
    
    # 否則返回完整頁面
    return render(request, 'waste_transport/reuse_manifest_detail.html', {'manifest': manifest})

# 獲取所有符合條件的聯單ID，用於全選功能
@permission_required('importer')
def get_all_manifest_ids(request):
    form = ManifestFilterForm(request.GET)
    
    # 初始化查詢集 - 只查詢可見的資料
    disposal_query = DisposalManifest.objects.filter(is_visible=True)
    reuse_query = ReuseManifest.objects.filter(is_visible=True)
    
    # 套用篩選條件
    if form.is_valid():
        data = form.cleaned_data
        
        # 根據聯單類型篩選
        manifest_type = data.get('manifest_type')
        if manifest_type == 'disposal':
            reuse_query = ReuseManifest.objects.none()
        elif manifest_type == 'reuse':
            disposal_query = DisposalManifest.objects.none()
            
        # 聯單編號篩選
        manifest_id = data.get('manifest_id')
        if manifest_id:
            disposal_query = disposal_query.filter(manifest_id__icontains=manifest_id)
            reuse_query = reuse_query.filter(manifest_id__icontains=manifest_id)
            
        # 事業機構名稱篩選
        company_name = data.get('company_name')
        if company_name:
            disposal_query = disposal_query.filter(company_name__icontains=company_name)
            reuse_query = reuse_query.filter(company_name__icontains=company_name)
            
        # 廢棄物代碼篩選
        waste_code = data.get('waste_code')
        if waste_code:
            disposal_query = disposal_query.filter(waste_code__icontains=waste_code)
            reuse_query = reuse_query.filter(substance_code__icontains=waste_code)
            
        # 廢棄物名稱篩選
        waste_name = data.get('waste_name')
        if waste_name:
            disposal_query = disposal_query.filter(waste_name__icontains=waste_name)
            reuse_query = reuse_query.filter(substance_name__icontains=waste_name)
            
        # 申報日期篩選
        report_date_from = data.get('report_date_from')
        if report_date_from:
            disposal_query = disposal_query.filter(report_date__gte=report_date_from)
            reuse_query = reuse_query.filter(report_date__gte=report_date_from)
            
        report_date_to = data.get('report_date_to')
        if report_date_to:
            disposal_query = disposal_query.filter(report_date__lte=report_date_to)
            reuse_query = reuse_query.filter(report_date__lte=report_date_to)
            
        # 申報重量篩選
        reported_weight_below = data.get('reported_weight_below')
        if reported_weight_below:
            disposal_query = disposal_query.filter(reported_weight__lte=reported_weight_below)
            reuse_query = reuse_query.filter(reported_weight__lte=reported_weight_below)
            
        reported_weight_above = data.get('reported_weight_above')
        if reported_weight_above:
            disposal_query = disposal_query.filter(reported_weight__gte=reported_weight_above)
            reuse_query = reuse_query.filter(reported_weight__gte=reported_weight_above)
            
        # 確認狀態篩選
        confirmation_status = data.get('confirmation_status')
        if confirmation_status == 'confirmed':
            disposal_query = disposal_query.filter(manifest_confirmation=True)
            reuse_query = reuse_query.filter(manifest_confirmation=True)
        elif confirmation_status == 'unconfirmed':
            disposal_query = disposal_query.filter(manifest_confirmation=False)
            reuse_query = reuse_query.filter(manifest_confirmation=False)
    
    # 提取所有符合條件的聯單ID
    manifests = []
    
    # 處理清除單
    for manifest in disposal_query.values('manifest_id', 'waste_id'):
        manifests.append({
            'type': 'disposal',
            'manifest_id': manifest['manifest_id'],
            'waste_id': manifest['waste_id']
        })
    
    # 處理再利用單
    for manifest in reuse_query.values('manifest_id', 'waste_id'):
        manifests.append({
            'type': 'reuse',
            'manifest_id': manifest['manifest_id'],
            'waste_id': manifest['waste_id']
        })
    
    return JsonResponse({
        'success': True,
        'manifests': manifests
    })

# CSV匯入處理 - AJAX
@csrf_exempt
@permission_required('importer')
def import_csv(request):
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': '僅支援POST請求'})
    
    form = CSVImportForm(request.POST, request.FILES)
    if not form.is_valid():
        errors = {}
        for field, error_list in form.errors.items():
            errors[field] = [str(error) for error in error_list]
        return JsonResponse({'success': False, 'errors': errors})
    
    try:
        csv_file = request.FILES['csv_file']
        import_type = form.cleaned_data['import_type']
        conflict_resolution = form.cleaned_data['conflict_resolution']
        
        # 處理CSV檔案
        csv_file_data = csv_file.read().decode('utf-8-sig')
        csv_io = io.StringIO(csv_file_data)
        reader = csv.DictReader(csv_io)
        rows = list(reader)  # 將所有行先讀入記憶體
        
        # 檢查是否有衝突
        conflict_exists = False
        conflicting_records = []
        
        for row in rows:
            manifest_id = row.get('聯單編號')
            waste_id = row.get('廢棄物ID')
            if not manifest_id or not waste_id:
                continue
                
            # 檢查是否已存在
            if import_type == 'disposal':
                existing = DisposalManifest.objects.filter(manifest_id=manifest_id, waste_id=waste_id, is_visible=True).first()
            else:
                existing = ReuseManifest.objects.filter(manifest_id=manifest_id, waste_id=waste_id, is_visible=True).first()
                
            if existing:
                conflict_exists = True
                conflict_data = {
                    'manifest_id': manifest_id,
                    'waste_id': waste_id,
                    'company_name': row.get('事業機構名稱', ''),
                    'report_date': row.get('申報日期', ''),
                    'new_data': {k: v for k, v in row.items() if v},
                    'existing_data': {}
                }
                
                # 添加現有資料以顯示差異
                if import_type == 'disposal':
                    print(existing.report_date)
                    conflict_data['existing_data'] = {
                        '聯單編號': existing.manifest_id,
                        '事業機構代碼': existing.company_id,
                        '事業機構名稱': existing.company_name,
                        '申報日期': time_reverse(existing.report_date,existing.report_time) if existing.report_date else '',
                        '廢棄物代碼': existing.waste_code,
                        '廢棄物名稱': existing.waste_name,
                        '申報重量': str(existing.reported_weight),
                        '廢棄物ID': existing.waste_id,
                        '清運日期': time_reverse(existing.transport_date,existing.transport_time) if existing.delivery_date else '',
                        '清除者代碼':existing.carrier_id,
                        '清除者名稱': existing.carrier_name,
                        '運送日期': time_reverse(existing.delivery_date,existing.delivery_time),
                        '清除者運載車號': existing.carrier_vehicle_number,
                        '處理者代碼': existing.processor_id,
                        '處理者名稱': existing.processor_name,
                        '收受日期': time_reverse(existing.receive_date,existing.receive_time),
                        '中間處理方式': existing.intermediate_treatment,
                        '處理完成日期': time_reverse(existing.processing_completion_date,existing.processing_completion_time),
                        '最終處置方式': existing.final_disposal_method,
                        '處理者確認': "Y" if existing.processor_confirmation else 'N',
                        '處理者運載車號': existing.processor_vehicle,
                        '最終處置者代碼': existing.final_processor_id,
                        '最終處置者名稱': existing.final_processor_name,
                        '進場日期': existing.entry_date,
                        '進場時間': existing.entry_time,
                        '進場編號': existing.entry_number,
                        '最終處置者確認': existing.final_processor_confirmation,
                        '最終流向': existing.final_destination,
                        '製程代碼': existing.process_code,
                        '製程名稱': existing.process_name,
                        '是否由貯存地起運': "是" if existing.from_storage else '否',
                        '起運地': existing.origin_location,
                        '聯單確認': "Y" if  existing.manifest_confirmation else 'N',
                        '運載車號': existing.carrier_vehicle,
                        '清除者確認': "Y" if existing.carrier_confirmation else 'N',
                    }
                else:
                    conflict_data['existing_data'] = {
                        '聯單編號': existing.manifest_id,
                        '事業機構代碼': existing.company_id,
                        '事業機構名稱': existing.company_name,
                        '申報日期': existing.report_date.strftime('%Y/%m/%d') if existing.report_date else '',
                        '物質代碼': existing.substance_code,
                        '物質名稱': existing.substance_name,
                        '申報重量': str(existing.reported_weight),
                        '廢棄物ID': existing.waste_id
                    }
                
                conflicting_records.append(conflict_data)
        
        if conflict_exists and conflict_resolution == 'ask':
            # 返回衝突資訊，由前端顯示衝突解決對話框
            return JsonResponse({
                'success': False,
                'conflict': True,
                'conflicting_records': conflicting_records,
                'import_data': {
                    'csv_data': csv_file_data,
                    'import_type': import_type,
                    'filename': csv_file.name,
                }
            })
        else:
            # 直接處理匯入
            result = process_csv_import(rows, import_type, conflict_resolution, csv_file.name)
            return JsonResponse(result)
            
    except Exception as e:
        logger.error(f"匯入過程中發生錯誤：{str(e)}", exc_info=True)
        return JsonResponse({'success': False, 'error': f"匯入過程中發生錯誤：{str(e)}"})
def time_reverse(date,time):
    date = date.strftime('%Y/%#m/%#d ')
    time_ = time.strftime('%H:%M:%S')
    time = time.strftime(' %I:%M:%S')
    if(int(time_.split(":")[0])<12):
        return date+"上午"+time
    else:
        return date+"下午"+time
# 處理衝突解決 - AJAX
@csrf_exempt
@permission_required('importer')
def handle_conflict_resolution(request):
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': '僅支援POST請求'})
    
    try:
        # 解析JSON資料
        data = json.loads(request.body)
        csv_data = data.get('csv_data')
        import_type = data.get('import_type')
        filename = data.get('filename')
        conflict_resolution = data.get('conflict_resolution')
        apply_to_all = data.get('apply_to_all', False)
        
        if not all([csv_data, import_type, filename, conflict_resolution]):
            return JsonResponse({'success': False, 'error': '缺少必要參數'})
        
        # 處理CSV資料
        csv_io = io.StringIO(csv_data)
        reader = csv.DictReader(csv_io)
        rows = list(reader)
        
        # 處理匯入
        result = process_csv_import(rows, import_type, conflict_resolution, filename, apply_to_all)
        return JsonResponse(result)
        
    except Exception as e:
        logger.error(f"處理衝突解決時發生錯誤：{str(e)}", exc_info=True)
        return JsonResponse({'success': False, 'error': f"處理衝突解決時發生錯誤：{str(e)}"})

# 處理CSV匯入
def process_csv_import(rows, import_type, conflict_resolution, filename, apply_to_all=False):
    try:
        # 統計資料
        total_records = len(rows)
        imported_records = 0
        skipped_records = 0
        
        # 批次處理，每100筆一個事務
        batch_size = 100
        
        with transaction.atomic():
            for i in range(0, total_records, batch_size):
                batch = rows[i:i+batch_size]
                
                try:
                    with transaction.atomic():
                        for row in batch:
                            row = transform_waste_record(row)
                            # 根據聯單類型處理資料
                            if import_type == 'disposal':
                                result = handle_disposal_import(row, conflict_resolution, apply_to_all)
                            else:  # 再利用單
                                result = handle_reuse_import(row, conflict_resolution, apply_to_all)
                            
                            if result:
                                imported_records += 1
                            else:
                                skipped_records += 1
                except Exception as e:
                    logger.error(f"批次處理時發生錯誤：{str(e)}", exc_info=True)
                    skipped_records += len(batch)
            
            # 儲存匯入歷史記錄
            ImportHistory.objects.create(
                filename=filename,
                import_type=import_type,
                total_records=total_records,
                imported_records=imported_records,
                skipped_records=skipped_records
            )
            
            return {
                'success': True, 
                'message': f'成功匯入 {imported_records} 筆資料，跳過 {skipped_records} 筆資料',
                'imported': imported_records,
                'skipped': skipped_records,
                'total': total_records
            }
            
    except Exception as e:
        logger.error(f"匯入過程中發生錯誤：{str(e)}", exc_info=True)
        return {'success': False, 'error': f"匯入過程中發生錯誤：{str(e)}"}

# 處理清除單匯入
def handle_disposal_import(row, conflict_resolution, apply_to_all=False):
    try:
        # 轉換布林值欄位
        bool_fields = ['是否由貯存地起運', '聯單確認', '清除者確認', '處理者確認', '最終處置者確認']
        for field in bool_fields:
            if field in row:
                value = row[field]
                row[field] = value.upper() == 'Y' or value.upper() == 'TRUE' or value == '1'
        
        # 檢查聯單是否已存在
        manifest_id = row.get('聯單編號')
        waste_id = row.get('廢棄物ID')
        if not manifest_id or not waste_id:
            return False
            
        existing_manifest = None
        try:
            existing_manifest = DisposalManifest.objects.get(manifest_id=manifest_id, waste_id=waste_id, is_visible=True)
        except DisposalManifest.DoesNotExist:
            existing_manifest = None
        
        # 根據衝突處理方式決定如何處理
        if existing_manifest:
            if conflict_resolution == 'skip':
                return False
            elif conflict_resolution == 'replace':
                # 將現有聯單標記為不可見，然後創建新的
                existing_manifest.is_visible = False
                existing_manifest.save()
            elif conflict_resolution == 'cancel':
                # 取消整個匯入過程
                return False
        
        # 建立新的清除單記錄
        manifest = DisposalManifest(
            manifest_id=row.get('聯單編號', ''),
            company_id=row.get('事業機構代碼', ''),
            company_name=row.get('事業機構名稱', ''),
            report_date=parse_date(row.get('申報日期', None)),
            report_time=parse_time(row.get('申報時間', None)),
            transport_date=parse_date(row.get('清運日期', None)),
            transport_time=parse_time(row.get('清運時間', None)),
            waste_code=row.get('廢棄物代碼', ''),
            waste_name=row.get('廢棄物名稱', ''),
            waste_id=row.get('廢棄物ID', ''),
            reported_weight=parse_float(row.get('申報重量', 0)),
            process_code=row.get('製程代碼', ''),
            process_name=row.get('製程名稱', ''),
            from_storage=row.get('是否由貯存地起運', False),
            origin_location=row.get('起運地', ''),
            manifest_confirmation=row.get('聯單確認', False),
            carrier_vehicle=row.get('運載車號', ''),
            carrier_confirmation=row.get('清除者確認', False),
            is_visible=True,
            # 清除單特有欄位
            carrier_id=row.get('清除者代碼', ''),
            carrier_name=row.get('清除者名稱', ''),
            delivery_date=parse_date(row.get('運送日期', None)),
            delivery_time=parse_time(row.get('運送時間', None)),
            carrier_vehicle_number=row.get('清除者運載車號', ''),
            processor_id=row.get('處理者代碼', ''),
            processor_name=row.get('處理者名稱', ''),
            receive_date=parse_date(row.get('收受日期', None)),
            receive_time=parse_time(row.get('收受時間', None)),
            intermediate_treatment=row.get('中間處理方式', ''),
            processing_completion_date=parse_date(row.get('處理完成日期', None)),
            processing_completion_time=parse_time(row.get('處理完成時間', None)),
            final_disposal_method=row.get('最終處置方式', ''),
            processor_confirmation=row.get('處理者確認', False),
            processor_vehicle=row.get('處理者運載車號', ''),
            final_processor_id=row.get('最終處置者代碼', ''),
            final_processor_name=row.get('最終處置者名稱', ''),
            entry_date=parse_date(row.get('進場日期', None)),
            entry_time=parse_time(row.get('進場時間', None)),
            entry_number=row.get('進場編號', ''),
            final_processor_confirmation=row.get('最終處置者確認', False),
            final_destination=row.get('最終流向', '')
        )
        manifest.save()
        return True
    except Exception as e:
        logger.error(f"處理清除單匯入時發生錯誤: {e}", exc_info=True)
        return False

# 處理再利用單匯入
def handle_reuse_import(row, conflict_resolution, apply_to_all=False):
    try:
        # 轉換布林值欄位
        bool_fields = ['是否由貯存地起運', '聯單確認', '清除者確認', '再利用者是否確認', '產源是否已確認申報聯單內容']
        for field in bool_fields:
            if field in row:
                value = row[field]
                row[field] = value.upper() == 'Y' or value.upper() == 'TRUE' or value == '1'
        
        # 檢查聯單是否已存在
        manifest_id = row.get('聯單編號')
        waste_id = row.get('廢棄物ID')
        if not manifest_id or not waste_id:
            return False
            
        existing_manifest = None
        try:
            existing_manifest = ReuseManifest.objects.get(manifest_id=manifest_id, waste_id=waste_id, is_visible=True)
        except ReuseManifest.DoesNotExist:
            existing_manifest = None
        
        # 根據衝突處理方式決定如何處理
        if existing_manifest:
            if conflict_resolution == 'skip':
                return False
            elif conflict_resolution == 'replace':
                # 將現有聯單標記為不可見，然後創建新的
                existing_manifest.is_visible = False
                existing_manifest.save()
            elif conflict_resolution == 'cancel':
                # 取消整個匯入過程
                return False
        
        # 建立新的再利用單記錄
        manifest = ReuseManifest(
            manifest_id=row.get('聯單編號', ''),
            company_id=row.get('事業機構代碼', ''),
            company_name=row.get('事業機構名稱', ''),
            report_date=parse_date(row.get('申報日期', None)),
            report_time=parse_time(row.get('申報時間', None)),
            transport_date=parse_date(row.get('清運日期', None)),
            transport_time=parse_time(row.get('清運時間', None)),
            reported_weight=parse_float(row.get('申報重量', 0)),
            process_code=row.get('製程代碼', ''),
            process_name=row.get('製程名稱', ''),
            from_storage=row.get('是否由貯存地起運', False),
            origin_location=row.get('起運地', ''),
            manifest_confirmation=row.get('聯單確認', False),
            carrier_vehicle=row.get('運載車號', ''),
            carrier_confirmation=row.get('清除者確認', False),
            is_visible=True,
            # 再利用單特有欄位
            waste_code=row.get('物質代碼', ''),  # 使用基本欄位存物質代碼
            waste_name=row.get('物質名稱', ''),  # 使用基本欄位存物質名稱
            waste_id=row.get('廢棄物ID', ''),
            substance_code=row.get('物質代碼', ''),
            substance_name=row.get('物質名稱', ''),
            reuse_purpose=row.get('再利用用途', ''),
            reuse_purpose_description=row.get('再利用用途說明', ''),
            reuse_method=row.get('再利用方式', ''),
            carrier_id=row.get('清除者代碼', ''),
            carrier_name=row.get('清除者名稱', ''),
            other_carrier=row.get('其它清除者', ''),
            delivery_date=parse_date(row.get('運送日期', None)),
            delivery_time=parse_time(row.get('運送時間', None)),
            carrier_vehicle_number=row.get('清除者實際運載車號', ''),
            carrier_rejection_reason=row.get('清除者不接受原因', ''),
            reuser_id=row.get('再利用者代碼', ''),
            reuser_name=row.get('再利用者名稱', ''),
            other_reuser=row.get('其它再利用者', ''),
            reuser_nature=row.get('再利用者性質', ''),
            recovery_date=parse_date(row.get('回收日期', None)),
            recovery_time=parse_time(row.get('回收時間', None)),
            reuse_completion_time=parse_datetime(row.get('再利用完成時間', None)),
            reuser_confirmation=row.get('再利用者是否確認', False),
            reuser_vehicle=row.get('再利用者實際運載車號', ''),
            reuser_rejection_reason=row.get('再利用者不接受原因', ''),
            source_confirmed=row.get('產源是否已確認申報聯單內容', False)
        )
        manifest.save()
        return True
    except Exception as e:
        logger.error(f"處理再利用單匯入時發生錯誤: {e}", exc_info=True)
        return False

# 匯出CSV - 新增功能
@permission_required('importer')
def export_manifests_csv(request):
    form = ManifestFilterForm(request.GET)
    
    # 初始化查詢集 - 只查詢可見的資料
    disposal_query = DisposalManifest.objects.filter(is_visible=True)
    reuse_query = ReuseManifest.objects.filter(is_visible=True)
    
    # 套用篩選條件
    if form.is_valid():
        data = form.cleaned_data
        
        # 根據聯單類型篩選
        manifest_type = data.get('manifest_type')
        if manifest_type == 'disposal':
            reuse_query = ReuseManifest.objects.none()
        elif manifest_type == 'reuse':
            disposal_query = DisposalManifest.objects.none()
            
        # 套用其他篩選條件 (與manifest_list相同)
        # 聯單編號篩選
        manifest_id = data.get('manifest_id')
        if manifest_id:
            disposal_query = disposal_query.filter(manifest_id__icontains=manifest_id)
            reuse_query = reuse_query.filter(manifest_id__icontains=manifest_id)
            
        # 事業機構名稱篩選
        company_name = data.get('company_name')
        if company_name:
            disposal_query = disposal_query.filter(company_name__icontains=company_name)
            reuse_query = reuse_query.filter(company_name__icontains=company_name)
            
        # 廢棄物代碼篩選
        waste_code = data.get('waste_code')
        if waste_code:
            disposal_query = disposal_query.filter(waste_code__icontains=waste_code)
            reuse_query = reuse_query.filter(substance_code__icontains=waste_code)
            
        # 申報日期篩選
        report_date_from = data.get('report_date_from')
        if report_date_from:
            disposal_query = disposal_query.filter(report_date__gte=report_date_from)
            reuse_query = reuse_query.filter(report_date__gte=report_date_from)
            
        report_date_to = data.get('report_date_to')
        if report_date_to:
            disposal_query = disposal_query.filter(report_date__lte=report_date_to)
            reuse_query = reuse_query.filter(report_date__lte=report_date_to)
    
    # 創建響應
    response = HttpResponse(content_type='text/csv')
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    
    if manifest_type == 'disposal':
        response['Content-Disposition'] = f'attachment; filename="disposal_manifests_{timestamp}.csv"'
        writer = csv.writer(response)
        
        # 寫入CSV頭部
        writer.writerow([
            '聯單編號', '事業機構代碼', '事業機構名稱', '申報日期', '申報時間', 
            '清運日期', '清運時間', '廢棄物代碼', '廢棄物名稱', '廢棄物ID', 
            '申報重量', '製程代碼', '製程名稱', '是否由貯存地起運', '起運地', 
            '聯單確認', '運載車號', '清除者確認', '清除者代碼', '清除者名稱',
            '處理者代碼', '處理者名稱', '最終處置方式'
        ])
        
        # 寫入資料
        for manifest in disposal_query:
            writer.writerow([
                manifest.manifest_id, manifest.company_id, manifest.company_name,
                manifest.report_date, manifest.report_time,
                manifest.transport_date, manifest.transport_time,
                manifest.waste_code, manifest.waste_name, manifest.waste_id,
                manifest.reported_weight, manifest.process_code, manifest.process_name,
                'Y' if manifest.from_storage else 'N', manifest.origin_location,
                'Y' if manifest.manifest_confirmation else 'N', manifest.carrier_vehicle,
                'Y' if manifest.carrier_confirmation else 'N',
                manifest.carrier_id, manifest.carrier_name,
                manifest.processor_id, manifest.processor_name,
                manifest.final_disposal_method
            ])
    
    elif manifest_type == 'reuse':
        response['Content-Disposition'] = f'attachment; filename="reuse_manifests_{timestamp}.csv"'
        writer = csv.writer(response)
        
        # 寫入CSV頭部
        writer.writerow([
            '聯單編號', '事業機構代碼', '事業機構名稱', '申報日期', '申報時間', 
            '清運日期', '清運時間', '物質代碼', '物質名稱', '廢棄物ID', 
            '申報重量', '製程代碼', '製程名稱', '是否由貯存地起運', '起運地', 
            '聯單確認', '運載車號', '清除者確認', '再利用用途', '再利用方式',
            '再利用者代碼', '再利用者名稱', '產源是否已確認申報聯單內容'
        ])
        
        # 寫入資料
        for manifest in reuse_query:
            writer.writerow([
                manifest.manifest_id, manifest.company_id, manifest.company_name,
                manifest.report_date, manifest.report_time,
                manifest.transport_date, manifest.transport_time,
                manifest.substance_code, manifest.substance_name, manifest.waste_id,
                manifest.reported_weight, manifest.process_code, manifest.process_name,
                'Y' if manifest.from_storage else 'N', manifest.origin_location,
                'Y' if manifest.manifest_confirmation else 'N', manifest.carrier_vehicle,
                'Y' if manifest.carrier_confirmation else 'N',
                manifest.reuse_purpose, manifest.reuse_method,
                manifest.reuser_id, manifest.reuser_name,
                'Y' if manifest.source_confirmed else 'N'
            ])
    
    else:  # 兩種類型都匯出
        response['Content-Disposition'] = f'attachment; filename="all_manifests_{timestamp}.csv"'
        writer = csv.writer(response)
        
        # 寫入CSV頭部 - 共同欄位
        writer.writerow([
            '聯單類型', '聯單編號', '事業機構代碼', '事業機構名稱', '申報日期', '申報時間', 
            '清運日期', '清運時間', '代碼', '名稱', '廢棄物ID', 
            '申報重量', '製程代碼', '製程名稱', '是否由貯存地起運', '起運地', 
            '聯單確認', '運載車號', '清除者確認'
        ])
        
        # 寫入清除單資料
        for manifest in disposal_query:
            writer.writerow([
                '清除單', manifest.manifest_id, manifest.company_id, manifest.company_name,
                manifest.report_date, manifest.report_time,
                manifest.transport_date, manifest.transport_time,
                manifest.waste_code, manifest.waste_name, manifest.waste_id,
                manifest.reported_weight, manifest.process_code, manifest.process_name,
                'Y' if manifest.from_storage else 'N', manifest.origin_location,
                'Y' if manifest.manifest_confirmation else 'N', manifest.carrier_vehicle,
                'Y' if manifest.carrier_confirmation else 'N'
            ])
        
        # 寫入再利用單資料
        for manifest in reuse_query:
            writer.writerow([
                '再利用單', manifest.manifest_id, manifest.company_id, manifest.company_name,
                manifest.report_date, manifest.report_time,
                manifest.transport_date, manifest.transport_time,
                manifest.substance_code, manifest.substance_name, manifest.waste_id,
                manifest.reported_weight, manifest.process_code, manifest.process_name,
                'Y' if manifest.from_storage else 'N', manifest.origin_location,
                'Y' if manifest.manifest_confirmation else 'N', manifest.carrier_vehicle,
                'Y' if manifest.carrier_confirmation else 'N'
            ])
    
    return response

# 輔助函數：解析日期
def parse_date(date_str):
    if not date_str or date_str.strip() == '':
        return None
        
    formats = ['%Y/%m/%d', '%Y-%m-%d', '%Y/%m/%d %H:%M:%S', '%Y-%m-%d %H:%M:%S']
    for fmt in formats:
        try:
            return datetime.strptime(date_str, fmt).date()
        except (ValueError, TypeError):
            continue
    
    return None

# 輔助函數：解析時間
def parse_time(time_str):
    if not time_str or time_str.strip() == '':
        return None
        
    formats = ['%H:%M:%S', '%H:%M']
    for fmt in formats:
        try:
            return datetime.strptime(time_str, fmt).time()
        except (ValueError, TypeError):
            continue
    
    return None

# 輔助函數：解析日期時間
def parse_datetime(datetime_str):
    if not datetime_str or datetime_str.strip() == '':
        return None
        
    formats = ['%Y/%m/%d %H:%M:%S', '%Y-%m-%d %H:%M:%S', '%Y/%m/%d %H:%M', '%Y-%m-%d %H:%M']
    for fmt in formats:
        try:
            return datetime.strptime(datetime_str, fmt)
        except (ValueError, TypeError):
            continue
    
    return None

# 輔助函數：解析浮點數
def parse_float(value):
    if not value:
        return 0.0
        
    try:
        return float(value)
    except (ValueError, TypeError):
        return 0.0

# 根據CSV欄位名稱取得對應的模型欄位名稱
def get_model_field_name(csv_field_name):
    # 自訂映射表
    field_map = {
        '聯單編號': 'manifest_id',
        '事業機構代碼': 'company_id',
        '事業機構名稱': 'company_name',
        '申報日期': 'report_date',
        '申報時間': 'report_time',
        '清運日期': 'transport_date',
        '清運時間': 'transport_time',
        '廢棄物代碼': 'waste_code',
        '廢棄物名稱': 'waste_name',
        '廢棄物ID': 'waste_id',
        '申報重量': 'reported_weight',
        '製程代碼': 'process_code',
        '製程名稱': 'process_name',
        '是否由貯存地起運': 'from_storage',
        '起運地': 'origin_location',
        '聯單確認': 'manifest_confirmation',
        '運載車號': 'carrier_vehicle',
        '清除者確認': 'carrier_confirmation',
        # 清除單特有欄位
        '清除者代碼': 'carrier_id',
        '清除者名稱': 'carrier_name',
        '運送日期': 'delivery_date',
        '運送時間': 'delivery_time',
        '清除者運載車號': 'carrier_vehicle_number',
        '處理者代碼': 'processor_id',
        '處理者名稱': 'processor_name',
        '收受日期': 'receive_date',
        '收受時間': 'receive_time',
        '中間處理方式': 'intermediate_treatment',
        '處理完成日期': 'processing_completion_date',
        '處理完成時間': 'processing_completion_time',
        '最終處置方式': 'final_disposal_method',
        '處理者確認': 'processor_confirmation',
        '處理者運載車號': 'processor_vehicle',
        '最終處置者代碼': 'final_processor_id',
        '最終處置者名稱': 'final_processor_name',
        '進場日期': 'entry_date',
        '進場時間': 'entry_time',
        '進場編號': 'entry_number',
        '最終處置者確認': 'final_processor_confirmation',
        '最終流向': 'final_destination',
        # 再利用單特有欄位
        '物質代碼': 'substance_code',
        '物質名稱': 'substance_name',
        '再利用用途': 'reuse_purpose',
        '再利用用途說明': 'reuse_purpose_description',
        '再利用方式': 'reuse_method',
        '其它清除者': 'other_carrier',
        '清除者實際運載車號': 'carrier_vehicle_number',
        '清除者不接受原因': 'carrier_rejection_reason',
        '再利用者代碼': 'reuser_id',
        '再利用者名稱': 'reuser_name',
        '其它再利用者': 'other_reuser',
        '再利用者性質': 'reuser_nature',
        '回收日期': 'recovery_date',
        '回收時間': 'recovery_time',
        '再利用完成時間': 'reuse_completion_time',
        '再利用者是否確認': 'reuser_confirmation',
        '再利用者實際運載車號': 'reuser_vehicle',
        '再利用者不接受原因': 'reuser_rejection_reason',
        '產源是否已確認申報聯單內容': 'source_confirmed'
    }
    
    return field_map.get(csv_field_name, '')

def format_datetime_entry(entry):
    """
    Formats a datetime entry, separating date and time
    
    Args:
        entry (str): Original datetime string
    
    Returns:
        tuple: Formatted date and time (date, time)
    """
    if not entry or entry.strip() == '':
        return '', ''
    
    # Remove extra whitespace
    entry = entry.strip()
    
    # Parse the datetime
    try:
        # First, handle AM/PM conversion
        if '上午' in entry:
            entry = entry.replace('上午', '').strip()
            dt = datetime.strptime(entry, '%Y/%m/%d %I:%M:%S')
        elif '下午' in entry:
            entry = entry.replace('下午', '').strip()
            dt = datetime.strptime(entry, '%Y/%m/%d %I:%M:%S')
            # Adjust time for PM
            if dt.hour != 12:
                dt = dt.replace(hour=dt.hour + 12)
        else:
            # If no AM/PM marker, assume the time is already in 24-hour format
            dt = datetime.strptime(entry, '%Y/%m/%d %H:%M:%S')
        
        # Format date and time separately
        return dt.strftime('%Y/%m/%d'), dt.strftime('%H:%M:%S')
    
    except ValueError:
        # If parsing fails, return the original entry
        return entry, ''

def transform_waste_record(record):
    """
    Transforms the datetime entries in a waste record dictionary
    
    Args:
        record (dict): Input dictionary with waste record information
    
    Returns:
        dict: Dictionary with formatted datetime entries
    """
    # Dictionary of keys to transform
    datetime_keys = {
        '申報日期': ('申報日期', '申報時間'),
        '清運日期': ('清運日期', '清運時間'),
        '運送日期': ('運送日期', '運送時間'),
        '收受日期': ('收受日期', '收受時間'),
        '回收日期': ('回收日期', '回收時間'),
        '處理完成日期': ('處理完成日期', '處理完成時間')
    }
    
    # Create a copy of the dictionary to avoid modifying the original
    transformed_record = record.copy()
    
    # Transform specified datetime entries
    for original_key, (date_key, time_key) in datetime_keys.items():
        try:
            formatted_date, formatted_time = format_datetime_entry(record[original_key])
            transformed_record[date_key] = formatted_date
            transformed_record[time_key] = formatted_time
        except:
            continue
    
    return transformed_record

# 修改刪除聯單功能 - 變更為標記不可見
@csrf_exempt
@permission_required('importer')
def delete_manifests(request):
    """批量標記聯單為不可見"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': '僅支援POST請求'})
    
    try:
        # 解析JSON資料
        data = json.loads(request.body)
        manifests_to_delete = data.get('manifests', [])
        
        if not manifests_to_delete:
            return JsonResponse({'success': False, 'error': '未提供要移除的聯單'})
        
        deleted_count = 0
        
        with transaction.atomic():
            for manifest in manifests_to_delete:
                manifest_type = manifest.get('type')
                manifest_id = manifest.get('manifestId')
                waste_id = manifest.get('wasteId')
                
                if not all([manifest_type, manifest_id, waste_id]):
                    continue
                
                if manifest_type == 'disposal':
                    # 標記清除單為不可見
                    result = DisposalManifest.objects.filter(
                        manifest_id=manifest_id, 
                        waste_id=waste_id,
                        is_visible=True
                    ).update(is_visible=False)
                    deleted_count += result
                elif manifest_type == 'reuse':
                    # 標記再利用單為不可見
                    result = ReuseManifest.objects.filter(
                        manifest_id=manifest_id,
                        waste_id=waste_id,
                        is_visible=True
                    ).update(is_visible=False)
                    deleted_count += result
        
        return JsonResponse({
            'success': True,
            'deleted_count': deleted_count,
            'message': f'成功移除 {deleted_count} 筆聯單'
        })
        
    except Exception as e:
        return JsonResponse({'success': False, 'error': f'移除過程中發生錯誤：{str(e)}'})

# 自動完成相關視圖函數
def autocomplete_company_name(request):
    """自動完成事業機構名稱"""
    query = request.GET.get('q', '')
    
    # 從清除單和再利用單中收集唯一的公司名稱
    disposal_companies = DisposalManifest.objects.filter(
        company_name__icontains=query, 
        is_visible=True
    ).values('company_name').distinct()
    
    reuse_companies = ReuseManifest.objects.filter(
        company_name__icontains=query, 
        is_visible=True
    ).values('company_name').distinct()
    
    # 合併結果並去重
    company_names = set()
    for company in disposal_companies:
        company_names.add(company['company_name'])
    
    for company in reuse_companies:
        company_names.add(company['company_name'])
    
    # 如果查詢為空，返回所有公司名稱
    if not query:
        company_names = list(company_names)
    
    # 將結果格式化為列表字典
    results = [{'name': name} for name in sorted(list(company_names))]
    
    return JsonResponse({'results': results[:20]})  # 限制返回20個結果

def autocomplete_waste_name(request):
    """自動完成廢棄物名稱"""
    query = request.GET.get('q', '')
    
    # 從清除單和再利用單中收集唯一的廢棄物名稱
    disposal_wastes = DisposalManifest.objects.filter(
        waste_name__icontains=query,
        is_visible=True
    ).values('waste_name').distinct()
    
    reuse_wastes = ReuseManifest.objects.filter(
        substance_name__icontains=query,
        is_visible=True
    ).values('substance_name').distinct()
    
    # 合併結果並去重
    waste_names = set()
    for waste in disposal_wastes:
        waste_names.add(waste['waste_name'])
    
    for waste in reuse_wastes:
        waste_names.add(waste['substance_name'])
    
    # 如果查詢為空，返回所有廢棄物名稱
    if not query:
        waste_names = list(waste_names)
    
    # 將結果格式化為列表字典
    results = [{'name': name} for name in sorted(list(waste_names))]
    
    return JsonResponse({'results': results[:20]})  # 限制返回20個結果

def autocomplete_waste_code(request):
    """自動完成廢棄物代碼"""
    query = request.GET.get('q', '')
    
    # 從清除單和再利用單中收集唯一的廢棄物代碼
    disposal_codes = DisposalManifest.objects.filter(
        waste_code__icontains=query,
        is_visible=True
    ).values('waste_code').distinct()
    
    reuse_codes = ReuseManifest.objects.filter(
        substance_code__icontains=query,
        is_visible=True
    ).values('substance_code').distinct()
    
    # 合併結果並去重
    waste_codes = set()
    for code in disposal_codes:
        waste_codes.add(code['waste_code'])
    
    for code in reuse_codes:
        waste_codes.add(code['substance_code'])
    
    # 如果查詢為空，返回所有廢棄物代碼
    if not query:
        waste_codes = list(waste_codes)
    
    # 將結果格式化為列表字典
    results = [{'code': code} for code in sorted(list(waste_codes))]
    
    return JsonResponse({'results': results[:20]})  # 限制返回20個結果