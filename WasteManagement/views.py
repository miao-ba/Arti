from django.shortcuts import render
from django.db.models import Q
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.db import transaction, OperationalError
from WasteManagement.models import *
from MedicalWasteManagementSystem.permissions import *
from datetime import datetime
from dateutil import relativedelta
import json
import time
import logging
import sqlite3

# Set up logging
logger = logging.getLogger(__name__)

TABLE_MAPPING = {
    "general_waste_production": GeneralWasteProduction,
    "biomedical_waste_production": BiomedicalWasteProduction,
    "dialysis_bucket_soft_bag_production_and_disposal_costs": DialysisBucketSoftBagProductionAndDisposalCosts,
    "pharmaceutical_glass_production_and_disposal_costs": PharmaceuticalGlassProductionAndDisposalCosts,
    "paper_iron_aluminum_can_plastic_and_glass_production_and_recycling_revenue": PaperIronAluminumCanPlasticAndGlassProductionAndRecyclingRevenue
}

# Retry decorator for database operations
def retry_on_lock(func, max_retries=999999, delay=0.5):
    def wrapper(*args, **kwargs):
        for attempt in range(max_retries):
            try:
                with transaction.atomic():
                    return func(*args, **kwargs)
            except OperationalError as e:
                if "database is locked" in str(e):
                    logger.warning(f"Database locked in {func.__name__}, attempt {attempt + 1}/{max_retries}")
                    if attempt < max_retries - 1:
                        time.sleep(delay)
                        continue
                raise e
        logger.error(f"Failed to execute {func.__name__} after {max_retries} attempts due to persistent lock")
        raise OperationalError("Database remained locked after maximum retries")
    return wrapper

@permission_required("registrar")
def database_index(request):
    table_name = request.POST.get("table") or request.GET.get("table", "general_waste_production")
    model, fields, field_info = get_model_info(table_name)

    start_date = request.POST.get("start_date", "") or ""
    end_date = request.POST.get("end_date", "") or ""
    edit_date = request.POST.get("edit_date") if request.method == "POST" and request.POST.get("action") in ["edit", "save"] else None
    adding = request.method == "POST" and request.POST.get("action") == "add"
    error = None

    is_ajax = request.headers.get('X-Requested-With') == 'XMLHttpRequest'

    if request.method == "POST" and not is_ajax:
        action = request.POST.get("action")
        if action == "delete":
            dates = request.POST.getlist("selected_dates")
            if dates:
                delete_data_logic(table_name, dates)
        elif action == "filter":
            start_date = request.POST.get("start_date", "")
            end_date = request.POST.get("end_date", "")
        elif action == "clear":
            start_date = end_date = ""
        elif action == "edit":
            edit_date = request.POST.get("edit_date")
        elif action == "add":
            adding = True
        elif action == "cancel":
            adding = False
            edit_date = None
        elif action == "save":
            date = request.POST.get("new_date") or request.POST.get("edit_date")
            if not validate_date_format(date):
                error = "日期必須為 YYYY-MM 格式"
            elif model.objects.filter(date=date).exists() and date != request.POST.get("edit_date", ""):
                error = f"日期 {date} 已存在"
                edit_date = request.POST.get("edit_date")
                if not edit_date:
                    adding = True
            else:
                defaults = {}
                for field in fields:
                    value = request.POST.get(f"new_{field}") or request.POST.get(f"edit_{field}")
                    if value:
                        defaults[field] = float(value) if isinstance(model._meta.get_field(field), models.FloatField) else int(value)
                    elif value == "":
                        defaults[field] = None
                model.objects.update_or_create(date=date, defaults=defaults)
                adding = False
                edit_date = None

    data = list(model.objects.filter(
        Q(date__gte=start_date) if start_date else Q(),
        Q(date__lte=end_date) if end_date else Q()
    ).order_by('date').values("date", *fields)) if model else []

    return render(request, 'management/database.html', {
        "data": data,
        "fields": fields,
        "field_info": field_info,
        "selected_table": table_name,
        "start_date": start_date,
        "end_date": end_date,
        "edit_date": edit_date,
        "adding": adding,
        "error": error
    })


