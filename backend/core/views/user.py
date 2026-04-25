from django.contrib.auth import get_user_model
from rest_framework.viewsets import ModelViewSet

from core.permissions import IsAdminUser
from core.serializers.user import UserSerializer

User = get_user_model()


class UserViewSet(ModelViewSet):
    permission_classes = [IsAdminUser]
    serializer_class = UserSerializer

    def get_queryset(self):
        return User.objects.select_related("player").order_by("-date_joined")
