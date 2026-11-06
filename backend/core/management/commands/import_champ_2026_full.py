"""Чемпионат Вологодской области 2026 — участники всех разрядов.

Данные взяты из официальных заявочных листов и жеребьёвок VK-группы
«Теннис, Вологодская область» (посты 658, 660, 751) и Google Sheets.
Команда только создаёт заявки, пары и начисляет очки за пьедестал;
сетки матчей импортируются отдельной командой.
"""

from datetime import date

from django.core.management.base import BaseCommand
from django.db import transaction

from core.models import Player, Tournament, TournamentPointsAward, TournamentRegistration
from core.services.points import participants_count, points_for

MEN_SEEDS = [
    (1, "Лашков Владислав"),
    (2, "Хачатрян Вазген"),
    (3, "Коноплев Альберт"),
    (4, "Богданов Андрей"),
    (5, "Айтман Артем"),
    (6, "Хрулев Антон"),
    (7, "Смирнов Александр"),
    (8, "Игнатьевский Павел"),
    (9, "Хромцов Георгий"),
    (10, "Рогачев Павел"),
    (11, "Поздеев Иван"),
    (12, "Рожков Николай"),
    (13, "Волков Александр"),
    (14, "Гумаров Виталий"),
    (15, "Якуничев Александр"),
    (16, "Беляков Артем"),
]

MEN_UNSEEDED = [
    "Григорьев Кирилл",
    "Рудаков Игорь",
    "Иванов Сергей",
    "Карабанов Евгений",
    "Какама Семен",
    "Маркелов Игорь",
    "Тяпин Марк",
    "Скибин Александр",
    "Кобычев Сергей",
    "Пята Арсений",
    "Баранов Леонид",
    "Баранов Николай",
    "Чегодин Олег",
    "Смирнов Сергей",
    "Суслов Максим",
    "Мокин Александр",
    "Малгин Андрей",
    "Сикорский Юрий",
    "Золотов Евгений",
    "Чигонин Дмитрий",
    "Петрухин Юрий",
    "Пестов Егор",
    "Виноградов Артем",
    "Клыпенков Антон",
    "Ивойлов Сергей",
    "Козлов Дмитрий",
]

WOMEN_SEEDS = [
    (1, "Селек Бализза"),
    (2, "Евграфова Анжелика"),
    (3, "Дулова Лидия"),
    (4, "Дудник Кристина"),
    (5, "Волхонская Полина"),
    (6, "Кашина Валерия"),
    (7, "Селек Мира"),
    (8, "Титова Злата"),
]

WOMEN_UNSEEDED = [
    "Сурикова Алиса",
    "Корякина Юлия",
    "Уткина Елизавета",
    "Якимова Анна",
    "Никитина Ксения",
    "Болдырева Татьяна",
    "Максина Дарья",
    "Хлопачева Екатерина",
    "Хромцова Ольга",
    "Чегодина Мария",
    "Шулепова Елена",
    "Мукина Нина",
    "Селиванова Людмила",
    "Кокина Юлия",
]

MIXED_PAIRS = [
    (1, ["Баранцов Александр", "Хлопачева Екатерина"]),
    (None, ["Маркелов Игорь", "Маркелова Кристина"]),
    (None, ["Беляков Артем", "Осипова Надежда"]),
    (None, ["Чигонин Дмитрий", "Гуреева Инга"]),
    (6, ["Рогачев Павел", "Рогачева Екатерина"]),
    (7, ["Лашков Владислав", "Торочкова Елена"]),
    (None, ["Иванов Денис", "Петровец Марина"]),
    (None, ["Якуничев Александр", "Шулепова Елена"]),
    (None, ["Цветов Василий", "Костерова Ирина"]),
    (3, ["Рогачев Григорий", "Пантина Дарина"]),
    (4, ["Суслов Максим", "Линдгрен Дарья"]),
    (None, ["Парпиев Станислав", "Уткина Елизавета"]),
    (None, ["Волков Александр", "Мукина Нина"]),
    (None, ["Гумаров Виталий", "Гумарова Анна"]),
    (8, ["Кобычев Сергей", "Сурикова Алиса"]),
    (5, ["Клыпенков Антон", "Кашина Валерия"]),
    (None, ["Скибин Александр", "Евграфова Анжелика"]),
    (None, ["Козлов Дмитрий", "Кокина Юлия"]),
    (None, ["Игнатьевский Павел", "Игнатьевская Марина"]),
    (2, ["Хрулев Антон", "Дудник Кристина"]),
]

