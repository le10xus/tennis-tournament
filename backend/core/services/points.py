"""Начисление рейтинговых очков по итогам турнира.

Правила взяты с последнего листа таблицы (gid=1971746850):
категория турнира + схема проведения + число участников + занятое место.
"""

from collections import defaultdict
from dataclasses import dataclass

from django.db import transaction

from core.models import Match, Player, Tournament, TournamentRegistration

# ── Схемы ────────────────────────────────────────────────────────────────────

SCHEME_OLYMPIC = "olympic"
SCHEME_DOUBLE = "double_elim"
SCHEME_GROUP = "group"

# ── Таблицы очков ────────────────────────────────────────────────────────────
# Категория → число участников → место/этап → очки.

OLYMPIC = {
    Tournament.PointsCategory.TWO_DAY: {
        "25-32": {"1": 60, "2": 40, "3": 32, "4": 25, "1/4": 15, "1/8": 9, "1/16": 5},
        "17-24": {"1": 50, "2": 35, "3": 26, "4": 19, "1/4": 12, "1/8": 7, "1/16": 4},
        "13-16": {"1": 40, "2": 30, "3": 22, "4": 15, "1/4": 9, "1/8": 4},
        "9-12": {"1": 30, "2": 20, "3": 14, "4": 10, "1/4": 6, "1/8": 2},
        "8≤": {"1": 20, "2": 13, "3": 9, "4": 6, "1/4": 4},
    },
    Tournament.PointsCategory.ONE_DAY: {
        "25-32": {"1": 20, "2": 13, "3": 9, "4": 6, "1/4": 4, "1/8": 3, "1/16": 2},
        "17-24": {"1": 16, "2": 10, "3": 7, "4": 5, "1/4": 3, "1/8": 2, "1/16": 1},
        "13-16": {"1": 12, "2": 8, "3": 5, "4": 3, "1/4": 2, "1/8": 1},
        "9-12": {"1": 9, "2": 6, "3": 4, "4": 2, "1/4": 1, "1/8": 1},
        "8≤": {"1": 7, "2": 4, "3": 2, "4": 1, "1/4": 1},
    },
    Tournament.PointsCategory.VETERANS: {
        "13-16": {"1": 30, "2": 20, "3": 14, "4": 10, "1/4": 6, "1/8": 2, "Q": 1},
        "9-12": {"1": 25, "2": 16, "3": 11, "4": 7, "1/4": 4, "1/8": 1},
        "8≤": {"1": 20, "2": 13, "3": 9, "4": 6, "1/4": 2},
    },
    Tournament.PointsCategory.REGION: {
        "49-64": {"1": 250, "2": 150, "3": 90, "4": 65, "1/4": 45, "1/8": 25, "1/16": 15, "1/32": 9, "Q": 3},
        "33-48": {"1": 150, "2": 100, "3": 70, "4": 50, "1/4": 35, "1/8": 20, "1/16": 10, "1/32": 5},
        "25-32": {"1": 120, "2": 80, "3": 55, "4": 40, "1/4": 25, "1/8": 15, "1/16": 5, "Q": 2},
        "17-24": {"1": 80, "2": 55, "3": 40, "4": 30, "1/4": 20, "1/8": 10, "1/16": 4},
        "13-16": {"1": 60, "2": 40, "3": 32, "4": 25, "1/4": 12, "1/8": 5, "Q": 1},
        "9-12": {"1": 40, "2": 30, "3": 22, "4": 15, "1/4": 9, "1/8": 4},
        "8≤": {"1": 30, "2": 20, "3": 14, "4": 9, "1/4": 3},
    },
}

