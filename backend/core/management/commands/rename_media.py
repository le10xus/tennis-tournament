"""Переименование фото турниров из vk-<id>-<n>.jpg в <slug>-<n>.jpg.

Нужно, чтобы файлы в media назывались по турниру и их было удобно смотреть.
"""

import os

from django.conf import settings
from django.core.management.base import BaseCommand

from core.models import TournamentPhoto

SLUGS = {
    50: "zimniy-mikst-2026",
    51: "kubok-8-marta",
    52: "kubok-muzhestva-vesna-2026",
    53: "muzhskoy-start",
    54: "gruntovoe-solo",
    55: "uts",
    57: "kubok-vologdy-muzhchiny",
    58: "zhenskiy-tvd-10",
    59: "kubok-muzhestva-osen-2026",
    60: "kruzheva-igry",
    61: "kubok-vologdy-zhenshchiny",
    62: "mir-tennis-may",
}


class Command(BaseCommand):
    help = "Переименовать фото турниров по названию турнира"

    def add_arguments(self, parser):
        parser.add_argument("--apply", action="store_true", help="Записать изменения")

    def handle(self, *args, **options):
        apply_changes = options["apply"]

        for tournament_id, slug in SLUGS.items():
            photos = (
                TournamentPhoto.objects
                .filter(tournament_id=tournament_id)
                .select_related("tournament")
                .order_by("order", "id")
            )
            for index, photo in enumerate(photos, start=1):
                extension = os.path.splitext(photo.image.name)[1] or ".jpg"
                new_rel = f"tournaments/photos/{slug}-{index}{extension}"
                if photo.image.name == new_rel:
                    continue

                old_path = photo.image.path
                new_path = os.path.join(settings.MEDIA_ROOT, new_rel)
                exists = os.path.exists(old_path)
                self.stdout.write(
                    f"{tournament_id}: {photo.image.name} -> {new_rel}"
                    f"{'' if exists else ' (файла нет)'}"
                )
                if not apply_changes:
                    continue

                if exists:
                    if os.path.exists(new_path):
                        os.remove(old_path)
                    else:
                        os.makedirs(os.path.dirname(new_path), exist_ok=True)
                        os.replace(old_path, new_path)

                photo.image.name = new_rel
                fields = ["image"]
                if not photo.caption:
                    photo.caption = f"{photo.tournament.name} — фото {index}"
                    fields.append("caption")
                photo.save(update_fields=fields)

        if not apply_changes:
            self.stdout.write(self.style.WARNING("Это план. Для записи добавьте --apply"))
        else:
            self.stdout.write(self.style.SUCCESS("Готово"))
