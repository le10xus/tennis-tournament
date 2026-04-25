from rest_framework.viewsets import ModelViewSet

from core.models import Match
from core.permissions import RolePermission
from core.serializers import MatchSerializer


class MatchViewSet(ModelViewSet):
    permission_classes = [RolePermission]
    serializer_class = MatchSerializer
    queryset = Match.objects.none()

    def get_queryset(self):
        qs = Match.objects.select_related("player1", "player2", "winner", "tournament")
        tournament_id = self.request.query_params.get("tournament")
        gender_type = self.request.query_params.get("gender_type")
        status = self.request.query_params.get("status")
        if tournament_id:
            qs = qs.filter(tournament_id=tournament_id)
        if gender_type:
            qs = qs.filter(gender_type=gender_type)
        if status:
            qs = qs.filter(status=status)
        return qs
