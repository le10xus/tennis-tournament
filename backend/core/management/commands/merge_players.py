"""Слияние дубликатов игроков (например, смена фамилии)."""

import re

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from core.models import (
    Match,
    Player,
    TournamentPointsAward,
    TournamentRegistration,
    TournamentResult,
    User,
)


def normalize(value):
    return re.sub(r"\s+", " ", value.replace("ё", "е")).strip().lower()


class Command(BaseCommand):
    help = "Объединить двух игроков: ссылки переносятся на целевого, дубликат удаляется"

    def add_arguments(self, parser):
        parser.add_argument("source", help="Фамилия Имя дубликата")
        parser.add_argument("target", help="Фамилия Имя, кого оставить")
        parser.add_argument("--apply", action="store_true", help="Записать в БД")

    def _find(self, value):
        if value.isdigit():
            player = Player.objects.filter(pk=int(value)).first()
            if not player:
                raise CommandError(f"Игрок id={value} не найден.")
            return player
        last_name, _, first_name = value.partition(" ")
        qs = Player.objects.filter(
            last_name__iexact=last_name.strip(),
            first_name__iexact=first_name.strip(),
        )
        players = list(qs)
        if len(players) != 1:
            raise CommandError(
                f"По «{value}» найдено {len(players)} игроков; нужно ровно одного."
            )
        return players[0]

    def handle(self, *args, **options):
        source = self._find(options["source"])
        target = self._find(options["target"])
        if source.pk == target.pk:
            raise CommandError("Это один и тот же игрок.")

        self.stdout.write(
            f"{source.pk} {source.last_name} {source.first_name} -> "
            f"{target.pk} {target.last_name} {target.first_name}"
        )
        self.stdout.write(
            f"  заявок: {source.tournamentregistration_set.count()}, "
            f"результатов: {TournamentResult.objects.filter(player=source).count()}, "
            f"очков: {TournamentPointsAward.objects.filter(player=source).count()}"
        )

        if not options["apply"]:
            return

        with transaction.atomic():
            for registration in TournamentRegistration.objects.filter(player=source):
                exists = TournamentRegistration.objects.filter(
                    tournament_id=registration.tournament_id,
                    player=target,
                ).exists()
                if exists:
                    registration.delete()
                else:
                    registration.player = target
                    registration.save(update_fields=["player"])

            for award in TournamentPointsAward.objects.filter(player=source):
                exists = TournamentPointsAward.objects.filter(
                    tournament_id=award.tournament_id,
                    player=target,
                ).exists()
                if exists:
                    award.delete()
                else:
                    award.player = target
                    award.save(update_fields=["player"])

            TournamentResult.objects.filter(player=source).update(player=target)
            Match.objects.filter(player1=source).update(player1=target)
            Match.objects.filter(pair1_player2=source).update(pair1_player2=target)
            Match.objects.filter(player2=source).update(player2=target)
            Match.objects.filter(pair2_player2=source).update(pair2_player2=target)
            Match.objects.filter(winner=source).update(winner=target)

            user = User.objects.filter(player=source).first()
            if user and not User.objects.filter(player=target).exists():
                user.player = target
                user.save(update_fields=["player"])

            source.delete()

        self.stdout.write(self.style.SUCCESS("объединено"))
