import uuid

import pytest

from core.models import Match, Tournament
from core.services.statistics_import import convert_external_payload, _normalize_obj


GUID_A = str(uuid.uuid4())
GUID_B = str(uuid.uuid4())
GUID_C = str(uuid.uuid4())
GUID_D = str(uuid.uuid4())
PAIR_HOME = str(uuid.uuid4())
PAIR_AWAY = str(uuid.uuid4())


def _sample_row(player_id, pair_id, **kwargs):
    base = {
        "PlayerId": player_id,
        "PairId": pair_id,
        "Aces": 0,
        "Doubles": 3,
        "Unforced": 10,
        "FirstServePercent": 55,
        "BreakPoints": 4,
        "BreakPointsWon": 2,
        "FirstServeWon": 8,
        "SecondServeWon": 5,
        "FirstServesIn": 12,
        "SecondServeTotal": 9,
        "Winners": 6,
        "ForcedErrors": 2,
        "PointsWon": 40,
        "Regular": 1,
    }
    base.update(kwargs)
    return base


@pytest.mark.django_db
def test_convert_singles_statistics(tournament, player_factory):
    p1 = player_factory()
    p2 = player_factory()
    match = Match.objects.create(tournament=tournament, player1=p1, player2=p2)

    gid_home = "00000000-0000-4000-8000-000000000001"
    gid_away = "00000000-0000-4000-8000-000000000002"
    payload = _normalize_obj({
        "MatchId": str(uuid.uuid4()),
        "Statistics": [
            _sample_row(gid_home, None, Doubles=6, PointsWon=48),
            _sample_row(gid_away, None, Doubles=7, PointsWon=48),
        ],
    })

    stats = convert_external_payload(match, payload)
    assert stats is not None
    assert stats["home"]["double_faults"] == 6
    assert stats["away"]["double_faults"] == 7
    assert stats["home"]["points_total"] == 96


@pytest.mark.django_db
def test_convert_doubles_statistics(tournament, player_factory):
    tournament.kind = Tournament.Kind.DOUBLES
    tournament.save(update_fields=["kind"])
    p1 = player_factory()
    p2 = player_factory()
    p3 = player_factory()
    p4 = player_factory()
    match = Match.objects.create(
        tournament=tournament,
        player1=p1,
        pair1_player2=p2,
        player2=p3,
        pair2_player2=p4,
    )

    # home pair = lexicographically smaller pair id
    home_pair = min(PAIR_HOME, PAIR_AWAY)
    away_pair = max(PAIR_HOME, PAIR_AWAY)
    home_guids = sorted([GUID_A, GUID_B])
    away_guids = sorted([GUID_C, GUID_D])

    payload = _normalize_obj({
        "Statistics": [
            _sample_row(home_guids[0], home_pair),
            _sample_row(home_guids[1], home_pair),
            _sample_row(away_guids[0], away_pair),
            _sample_row(away_guids[1], away_pair),
        ],
    })

    stats = convert_external_payload(match, payload)
    assert stats is not None
    assert "players" in stats["home"]
    assert str(p1.id) in stats["home"]["players"] or str(p2.id) in stats["home"]["players"]
