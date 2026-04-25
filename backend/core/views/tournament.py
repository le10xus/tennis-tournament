from math import ceil, log2

from django.db.models import Count, F
from rest_framework import status as http_status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from core.models import Match, Tournament, TournamentRegistration
from core.permissions import RolePermission
from core.serializers import TournamentSerializer, TournamentRegistrationSerializer
from core.serializers.match import MatchSerializer


class TournamentViewSet(ModelViewSet):
    permission_classes = [RolePermission]
    serializer_class = TournamentSerializer
    queryset = Tournament.objects.none()

    def get_queryset(self):
        qs = Tournament.objects.annotate(players_count=Count("players"))
        status_param = self.request.query_params.get("status")
        gender_type = self.request.query_params.get("gender_type")
        if status_param:
            qs = qs.filter(status=status_param)
        if gender_type:
            qs = qs.filter(gender_type=gender_type)
        return qs

    @action(detail=True, methods=["post"], url_path="generate_bracket")
    def generate_bracket(self, request, pk=None):
        user = request.user
        if not (user.is_staff or getattr(user, "role", "player") == "organizer"):
            return Response({"detail": "Недостаточно прав."}, status=403)

        tournament = self.get_object()

        regs = list(
            TournamentRegistration.objects
            .filter(tournament=tournament)
            .select_related("player")
            .order_by(F("seed").asc(nulls_last=True), "registered_at")
        )
        players = [r.player for r in regs]
        n = len(players)

        if n < 2:
            return Response({"detail": "Нужно минимум 2 игрока."}, status=400)

        Match.objects.filter(tournament=tournament).delete()

        if tournament.format == Tournament.Format.ROUND_ROBIN:
            matches = self._gen_round_robin(tournament, players)
        else:
            matches = self._gen_single_elim(tournament, players)

        Match.objects.bulk_create(matches)
        qs = Match.objects.filter(tournament=tournament).select_related(
            "player1", "player2", "pair1_player2", "pair2_player2", "winner"
        )
        return Response(MatchSerializer(qs, many=True).data, status=http_status.HTTP_201_CREATED)

    def _gen_round_robin(self, tournament, players):
        """Circle method: balanced round-robin schedule."""
        working = list(players)
        if len(working) % 2 == 1:
            working.append(None)  # bye placeholder
        m = len(working)
        fixed = working[0]
        rotating = list(working[1:])
        matches = []
        for round_num in range(1, m):
            current = [fixed] + rotating
            for i in range(m // 2):
                p1 = current[i]
                p2 = current[m - 1 - i]
                if p1 is not None and p2 is not None:
                    matches.append(Match(
                        tournament=tournament,
                        gender_type=tournament.gender_type,
                        player1=p1,
                        player2=p2,
                        round_number=round_num,
                        status="scheduled",
                    ))
            rotating = [rotating[-1]] + rotating[:-1]
        return matches

    def _gen_single_elim(self, tournament, players):
        """Standard seeded bracket, seed 1 vs N, 2 vs N-1, etc."""
        n = len(players)
        bracket_size = 2 ** ceil(log2(max(n, 2)))

        def bracket_order(size):
            if size == 2:
                return [1, 2]
            half = bracket_order(size // 2)
            result = []
            for p in half:
                result.append(p)
                result.append(size + 1 - p)
            return result

        positions = bracket_order(bracket_size)
        matches = []
        for i in range(0, bracket_size, 2):
            seed_a = positions[i]
            seed_b = positions[i + 1]
            player_a = players[seed_a - 1] if seed_a <= n else None
            player_b = players[seed_b - 1] if seed_b <= n else None
            if player_a is None or player_b is None:
                continue  # bye
            matches.append(Match(
                tournament=tournament,
                gender_type=tournament.gender_type,
                player1=player_a,
                player2=player_b,
                round_number=1,
                status="scheduled",
            ))
        return matches


class TournamentRegistrationViewSet(ModelViewSet):
    permission_classes = [RolePermission]
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
