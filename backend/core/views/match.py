from django.db.models import Q
from rest_framework.viewsets import ModelViewSet

from core.models import Match
from core.permissions import RolePermission
from core.serializers import MatchSerializer


class MatchViewSet(ModelViewSet):
    permission_classes = [RolePermission]
    serializer_class = MatchSerializer
    queryset = Match.objects.none()

    def get_queryset(self):
        qs = Match.objects.select_related(
            "player1", "pair1_player2", "player2", "pair2_player2", "winner", "tournament"
        )
        tournament_id = self.request.query_params.get("tournament")
        gender_type = self.request.query_params.get("gender_type")
        status = self.request.query_params.get("status")
        player_id = self.request.query_params.get("player")

        if tournament_id:
            qs = qs.filter(tournament_id=tournament_id)
        if gender_type:
            qs = qs.filter(gender_type=gender_type)
        if status:
            qs = qs.filter(status=status)
        if player_id:
            # игрок может быть в любом из четырёх слотов (одиночный и парный)
            qs = qs.filter(
                Q(player1_id=player_id)
                | Q(pair1_player2_id=player_id)
                | Q(player2_id=player_id)
                | Q(pair2_player2_id=player_id)
            )
        return qs
