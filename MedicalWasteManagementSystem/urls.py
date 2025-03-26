"""
URL configuration for MedicalWasteManagementSystem project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include

import Main.views

urlpatterns = [
    # Main menu interfaces & APIs
    path('', Main.views.index, name='main'),
    path('time/', Main.views.server_time, name='server_time'),
    # Othe pages' interfaces & APIs
    path('admin/', admin.site.urls),
    path('account/', include('Main.urls', namespace='account'), name='account'),
    path('transport/', include('WasteTransport.urls', namespace='transport'), name='transport'),
    path('management/', include('WasteManagement.urls', namespace='management'), name='management'),
]
