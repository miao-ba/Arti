from django.apps import AppConfig


class WastetransportConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'WasteTransport'
    verbose_name = '聯單管理'
    
    def ready(self):
        # Import signals if you have any
        pass