# Ensure save_data still triggers override detection (unchanged from last version)
@csrf_exempt
def save_data(request):
    if request.method != "POST":
        return JsonResponse({"success": False, "error": "無效請求"})

    @retry_on_lock
    def save_logic(data):
        table_name = data.get("table")
        model, fields, field_info = get_model_info(table_name)
        if not model:
            raise ValueError("無效的表格名稱")

        date = data.get("date")
        original_date = data.get("original_date", "")
        if not validate_date_format(date):
            raise ValueError("日期必須為 YYYY-MM 格式")

        # Explicitly check for conflict
        if model.objects.filter(date=date).exists() and date != original_date:
            print(f"save_data: Conflict detected - date={date} exists, original_date={original_date}")
            return {"success": False, "error": f"日期 {date} 已存在"}

        field_map = {v['name']: k for k, v in field_info.items()}
        defaults = {}
        for field in fields:
            value = data.get(field) or data.get(field_info[field]['name'])
            if value:
                if isinstance(model._meta.get_field(field), models.FloatField):
                    defaults[field] = float(value)
                elif isinstance(model._meta.get_field(field), models.IntegerField):
                    defaults[field] = int(value)
            elif value == "":
                defaults[field] = None

        if original_date and original_date != date:
            model.objects.filter(date=original_date).delete()
        model.objects.update_or_create(date=date, defaults=defaults)
        print(f"save_data: Saved data for date={date}")
        return {"success": True}

    try:
        data = json.loads(request.body.decode('utf-8'))
        print(f"save_data: Received data - {data}")
        result = save_logic(data)
        print(f"save_data: Result - {result}")
        return JsonResponse(result)
    except json.JSONDecodeError:
        print("save_data: Invalid JSON data")
        return JsonResponse({"success": False, "error": "無效的 JSON 數據"})
    except ValueError as e:
        print(f"save_data: ValueError - {str(e)}")
        return JsonResponse({"success": False, "error": str(e)})
    except Exception as e:
        print(f"save_data: Unexpected error - {str(e)}")
        return JsonResponse({"success": False, "error": "伺服器錯誤"})


@csrf_exempt
def delete_data(request):
    if request.method != "POST":
        return JsonResponse({"success": False, "error": "無效請求"})

    @retry_on_lock
    def delete_logic(data):
        table_name = data.get("table")
        dates = data.get("dates", [])
        if not dates:
            raise ValueError("未選擇任何資料進行刪除")

        model, _, _ = get_model_info(table_name)
        if not model:
            raise ValueError("無效的表格名稱")

        deleted_data = list(model.objects.filter(date__in=dates).values('date', *model.FIELD_INFO.keys()))
        deleted_count = model.objects.filter(date__in=dates).delete()[0]

        if deleted_count != len(dates):
            raise ValueError("部分資料未能成功刪除")

        return {"success": True, "deleted_data": deleted_data}

    try:
        data = json.loads(request.body.decode('utf-8'))
        logger.debug(f"Received delete_data request: {data}")
        result = delete_logic(data)
        logger.debug("delete_data completed successfully")
        return JsonResponse(result)
    except json.JSONDecodeError:
        logger.error("Invalid JSON data received")
        return JsonResponse({"success": False, "error": "無效的 JSON 數據"})
    except ValueError as e:
        logger.error(f"Value error in delete_data: {str(e)}")
        return JsonResponse({"success": False, "error": str(e)})
    except Exception as e:
        logger.error(f"Unexpected error in delete_data: {str(e)}")
        return JsonResponse({"success": False, "error": "伺服器錯誤"})

@csrf_exempt  # Temporarily added to rule out CSRF issues
def get_data(request):
    table_name = request.GET.get("table")
    date = request.GET.get("date")
    model, fields, _ = get_model_info(table_name)
    if not model or not date:
        print(f"get_data: Invalid parameters - table={table_name}, date={date}")  # Temporary print
        return JsonResponse({"success": False, "error": "無效的請求參數"})
    try:
        record = model.objects.filter(date=date).values("date", *fields).first()
        if record:
            print(f"get_data: Found record for table={table_name}, date={date}")  # Temporary print
            return JsonResponse(record)
        print(f"get_data: No data found for table={table_name}, date={date}")  # Temporary print
        return JsonResponse({"success": False, "error": "資料不存在"})
    except Exception as e:
        print(f"get_data: Error - table={table_name}, date={date}, error={str(e)}")  # Temporary print
        return JsonResponse({"success": False, "error": f"伺服器錯誤: {str(e)}"})

def delete_data_logic(table_name, dates):
    model, _, _ = get_model_info(table_name)
    if model and dates:
        valid_dates = [d for d in dates if validate_date_format(d)]
        if valid_dates:
            try:
                model.objects.filter(date__in=valid_dates).delete()
            except sqlite3.OperationalError as e:
                print(f"Database error in delete: {e}")
                raise

