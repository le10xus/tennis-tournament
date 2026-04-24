from django.contrib import admin
from django.db import connection
from django.urls import include, path
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
]
