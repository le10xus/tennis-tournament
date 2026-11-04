"""Возрастные ограничения турнира."""

from datetime import date


def player_age(player, on_date=None):
    """Возраст игрока на дату турнира. None — если данных о рождении нет."""
    on_date = on_date or date.today()
    if player.birth_date:
        years = on_date.year - player.birth_date.year
        if (on_date.month, on_date.day) < (
            player.birth_date.month,
            player.birth_date.day,
        ):
            years -= 1
        return years
    if player.birth_year:
        return on_date.year - player.birth_year
    return None


def age_check(tournament, players):
    """Проверяет возрастной ценз.

    Возвращает (ok, message). Неизвестный возраст не блокирует заявку —
    решение остаётся за администратором.
    """
    on_date = tournament.start_date or date.today()
    ages = [(player, player_age(player, on_date)) for player in players]

    if tournament.age_min:
        for player, age in ages:
            if age is not None and age < tournament.age_min:
                return False, (
                    f"{player.last_name} {player.first_name}: возраст {age} — "
                    f"нужно не меньше {tournament.age_min} лет."
                )

    if tournament.kind == "doubles" and tournament.pair_age_sum_min:
        known = [age for _, age in ages if age is not None]
        if len(known) == len(ages) and len(known) >= 2:
            total = sum(known)
            if total < tournament.pair_age_sum_min:
                return False, (
                    f"Сумма возрастов пары {total} — нужно не меньше "
                    f"{tournament.pair_age_sum_min}."
                )

    return True, ""