DOUBLE_ELIM = {
    Tournament.PointsCategory.TWO_DAY: {
        "25-32": {"1": 60, "2": 40, "3": 32, "4": 25, "5-8": 15, "9-12": 9, "13-16": 5, "17-24": 3, "25-32": 1},
        "17-24": {"1": 50, "2": 35, "3": 26, "4": 19, "5-8": 12, "9-12": 7, "13-16": 4, "17-24": 1},
        "13-16": {"1": 40, "2": 30, "3": 22, "4": 15, "5-8": 9, "9-12": 4, "13-16": 2},
        "9-12": {"1": 30, "2": 20, "3": 14, "4": 10, "5-8": 6, "9-12": 2},
        "8≤": {"1": 20, "2": 13, "3": 9, "4": 6, "5-8": 4},
    },
    Tournament.PointsCategory.ONE_DAY: {
        "25-32": {"1": 20, "2": 13, "3": 9, "4": 6, "5-8": 4, "9-12": 3, "13-16": 2, "17-24": 2, "25-32": 1},
        "17-24": {"1": 16, "2": 10, "3": 7, "4": 5, "5-8": 4, "9-12": 3, "13-16": 2, "17-24": 1},
        "13-16": {"1": 12, "2": 8, "3": 5, "4": 3, "5-8": 2, "9-12": 1, "13-16": 1},
        "9-12": {"1": 9, "2": 6, "3": 4, "4": 2, "5-8": 1, "9-12": 1},
        "8≤": {"1": 7, "2": 4, "3": 2, "4": 1, "5-8": 1},
    },
    Tournament.PointsCategory.VETERANS: {
        "13-16": {"1": 20, "2": 13, "3": 9, "4": 6, "1/4": 3, "1/8": 1},
        "9-12": {"1": 16, "2": 10, "3": 7, "4": 5, "1/4": 2, "1/8": 1},
        "8≤": {"1": 12, "2": 8, "3": 5, "4": 3, "1/4": 1},
    },
}

# Групповой этап + олимпийка: очки строго за место, набор мест зависит
# от числа участников и от длительности турнира.
GROUP = {
    Tournament.PointsCategory.TWO_DAY: {
        "12": ["30", "20", "14", "10", "6", "5", "4", "3", "2", "1", "1"],
        "9-10": ["25", "16", "11", "7", "5", "4", "3", "2", "1", "1"],
        "8": ["20", "13", "9", "6", "4", "3", "2", "1"],
        "6": ["12", "8", "5", "3", "2", "1"],
        "5": ["9", "6", "4", "2", "1"],
    },
    Tournament.PointsCategory.ONE_DAY: {
        "12": ["12", "8", "5", "3", "2", "1"],
        "9-10": ["9", "6", "4", "2", "1"],
        "8": ["7", "4", "2", "1"],
        "6": ["4", "2", "1"],
        "5": ["2", "1"],
    },
}

GROUP_LABELS = {
    "12": ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "12"],
    "9-10": ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
    "8": ["1", "2", "3", "4", "5", "6", "7", "8"],
    "6": ["1", "2", "3", "4", "5", "6"],
    "5": ["1", "2", "3", "4", "5"],
}


@dataclass
class Award:
    player: Player
    place: str
    points: int


# ── Вспомогательное ──────────────────────────────────────────────────────────


def participants_count(tournament):
    regs = TournamentRegistration.objects.filter(
        tournament=tournament,
        status=TournamentRegistration.Status.APPROVED,
    )
    if tournament.kind == Tournament.Kind.DOUBLES:
        return regs.exclude(pair_id=None).values("pair_id").distinct().count()
    return regs.count()


def size_bucket(count):
    if count <= 8:
        return "8≤"
    if count <= 12:
        return "9-12"
    if count <= 16:
        return "13-16"
    if count <= 24:
        return "17-24"
    if count <= 32:
        return "25-32"
    if count <= 48:
        return "33-48"
    return "49-64"


def group_bucket(count):
    if count <= 5:
        return "5"
    if count <= 6:
        return "6"
    if count <= 8:
        return "8"
    if count <= 10:
        return "9-10"
    return "12"


def _side_players(match, side):
    if side == 1:
        return [p for p in (match.player1, match.pair1_player2) if p]
    return [p for p in (match.player2, match.pair2_player2) if p]


