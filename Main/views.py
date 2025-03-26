from datetime import datetime
import pytz

from django.contrib.auth import authenticate, login, logout, update_session_auth_hash
from django.contrib.auth.models import User, Group
# from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.db import transaction
from django.http import JsonResponse
from django.shortcuts import render, redirect
from django.utils.safestring import mark_safe
from django.utils.timezone import localtime
from django.views.decorators.csrf import csrf_exempt
from .forms import PasswordChangeForm
from django.contrib.auth.decorators import login_required
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta
import json
import logging

from MedicalWasteManagementSystem.permissions import *
from WasteManagement.models import (
    GeneralWasteProduction,
    BiomedicalWasteProduction,
    DialysisBucketSoftBagProductionAndDisposalCosts,
    PharmaceuticalGlassProductionAndDisposalCosts,
    PaperIronAluminumCanPlasticAndGlassProductionAndRecyclingRevenue
)

# Create your views here.

# =============================================================
# Main Menu
# =============================================================

# Set up logging
logger = logging.getLogger(__name__)

def index(request):
    """Render the main menu page with embedded chart data aligned with frontend logic."""
    login_as_guest = request.session.get('login_as_guest', False)

    # Fetch server time in Asia/Taipei to match frontend
    now = datetime.now(pytz.utc).astimezone(pytz.timezone('Asia/Taipei'))
    current_day = now.day
    cutoff_day = 5

    # Determine end month: < 5th shows 2 months ago, >= 5th shows previous month
    if current_day < cutoff_day:
        end_month = now - relativedelta(months=2)  # 2 months ago
    else:
        end_month = now - relativedelta(months=1)  # Previous month
    display_month = end_month.strftime('%Y-%m')  # For summary data
    # Generate 12-month range ending at end_month
    start_month = end_month - relativedelta(months=11)
    last_year = []
    current = start_month
    while current <= end_month:
        last_year.append(current.strftime('%Y-%m'))
        current += relativedelta(months=1)
    logger.info(f"Server time: {now}, Display month: {display_month}, Last 12 months: {last_year}")

    # Summary data (single month)
    general = GeneralWasteProduction.objects.filter(date=display_month).first()
    biomedical = BiomedicalWasteProduction.objects.filter(date=display_month).first()
    dialysis = DialysisBucketSoftBagProductionAndDisposalCosts.objects.filter(date=display_month).first()
    phar_glass = PharmaceuticalGlassProductionAndDisposalCosts.objects.filter(date=display_month).first()
    summary_data = {
        'year': display_month.split('-')[0],
        'month': int(display_month.split('-')[1]),
        'general_tainan': general.tainan if general and general.tainan is not None else None,
        'general_renwu': general.renwu if general and general.renwu is not None else None,
        'biomed_red': biomedical.red_bag if biomedical and biomedical.red_bag is not None else None,
        'biomed_yellow': biomedical.yellow_bag if biomedical and biomedical.yellow_bag is not None else None,
        'cost_dialysis': dialysis.cost if dialysis and dialysis.cost is not None else None,
        'cost_phar_glass': phar_glass.cost if phar_glass and phar_glass.cost is not None else None
    }
    logger.info(f"Summary data: {summary_data}")

    # Helper function to pad or align data arrays to match last_year length
    def pad_data(entries, field, labels=last_year):
        entries_dict = {e.date: getattr(e, field, 0) or 0 for e in entries}
        return [entries_dict.get(label, 0) for label in labels]

    # Recycle data
    recycle_entries = PaperIronAluminumCanPlasticAndGlassProductionAndRecyclingRevenue.objects.filter(date__in=last_year).order_by('date')
    logger.info(f"Recycle entries count: {recycle_entries.count()}, Dates: {[e.date for e in recycle_entries]}")
    recycle_data = {
        'lastMonth': {
            'labels': ['紙', '鐵鋁罐', '塑膠', '玻璃'],
            'data': [getattr(recycle_entries.filter(date=display_month).first(), f, 0) or 0 for f in ['paper_produced', 'iron_aluminum_can_produced', 'plastic_produced', 'glass_produced']],
            'title': f'上月({display_month})回收物質產量'
        },
        'last12Months': {
            'labels': last_year,
            'datasets': {
                '紙': {'data': pad_data(recycle_entries, 'paper_produced'), 'color': '#FF6384'},
                '鐵鋁罐': {'data': pad_data(recycle_entries, 'iron_aluminum_can_produced'), 'color': '#36A2EB'},
                '塑膠': {'data': pad_data(recycle_entries, 'plastic_produced'), 'color': '#FFCE56'},
                '玻璃': {'data': pad_data(recycle_entries, 'glass_produced'), 'color': '#4BC0C0'}
            },
            'title': '近12月回收物質產量'
        },
        'revenue12Months': {
            'labels': last_year,
            'data': pad_data(recycle_entries, 'recycling_revenue'),
            'title': '近12月回收收入'
        }
    }

    # General waste data
    general_entries = GeneralWasteProduction.objects.filter(date__in=last_year).order_by('date')
    logger.info(f"General entries count: {general_entries.count()}, Dates: {[e.date for e in general_entries]}")
    general_data = {
        'last12Months': {
            'labels': last_year,
            'datasets': {
                '南區': {'data': pad_data(general_entries, 'tainan'), 'color': '#FF6384'},
                '仁武': {'data': pad_data(general_entries, 'renwu'), 'color': '#36A2EB'}
            },
            'total': pad_data(general_entries, 'total'),
            'title': '近12月一般事業廢棄物產量'
        }
    }

    # Biomedical waste data
    biomedical_entries = BiomedicalWasteProduction.objects.filter(date__in=last_year).order_by('date')
    dialysis_entries = DialysisBucketSoftBagProductionAndDisposalCosts.objects.filter(date__in=last_year).order_by('date')
    logger.info(f"Biomedical entries count: {biomedical_entries.count()}, Dialysis entries count: {dialysis_entries.count()}")
    biomedical_data = {
        'last12Months': {
            'labels': last_year,
            'datasets': {
                '紅袋': {'data': pad_data(biomedical_entries, 'red_bag'), 'color': '#FF6384'},
                '黃袋': {'data': pad_data(biomedical_entries, 'yellow_bag'), 'color': '#FFCE56'}
            },
            'total': pad_data(biomedical_entries, 'total'),
            'title': '近12月生物醫療廢棄物產量'
        },
        'dialysis12Months': {
            'labels': last_year,
            'datasets': {
                '洗腎桶': {'data': pad_data(dialysis_entries, 'produced_dialysis_bucket'), 'color': '#36A2EB'},
                '軟袋': {'data': pad_data(dialysis_entries, 'produced_soft_bag'), 'color': '#4BC0C0'}
            },
            'costs': pad_data(dialysis_entries, 'cost')
        }
    }

    # Pharmaceutical glass data
    phar_glass_entries = PharmaceuticalGlassProductionAndDisposalCosts.objects.filter(date__in=last_year).order_by('date')
    logger.info(f"Phar glass entries count: {phar_glass_entries.count()}, Dates: {[e.date for e in phar_glass_entries]}")
    phar_glass_data = {
        'last12Months': {
            'labels': last_year,
            'data': pad_data(phar_glass_entries, 'produced'),
            'costs': pad_data(phar_glass_entries, 'cost'),
            'title': '近12月藥用玻璃產量'
        }
    }

    # Combine all context data for template
    context = {
        'login_as_guest': login_as_guest,
        'summary_data': summary_data,
        'summary_data_json': mark_safe(json.dumps(summary_data)),
        'recycle_data_json': mark_safe(json.dumps(recycle_data)),
        'general_data_json': mark_safe(json.dumps(general_data)),
        'biomedical_data_json': mark_safe(json.dumps(biomedical_data)),
        'phar_glass_data_json': mark_safe(json.dumps(phar_glass_data))
    }
    return render(request, 'main_menu.html', context)

