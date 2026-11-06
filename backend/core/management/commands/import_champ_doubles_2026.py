"""Чемпионат Вологодской области 2026 — парные разряды.

Данные из официальной таблицы (Google Sheets), вкладки:
мужская пара, женская пара, смешанный разряд.
"""

from datetime import date, datetime, time

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from core.models import Match, Player, Tournament, TournamentRegistration, TournamentResult

TZ = timezone.get_current_timezone()

MEN_PAIRS = [
    (1, ["Садов Евгений", "Хрулев Антон"]),
    (None, ["Баранов Леонид", "Гумаров Виталий"]),
    (None, ["Рогачев Григорий", "Козлов Дмитрий"]),
    (None, ["Карабанов Евгений", "Кашин Юрий"]),
    (4, ["Кобычев Сергей", "Матюков Матвей"]),
    (None, ["Затейников Владимир", "Погорелец Владислав"]),
    (None, ["Волков Александр", "Игнатьевский Павел"]),
    (None, ["Парпиев Станислав", "Рогачев Павел"]),
    (None, ["Какама Семен", "Поздеев Иван"]),
    (None, ["Суслов Максим", "Клыпенков Антон"]),
    (None, ["Коноплев Альберт", "Потехин Михаил"]),
    (3, ["Кузнецов Сергей", "Лашков Владислав"]),
    (None, ["Рожков Николай", "Якуничев Александр"]),
    (None, ["Беляков Артем", "Скибин Александр"]),
    (None, ["Маркелов Игорь", "Тяпин Марк"]),
    (2, ["Баранцов Александр", "Кагарлицкий Андрей"]),
]

MEN_MATCHES = [
    # 1/8
    (1, ["Садов Евгений", "Хрулев Антон"], ["Баранов Леонид", "Гумаров Виталий"], "6:0 6:1", 1),
    (1, ["Рогачев Григорий", "Козлов Дмитрий"], ["Карабанов Евгений", "Кашин Юрий"], "6:2 7:5", 1),
    (1, ["Кобычев Сергей", "Матюков Матвей"], ["Затейников Владимир", "Погорелец Владислав"], "6:3 6:3", 1),
    (1, ["Парпиев Станислав", "Рогачев Павел"], ["Волков Александр", "Игнатьевский Павел"], "4:6 6:4 7:6(5)", 1),
    (1, ["Суслов Максим", "Клыпенков Антон"], ["Какама Семен", "Поздеев Иван"], "6:2 6:2", 1),
    (1, ["Кузнецов Сергей", "Лашков Владислав"], ["Коноплев Альберт", "Потехин Михаил"], "6:4 6:2", 1),
    (1, ["Беляков Артем", "Скибин Александр"], ["Рожков Николай", "Якуничев Александр"], "6:1 7:5", 1),
    (1, ["Баранцов Александр", "Кагарлицкий Андрей"], ["Маркелов Игорь", "Тяпин Марк"], "6:2 6:0", 1),
    # 1/4
    (2, ["Садов Евгений", "Хрулев Антон"], ["Рогачев Григорий", "Козлов Дмитрий"], "6:3 6:3", 1),
    (2, ["Кобычев Сергей", "Матюков Матвей"], ["Парпиев Станислав", "Рогачев Павел"], "6:4 4:6 6:2", 1),
    (2, ["Кузнецов Сергей", "Лашков Владислав"], ["Суслов Максим", "Клыпенков Антон"], "5:7 6:0 6:3", 1),
    (2, ["Баранцов Александр", "Кагарлицкий Андрей"], ["Беляков Артем", "Скибин Александр"], "6:2 6:3", 1),
    # 1/2
    (3, ["Кобычев Сергей", "Матюков Матвей"], ["Садов Евгений", "Хрулев Антон"], "6:3 6:3", 1),
    (3, ["Кузнецов Сергей", "Лашков Владислав"], ["Баранцов Александр", "Кагарлицкий Андрей"], "6:4 6:1", 1),
    # финал
    (4, ["Кобычев Сергей", "Матюков Матвей"], ["Кузнецов Сергей", "Лашков Владислав"], "4:6 6:4 6:2", 1),
]

MEN_THIRD = (["Садов Евгений", "Хрулев Антон"], ["Баранцов Александр", "Кагарлицкий Андрей"], "6:2 6:2", 1)

WOMEN_PAIRS = [
    (1, ["Кашина Валерия", "Линдгрен Дарья"]),
    (None, ["Костерова Ирина", "Тугаринова Наталья"]),
    (3, ["Волхонская Полина", "Евграфова Анжелика"]),
    (None, ["Маркина Юлия", "Торочкова Елена"]),
    (None, ["Гумарова Анна", "Касьянова Татьяна"]),
    (None, ["Маркелова Кристина", "Чегодина Мария"]),
    (4, ["Пантина Дарина", "Сурикова Алиса"]),
    (None, ["Кокина Юлия", "Селиванова Людмила"]),
    (None, ["Мукина Нина", "Шулепова Елена"]),
    (2, ["Дудник Кристина", "Хлопачева Екатерина"]),
]

