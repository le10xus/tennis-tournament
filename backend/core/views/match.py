from django.db.models import Q
from rest_framework.viewsets import ModelViewSet

from core.models import Match
from core.permissions import RolePermission
from core.serializers import MatchSerializer


class MatchViewSet(ModelViewSet):
    permission_classes = [RolePermission]
    serializer_class = MatchSerializer
    queryset = Match.objects.none()

    def perform_update(self, serializer):
        match = serializer.save()
        self._advance(match)

    def _advance(self, match):
        """Победитель уходит в next_match, проигравший — в loser_next_match."""
        if not match.winner_id:
            return
        if match.winner_id == match.player1_id:
            winner_side = (match.player1, match.pair1_player2)
            loser_side = (match.player2, match.pair2_player2)
        elif match.winner_id == match.player2_id:
            winner_side = (match.player2, match.pair2_player2)
            loser_side = (match.player1, match.pair1_player2)
        else:
            return

        if match.next_match_id and winner_side[0]:
            self._fill_slot(match.next_match, match.next_slot, winner_side)
        if match.loser_next_match_id and loser_side[0]:
            self._fill_slot(match.loser_next_match, match.loser_next_slot, loser_side)

    @staticmethod
    def _fill_slot(target, slot, side):
        player, partner = side
        if slot == 1:
            target.player1, target.pair1_player2 = player, partner
        elif slot == 2:
            target.player2, target.pair2_player2 = player, partner
        else:
            return
        target.save(update_fields=[
            "player1", "pair1_player2", "player2", "pair2_player2",
        ])
        # если победитель больше не участвует в матче — сбрасываем результат
        if target.winner_id and target.winner_id not in (target.player1_id, target.player2_id):
            target.winner = None
            target.score = ""
            target.status = Match.Status.SCHEDULED
            target.save(update_fields=["winner", "score", "status"])

    def get_queryset(self):
        qs = Match.objects.select_related(
            "player1", "pair1_player2", "player2", "pair2_player2", "winner", "tournament"
        )
        tournament_id = self.request.query_params.get("tournament")
        gender_type = self.request.query_params.get("gender_type")
        kind_param = self.request.query_params.get("kind")
        status = self.request.query_params.get("status")
        player_id = self.request.query_params.get("player")

        if tournament_id:
            qs = qs.filter(tournament_id=tournament_id)
        if gender_type:
            qs = qs.filter(gender_type=gender_type)
        if kind_param == "singles":
            qs = qs.filter(pair1_player2__isnull=True)
        elif kind_param == "doubles":
            qs = qs.filter(pair1_player2__isnull=False)
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