def server_time(request):
    current_server_time = datetime.now(pytz.utc).isoformat()  # Get server time in UTC
    return JsonResponse({"serverTime": current_server_time})


# =============================================================
# Account Interface
# =============================================================

def view_login(request):
    login_error = None

    if request.method == 'POST':
        # 檢查是否為訪客模式
        if 'login_as_guest' in request.POST and request.POST['login_as_guest'] == 'true':
            request.session['login_as_guest'] = True
            return redirect('/')

        # 處理正常登入邏輯
        username = request.POST.get('username')
        password = request.POST.get('password')
        if username and password:
            user = authenticate(request, username=username, password=password)
            if user is not None:
                login(request, user)
                # 如果是訪客模式轉正規登入，清除訪客狀態
                if 'login_as_guest' in request.session:
                    del request.session['login_as_guest']
                return redirect('/')
            else:
                login_error = "帳號或密碼錯誤，請重試。"
        else:
            login_error = "請輸入帳號和密碼。"

    # 僅當未登入且未處於訪客模式時顯示登入頁
    # 如果已登入或訪客模式，直接顯示登入頁而非強制跳轉
    return render(request, 'account/login.html', {
        'login_error': login_error
    })

def logout_guest(request):
    if 'login_as_guest' in request.session:
        del request.session['login_as_guest']
    return redirect('/account/login')

def view_logout(request):
    logout(request)
    return redirect('main')

# def view_setting(request):
#     form = PasswordChangeForm(user=request.user)  # 確保 form 存在
#     return render(request, 'account/setting.html', {"form": form})

# 修改自己的密碼
@login_required
def change_password(request):
    if request.method == "POST":
        print("Request POST Data:", request.POST.dict())  # 檢查 POST 內容
        form = PasswordChangeForm(user=request.user, data=request.POST)
        if form.is_valid():
            user = form.save()
            update_session_auth_hash(request, user)  # 避免修改密碼後登出
            return JsonResponse({"success": True})  # 成功回傳 JSON

        # 失敗時回傳 JSON 錯誤訊息
        errors = {field: errors for field, errors in form.errors.items()}
        return JsonResponse({"success": False, "errors": errors}, status=400)

    form = PasswordChangeForm(user=request.user)
    return render(request, "account/setting.html", {"form": form})

