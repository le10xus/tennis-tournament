"""Загрузка и преобразование внешней JSON-статистики матча."""

from __future__ import annotations

import json
import re
import ssl
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from typing import Any
from uuid import UUID

from django.core.exceptions import ValidationError

from core.models import Match
from core.services.match_statistics import normalize_statistics

_MAX_BODY = 5 * 1024 * 1024
_TIMEOUT = 15

_SUM_FIELDS = (
    "aces",
    "doubles",
    "unforced",
    "break_points",
    "break_points_won",
    "first_serve_won",
    "second_serve_won",
    "first_serves_in",
    "second_serve_total",
    "winners",
    "forced_errors",
    "points_won",
)


def _snake(name: str) -> str:
    s1 = re.sub(r"(.)([A-Z][a-z]+)", r"\1_\2", name)
    return re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", s1).lower()


def _normalize_obj(obj: Any) -> Any:
    if isinstance(obj, list):
        return [_normalize_obj(item) for item in obj]
    if isinstance(obj, dict):
        return {_snake(k): _normalize_obj(v) for k, v in obj.items()}
    return obj


def _guid_str(val: Any) -> str | None:
    if val is None:
        return None
    try:
        return str(UUID(str(val))).lower()
    except (ValueError, TypeError, AttributeError):
        return str(val).strip().lower() or None


def fetch_statistics_json(url: str) -> dict:
    if not url or not url.strip():
        raise ValidationError("Укажите ссылку на статистику.")
    parsed = urllib.parse.urlparse(url.strip())
    if parsed.scheme not in ("http", "https"):
        raise ValidationError("Ссылка должна начинаться с http:// или https://")
    if not parsed.netloc:
        raise ValidationError("Некорректная ссылка.")
    req = urllib.request.Request(
        url.strip(),
        headers={"Accept": "application/json", "User-Agent": "tennis-tournament/1.0"},
        method="GET",
    )
    ctx = ssl.create_default_context()
    try:
        with urllib.request.urlopen(req, timeout=_TIMEOUT, context=ctx) as resp:
            if resp.status and resp.status >= 400:
                raise ValidationError(f"Сервер вернул код {resp.status}.")
            raw = resp.read(_MAX_BODY + 1)
    except urllib.error.HTTPError as exc:
        raise ValidationError(f"Не удалось загрузить статистику: HTTP {exc.code}.") from exc
    except urllib.error.URLError as exc:
        raise ValidationError(f"Не удалось загрузить статистику: {exc.reason}.") from exc

    if len(raw) > _MAX_BODY:
        raise ValidationError("Ответ слишком большой.")

    try:
        data = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ValidationError("Ответ не является JSON.") from exc

    if not isinstance(data, dict):
        raise ValidationError("Ожидался JSON-объект матча.")
    return _normalize_obj(data)


def _row_val(row: dict, *keys: str, default=0) -> int:
    for key in keys:
        if key in row and row[key] is not None:
            try:
                return int(row[key])
            except (TypeError, ValueError):
                pass
    return default


def _aggregate_player_rows(rows: list[dict]) -> dict[str, dict]:
    by_player: dict[str, dict] = defaultdict(lambda: {"pair_id": None, "first_serve_pct_sum": 0, "weight": 0})
    for row in rows:
        pid = _guid_str(row.get("player_id"))
        if not pid:
            continue
        agg = by_player[pid]
        pair = _guid_str(row.get("pair_id"))
        if pair:
            agg["pair_id"] = pair
        for field in _SUM_FIELDS:
            agg[field] = agg.get(field, 0) + _row_val(row, field)
        w = _row_val(row, "first_serves_in") + _row_val(row, "second_serve_total")
        pct = _row_val(row, "first_serve_percent", default=-1)
        if w > 0 and pct >= 0:
            agg["first_serve_pct_sum"] += pct * w
            agg["weight"] += w
    for agg in by_player.values():
        if agg["weight"] > 0:
            agg["first_serve_pct"] = round(agg["first_serve_pct_sum"] / agg["weight"])
        else:
            agg["first_serve_pct"] = None
        agg.pop("first_serve_pct_sum", None)
        agg.pop("weight", None)
    return dict(by_player)


