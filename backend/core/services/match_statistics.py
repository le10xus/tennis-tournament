"""Схема и нормализация JSON-статистики матча (home = сторона 1, away = сторона 2)."""

SIDE_FIELDS = frozenset({
    "aces",
    "double_faults",
    "first_serve_pct",
    "unreturned_serves",
    "first_serve_won",
    "first_serve_total",
    "second_serve_won",
    "second_serve_total",
    "winners",
    "unforced_errors",
    "forced_errors",
    "points_won",
    "points_total",
    "break_points_won",
    "break_points_total",
})

PLAYER_FIELDS = frozenset({
    "double_faults",
    "first_serve_pct",
    "first_serve_won",
    "first_serve_total",
    "second_serve_won",
    "second_serve_total",
})

PCT_FIELDS = frozenset({"first_serve_pct"})


def _is_empty_side(side):
    if not isinstance(side, dict):
        return True
    for key, val in side.items():
        if key == "players":
            if isinstance(val, dict) and val:
                return False
            continue
        if val is not None:
            return False
    return True


def statistics_is_empty(data):
    if not data or not isinstance(data, dict):
        return True
    home = data.get("home") or {}
    away = data.get("away") or {}
    return _is_empty_side(home) and _is_empty_side(away)


def normalize_statistics(value):
    """Возвращает очищенный объект или None, если все поля пусты."""
    if value is None:
        return None
    if not isinstance(value, dict):
        raise ValueError("statistics must be an object")
    out = {"home": {}, "away": {}}
    for side in ("home", "away"):
        raw = value.get(side)
        if not isinstance(raw, dict):
            continue
        side_out = {}
        for field in SIDE_FIELDS:
            if field not in raw or raw[field] is None:
                continue
            side_out[field] = _coerce_int(raw[field], field)
        players = raw.get("players")
        if isinstance(players, dict) and players:
            players_out = {}
            for pid, prow in players.items():
                if not isinstance(prow, dict):
                    continue
                player_out = {}
                for field in PLAYER_FIELDS:
                    if field not in prow or prow[field] is None:
                        continue
                    player_out[field] = _coerce_int(prow[field], field)
                if player_out:
                    players_out[str(pid)] = player_out
            if players_out:
                side_out["players"] = players_out
        if side_out:
            out[side] = side_out
    if statistics_is_empty(out):
        return None
    return out


def _coerce_int(val, field):
    try:
        num = int(val)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{field}: must be an integer") from exc
    if num < 0:
        raise ValueError(f"{field}: must be >= 0")
    if field in PCT_FIELDS and num > 100:
        raise ValueError(f"{field}: must be <= 100")
    return num


def validate_statistics_shape(value, participant_ids=None):
    """Проверка структуры; participant_ids — id игроков матча для players."""
    if value is None:
        return None
    if not isinstance(value, dict):
        raise ValueError("statistics must be an object")
    if "home" not in value or "away" not in value:
        raise ValueError("statistics must contain home and away")
    participant_ids = set(participant_ids or [])
    for side in ("home", "away"):
        raw = value.get(side)
        if raw is None:
            continue
        if not isinstance(raw, dict):
            raise ValueError(f"{side} must be an object")
        for key in raw:
            if key == "players":
                players = raw["players"]
                if players is None:
                    continue
                if not isinstance(players, dict):
                    raise ValueError(f"{side}.players must be an object")
                for pid, prow in players.items():
                    try:
                        pid_int = int(pid)
                    except (TypeError, ValueError) as exc:
                        raise ValueError(f"{side}.players: invalid player id") from exc
                    if participant_ids and pid_int not in participant_ids:
                        raise ValueError(
                            f"{side}.players: player {pid_int} is not in this match"
                        )
                    if not isinstance(prow, dict):
                        raise ValueError(f"{side}.players[{pid}] must be an object")
                    unknown = set(prow) - PLAYER_FIELDS
                    if unknown:
                        raise ValueError(
                            f"{side}.players[{pid}]: unknown fields {sorted(unknown)}"
                        )
                continue
            if key not in SIDE_FIELDS:
                raise ValueError(f"{side}: unknown field {key}")
    try:
        return normalize_statistics(value)
    except ValueError as exc:
        raise ValueError(str(exc)) from exc