# 左側帳號選單欄
@permission_required('moderator')
def view_account_manage_list(request):
    # 定義群組名稱的順序及其對應的圖示
    permission_order = ['root', 'moderator', 'staff', 'registrar', 'importer']
    permission_icons = {
        'root': 'gear',
        'moderator': 'user-shield',
        'staff': 'users',
        'registrar': 'file-pen',
        'importer': 'file-import',
    }

    # 查詢群組，並在 Python 中排序
    permissions = Group.objects.filter(name__in=permission_order)
    groups = sorted(permissions, key=lambda g: permission_order.index(g.name))

    # 建立群組與成員的映射
    permission_types = {group.name: group.user_set.all() for group in groups}

    # 確保所有群組名稱都存在於字典中，即使成員為空
    permission_types = {name: permission_types.get(name, []) for name in permission_order}

    # print(permission_types)  # 確認群組名稱
    # print(permission_icons)   # 確認圖標對應的字典

    # 傳遞至模板
    return render(request, 'account/manage.html', {
        'permission_icons': permission_icons,
        'permission_types': permission_types,
        'current_user': request.user
    })

# 右側帳號資訊欄/個人帳號管理帳號資訊
@login_required
def view_account_manage_info(request, account_id):
    user_level = get_permission_hi(request.user, id=True)
    print(account_id, user_level)
    if request.user.username == account_id or user_level >= GROUP_HIERARCHY["moderator"]:
        try:
            account = User.objects.get(username=account_id)
            account_data = {
                'username': account.username,
                'first_name': account.first_name,
                'last_name': account.last_name,
                'group': account.groups.first().name if account.groups.exists() else "",
                'is_superuser': account.is_superuser,
                'is_staff': account.is_staff,
                'date_joined': localtime(account.date_joined).strftime("%Y-%m-%d %H:%M:%S.%f %z"),
                'last_login': localtime(account.last_login).strftime("%Y-%m-%d %H:%M:%S.%f %z"),
            }
            return JsonResponse(account_data)
        except User.DoesNotExist:
            return JsonResponse({'error': 'Account not found'}, status=404)
    else:
        return JsonResponse({'error': 'Permission denied'}, status=403)

# 帳號刪除
@csrf_exempt
@permission_required('moderator')
def delete_account(request, username):
    if request.method == 'DELETE':
        try:
            with transaction.atomic():  # 使用交易確保一致性
                current_user = request.user
                target_user = User.objects.get(username=username)

                if target_user == current_user:
                    return JsonResponse({'success': False, 'error': '不能刪除自己的帳號'}, status=403)

                current_user_group_name = current_user.groups.first().name if current_user.groups.exists() else None
                target_user_group_name = target_user.groups.first().name if target_user.groups.exists() else None

                if current_user_group_name not in GROUP_HIERARCHY or target_user_group_name not in GROUP_HIERARCHY:
                    return JsonResponse({'success': False, 'error': '群組配置無效，請聯繫管理員'}, status=500)

                if GROUP_HIERARCHY[current_user_group_name] <= GROUP_HIERARCHY[target_user_group_name]:
                    return JsonResponse({'success': False, 'error': '權限不足，無法刪除此帳號'}, status=403)

                target_user.delete()
                return JsonResponse({'success': True})

        except User.DoesNotExist:
            return JsonResponse({'success': False, 'error': '目標帳號不存在'}, status=404)
        except Exception as e:
            # 記錄其他異常並返回錯誤
            print(f"刪除帳戶時發生錯誤：{e}")
            return JsonResponse({'success': False, 'error': '伺服器內部錯誤'}, status=500)
    return JsonResponse({'success': False, 'error': '無效的請求方法'}, status=405)

@permission_required('moderator')
def view_account_register(request):
    if request.method == 'POST':
        username = request.POST.get('username')
        email = request.POST.get('email')
        first_name = request.POST.get('first_name')
        last_name = request.POST.get('last_name')
        password = request.POST.get('password')
        permission = request.POST.get('permission')

        # print(username, email, first_name, last_name)
        # print(password, permission)

        # 檢查必填項目
        if not username or not password or not permission:
            return JsonResponse({'success': False, 'error': '請填寫所有必填項目！'})

        try:
            # 創建用戶
            user = User.objects.create_user(
                username=username,
                email=email,
                first_name=first_name,
                last_name=last_name,
                password=password
            )

            # 確認群組是否存在並分配
            user_permission = Group.objects.get(name=permission)
            user.groups.add(user_permission)

            return JsonResponse({'success': True})
        except (Exception, ValidationError) as e:
            # 返回錯誤訊息
            return JsonResponse({'success': False, 'error': str(e)})

    # 動態調整下拉選單
    user = request.user
    permission_options = []
    if user.groups.filter(name='root').exists():
        permission_options = ['moderator', 'staff', 'registrar', 'importer']
    elif user.groups.filter(name='moderator').exists():
        permission_options = ['registrar', 'importer']

    return render(request, 'account/register.html', {'permission_options': permission_options})