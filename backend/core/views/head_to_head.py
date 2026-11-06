from django.db.models import Q
from rest_framework.decorators import api_view
from rest_framework.response import Response

from core.models import Match, Player
from core.serializers import PlayerBriefSerializer


@api_view(["GET"])
def head_to_head(request):
    try:
        player1_id = int(request.query_params.get("player1", ""))
        player2_id = int(request.query_params.get("player2", ""))
    except (TypeError, ValueError):
        return Response({"detail": "Укажите player1 и player2."}, status=400)

    if player1_id == player2_id:
        return Response({"detail": "Выберите двух разных игроков."}, status=400)

    players = {p.id: p for p in Player.objects.filter(pk__in=[player1_id, player2_id])}
    if len(players) != 2:
        return Response({"detail": "Игрок не найден."}, status=404)

    def side_q(player_id):
        return (
            Q(player1_id=player_id)
            | Q(pair1_player2_id=player_id)
            | Q(player2_id=player_id)
            | Q(pair2_player2_id=player_id)
        )

    matches = (
        Match.objects
        .filter(side_q(player1_id))
        .filter(side_q(player2_id))
        .select_related("tournament", "player1", "player2", "pair1_player2", "pair2_player2", "winner")
        .order_by("-tournament__start_date", "-id")
    )

    rows = []
    wins1 = wins2 = 0
    for match in matches:
        side1_ids = {match.player1_id, match.pair1_player2_id}
        side2_ids = {match.player2_id, match.pair2_player2_id}
        winner_side = 0
        if match.winner_id in side1_ids:
            winner_side = 1
            wins1 += 1
        elif match.winner_id in side2_ids:
            winner_side = 2
            wins2 += 1
        rows.append({
            "id": match.id,
            "tournament": match.tournament_id,
            "tournament_name": match.tournament.name,
            "date": match.tournament.start_date,
            "round": match.round_number,
            "bracket": match.bracket,
            "score": match.score,
            "winner_side": winner_side,
        })

    return Response({
        "player1": PlayerBriefSerializer(players[player1_id]).data,
        "player2": PlayerBriefSerializer(players[player2_id]).data,
        "count": len(rows),
        "wins1": wins1,
        "wins2": wins2,
        "matches": rows,
    })
