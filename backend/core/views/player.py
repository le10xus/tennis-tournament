from rest_framework.viewsets import ModelViewSet

from core.models import Player
from core.permissions import RolePermission
from core.serializers import PlayerDetailSerializer, PlayerSerializer


class PlayerViewSet(ModelViewSet):
    permission_classes = [RolePermission]
    serializer_class = PlayerSerializer
    queryset = Player.objects.none()

    def get_serializer_class(self):
        if self.action == "retrieve":
            return PlayerDetailSerializer
        return PlayerSerializer

    def get_queryset(self):
        qs = Player.objects.all()
        gender = self.request.query_params.get("gender")
        if gender:
            qs = qs.filter(gender=gender)
        return qs
