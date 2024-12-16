from django.urls import path
from . import views

urlpatterns = [
    path('', views.index, name='index'), 
    path('stats/', views.your_stats, name='your_stats'),
]