def _winner_side(match):
    if match.winner_id and match.winner_id == match.player1_id:
        return 1
    if match.winner_id and match.winner_id == match.player2_id:
        return 2
    return None


def _losers(match):
    side = _winner_side(match)
    if not side:
        return []
    return _side_players(match, 2 if side == 1 else 1)


def _winners(match):
    side = _winner_side(match)
    if not side:
        return []
    return _side_players(match, side)


def _assign(result, players, label):
    for player in players:
        result[player.id] = label


# ── Определение мест ─────────────────────────────────────────────────────────


def places_double_elim(matches):
    """Место в 16-участниковой сетке с подвалом."""
    result = {}
    winners = [m for m in matches if m.bracket == Match.Bracket.WINNERS]
    consolation = [m for m in matches if m.bracket == Match.Bracket.CONSOLATION]
    if not winners or not consolation:
        return places_olympic(matches)

    max_round = max(m.round_number for m in winners)

    for match in consolation:
        if match.group == Match.Group.PLACES_9_16:
            _assign(result, _losers(match), "13-16")
        elif match.group == Match.Group.PLACES_5_8:
            _assign(result, _losers(match), "9-12")

    for match in winners:
        if match.round_number == max_round - 2:
            _assign(result, _losers(match), "5-8")

    third = next((m for m in matches if m.bracket == Match.Bracket.THIRD_PLACE), None)
    if third:
        _assign(result, _winners(third), "3")
        _assign(result, _losers(third), "4")

    final = next((m for m in winners if m.round_number == max_round), None)
    if final:
        _assign(result, _winners(final), "1")
        _assign(result, _losers(final), "2")

    semifinal_losers = [
        player
        for match in winners
        if match.round_number == max_round - 1
        for player in _losers(match)
    ]
    for player in semifinal_losers:
        result.setdefault(player.id, "3")

    return result


def places_olympic(matches):
    """Олимпийская сетка: 1–4 и выбывшие в 1/4, 1/8, 1/16, 1/32."""
    result = {}
    winners = [m for m in matches if m.bracket == Match.Bracket.WINNERS]
    if not winners:
        return result

    max_round = max(m.round_number for m in winners)

    for match in winners:
        if match.round_number <= max_round - 2:
            reached = 2 ** (max_round - match.round_number)
            _assign(result, _losers(match), f"1/{reached}")

    third = next((m for m in matches if m.bracket == Match.Bracket.THIRD_PLACE), None)
    if third:
        _assign(result, _winners(third), "3")
        _assign(result, _losers(third), "4")

    final = next((m for m in winners if m.round_number == max_round), None)
    if final:
        _assign(result, _winners(final), "1")
        _assign(result, _losers(final), "2")

    semifinal_losers = [
        player
        for match in winners
        if match.round_number == max_round - 1
        for player in _losers(match)
    ]
    for player in semifinal_losers:
        result.setdefault(player.id, "3")

    return result


def places_group(matches):
    """Круговой: место по числу побед и разнице сетов."""
    table = defaultdict(lambda: {"wins": 0, "sets_for": 0, "sets_against": 0})
    for match in matches:
        if not match.winner_id:
            continue
        won = _winner_side(match)
        if not won:
            continue
        sides = {1: _side_players(match, 1), 2: _side_players(match, 2)}
        for player in sides[won]:
            table[player.id]["wins"] += 1
        for side in (1, 2):
            sets_for = 0
            for home, away in (
                (match.set1_home, match.set1_away),
                (match.set2_home, match.set2_away),
                (match.set3_home, match.set3_away),
            ):
                if home is None or away is None:
                    continue
                if side == 1 and home > away:
                    sets_for += 1
                elif side == 2 and away > home:
                    sets_for += 1
            for player in sides[side]:
                table[player.id]["sets_for"] += sets_for
                table[player.id]["sets_against"] += sum(
                    1
                    for home, away in (
                        (match.set1_home, match.set1_away),
                        (match.set2_home, match.set2_away),
                        (match.set3_home, match.set3_away),
                    )
                    if home is not None and away is not None
                ) - sets_for

    ordered = sorted(
        table.items(),
        key=lambda item: (
            -item[1]["wins"],
            -(item[1]["sets_for"] - item[1]["sets_against"]),
            -item[1]["sets_for"],
        ),
    )
    return {player_id: str(index) for index, (player_id, _) in enumerate(ordered, start=1)}


