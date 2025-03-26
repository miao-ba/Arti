from django.urls import path
from WasteManagement import views

app_name = 'WasteManagement'
urlpatterns = [
    # User Interface URL
    path('database/', views.database_index, name='database_index'),
    path('get_data/', views.get_data, name='get_data'),
    path('save_data/', views.save_data, name='save_data'),
    path('delete_data/', views.delete_data, name='delete_data'),
    path('visualize/', views.visualize_index, name='visualize_index'),
]