WOMEN_MATCHES = [
    # 1/8
    (1, ["Маркина Юлия", "Торочкова Елена"], ["Гумарова Анна", "Касьянова Татьяна"], "0:6 2:6", 2),
    (1, ["Кокина Юлия", "Селиванова Людмила"], ["Мукина Нина", "Шулепова Елена"], "2:6 2:6", 2),
    # 1/4
    (2, ["Кашина Валерия", "Линдгрен Дарья"], ["Костерова Ирина", "Тугаринова Наталья"], "6:1 6:0", 1),
    (2, ["Волхонская Полина", "Евграфова Анжелика"], ["Гумарова Анна", "Касьянова Татьяна"], "6:1 6:2", 1),
    (2, ["Пантина Дарина", "Сурикова Алиса"], ["Маркелова Кристина", "Чегодина Мария"], "6:1 6:0", 1),
    (2, ["Дудник Кристина", "Хлопачева Екатерина"], ["Мукина Нина", "Шулепова Елена"], "7:5 6:3", 1),
    # 1/2
    (3, ["Кашина Валерия", "Линдгрен Дарья"], ["Волхонская Полина", "Евграфова Анжелика"], "3:6 6:3 6:2", 1),
    (3, ["Мукина Нина", "Шулепова Елена"], ["Пантина Дарина", "Сурикова Алиса"], "0:6 6:4 6:2", 1),
    # финал
    (4, ["Кашина Валерия", "Линдгрен Дарья"], ["Мукина Нина", "Шулепова Елена"], "6:3 6:0", 1),
]

WOMEN_THIRD = (["Пантина Дарина", "Сурикова Алиса"], ["Волхонская Полина", "Евграфова Анжелика"], "6:3 6:1", 1)

MIXED_PAIRS = [
    (6, ["Рогачев Павел", "Рогачева Екатерина"]),
    (4, ["Суслов Максим", "Линдгрен Дарья"]),
    (None, ["Скибин Александр", "Евграфова Анжелика"]),
    (None, ["Лашков Владислав", "Торочкова Елена"]),
]

MIXED_MATCHES = [
    (1, ["Рогачев Павел", "Рогачева Екатерина"], ["Лашков Владислав", "Торочкова Елена"], "6:1 3:6 [10:4]", 1),
    (1, ["Суслов Максим", "Линдгрен Дарья"], ["Скибин Александр", "Евграфова Анжелика"], "7:5 6:1", 1),
    (2, ["Рогачев Павел", "Рогачева Екатерина"], ["Суслов Максим", "Линдгрен Дарья"], "6:1 3:6 [10:4]", 1),
]

MIXED_THIRD = (["Скибин Александр", "Евграфова Анжелика"], ["Лашков Владислав", "Торочкова Елена"], "6:2 3:6 [10:6]", 1)

TOURNAMENTS = [
    {
        "name": "Чемпионат Вологодской области 2026 — мужская пара",
        "start": date(2026, 8, 17),
        "end": date(2026, 8, 30),
        "pairs": MEN_PAIRS,
        "matches": MEN_MATCHES,
        "third": MEN_THIRD,
        "slots": [0, 1, 2, 3, 4, 5, 6, 7],
        "source_url": "https://vk.com/wall-10636220_8588",
        "points_category": "region",
        "summary": "Чемпионат Вологодской области 2026. Мужской парный разряд.\n\n"
                   "1. Матюков Матвей / Кобычев Сергей\n"
                   "2. Лашков Владислав / Кузнецов Сергей\n"
                   "3. Садов Евгений / Хрулёв Антон",
        "results": [
            (1, "Матюков Матвей / Кобычев Сергей", "Матюков Матвей"),
            (2, "Лашков Владислав / Кузнецов Сергей", "Лашков Владислав"),
            (3, "Садов Евгений / Хрулёв Антон", "Садов Евгений"),
        ],
    },
    {
        "name": "Чемпионат Вологодской области 2026 — женская пара",
        "start": date(2026, 8, 17),
        "end": date(2026, 8, 30),
        "pairs": WOMEN_PAIRS,
        "matches": WOMEN_MATCHES,
        "third": WOMEN_THIRD,
        "slots": [3, 6],
        "source_url": "https://vk.com/wall-10636220_8588",
        "points_category": "region",
        "summary": "Чемпионат Вологодской области 2026. Женский парный разряд.\n\n"
                   "1. Кашина Валерия / Линдгрен Дарья\n"
                   "2. Мукина Нина / Шулепова Елена\n"
                   "3. Пантина Дарина / Сурикова Алиса",
        "results": [
            (1, "Кашина Валерия / Линдгрен Дарья", "Кашина Валерия"),
            (2, "Мукина Нина / Шулепова Елена", "Мукина Нина"),
            (3, "Пантина Дарина / Сурикова Алиса", "Пантина Дарина"),
        ],
    },
    {
        "name": "Чемпионат Вологодской области 2026 — микст",
        "start": date(2026, 8, 17),
        "end": date(2026, 8, 30),
        "pairs": MIXED_PAIRS,
        "matches": MIXED_MATCHES,
        "third": MIXED_THIRD,
        "slots": [0, 1],
        "source_url": "https://vk.com/wall-10636220_8588",
        "points_category": "",
        "summary": "Чемпионат Вологодской области 2026. Смешанный парный разряд.\n\n"
                   "1. Рогачёв Павел / Рогачёва Екатерина\n"
                   "2. Суслов Максим / Линдгрен Дарья\n"
                   "3. Скибин Александр / Евграфова Анжелика",
        "results": [
            (1, "Рогачёв Павел / Рогачёва Екатерина", "Рогачев Павел"),
            (2, "Суслов Максим / Линдгрен Дарья", "Суслов Максим"),
            (3, "Скибин Александр / Евграфова Анжелика", "Скибин Александр"),
        ],
    },
]