# ── Начисление ───────────────────────────────────────────────────────────────


def resolve_scheme(tournament, matches):
    if tournament.format == Tournament.Format.ROUND_ROBIN:
        return SCHEME_GROUP
    has_consolation = any(m.bracket == Match.Bracket.CONSOLATION for m in matches)
    if tournament.format == Tournament.Format.DOUBLE_ELIM and has_consolation:
        return SCHEME_DOUBLE
    return SCHEME_OLYMPIC


def points_for(category, scheme, count, place):
    if scheme == SCHEME_GROUP:
        bucket = group_bucket(count)
        labels = GROUP_LABELS.get(bucket, [])
        values = GROUP.get(category, {}).get(bucket)
        if not values or place not in labels:
            return 0
        index = labels.index(place)
        return int(values[index]) if index < len(values) else 0

    table = (DOUBLE_ELIM if scheme == SCHEME_DOUBLE else OLYMPIC).get(category, {})
    row = table.get(size_bucket(count), {})
    return int(row.get(place, 0))


def build_awards(tournament, matches=None):
    if not tournament.points_category:
        return []

    matches = list(matches if matches is not None else Match.objects.filter(tournament=tournament))
    scheme = resolve_scheme(tournament, matches)
    if scheme == SCHEME_DOUBLE:
        places = places_double_elim(matches)
    elif scheme == SCHEME_GROUP:
        places = places_group(matches)
    else:
        places = places_olympic(matches)

    if not places:
        return []

    count = participants_count(tournament)
    players = {p.id: p for p in Player.objects.filter(pk__in=places.keys())}
    awards = []
    for player_id, place in places.items():
        player = players.get(player_id)
        if not player:
            continue
        points = points_for(tournament.points_category, scheme, count, place)
        if points <= 0:
            continue
        awards.append(Award(player=player, place=place, points=points))

    awards.sort(key=lambda award: (-award.points, award.player.last_name))
    return awards


@transaction.atomic
def apply_awards(tournament):
    """Пересчитывает очки: снимает прежние начисления и начисляет заново."""
    from core.models import TournamentPointsAward

    # сериализуем параллельные пересчёты/удаления
    Tournament.objects.select_for_update().get(pk=tournament.pk)

    field = (
        "points_doubles"
        if tournament.kind == Tournament.Kind.DOUBLES
        else "points_singles"
    )

    for award in tournament.points_awards.select_related("player"):
        current = getattr(award.player, field)
        setattr(award.player, field, max(0, current - award.points))
        award.player.save(update_fields=[field])
    tournament.points_awards.all().delete()

    awards = build_awards(tournament)
    created = []
    for award in awards:
        current = getattr(award.player, field)
        setattr(award.player, field, current + award.points)
        award.player.save(update_fields=[field])
        created.append(
            TournamentPointsAward.objects.create(
                tournament=tournament,
                player=award.player,
                place=award.place,
                points=award.points,
            )
        )
    return created


@transaction.atomic
def revert_awards(tournament):
    from core.models import TournamentPointsAward

    Tournament.objects.select_for_update().get(pk=tournament.pk)

    field = (
        "points_doubles"
        if tournament.kind == Tournament.Kind.DOUBLES
        else "points_singles"
    )
    for award in tournament.points_awards.select_related("player"):
        current = getattr(award.player, field)
        setattr(award.player, field, max(0, current - award.points))
        award.player.save(update_fields=[field])
    TournamentPointsAward.objects.filter(tournament=tournament).delete()
