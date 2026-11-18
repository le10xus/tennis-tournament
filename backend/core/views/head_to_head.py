import re

from django.db.models import Q
from rest_framework.decorators import api_view
from rest_framework.response import Response

from core.models import Match, Player
from core.serializers import PlayerBriefSerializer

# Сет «6:4», «4:3(5)» или «19/12»: тай-брейк в скобках остаётся при своём числе.
_SET_SCORE = re.compile(r"^(\d+(?:\(\d+\))?)([:/])(\d+(?:\(\d+\))?)$")


def _score_for_player(score, player_is_home):
    """Счёт с точки зрения выбранного игрока: его геймы — первые."""
    if player_is_home or not score:
        return score
    return " ".join(_flip_set(token) for token in score.split())


def _flip_set(token):
    match = _SET_SCORE.match(token)
    if not match:
        return token
    left, separator, right = match.groups()
    return f"{right}{separator}{left}"


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

    def on_side(player_id, *fields):
        query = Q()
        for field in fields:
            query |= Q(**{field: player_id})
        return query

    home = ("player1_id", "pair1_player2_id")
    away = ("player2_id", "pair2_player2_id")
    # Только соперники: один на домашней стороне, другой на гостевой.
    # Матч, где оба в одной паре, не считается очной встречей.
    opponents = (
        on_side(player1_id, *home) & on_side(player2_id, *away)
    ) | (
        on_side(player1_id, *away) & on_side(player2_id, *home)
    )

    matches = (
        Match.objects
        .filter(opponents)
        .select_related("tournament", "player1", "player2", "pair1_player2", "pair2_player2", "winner")
        .order_by("-tournament__start_date", "-id")
    )

    rows = []
    wins1 = wins2 = 0
    for match in matches:
        # Победитель в базе — капитан стороны. Партнёр получает тот же результат.
        player1_home = player1_id in (match.player1_id, match.pair1_player2_id)
        home_won = bool(match.winner_id) and match.winner_id == match.player1_id
        away_won = bool(match.winner_id) and match.winner_id == match.player2_id
        winner_side = 0
        if home_won or away_won:
            if player1_home == home_won:
                winner_side = 1
                wins1 += 1
            else:
                winner_side = 2
                wins2 += 1
        rows.append({
            "id": match.id,
            "tournament": match.tournament_id,
            "tournament_name": match.tournament.name,
            "date": match.tournament.start_date,
            "round": match.round_number,
            "bracket": match.bracket,
            "score": _score_for_player(match.score, player1_home),
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
