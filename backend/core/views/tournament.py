from collections import defaultdict
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
        kind_param = self.request.query_params.get("kind")
        if status_param:
            qs = qs.filter(status=status_param)
        if gender_type:
            qs = qs.filter(gender_type=gender_type)
        if kind_param:
            qs = qs.filter(kind=kind_param)
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

        Match.objects.filter(tournament=tournament).delete()

        if tournament.kind == Tournament.Kind.DOUBLES:
            result = self._generate_doubles(tournament, regs)
            if isinstance(result, Response):
                return result
            matches = result
        else:
            players = [r.player for r in regs]
            if len(players) < 2:
                return Response({"detail": "Нужно минимум 2 игрока."}, status=400)
            if tournament.format == Tournament.Format.ROUND_ROBIN:
                matches = self._gen_round_robin(tournament, players)
            else:
                matches = self._gen_single_elim(tournament, players)

        Match.objects.bulk_create(matches)
        qs = Match.objects.filter(tournament=tournament).select_related(
            "player1", "player2", "pair1_player2", "pair2_player2", "winner"
        )
        return Response(MatchSerializer(qs, many=True).data, status=http_status.HTTP_201_CREATED)

    # ── Doubles ────────────────────────────────────────────────────────────────

    def _generate_doubles(self, tournament, regs):
        grouped = defaultdict(list)
        for r in regs:
            if r.pair_id is not None:
                grouped[r.pair_id].append(r)

        # Build list of complete pairs sorted by min seed (nulls last)
        pairs = []
        for pair_id, pair_regs in sorted(grouped.items()):
            if len(pair_regs) < 2:
                continue
            seeds = [r.seed for r in pair_regs if r.seed is not None]
            pair_seed = min(seeds) if seeds else None
            pairs.append((pair_seed, pair_regs[0].player, pair_regs[1].player))

        pairs.sort(key=lambda x: (x[0] is None, x[0]))

        if len(pairs) < 2:
            return Response(
                {"detail": "Нужно минимум 2 пары. Назначьте номера пар игрокам."},
                status=400,
            )

        pair_list = [(p[1], p[2]) for p in pairs]

        if tournament.format == Tournament.Format.ROUND_ROBIN:
            return self._gen_round_robin_doubles(tournament, pair_list)
        return self._gen_single_elim_doubles(tournament, pair_list)

    def _gen_round_robin_doubles(self, tournament, pairs):
        working = list(pairs)
        if len(working) % 2 == 1:
            working.append(None)
        m = len(working)
        fixed = working[0]
        rotating = list(working[1:])
        matches = []
        for round_num in range(1, m):
            current = [fixed] + rotating
            for i in range(m // 2):
                pair_a = current[i]
                pair_b = current[m - 1 - i]
                if pair_a is not None and pair_b is not None:
                    matches.append(Match(
                        tournament=tournament,
                        gender_type=tournament.gender_type,
                        player1=pair_a[0], pair1_player2=pair_a[1],
                        player2=pair_b[0], pair2_player2=pair_b[1],
                        round_number=round_num,
                        status="scheduled",
                    ))
            rotating = [rotating[-1]] + rotating[:-1]
        return matches

    def _gen_single_elim_doubles(self, tournament, pairs):
        n = len(pairs)
        bracket_size = 2 ** ceil(log2(max(n, 2)))
        positions = self._bracket_order(bracket_size)
        matches = []
        for i in range(0, bracket_size, 2):
            pair_a = pairs[positions[i] - 1] if positions[i] <= n else None
            pair_b = pairs[positions[i + 1] - 1] if positions[i + 1] <= n else None
            if pair_a is None and pair_b is None:
                continue
            p1, p1p2 = (pair_a[0], pair_a[1]) if pair_a else (None, None)
            p2, p2p2 = (pair_b[0], pair_b[1]) if pair_b else (None, None)
            matches.append(Match(
                tournament=tournament,
                gender_type=tournament.gender_type,
                player1=p1, pair1_player2=p1p2,
                player2=p2, pair2_player2=p2p2,
                round_number=1,
                slot_index=i // 2,
                status="scheduled",
            ))
        return matches

    # ── Singles ────────────────────────────────────────────────────────────────

    def _gen_round_robin(self, tournament, players):
        working = list(players)
        if len(working) % 2 == 1:
            working.append(None)
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
                        player1=p1, player2=p2,
                        round_number=round_num,
                        status="scheduled",
                    ))
            rotating = [rotating[-1]] + rotating[:-1]
        return matches

    def _gen_single_elim(self, tournament, players):
        n = len(players)
        bracket_size = 2 ** ceil(log2(max(n, 2)))
        positions = self._bracket_order(bracket_size)
        matches = []
        for i in range(0, bracket_size, 2):
            player_a = players[positions[i] - 1] if positions[i] <= n else None
            player_b = players[positions[i + 1] - 1] if positions[i + 1] <= n else None
            if player_a is None and player_b is None:
                continue
            matches.append(Match(
                tournament=tournament,
                gender_type=tournament.gender_type,
                player1=player_a, player2=player_b,
                round_number=1,
                slot_index=i // 2,
                status="scheduled",
            ))
        return matches

    @staticmethod
    def _bracket_order(size):
        if size == 2:
            return [1, 2]
        half = TournamentViewSet._bracket_order(size // 2)
        result = []
        for p in half:
            result.append(p)
            result.append(size + 1 - p)
        return result


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
