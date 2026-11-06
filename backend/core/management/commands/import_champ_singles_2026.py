"""Итоги Чемпионата Вологодской области 2026 в одиночных разрядах.

Сетки одиночных разрядов в VK — это видеотрансляции жеребьёвки,
поэтому в протокол заносим официальные итоги (пьедестал) из поста «Итоги».
"""

from datetime import date

from django.core.management.base import BaseCommand
from django.db import transaction

from core.models import Player, Tournament, TournamentResult

TOURNAMENTS = [
    {
        "name": "Чемпионат Вологодской области 2026 — женский одиночный",
        "start": date(2026, 6, 29),
        "end": date(2026, 7, 12),
        "source_url": "https://vk.com/wall-10636220_8292",
        "summary": (
            "Чемпионат Вологодской области по теннису 2026. Женский одиночный разряд.\n"
            "29 июня — 12 июля, Вологда. 23 участницы.\n\n"
            "1. Селек Бализза (Вологда)\n"
            "2. Мукина Нина (Вологда)\n"
            "3. Максина Дарья (Вологда)\n\n"
            "Утешительный турнир: Селек Мира."
        ),
        "results": [
            (1, "Селек Бализза", "Селек Бализза"),
            (2, "Мукина Нина", "Мукина Нина"),
            (3, "Максина Дарья", "Максина Дарья"),
        ],
    },
    {
        "name": "Чемпионат Вологодской области 2026 — мужской одиночный",
        "start": date(2026, 6, 29),
        "end": date(2026, 7, 12),
        "source_url": "https://vk.com/wall-10636220_8292",
        "summary": (
            "Чемпионат Вологодской области по теннису 2026. Мужской одиночный разряд.\n"
            "29 июня — 12 июля, Вологда. 42 участника, 90 матчей за турнир.\n\n"
            "1. Лашков Владислав (Череповец)\n"
            "2. Коноплёв Альберт (Вологда)\n"
            "3. Гумаров Виталий (Вологда)\n\n"
            "Утешительный турнир: Карабанов Евгений."
        ),
        "results": [
            (1, "Лашков Владислав", "Лашков Владислав"),
            (2, "Коноплёв Альберт", "Коноплев Альберт"),
            (3, "Гумаров Виталий", "Гумаров Виталий"),
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
    help = "Итоги Чемпионата Вологодской области 2026 в одиночных разрядах"

    def add_arguments(self, parser):
        parser.add_argument("--apply", action="store_true")

    def handle(self, *args, **options):
        for item in TOURNAMENTS:
            tournament = Tournament.objects.filter(name=item["name"]).first()
            if not tournament:
                self.stdout.write(self.style.ERROR(f"Нет турнира: {item['name']}"))
                continue
            self.stdout.write(f"{item['name']}: {len(item['results'])} призёра")
            if not options["apply"]:
                continue
            with transaction.atomic():
                TournamentResult.objects.filter(tournament=tournament).delete()
                for place, name, captain in item["results"]:
                    TournamentResult.objects.create(
                        tournament=tournament,
                        place=place,
                        name=name,
                        player=get_player(captain),
                    )
                tournament.start_date = item["start"]
                tournament.end_date = item["end"]
                tournament.source_url = item["source_url"]
                tournament.summary_text = item["summary"]
                tournament.points_category = Tournament.PointsCategory.REGION
                tournament.status = Tournament.Status.FINISHED
                tournament.save()

        if not options["apply"]:
            self.stdout.write(self.style.WARNING("Это план. Для записи добавьте --apply"))
        else:
            self.stdout.write(self.style.SUCCESS("Готово"))
