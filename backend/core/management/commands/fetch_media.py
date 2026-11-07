"""Догрузка фото турниров из Git LFS в MEDIA_ROOT.

Нужна на Amvera: Docker-образ собирается из GitHub, но Git LFS не тянется
автоматически. Команда читает backend/core/data/media_manifest.json и
скачивает отсутствующие файлы с media.githubusercontent.com.
"""

import json
import os
import urllib.parse
import urllib.request
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand

DEFAULT_SOURCE = (
    "https://media.githubusercontent.com/media/le10xus/tennis-tournament/"
    "main/backend/media"
)


class Command(BaseCommand):
    help = "Скачать отсутствующие фото из Git LFS в MEDIA_ROOT"

    def add_arguments(self, parser):
        parser.add_argument("--force", action="store_true", help="Перекачать файлы")
        parser.add_argument("--dry-run", action="store_true", help="Только показать")

    def handle(self, *args, **options):
        manifest_path = Path(settings.BASE_DIR) / "core" / "data" / "media_manifest.json"
        media_root = Path(settings.MEDIA_ROOT)
        source = os.getenv("MEDIA_SOURCE_URL", DEFAULT_SOURCE).rstrip("/")
        paths = json.loads(manifest_path.read_text(encoding="utf-8"))

        downloaded = 0
        skipped = 0
        failed = []

        for index, relative in enumerate(paths, start=1):
            destination = media_root / relative
            if destination.exists() and destination.stat().st_size > 0 and not options["force"]:
                skipped += 1
                continue

            if options["dry_run"]:
                self.stdout.write(f"would download {relative}")
                continue

            destination.parent.mkdir(parents=True, exist_ok=True)
            url = f"{source}/{urllib.parse.quote(relative)}"
            try:
                urllib.request.urlretrieve(url, destination)
                downloaded += 1
                if downloaded % 10 == 0:
                    self.stdout.write(f"downloaded {downloaded}/{len(paths)}")
            except Exception as exc:  # noqa: BLE001
                failed.append((relative, str(exc)))
                self.stderr.write(f"failed {relative}: {exc}")

        self.stdout.write(
            self.style.SUCCESS(
                f"media: downloaded={downloaded} skipped={skipped} failed={len(failed)}"
            )
        )
        if failed:
            self.stderr.write(f"first failure: {failed[0]}")