def _teams_from_players(by_player: dict[str, dict]) -> list[list[str]]:
    pairs: dict[str, list[str]] = defaultdict(list)
    singles: list[str] = []
    for pid, agg in by_player.items():
        pair_id = agg.get("pair_id")
        if pair_id:
            pairs[pair_id].append(pid)
        else:
            singles.append(pid)

    teams: list[list[str]] = []
    for members in pairs.values():
        teams.append(sorted(members))
    if singles:
        if len(singles) == 2 and not pairs:
            teams = [sorted(singles[:1]), sorted(singles[1:])]
        elif len(singles) == 1 and len(teams) == 1:
            teams[0].extend(singles)
        elif not teams:
            teams = [[pid] for pid in sorted(singles)]

    teams.sort(key=lambda t: t[0] if t else "")
    return teams


def _side_players(match: Match, side: str) -> list[tuple[int, int | None]]:
    """(player_id, slot_index 0=капитан) для home/away."""
    if side == "home":
        ids = [match.player1_id, match.pair1_player2_id]
    else:
        ids = [match.player2_id, match.pair2_player2_id]
    out = []
    for idx, pid in enumerate(ids):
        if pid:
            out.append((pid, idx))
    return out


def _map_guids_to_players(match: Match, teams: list[list[str]]) -> tuple[dict[str, str], dict[str, int]]:
    """
    guid -> 'home'|'away', guid -> our player_id
  """
    if len(teams) < 2:
        raise ValidationError("В статистике должны быть две стороны.")

    home_guids = teams[0]
    away_guids = teams[1]
    home_slots = _side_players(match, "home")
    away_slots = _side_players(match, "away")

    if len(home_guids) != len(home_slots) or len(away_guids) != len(away_slots):
        raise ValidationError(
            "Число игроков в статистике не совпадает с составом матча. "
            "Проверьте участников или загрузите статистику вручную."
        )

    guid_side: dict[str, str] = {}
    guid_player: dict[str, int] = {}
    for guid, (player_id, _) in zip(home_guids, home_slots):
        guid_side[guid] = "home"
        guid_player[guid] = player_id
    for guid, (player_id, _) in zip(away_guids, away_slots):
        guid_side[guid] = "away"
        guid_player[guid] = player_id
    return guid_side, guid_player


def _player_stats_chunk(agg: dict) -> dict:
    pct = agg.get("first_serve_pct")
    chunk = {
        "double_faults": agg.get("doubles") or None,
        "first_serve_pct": pct,
        "first_serve_won": agg.get("first_serve_won") or None,
        "first_serve_total": (
            (agg.get("first_serve_won") or 0) + max(
                0,
                (agg.get("first_serves_in") or 0) - (agg.get("first_serve_won") or 0),
            )
            if agg.get("first_serve_won") or agg.get("first_serves_in")
            else None
        ),
        "second_serve_won": agg.get("second_serve_won") or None,
        "second_serve_total": agg.get("second_serve_total") or None,
    }
    if chunk["first_serve_total"] == 0:
        chunk["first_serve_total"] = agg.get("first_serves_in") or None
    return {k: v for k, v in chunk.items() if v is not None}


def _side_team_stats(aggs: list[dict]) -> dict:
    if not aggs:
        return {}
    def s(key):
        return sum(a.get(key, 0) for a in aggs)

    first_in = s("first_serves_in")
    second_total = s("second_serve_total")
    first_attempts = first_in + max(0, s("doubles") - 0)  # грубо; точнее — по weight
    weights = 0
    pct_sum = 0
    for a in aggs:
        w = a.get("first_serves_in", 0) + a.get("second_serve_total", 0)
        if w and a.get("first_serve_pct") is not None:
            pct_sum += a["first_serve_pct"] * w
            weights += w
    first_pct = round(pct_sum / weights) if weights else (round(100 * first_in / first_attempts) if first_attempts else None)

    points_won = s("points_won")
    return {
        "aces": s("aces") or None,
        "double_faults": s("doubles") or None,
        "first_serve_pct": first_pct,
        "first_serve_won": s("first_serve_won") or None,
        "first_serve_total": first_in or None,
        "second_serve_won": s("second_serve_won") or None,
        "second_serve_total": second_total or None,
        "winners": s("winners") or None,
        "unforced_errors": s("unforced") or None,
        "forced_errors": s("forced_errors") or None,
        "points_won": points_won or None,
        "break_points_won": s("break_points_won") or None,
        "break_points_total": s("break_points") or None,
    }


