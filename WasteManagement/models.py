# 單位：
#     metric_ton: 公噸
#     kilogram: 公斤
#     new_taiwan_dollar: 新台幣(NTD/TWD)

from django.db import models

class GeneralWasteProduction(models.Model): # 一般事業廢棄物產出表
    date = models.CharField(max_length=7, primary_key=True) # YYYY-MM
    tainan = models.FloatField(null=True, blank=True)
    renwu = models.FloatField(null=True, blank=True)
    total = models.FloatField(null=True, blank=True)

    class Meta:
        db_table = 'general_waste_production'

    # 欄位名稱與單位定義
    FIELD_INFO = {
        'tainan': {'name': '南區一般事業廢棄物產量', 'unit': 'metric_ton'},
        'renwu': {'name': '仁武一般事業廢棄物產量', 'unit': 'metric_ton'},
        'total': {'name': '一般事業廢棄物總產量', 'unit': 'metric_ton'},
    }

class BiomedicalWasteProduction(models.Model): # 生物醫療廢棄物產出表
    date = models.CharField(max_length=7, primary_key=True) # YYYY-MM
    red_bag = models.FloatField(null=True, blank=True)
    yellow_bag = models.FloatField(null=True, blank=True)
    total = models.FloatField(null=True, blank=True)

    class Meta:
        db_table = 'biomedical_waste_production'

    # 欄位名稱與單位定義
    FIELD_INFO = {
        'red_bag': {'name': '紅袋生物醫療廢棄物產量', 'unit': 'metric_ton'},
        'yellow_bag': {'name': '黃袋生物醫療廢棄物產量', 'unit': 'metric_ton'},
        'total': {'name': '生物醫療廢棄物總產量', 'unit': 'metric_ton'},
    }

class DialysisBucketSoftBagProductionAndDisposalCosts(models.Model): # 洗腎桶軟袋產出及處理費用表
    date = models.CharField(max_length=7, primary_key=True) # YYYY-MM
    produced_dialysis_bucket = models.FloatField(null=True, blank=True)
    produced_soft_bag = models.FloatField(null=True, blank=True)
    cost = models.IntegerField(null=True, blank=True)

    class Meta:
        db_table = 'dialysis_bucket_soft_bag_production_and_disposal_costs'

    # 欄位名稱與單位定義
    FIELD_INFO = {
        'produced_dialysis_bucket': {'name': '洗腎桶產出', 'unit': 'kilogram'},
        'produced_soft_bag': {'name': '軟袋產出', 'unit': 'kilogram'},
        'cost': {'name': '洗腎桶軟袋處理費用', 'unit': 'new_taiwan_dollar'},
    }

class PharmaceuticalGlassProductionAndDisposalCosts(models.Model): # 藥用玻璃產出及處理費用表
    date = models.CharField(max_length=7, primary_key=True) # YYYY-MM
    produced = models.FloatField(null=True, blank=True)
    cost = models.IntegerField(null=True, blank=True)

    class Meta:
        db_table = 'pharmaceutical_glass_production_and_disposal_costs'

    # 欄位名稱與單位定義
    FIELD_INFO = {
        'produced': {'name': '藥用玻璃產量', 'unit': 'kilogram'},
        'cost': {'name': '藥用玻璃處理費用', 'unit': 'new_taiwan_dollar'},
    }

class PaperIronAluminumCanPlasticAndGlassProductionAndRecyclingRevenue(models.Model): # 紙鐵鋁罐塑膠玻璃產出及回收收入表
    date = models.CharField(max_length=7, primary_key=True) # YYYY-MM
    paper_produced = models.FloatField(null=True, blank=True)
    iron_aluminum_can_produced = models.FloatField(null=True, blank=True)
    plastic_produced = models.FloatField(null=True, blank=True)
    glass_produced = models.FloatField(null=True, blank=True)
    recycling_revenue = models.IntegerField(null=True, blank=True)

    class Meta:
        db_table = 'paper_iron_aluminum_can_plastic_and_glass_production_and_recycling_revenue'

    # 欄位名稱與單位定義
    FIELD_INFO = {
        'paper_produced': {'name': '紙產量', 'unit': 'kilogram'},
        'iron_aluminum_can_produced': {'name': '鐵鋁罐產量', 'unit': 'kilogram'},
        'plastic_produced': {'name': '塑膠產量', 'unit': 'kilogram'},
        'glass_produced': {'name': '玻璃產量', 'unit': 'kilogram'},
        'recycling_revenue': {'name': '回收收入', 'unit': 'new_taiwan_dollar'},
    }