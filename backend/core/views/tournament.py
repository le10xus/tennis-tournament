from django.db.models import Count
from rest_framework.viewsets import ModelViewSet

from core.models import Tournament, TournamentRegistration
from core.serializers import TournamentSerializer, TournamentRegistrationSerializer


class TournamentViewSet(ModelViewSet):
    serializer_class = TournamentSerializer
    queryset = Tournament.objects.none()

    def get_queryset(self):
        qs = Tournament.objects.annotate(players_count=Count("players"))
        status = self.request.query_params.get("status")
        gender_type = self.request.query_params.get("gender_type")
        if status:
            qs = qs.filter(status=status)
        if gender_type:
            qs = qs.filter(gender_type=gender_type)
        return qs


class TournamentRegistrationViewSet(ModelViewSet):
    serializer_class = TournamentRegistrationSerializer
    queryset = TournamentRegistration.objects.none()

    def get_queryset(self):
        qs = TournamentRegistration.objects.select_related("player", "tournament")
        tournament_id = self.request.query_params.get("tournament")
        player_id = self.request.query_params.get("player")
        if tournament_id:
            qs = qs.filter(tournament_id=tournament_id)
        if player_id:
            qs = qs.filter(player_id=player_id)
        return qs
