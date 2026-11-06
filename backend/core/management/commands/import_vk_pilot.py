"""Пилотный импорт турниров 2026 года из группы ВК «БТ35».

Источник — JSON, выгруженный из VK: список постов с текстами и фото.
Запуск без --apply показывает план, с --apply создаёт турниры.
"""

import json
import re
import urllib.request
from datetime import date

from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from core.models import (
    Player,
    Tournament,
    TournamentPhoto,
    TournamentResult,
    TournamentVideo,
)

TRANSLIT = {
    "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "e",
    "ж": "zh", "з": "z", "и": "i", "й": "y", "к": "k", "л": "l", "м": "m",
    "н": "n", "о": "o", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u",
    "ф": "f", "х": "h", "ц": "c", "ч": "ch", "ш": "sh", "щ": "sch", "ъ": "",
    "ы": "y", "ь": "", "э": "e", "ю": "yu", "я": "ya", " ": "-",
}

ALIASES = {
    "Загребина Валерия": "Кашина Валерия",
}


def translit(value):
    return "".join(TRANSLIT.get(char, char) for char in value.lower())


def split_name(value):
    value = re.sub(r"\s+", " ", value.replace("ё", "е")).strip(" .,")
    parts = [part for part in value.split(" ") if part]
    if len(parts) >= 2:
        return parts[0], " ".join(parts[1:])
    return value, ""


TOURNAMENTS = [
    {
        "title": "Зимний микст 2026",
        "post_ids": [7152, 7164],
        "start": date(2026, 2, 7),
        "end": date(2026, 2, 8),
        "kind": "doubles",
        "gender": "mixed",
        "format": "round_robin",
        "max_players": 16,
        "location": "Череповец",
        "podium": [],
    },
    {
        "title": "Кубок 8 марта",
        "post_ids": [7225],
        "start": date(2026, 3, 7),
        "end": date(2026, 3, 8),
        "kind": "singles",
        "gender": "female",
        "format": "double_elim",
        "max_players": 13,
        "location": "Череповец",
        "podium": [
            (1, ["Евграфова Анжелика"]),
            (2, ["Волхонская Полина"]),
            (3, ["Дудник Кристина"]),
        ],
    },
    {
        "title": "Кубок мужества. Весна 2026",
        "post_ids": [7277, 7258],
        "start": date(2026, 3, 21),
        "end": date(2026, 3, 22),
        "kind": "singles",
        "gender": "male",
        "format": "single_elim",
        "max_players": 27,
        "location": "Череповец",
        "podium": [
            (1, ["Папашвили Давид"]),
            (2, ["Баранцов Александр"]),
        ],
    },
    {
        "title": "Мужской старт",
        "post_ids": [7372],
        "start": date(2026, 4, 11),
        "end": date(2026, 4, 12),
        "kind": "singles",
        "gender": "male",
        "format": "single_elim",
        "max_players": 20,
        "location": "Череповец",
        "podium": [
            (1, ["Иванов Денис"]),
            (2, ["Голыгин Дмитрий"]),
            (3, ["Корниенко Владислав"]),
        ],
    },
    {
        "title": "Мир! Теннис! Май!",
        "post_ids": [7450],
        "start": date(2026, 5, 1),
        "end": date(2026, 5, 2),
        "kind": "singles",
        "gender": "female",
        "format": "double_elim",
        "max_players": 16,
        "location": "Череповец",
        "podium": [
            (1, ["Кашина Валерия"]),
            (2, ["Дудник Кристина"]),
            (3, ["Евграфова Анжелика"]),
        ],
    },
    {
        "title": "Грунтовое соло",
        "post_ids": [7671],
        "start": date(2026, 6, 13),
        "end": date(2026, 6, 14),
        "kind": "singles",
        "gender": "female",
        "format": "round_robin",
        "max_players": 10,
        "location": "Череповец",
        "podium": [
            (1, ["Осипова Надежда"]),
            (2, ["Шулепова Елена"]),
            (3, ["Торочкова Елена"]),
        ],
    },
    {
        "title": "UTS",
        "post_ids": [8208],
        "start": date(2026, 7, 25),
        "end": date(2026, 7, 26),
        "kind": "singles",
        "gender": "male",
        "format": "round_robin",
        "max_players": 18,
        "location": "Череповец",
        "podium": [
            (1, ["Гумаров Виталий"]),
            (2, ["Хрулёв Антон"]),
            (3, ["Игнатьевский Павел"]),
        ],
    },
    {
        "title": "Кубок Вологды 2026 (мужчины)",
        "post_ids": [8390],
        "start": date(2026, 8, 15),
        "end": date(2026, 8, 16),
        "kind": "singles",
        "gender": "male",
        "format": "single_elim",
        "max_players": 16,
        "location": "Вологда",
        "podium": [
            (1, ["Баранцов Александр"]),
            (2, ["Хрулёв Антон"]),
            (3, ["Гумаров Виталий"]),
        ],
    },
    {
        "title": "Кубок Вологды 2026 (женщины)",
        "post_ids": [8390],
        "start": date(2026, 8, 15),
        "end": date(2026, 8, 16),
        "kind": "singles",
        "gender": "female",
        "format": "single_elim",
        "max_players": 16,
        "location": "Вологда",
        "podium": [
            (1, ["Селиванова Людмила"]),
            (2, ["Кокина Юлия"]),
            (3, ["Костерова Ирина"]),
        ],
    },
    {
        "title": "Женский одиночный ТВД (10-й)",
        "post_ids": [8647],
        "start": date(2026, 9, 19),
        "end": date(2026, 9, 20),
        "kind": "singles",
        "gender": "female",
        "format": "single_elim",
        "max_players": 9,
        "location": "Череповец",
        "podium": [
            (1, ["Дудник Кристина"]),
            (2, ["Евграфова Анжелика"]),
            (3, ["Волхонская Полина"]),
        ],
    },
    {
        "title": "Кубок мужества. Осень 2026",
        "post_ids": [8741],
        "start": date(2026, 10, 10),
        "end": date(2026, 10, 11),
        "kind": "singles",
        "gender": "male",
        "format": "single_elim",
        "max_players": 27,
        "location": "Череповец",
        "podium": [
            (1, ["Гумаров Виталий"]),
            (2, ["Хрулёв Антон"]),
            (3, ["Скибин Александр"]),
        ],
    },
    {
        "title": "Кружева игры",
        "post_ids": [8850, 8851],
        "start": date(2026, 10, 24),
        "end": date(2026, 10, 25),
        "kind": "doubles",
        "gender": "female",
        "format": "double_elim",
        "max_players": 16,
        "location": "Череповец",
        "podium": [
            (1, ["Ульянова Ольга", "Балашова Наталия"]),
            (2, ["Евграфова Анжелика", "Волхонская Полина"]),
            (3, ["Хлопачева Екатерина", "Дудник Кристина"]),
        ],
    },
]


