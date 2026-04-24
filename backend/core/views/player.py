from rest_framework.viewsets import ModelViewSet

from core.models import Player
from core.serializers import PlayerSerializer


class PlayerViewSet(ModelViewSet):
    serializer_class = PlayerSerializer
    queryset = Player.objects.none()

    def get_queryset(self):
        qs = Player.objects.all()
        gender = self.request.query_params.get("gender")
        if gender:
            qs = qs.filter(gender=gender)
        return qs
