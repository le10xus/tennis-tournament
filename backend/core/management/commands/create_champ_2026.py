"""Пять турниров Чемпионата Вологодской области 2026.

Создаёт карточки турниров, которых не было в пилоте 12 ТВД:
женский/мужской одиночный, мужская/женская пара, микст.
Сетки и результаты добавляются отдельно, когда есть выгрузка из VK.
"""

from datetime import date

from django.core.management.base import BaseCommand

from core.models import Tournament


TOURNAMENTS = [
    {
        "name": "Чемпионат Вологодской области 2026 — женский одиночный",
        "kind": Tournament.Kind.SINGLES,
        "gender_type": "female",
        "start": date(2026, 6, 25),
        "end": date(2026, 7, 12),
        "max_players": 32,
        "source_url": "https://vk.com/wall-10636220_8065",
        "summary": (
            "Чемпионат Вологодской области по теннису 2026. "
            "Женский одиночный разряд. 25 июня — 12 июля, Вологда.\n\n"
            "Финал: https://vk.com/wall-10636220_8065"
        ),
    },
    {
        "name": "Чемпионат Вологодской области 2026 — мужской одиночный",
        "kind": Tournament.Kind.SINGLES,
        "gender_type": "male",
        "start": date(2026, 6, 25),
        "end": date(2026, 7, 12),
        "max_players": 32,
        "source_url": "https://vk.com/wall-10636220_8144",
        "summary": (
            "Чемпионат Вологодской области по теннису 2026. "
            "Мужской одиночный разряд. 25 июня — 12 июля, Вологда.\n\n"
            "Финал: https://vk.com/wall-10636220_8144"
        ),
    },
    {
        "name": "Чемпионат Вологодской области 2026 — мужская пара",
        "kind": Tournament.Kind.DOUBLES,
        "gender_type": "male",
        "start": date(2026, 8, 13),
        "end": date(2026, 8, 30),
        "max_players": 16,
        "source_url": "https://vk.com/wall-10636220_8560",
        "summary": (
            "Чемпионат Вологодской области по теннису 2026. "
            "Мужской парный разряд. 13–30 августа, Вологда.\n\n"
            "Финал: https://vk.com/wall-10636220_8560"
        ),
    },
    {
        "name": "Чемпионат Вологодской области 2026 — женская пара",
        "kind": Tournament.Kind.DOUBLES,
        "gender_type": "female",
        "start": date(2026, 8, 13),
        "end": date(2026, 8, 30),
        "max_players": 16,
        "source_url": "https://vk.com/wall-10636220_8555",
        "summary": (
            "Чемпионат Вологодской области по теннису 2026. "
            "Женский парный разряд. 13–30 августа, Вологда.\n\n"
            "Финалы и матчи за 3-е место: https://vk.com/wall-10636220_8555"
        ),
    },
    {
        "name": "Чемпионат Вологодской области 2026 — микст",
        "kind": Tournament.Kind.DOUBLES,
        "gender_type": "mixed",
        "start": date(2026, 8, 13),
        "end": date(2026, 8, 30),
        "max_players": 16,
        "source_url": "https://vk.com/wall-10636220_8571",
        "summary": (
            "Чемпионат Вологодской области по теннису 2026. "
            "Смешанный парный разряд. 13–30 августа, Вологда.\n\n"
            "Финал: https://vk.com/wall-10636220_8571"
        ),
    },
]


class Command(BaseCommand):
    help = "Создать пять турниров Чемпионата Вологодской области 2026"

    def add_arguments(self, parser):
        parser.add_argument("--apply", action="store_true", help="Записать в БД")

    def handle(self, *args, **options):
        for item in TOURNAMENTS:
            exists = Tournament.objects.filter(name=item["name"]).first()
            self.stdout.write(
                f"{item['name']}: {'есть' if exists else 'создать'}"
            )
            if not options["apply"]:
                continue
            tournament, created = Tournament.objects.get_or_create(
                name=item["name"],
                defaults={
                    "kind": item["kind"],
                    "gender_type": item["gender_type"],
                    "format": Tournament.Format.SINGLE_ELIM,
                    "status": Tournament.Status.FINISHED,
                    "start_date": item["start"],
                    "end_date": item["end"],
                    "location": "Вологда",
                    "description": "Чемпионат Вологодской области по теннису 2026.",
                    "max_players": item["max_players"],
                    "set_games": 6,
                    "third_set_super_tiebreak": True,
                    "points_category": Tournament.PointsCategory.REGION,
                    "summary_text": item["summary"],
                    "source_url": item["source_url"],
                    "regulation_url": "https://sites.google.com/view/ftvo-35/",
                },
            )
            if not created:
                tournament.kind = item["kind"]
                tournament.gender_type = item["gender_type"]
                tournament.start_date = item["start"]
                tournament.end_date = item["end"]
                tournament.location = "Вологда"
                tournament.max_players = item["max_players"]
                tournament.points_category = Tournament.PointsCategory.REGION
                tournament.summary_text = item["summary"]
                tournament.source_url = item["source_url"]
                tournament.regulation_url = "https://sites.google.com/view/ftvo-35/"
                tournament.save()

        if not options["apply"]:
            self.stdout.write(self.style.WARNING("Это план. Для записи добавьте --apply"))
        else:
            self.stdout.write(self.style.SUCCESS("Готово"))
