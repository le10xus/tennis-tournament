"""Матч городов 2026 — отдельный ежегодный турнир Вологда / Череповец."""

from datetime import date

from django.core.management.base import BaseCommand

from core.models import Tournament


class Command(BaseCommand):
    help = "Создать карточку турнира «Матч городов 2026»"

    def add_arguments(self, parser):
        parser.add_argument("--apply", action="store_true")

    def handle(self, *args, **options):
        name = "Матч городов 2026"
        tournament = Tournament.objects.filter(name=name).first()
        self.stdout.write(f"{name}: {'есть' if tournament else 'создать'}")
        if not options["apply"]:
            self.stdout.write(self.style.WARNING("Это план. Для записи добавьте --apply"))
            return

        tournament, created = Tournament.objects.get_or_create(
            name=name,
            defaults={
                "kind": Tournament.Kind.SINGLES,
                "gender_type": "mixed",
                "format": Tournament.Format.ROUND_ROBIN,
                "status": Tournament.Status.FINISHED,
                "start_date": date(2026, 8, 1),
                "end_date": date(2026, 8, 2),
                "location": "Вологда / Череповец",
                "description": "Ежегодный командный турнир Вологда — Череповец.",
                "max_players": 32,
                "source_url": "https://vk.com/wall-10636220_8217",
                "summary_text": (
                    "Матч городов 2026. 1–2 августа, Вологда / Череповец.\n\n"
                    "Командный турнир между Вологдой и Череповцом. "
                    "Результаты и видео — в постах «Матч городов. 1-й день» "
                    "(https://vk.com/wall-10636220_8217) и «2-й день» "
                    "(https://vk.com/wall-10636220_8284)."
                ),
            },
        )
        if not created:
            tournament.start_date = date(2026, 8, 1)
            tournament.end_date = date(2026, 8, 2)
            tournament.location = "Вологда / Череповец"
            tournament.source_url = "https://vk.com/wall-10636220_8217"
            tournament.status = Tournament.Status.FINISHED
            tournament.save()

        self.stdout.write(self.style.SUCCESS(f"Готово: #{tournament.pk}"))