def validate_date_format(date_str):
    if not isinstance(date_str, str) or date_str == '' or date_str.lower() == 'none':
        return False
    date_str = date_str.strip()
    if len(date_str) != 7 or date_str[4] != '-' or not date_str[:4].isdigit() or not date_str[5:].isdigit():
        return False
    try:
        year = int(date_str[:4])
        month = int(date_str[5:])
        return 1 <= month <= 12 and 1970 <= year <= 9999
    except ValueError:
        return False

def get_model_info(table_name):
    model = TABLE_MAPPING.get(table_name)
    if model and hasattr(model, 'FIELD_INFO'):
        fields = list(model.FIELD_INFO.keys())
        field_info = model.FIELD_INFO
        return model, fields, field_info
    return None, [], {}

def visualize_index(request):
    """Handle visualization requests: render page for GET, process chart data for POST."""
    if request.method == 'GET':
        try:
            fields = {}
            for table_name, model_class in TABLE_MAPPING.items():
                if hasattr(model_class, 'FIELD_INFO'):
                    fields[table_name] = model_class.FIELD_INFO
            context = {'fields': json.dumps(fields, ensure_ascii=False)}
            logger.debug(f"Fields sent to template: {json.dumps(fields, ensure_ascii=False, indent=2)}")
            return render(request, 'management/visualize.html', context)
        except Exception as e:
            logger.error(f"GET error: {str(e)}", exc_info=True)
            return render(request, 'management/visualize.html', {'fields': json.dumps({})})

    elif request.method == 'POST':
        try:
            data = json.loads(request.body)
            chart_type = data.get('chart_type')
            y_axis = data.get('y_axis')
            x_axis = data.get('x_axis')
            datasets = data.get('datasets', [])
            title = data.get('title')
            show_values = data.get('show_values', False)

            if not all([chart_type, y_axis, x_axis, datasets]):
                logger.warning("Missing required fields in POST.")
                return JsonResponse({'success': False, 'error': '缺少必要欄位'})

            all_start_dates = [d['start_date'][:7] for d in datasets]
            all_end_dates = [d['end_date'][:7] for d in datasets]
            global_start = min(all_start_dates)
            global_end = max(all_end_dates)
            global_labels = generate_date_range(global_start, global_end, x_axis)

            chart_data = []
            for dataset in datasets:
                table = dataset.get('table')
                field = dataset.get('field')
                start_date = dataset.get('start_date')
                end_date = dataset.get('end_date')
                model_class = TABLE_MAPPING.get(table)

                if not model_class or not hasattr(model_class, 'FIELD_INFO') or field not in model_class.FIELD_INFO:
                    logger.warning(f"Invalid table ({table}) or field ({field}).")
                    continue

                field_info = model_class.FIELD_INFO
                row_data = process_data_row(model_class, field_info, y_axis, start_date, end_date, x_axis, field)
                aligned_data = [
                    row_data['data'][row_data['labels'].index(label)] if label in row_data['labels'] else 0
                    for label in global_labels
                ]
                aligned_raw_data = [
                    row_data['raw_data'][row_data['labels'].index(label)] if label in row_data['labels'] else 0
                    for label in global_labels
                ]
                chart_data.append({
                    'name': dataset.get('name', f"{field_info[field]['name']} ({start_date[:7]} 至 {end_date[:7]})"),
                    'data': aligned_data,
                    'raw_data': aligned_raw_data,
                    'unit': field_info[field]['unit'],
                    'color': dataset.get('color', '#000000'),
                })

            # Handle percentage conversion
            if 'percentage' in y_axis and chart_type not in ['pie', 'donut']:
                total_sums = [sum(row['data'][i] for row in chart_data) for i in range(len(global_labels))]
                for row in chart_data:
                    row['data'] = [
                        round(row['data'][i] / total_sums[i] * 100, 2) if total_sums[i] else 0
                        for i in range(len(global_labels))
                    ]

            response = {
                'success': True,
                'chart_type': chart_type,
                'x_axis_labels': global_labels,
                'series': chart_data,
                'title': title or f"廢棄物報表 ({y_axis} vs {x_axis})",
                'show_values': show_values,
            }
            logger.debug(f"Response: {json.dumps(response, ensure_ascii=False, indent=2)}")
            return JsonResponse(response)

        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON: {str(e)}")
            return JsonResponse({'success': False, 'error': '無效的 JSON 數據'})
        except Exception as e:
            logger.error(f"POST error: {str(e)}", exc_info=True)
            return JsonResponse({'success': False, 'error': f'伺服器錯誤: {str(e)}'})

    return JsonResponse({'success': False, 'error': '不支持的請求方法'})


