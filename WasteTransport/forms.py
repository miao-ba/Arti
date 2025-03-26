from django import forms
from .models import DisposalManifest, ReuseManifest

class ManifestFilterForm(forms.Form):
    """聯單篩選表單 - 增強版"""
    MANIFEST_TYPE_CHOICES = [
        ('', '全部類型'),
        ('disposal', '清除單'),
        ('reuse', '再利用單'),
    ]
    
    CONFIRMATION_STATUS_CHOICES = [
        ('', '全部狀態'),
        ('confirmed', '已確認'),
        ('unconfirmed', '未確認'),
    ]
    
    manifest_type = forms.ChoiceField(
        choices=MANIFEST_TYPE_CHOICES, 
        required=False, 
        label="聯單類型",
        widget=forms.Select(attrs={'class': 'ts-select'})
    )
    
    manifest_id = forms.CharField(
        max_length=17, 
        required=False, 
        label="聯單編號",
        widget=forms.TextInput(attrs={'class': 'ts-input', 'placeholder': '請輸入聯單編號'})
    )
    
    company_name = forms.CharField(
        max_length=100, 
        required=False, 
        label="事業機構名稱",
        widget=forms.TextInput(attrs={
            'class': 'ts-input', 
            'placeholder': '請輸入事業機構名稱',
            'id': 'company_name',  # 添加ID用於自動完成功能
        })
    )
    
    waste_code = forms.CharField(
        max_length=10, 
        required=False, 
        label="廢棄物代碼",
        widget=forms.TextInput(attrs={
            'class': 'ts-input', 
            'placeholder': '請輸入廢棄物代碼',
            'id': 'waste_code',  # 添加ID用於自動完成功能
        })
    )
    
    waste_name = forms.CharField(
        max_length=100, 
        required=False, 
        label="廢棄物名稱",
        widget=forms.TextInput(attrs={
            'class': 'ts-input', 
            'placeholder': '請輸入廢棄物名稱',
            'id': 'waste_name',  # 添加ID用於自動完成功能
        })
    )
    
    report_date_from = forms.DateField(
        required=False, 
        label="申報日期從",
        widget=forms.DateInput(attrs={'class': 'ts-input', 'type': 'date'})
    )
    
    report_date_to = forms.DateField(
        required=False, 
        label="申報日期至",
        widget=forms.DateInput(attrs={'class': 'ts-input', 'type': 'date'})
    )
    
    reported_weight_above = forms.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        required=False, 
        label="申報重量高於",
        widget=forms.NumberInput(attrs={'class': 'ts-input', 'placeholder': '最小重量 (kg)', 'min': '0'})
    )
    
    reported_weight_below = forms.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        required=False, 
        label="申報重量低於",
        widget=forms.NumberInput(attrs={'class': 'ts-input', 'placeholder': '最大重量 (kg)', 'min': '0'})
    )
    
    confirmation_status = forms.ChoiceField(
        choices=CONFIRMATION_STATUS_CHOICES,
        required=False,
        label="確認狀態",
        widget=forms.Select(attrs={'class': 'ts-select'})
    )

class CSVImportForm(forms.Form):
    """CSV匯入表單"""
    IMPORT_TYPE_CHOICES = [
        ('disposal', '清除單'),
        ('reuse', '再利用單'),
    ]
    
    CONFLICT_RESOLUTION_CHOICES = [
        ('ask', '詢問如何處理'),
        ('skip', '略過重複資料'),
        ('replace', '覆蓋重複資料'),
        ('keep_both', '保留兩者'),
        ('smart_merge', '智慧合併'),
    ]
    
    csv_file = forms.FileField(
        label="CSV 檔案",
        help_text="請選擇要匯入的 CSV 檔案",
        widget=forms.FileInput(attrs={'class': 'ts-input', 'accept': '.csv'})
    )
    
    import_type = forms.ChoiceField(
        choices=IMPORT_TYPE_CHOICES,
        label="匯入類型",
        widget=forms.Select(attrs={'class': 'ts-select'})
    )
    
    conflict_resolution = forms.ChoiceField(
        choices=CONFLICT_RESOLUTION_CHOICES,
        initial='ask',
        label="衝突處理方式",
        widget=forms.Select(attrs={'class': 'ts-select'})
    )
    
    def clean_csv_file(self):
        file = self.cleaned_data.get('csv_file')
        
        if not file:
            raise forms.ValidationError("請選擇一個CSV檔案")
        
        if not file.name.endswith('.csv'):
            raise forms.ValidationError("僅支援CSV檔案格式")
            
        # 檢查檔案大小，限制為5MB
        if file.size > 5 * 1024 * 1024:
            raise forms.ValidationError("檔案大小不得超過5MB")
            
        return file