class Command(BaseCommand):
    help = "Пилотный импорт турниров 2026 года из выгрузки ВК"

    def add_arguments(self, parser):
        parser.add_argument(
            "--source",
            default="/app/backend/vk_export/vk_pilot_2026.json",
            help="JSON с постами VK (id, text, photos)",
        )
        parser.add_argument("--apply", action="store_true", help="Записать в БД")
        parser.add_argument(
            "--photos-only",
            action="store_true",
            help="Только докачать фото для уже импортированных турниров",
        )
        parser.add_argument("--max-photos", type=int, default=10)
        parser.add_argument("--skip-photos", action="store_true")
        parser.add_argument(
            "--force-media",
            action="store_true",
            help="Удалить текущие фото/видео и скачать заново",
        )

    def handle(self, *args, **options):
        try:
            with open(options["source"], encoding="utf-8") as fh:
                posts = {post["id"]: post for post in json.load(fh)}
        except OSError as exc:
            raise CommandError(f"Не удалось прочитать {options['source']}: {exc}")

        apply_changes = options["apply"]
        photos_only = options["photos_only"]
        max_photos = options["max_photos"]
        skip_photos = options["skip_photos"]
        force_media = options["force_media"]

        for item in TOURNAMENTS:
            source_url = f"https://vk.com/wall-10636220_{item['post_ids'][0]}"
            if photos_only:
                tournament = Tournament.objects.filter(
                    source_url=source_url, name=item["title"]
                ).first()
                if not tournament:
                    continue
                if force_media:
                    for photo in tournament.photos.all():
                        photo.image.delete(save=False)
                        photo.delete()
                    tournament.videos.all().delete()
                existing = list(tournament.photos.all())
                files_ok = existing and all(
                    photo.image.storage.exists(photo.image.name)
                    for photo in existing
                )
                if files_ok and tournament.videos.exists():
                    continue
                if skip_photos:
                    continue
                photos = self._photo_urls(item["post_ids"], posts)
                self._download_photos(tournament, photos[:max_photos])
                self._create_videos(tournament, item["post_ids"], posts)
                self.stdout.write(
                    f"{item['title']}: фото {tournament.photos.count()}, "
                    f"видео {tournament.videos.count()}"
                )
                continue

            self.stdout.write(
                f"\n{item['title']} · {item['start']}–{item['end']} · "
                f"{item['kind']}/{item['gender']}/{item['format']}"
            )
            missing = [post_id for post_id in item["post_ids"] if post_id not in posts]
            if missing:
                self.stdout.write(self.style.WARNING(f"  нет постов: {missing}"))
            source_url = f"https://vk.com/wall-10636220_{item['post_ids'][0]}"
            if Tournament.objects.filter(
                source_url=source_url, name=item["title"]
            ).exists():
                self.stdout.write("  уже импортирован — пропуск")
                continue

            text = self._summary(item["post_ids"], posts)
            self.stdout.write(f"  текст: {len(text)} символов")
            self.stdout.write(
                "  пьедестал: "
                + ", ".join(
                    f"{place}) {' / '.join(names)}"
                    for place, names in item["podium"]
                )
            )

            if not apply_changes:
                continue

            with transaction.atomic():
                tournament = Tournament.objects.create(
                    name=item["title"],
                    kind=item["kind"],
                    gender_type=item["gender"],
                    format=item["format"],
                    status=Tournament.Status.FINISHED,
                    start_date=item["start"],
                    end_date=item["end"],
                    location=item["location"],
                    max_players=item["max_players"],
                    summary_text=text,
                    source_url=source_url,
                )
                for place, names in item["podium"]:
                    for name in names:
                        player = self._player(name, item["gender"])
                        TournamentResult.objects.create(
                            tournament=tournament,
                            place=place,
                            name=name,
                            player=player,
                        )
                if not skip_photos:
                    photos = self._photo_urls(item["post_ids"], posts)
                    self._download_photos(tournament, photos[:max_photos])
                    self._create_videos(tournament, item["post_ids"], posts)

            self.stdout.write(self.style.SUCCESS("  импортирован"))

    @staticmethod
    def _summary(post_ids, posts):
        chunks = []
        for post_id in post_ids:
            text = (posts.get(post_id) or {}).get("text") or ""
            text = re.sub(r"\n{3,}", "\n\n", text).strip()
            if text and text not in chunks:
                chunks.append(text)
        return "\n\n".join(chunks)[:20000]

    @staticmethod
    def _photo_urls(post_ids, posts):
        seen = set()
        urls = []
        for post_id in post_ids:
            for photo in (posts.get(post_id) or {}).get("photos") or []:
                url = photo.get("url")
                if url and url not in seen:
                    seen.add(url)
                    urls.append(url)
        return urls

    @staticmethod
    def _create_videos(tournament, post_ids, posts):
        seen = set()
        order = 0
        for post_id in post_ids:
            for video in (posts.get(post_id) or {}).get("videos") or []:
                url = video.get("url")
                if not url or url in seen:
                    continue
                seen.add(url)
                TournamentVideo.objects.create(
                    tournament=tournament,
                    title=(video.get("title") or "")[:200],
                    url=url,
                    embed_url=video.get("embed") or "",
                    order=order,
                )
                order += 1

    @staticmethod
    def _player(name, gender):
        name = ALIASES.get(name, name)
        last_name, first_name = split_name(name)
        player = (
            Player.objects
            .filter(last_name__iexact=last_name, first_name__iexact=first_name)
            .first()
        )
        if player:
            return player

        base = f"vk-{translit(last_name)}-{translit(first_name)}".strip("-")
        email = f"{base}@tennis.local"
        suffix = 1
        while Player.objects.filter(email=email).exists():
            suffix += 1
            email = f"{base}-{suffix}@tennis.local"

        return Player.objects.create(
            first_name=first_name,
            last_name=last_name,
            email=email,
            gender=gender if gender in ("male", "female") else "male",
        )

    @staticmethod
    def _download_photos(tournament, urls):
        for index, url in enumerate(urls):
            try:
                request = urllib.request.Request(
                    url, headers={"User-Agent": "Mozilla/5.0"}
                )
                with urllib.request.urlopen(request, timeout=20) as response:
                    content = response.read()
                if len(content) > 5 * 1024 * 1024:
                    continue
                TournamentPhoto.objects.create(
                    tournament=tournament,
                    image=ContentFile(
                        content, name=f"vk-{tournament.pk}-{index}.jpg"
                    ),
                    order=index,
                )
            except Exception as exc:  # noqa: BLE001
                print(f"    фото не скачано: {exc}")