TOURNAMENTS = [
    {
        "name": "Чемпионат Вологодской области 2026 — мужской одиночный",
        "kind": "singles",
        "gender": "male",
        "max_players": 64,
        "seeds": MEN_SEEDS,
        "unseeded": MEN_UNSEEDED,
        "source_url": "https://vk.com/wall-28958642_719",
        "podium": [(1, "Лашков Владислав"), (2, "Коноплев Альберт"), (3, "Гумаров Виталий")],
    },
    {
        "name": "Чемпионат Вологодской области 2026 — женский одиночный",
        "kind": "singles",
        "gender": "female",
        "max_players": 32,
        "seeds": WOMEN_SEEDS,
        "unseeded": WOMEN_UNSEEDED,
        "source_url": "https://vk.com/wall-28958642_719",
        "podium": [(1, "Селек Бализза"), (2, "Мукина Нина"), (3, "Максина Дарья")],
    },
    {
        "name": "Чемпионат Вологодской области 2026 — микст",
        "kind": "doubles",
        "gender": "mixed",
        "max_players": 32,
        "pairs": MIXED_PAIRS,
        "source_url": "https://vk.com/wall-28958642_771",
        "podium": [
            (1, ["Рогачев Павел", "Рогачева Екатерина"]),
            (2, ["Суслов Максим", "Линдгрен Дарья"]),
            (3, ["Скибин Александр", "Евграфова Анжелика"]),
        ],
    },
]


def norm(value):
    return value.replace("ё", "е").replace("Ё", "Е").strip().lower()


class Command(BaseCommand):
    help = "Чемпионат Вологодской области 2026: заявки, пары и пьедестал"

    def add_arguments(self, parser):
        parser.add_argument("--apply", action="store_true")

    def handle(self, *args, **options):
        players = list(Player.objects.all())
        by_name = {}
        for player in players:
            by_name[(norm(player.last_name), norm(player.first_name))] = player

        def get_player(name, gender):
            parts = name.split(" ", 1)
            last, first = parts[0], parts[1] if len(parts) > 1 else ""
            key = (norm(last), norm(first))
            found = by_name.get(key)
            if found:
                return found
            base = f"champ-{last}-{first}".lower().replace("ё", "е").replace(" ", "-")
            email = f"{base}@tennis.local"
            suffix = 1
            while Player.objects.filter(email=email).exists():
                suffix += 1
                email = f"{base}-{suffix}@tennis.local"
            found = Player.objects.create(
                first_name=first,
                last_name=last,
                email=email,
                gender=gender,
            )
            by_name[key] = found
            return found

        for item in TOURNAMENTS:
            tournament = Tournament.objects.filter(name=item["name"]).first()
            if not tournament:
                self.stdout.write(self.style.ERROR(f"Нет турнира: {item['name']}"))
                continue
            self.stdout.write(f"{item['name']}: участники")
            if not options["apply"]:
                continue

            with transaction.atomic():
                TournamentRegistration.objects.filter(tournament=tournament).delete()
                if item["kind"] == "singles":
                    for seed, name in item["seeds"]:
                        TournamentRegistration.objects.create(
                            tournament=tournament,
                            player=get_player(name, item["gender"]),
                            status=TournamentRegistration.Status.APPROVED,
                            seed=seed,
                        )
                    for name in item["unseeded"]:
                        TournamentRegistration.objects.create(
                            tournament=tournament,
                            player=get_player(name, item["gender"]),
                            status=TournamentRegistration.Status.APPROVED,
                        )
                else:
                    for pair_id, (seed, names) in enumerate(item["pairs"], start=1):
                        for name in names:
                            gender = "female" if name.split(" ", 1)[0] in {
                                "Хлопачева", "Маркелова", "Осипова", "Гуреева",
                                "Рогачева", "Торочкова", "Петровец", "Шулепова",
                                "Костерова", "Пантина", "Линдгрен", "Уткина",
                                "Мукина", "Гумарова", "Сурикова", "Кашина",
                                "Евграфова", "Кокина", "Игнатьевская", "Дудник",
                            } else "male"
                            TournamentRegistration.objects.create(
                                tournament=tournament,
                                player=get_player(name, gender),
                                status=TournamentRegistration.Status.APPROVED,
                                seed=seed if name == names[0] else None,
                                pair_id=pair_id,
                            )

                tournament.kind = item["kind"]
                tournament.gender_type = item["gender"]
                tournament.max_players = item["max_players"]
                tournament.points_category = "region"
                tournament.status = Tournament.Status.FINISHED
                tournament.source_url = item["source_url"]
                tournament.save()

                # Пьедестал уже записан в TournamentResult; очки только за 1-3.
                TournamentPointsAward.objects.filter(tournament=tournament).delete()
                count = participants_count(tournament)
                field = "points_doubles" if item["kind"] == "doubles" else "points_singles"
                for place, subject in item["podium"]:
                    names = subject if isinstance(subject, list) else [subject]
                    points = points_for("region", "olympic", count, str(place))
                    for name in names:
                        player = get_player(name, "female" if item["kind"] == "doubles" else item["gender"])
                        setattr(player, field, getattr(player, field) + points)
                        player.save(update_fields=[field])
                        TournamentPointsAward.objects.create(
                            tournament=tournament,
                            player=player,
                            place=str(place),
                            points=points,
                        )

        self.stdout.write(
            self.style.SUCCESS("Готово" if options["apply"] else "Dry-run. Добавьте --apply")
        )