def convert_external_payload(match: Match, payload: dict) -> dict:
    rows = payload.get("statistics")
    if not isinstance(rows, list) or not rows:
        raise ValidationError("В JSON нет списка statistics.")

    by_player = _aggregate_player_rows(rows)
    if not by_player:
        raise ValidationError("Не найдено статистики по игрокам.")

    teams = _teams_from_players(by_player)
    if len(teams) != 2:
        raise ValidationError(
            f"Ожидались 2 команды (или 2 игрока в одиночном), получено: {len(teams)}."
        )

    guid_side, guid_player = _map_guids_to_players(match, teams)

    home_aggs: list[dict] = []
    away_aggs: list[dict] = []
    home_players: dict = {}
    away_players: dict = {}

    for guid, agg in by_player.items():
        side = guid_side.get(guid)
        if not side:
            continue
        if side == "home":
            home_aggs.append(agg)
        else:
            away_aggs.append(agg)
        player_id = guid_player.get(guid)
        if player_id is not None:
            pchunk = _player_stats_chunk(agg)
            if pchunk:
                if side == "home":
                    home_players[str(player_id)] = pchunk
                else:
                    away_players[str(player_id)] = pchunk

    home = _side_team_stats(home_aggs)
    away = _side_team_stats(away_aggs)
    total_pts = (home.get("points_won") or 0) + (away.get("points_won") or 0)
    if total_pts:
        home["points_total"] = total_pts
        away["points_total"] = total_pts
    if home_players:
        home["players"] = home_players
    if away_players:
        away["players"] = away_players

    return normalize_statistics({"home": home, "away": away})


def apply_set_scores_from_payload(match: Match, payload: dict) -> list[str]:
    """Пробует заполнить сети из set_statistics; возвращает список изменённых полей."""
    groups = payload.get("set_statistics") or payload.get("setstatistics")
    if not isinstance(groups, list) or not groups:
        return []

    sets_scored: list[tuple[int | None, int | None]] = []
    for item in groups:
        if not isinstance(item, dict):
            continue
        home = _row_val(
            item,
            "home_games",
            "home",
            "home_score",
            "score_home",
            "games_home",
            default=-1,
        )
        away = _row_val(
            item,
            "away_games",
            "away",
            "away_score",
            "score_away",
            "games_away",
            default=-1,
        )
        if home < 0 or away < 0:
            games = item.get("games") or item.get("scores")
            if isinstance(games, list) and len(games) >= 2:
                home = _row_val(games[0], "home", "score", default=-1)
                away = _row_val(games[1], "away", "score", default=-1)
        if home >= 0 and away >= 0:
            sets_scored.append((home, away))

    if not sets_scored:
        return []

    fields: list[str] = []
    set_fields = [
        ("set1_home", "set1_away"),
        ("set2_home", "set2_away"),
        ("set3_home", "set3_away"),
    ]
    for idx, (home, away) in enumerate(sets_scored[:3]):
        h_field, a_field = set_fields[idx]
        setattr(match, h_field, home)
        setattr(match, a_field, away)
        fields.extend([h_field, a_field])

    match.score = " ".join(f"{h}:{a}" for h, a in sets_scored[:3])
    fields.append("score")
    if match.winner_id or match.score:
        match.status = Match.Status.FINISHED
        fields.append("status")
    return fields


def import_match_statistics(match: Match, url: str) -> dict:
    payload = fetch_statistics_json(url)
    stats = convert_external_payload(match, payload)
    if stats is None:
        raise ValidationError("После импорта не осталось ни одного показателя.")

    extra_fields = apply_set_scores_from_payload(match, payload)
    match.statistics = stats
    update_fields = ["statistics", *extra_fields]
    if url and url != match.statistics_url:
        match.statistics_url = url
        update_fields.append("statistics_url")
    match.save(update_fields=list(dict.fromkeys(update_fields)))
    return stats