def get_unit_from_y_axis(y_axis):
    """Extract the base unit from the Y-axis selection for standardization."""
    if y_axis == 'metric_ton':
        return 'metric_ton'
    elif y_axis == 'kilogram':
        return 'kilogram'
    elif y_axis == 'new_taiwan_dollar':
        return 'new_taiwan_dollar'
    elif y_axis == 'weight_percentage':
        return 'kilogram'
    elif y_axis == 'weight_percentage_metric_ton':
        return 'metric_ton'
    elif y_axis == 'weight_percentage_kilogram':
        return 'kilogram'
    elif y_axis == 'cost_percentage_new_taiwan_dollar':
        return 'new_taiwan_dollar'
    return None


def standardize_value(from_unit, value, to_unit):
    """Convert a value from its original unit to the target unit with rounding."""
    if from_unit == to_unit:
        return round(value, 2)
    if from_unit == 'metric_ton' and to_unit == 'kilogram':
        return round(value * 1000, 2)
    if from_unit == 'kilogram' and to_unit == 'metric_ton':
        return round(value / 1000, 2)
    return round(value, 2)


def generate_date_range(start_date, end_date, x_axis):
    """Generate X-axis labels based on date range and aggregation type."""
    start_date = start_date[:7]
    end_date = end_date[:7]
    start = datetime.strptime(start_date, '%Y-%m')
    end = datetime.strptime(end_date, '%Y-%m')
    labels = []
    current = start
    x_axis_base = x_axis.split('_')[0] if '_' in x_axis else x_axis
    while current <= end:
        if x_axis_base == 'year':
            label = str(current.year)
        elif x_axis_base == 'quarter':
            quarter = (current.month - 1) // 3 + 1
            label = f"{current.year}-Q{quarter}"
        elif x_axis_base == 'month':
            label = current.strftime('%Y-%m')
        else:  # only_month
            label = current.strftime('%m')
        if label not in labels:
            labels.append(label)
        if x_axis_base == 'year':
            current = current.replace(year=current.year + 1)
        elif x_axis_base == 'quarter':
            current += relativedelta.relativedelta(months=3)
        else:
            current += relativedelta.relativedelta(months=1)
    return labels


def process_data_row(model_class, field_info, y_axis, start_date, end_date, x_axis, selected_field):
    """Aggregate data for a single dataset, returning raw and standardized values."""
    y_axis_unit = get_unit_from_y_axis(y_axis)
    field_unit = field_info[selected_field]['unit']
    if field_unit not in ['metric_ton', 'kilogram', 'new_taiwan_dollar']:
        return {'data': [], 'raw_data': [], 'labels': []}

    start_date = start_date[:7]
    end_date = end_date[:7]
    records = model_class.objects.filter(date__gte=start_date, date__lte=end_date).values('date', selected_field)
    grouped_data = {}
    raw_grouped_data = {}
    count_per_group = {}
    for record in records:
        value = record.get(selected_field)
        if value is not None:
            standardized_value = standardize_value(field_unit, value, y_axis_unit)
            date_str = record['date']
            x_axis_base = x_axis.split('_')[0] if '_' in x_axis else x_axis
            if x_axis_base == 'year':
                label = date_str[:4]
            elif x_axis_base == 'quarter':
                month = int(date_str[5:7])
                quarter = (month - 1) // 3 + 1
                label = f"{date_str[:4]}-Q{quarter}"
            elif x_axis_base == 'month':
                label = date_str
            else:  # only_month
                label = date_str[5:7]
            grouped_data[label] = grouped_data.get(label, 0) + standardized_value
            raw_grouped_data[label] = raw_grouped_data.get(label, 0) + value
            count_per_group[label] = count_per_group.get(label, 0) + 1

    x_axis_labels = generate_date_range(start_date, end_date, x_axis)
    series_data = []
    raw_series_data = []
    for label in x_axis_labels:
        value = grouped_data.get(label, 0)
        raw_value = raw_grouped_data.get(label, 0)
        if x_axis.endswith('avg') and value != 0:
            count = count_per_group.get(label, 1)
            series_data.append(round(value / count, 2))
            raw_series_data.append(round(raw_value / count, 2))
        else:
            series_data.append(round(value, 2))
            raw_series_data.append(round(raw_value, 2))
    return {'data': series_data, 'raw_data': raw_series_data, 'labels': x_axis_labels}