from django.contrib import admin
from django.db import connection
from django.urls import include, path, re_path
from django.views.generic import TemplateView
from rest_framework.decorators import api_view
from rest_framework.response import Response


@api_view(["GET"])
def ping(_request):
    with connection.cursor() as cursor:
        cursor.execute("SELECT 1")
        (db_value,) = cursor.fetchone()
    return Response({"status": "ok", "db": db_value})


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/ping/", ping),
    path("api/auth/", include("core.auth_urls")),
    path("api/", include("core.urls")),
    re_path(r"^(?!api/|admin/|static/).*$", TemplateView.as_view(template_name="index.html")),
]
