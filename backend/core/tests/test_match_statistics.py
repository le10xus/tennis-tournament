import pytest

from core.services.match_statistics import normalize_statistics, statistics_is_empty


def test_normalize_strips_empty():
    assert normalize_statistics(None) is None
    assert normalize_statistics({"home": {}, "away": {}}) is None


def test_normalize_keeps_values():
    data = {
        "home": {"aces": 2, "winners": 15},
        "away": {"aces": 0, "double_faults": 7},
    }
    out = normalize_statistics(data)
    assert not statistics_is_empty(out)
    assert out["home"]["aces"] == 2
    assert out["away"]["double_faults"] == 7


def test_validate_pct():
    from core.services.match_statistics import validate_statistics_shape

    with pytest.raises(ValueError):
        validate_statistics_shape({"home": {"first_serve_pct": 120}, "away": {}})
