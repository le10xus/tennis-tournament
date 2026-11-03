import json
from pathlib import Path

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction

from core.models import Player

User = get_user_model()

DEFAULT_DATA_FILE = Path(settings.BASE_DIR) / "core" / "data" / "ntrp_players.json"


class Command(BaseCommand):
    help = (
        "Создаёт игроков с очками/NTRP/городом и аккаунты для входа "
        "из core/data/ntrp_players.json. Команда идемпотентна: "
        "повторный запуск обновляет существующих игроков по email."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--file",
            default=str(DEFAULT_DATA_FILE),
            help="Путь к JSON с игроками",
        )
        parser.add_argument(
            "--password",
            default="Tennis2026!",
            help="Пароль для всех создаваемых аккаунтов",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Только посчитать, ничего не записывать в БД",
        )

    def handle(self, *args, **options):
        path = Path(options["file"])
        if not path.exists():
            self.stderr.write(f"Файл не найден: {path}")
            return

        payload = json.loads(path.read_text(encoding="utf-8"))
        password = options["password"]
        dry_run = options["dry_run"]

        created_players = updated_players = created_users = 0

        for item in payload:
            email = f"{item['login']}@tennis.local"
            points_singles = item.get("points_singles") or 0
            points_doubles = item.get("points_doubles") or 0

            defaults = {
                "first_name": item["first_name"],
                "last_name": item["last_name"],
                "gender": item["gender"],
                "birth_year": item.get("birth_year"),
                "city": item.get("city", ""),
                "ntrp_singles": item.get("ntrp_singles", ""),
                "ntrp_doubles": item.get("ntrp_doubles", ""),
                "points_singles": points_singles,
                "points_doubles": points_doubles,
                # rating — устаревшее одиночное поле, храним очки одиночного разряда;
                # рейтинг пары считается отдельно по points_doubles
                "rating": points_singles,
                "rating_type": Player.RatingType.MANUAL,
            }

            if dry_run:
                if Player.objects.filter(email=email).exists():
                    updated_players += 1
                else:
                    created_players += 1
                if not User.objects.filter(username=item["login"]).exists():
                    created_users += 1
                continue

            with transaction.atomic():
                player = Player.objects.filter(email=email).first()
                if player is None:
                    player = Player.objects.create(email=email, **defaults)
                    created_players += 1
                else:
                    for field, value in defaults.items():
                        setattr(player, field, value)
                    player.save(update_fields=list(defaults))
                    updated_players += 1

                user, user_created = User.objects.get_or_create(
                    username=item["login"],
                    defaults={
                        "email": email,
                        "role": User.Role.PLAYER,
                        "player": player,
                        "is_staff": False,
                    },
                )
                if user_created:
                    user.set_password(password)
                    user.save(update_fields=["password"])
                    created_users += 1
                else:
                    changed = []
                    if user.player_id != player.pk:
                        user.player = player
                        changed.append("player")
                    if not user.email:
                        user.email = email
                        changed.append("email")
                    if changed:
                        user.save(update_fields=changed)

        prefix = "[dry-run] " if dry_run else ""
        self.stdout.write(
            self.style.SUCCESS(
                f"{prefix}игроков создано: {created_players}, "
                f"обновлено: {updated_players}, "
                f"аккаунтов создано: {created_users} "
                f"(пароль: {password})"
            )
        )
