from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView, TokenVerifyView

from core.views.auth import CustomTokenObtainPairView, RegisterView

urlpatterns = [
    path("token/", CustomTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("token/verify/", TokenVerifyView.as_view(), name="token_verify"),
    path("register/", RegisterView.as_view(), name="register"),
]
