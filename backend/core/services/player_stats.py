"""W-L и призовые места игрока для карточки.

Победа и поражение — только у матча с известным победителем и обеими
сторонами. Bye, где соперника нет, не считается. В паре результат получает
и партнёр: победитель матча — капитан стороны.

Призовое место — 1, 2 или 3, один раз на турнир. Сначала опубликованный
результат и начисление очков, для завершённого турнира без них — место
по сетке.
"""

from collections import defaultdict

from django.db.models import F, Q

from core.models import Match, Tournament, TournamentPointsAward, TournamentResult
from core.services.points import assigned_places

PRIZE_PLACES = ("1", "2", "3")


def player_record(player_id):
    wins, losses = _match_record(player_id)
    return {
        "wins": wins,
        "losses": losses,
        "prize_places": _prize_places(player_id),
    }


def _match_record(player_id):
    on_side1 = Q(player1_id=player_id) | Q(pair1_player2_id=player_id)
    on_side2 = Q(player2_id=player_id) | Q(pair2_player2_id=player_id)
    played = Match.objects.filter(
        winner_id__isnull=False,
        player1_id__isnull=False,
        player2_id__isnull=False,
    ).filter(
        Q(winner_id=F("player1_id")) | Q(winner_id=F("player2_id")),
        on_side1 | on_side2,
    )
    wins = played.filter(
        (on_side1 & Q(winner_id=F("player1_id")))
        | (on_side2 & Q(winner_id=F("player2_id")))
    ).count()
    return wins, played.count() - wins


def _prize_places(player_id):
    counts = {place: 0 for place in PRIZE_PLACES}
    seen = set()

    for tournament_id, place in TournamentResult.objects.filter(
        player_id=player_id, place__in=(1, 2, 3)
    ).values_list("tournament_id", "place"):
        if tournament_id in seen:
            continue
        seen.add(tournament_id)
        counts[str(place)] += 1

    for tournament_id, place in TournamentPointsAward.objects.filter(
        player_id=player_id, place__in=PRIZE_PLACES
    ).values_list("tournament_id", "place"):
        if tournament_id in seen:
            continue
        seen.add(tournament_id)
        counts[place] += 1

    accounted = seen | set(
        TournamentResult.objects.filter(player_id=player_id).values_list(
            "tournament_id", flat=True
        )
    ) | set(
        TournamentPointsAward.objects.filter(player_id=player_id).values_list(
            "tournament_id", flat=True
        )
    )
    tournament_ids = list(
        Match.objects.filter(
            Q(player1_id=player_id)
            | Q(pair1_player2_id=player_id)
            | Q(player2_id=player_id)
            | Q(pair2_player2_id=player_id),
            tournament__status=Tournament.Status.FINISHED,
        )
        .exclude(tournament_id__in=accounted)
        .values_list("tournament_id", flat=True)
        .distinct()
    )
    if not tournament_ids:
        return counts

    tournaments = {
        tournament.id: tournament
        for tournament in Tournament.objects.filter(id__in=tournament_ids)
    }
    grouped = defaultdict(list)
    matches = Match.objects.filter(tournament_id__in=tournament_ids).select_related(
        "player1", "pair1_player2", "player2", "pair2_player2"
    )
    for match in matches:
        grouped[match.tournament_id].append(match)

    for tournament_id, tournament_matches in grouped.items():
        tournament = tournaments.get(tournament_id)
        if tournament is None:
            continue
        place = assigned_places(tournament, tournament_matches).get(player_id)
        if place in counts:
            counts[place] += 1
    return counts