def get_player(name):
    last, first = name.split(" ", 1)
    player = Player.objects.filter(
        last_name__iexact=last, first_name__iexact=first
    ).first()
    if player:
        return player
    base = f"champ-{last}-{first}".lower().replace(" ", "-")
    email = f"{base}@tennis.local"
    suffix = 1
    while Player.objects.filter(email=email).exists():
        suffix += 1
        email = f"{base}-{suffix}@tennis.local"
    return Player.objects.create(
        first_name=first,
        last_name=last,
        email=email,
        gender="female",
    )


class Command(BaseCommand):
    help = "Импорт парных турниров Чемпионата Вологодской области 2026"

    def add_arguments(self, parser):
        parser.add_argument("--apply", action="store_true")

    def handle(self, *args, **options):
        for item in TOURNAMENTS:
            tournament = Tournament.objects.filter(name=item["name"]).first()
            if not tournament:
                self.stdout.write(self.style.ERROR(f"Нет турнира: {item['name']}"))
                continue
            self.stdout.write(
                f"{item['name']}: пар {len(item['pairs'])}, матчей {len(item['matches'])}"
            )
            if not options["apply"]:
                continue

            with transaction.atomic():
                Match.objects.filter(tournament=tournament, is_historical=True).delete()
                TournamentResult.objects.filter(tournament=tournament).delete()

                for pair_id, (seed, names) in enumerate(item["pairs"], start=1):
                    for name in names:
                        player = get_player(name)
                        TournamentRegistration.objects.update_or_create(
                            tournament=tournament,
                            player=player,
                            defaults={
                                "status": TournamentRegistration.Status.APPROVED,
                                "seed": seed,
                                "pair_id": pair_id,
                            },
                        )

                slot_by_round = {}
                for round_no, p1, p2, score, winner_side in item["matches"]:
                    slot = slot_by_round.get(round_no, 0)
                    slot_by_round[round_no] = slot + 1
                    slot_index = slot
                    if round_no == 1 and item.get("slots") and slot < len(item["slots"]):
                        slot_index = item["slots"][slot]
                    side1 = [get_player(name) for name in p1]
                    side2 = [get_player(name) for name in p2]
                    winner = side1[0] if winner_side == 1 else side2[0]
                    Match.objects.create(
                        tournament=tournament,
                        gender_type=tournament.gender_type,
                        bracket=Match.Bracket.WINNERS,
                        round_number=round_no,
                        slot_index=slot_index,
                        player1=side1[0],
                        pair1_player2=side1[1] if len(side1) > 1 else None,
                        player2=side2[0],
                        pair2_player2=side2[1] if len(side2) > 1 else None,
                        winner=winner,
                        status=Match.Status.FINISHED,
                        score=score,
                        is_historical=True,
                        scheduled_at=timezone.make_aware(
                            datetime.combine(tournament.start_date, time(10, 0)), TZ
                        ),
                    )

                p1, p2, score, winner_side = item["third"]
                side1 = [get_player(name) for name in p1]
                side2 = [get_player(name) for name in p2]
                Match.objects.create(
                    tournament=tournament,
                    gender_type=tournament.gender_type,
                    bracket=Match.Bracket.THIRD_PLACE,
                    round_number=1,
                    slot_index=0,
                    player1=side1[0],
                    pair1_player2=side1[1] if len(side1) > 1 else None,
                    player2=side2[0],
                    pair2_player2=side2[1] if len(side2) > 1 else None,
                    winner=side1[0] if winner_side == 1 else side2[0],
                    status=Match.Status.FINISHED,
                    score=score,
                    is_historical=True,
                    scheduled_at=timezone.make_aware(
                        datetime.combine(tournament.start_date, time(10, 0)), TZ
                    ),
                )

                for place, name, captain in item["results"]:
                    TournamentResult.objects.create(
                        tournament=tournament,
                        place=place,
                        name=name,
                        player=get_player(captain),
                    )

                tournament.format = Tournament.Format.SINGLE_ELIM
                tournament.status = Tournament.Status.FINISHED
                tournament.start_date = item["start"]
                tournament.end_date = item["end"]
                tournament.source_url = item["source_url"]
                tournament.summary_text = item["summary"]
                tournament.points_category = item["points_category"]
                tournament.save()

        if not options["apply"]:
            self.stdout.write(self.style.WARNING("Это план. Для записи добавьте --apply"))
        else:
            self.stdout.write(self.style.SUCCESS("Готово"))
