"""Связи для исторической сетки на 16 участников с подвалом.

Структура (как на печатных сетках БТ35):
- основная 1/8 → 1/4 → 1/4 (8 игроков: 4 победителя 1/4 + 4 из подвала)
  → 1/2 → финал;
- подвал, 1-й раунд (13–16): пары проигравших 1/8;
- подвал, 2-й раунд (9–12): победители 1-го раунда против проигравших 1/4.

Команда расставляет next_match / loser_next_match, чтобы работали редактирование
и переходы статусов, а не только отрисовка.
"""

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from core.models import Match, Tournament


class Command(BaseCommand):
    help = "Связать исторические матчи сетки на 16 участников с подвалом"

    def add_arguments(self, parser):
        parser.add_argument("tournament_id", type=int)

    def handle(self, *args, **options):
        tournament = Tournament.objects.filter(pk=options["tournament_id"]).first()
        if not tournament:
            raise CommandError("Турнир не найден.")

        matches = list(tournament.matches.filter(is_historical=True))
        if not matches:
            raise CommandError("У турнира нет исторических матчей.")

        winners = [m for m in matches if m.bracket == Match.Bracket.WINNERS]
        cons1 = [
            m for m in matches
            if m.bracket == Match.Bracket.CONSOLATION and m.group == Match.Group.PLACES_9_16
        ]
        cons2 = [
            m for m in matches
            if m.bracket == Match.Bracket.CONSOLATION and m.group == Match.Group.PLACES_5_8
        ]
        third = next((m for m in matches if m.bracket == Match.Bracket.THIRD_PLACE), None)

        def by_round(round_no):
            return sorted(
                [m for m in winners if m.round_number == round_no],
                key=lambda m: m.slot_index,
            )

        w1, w2, w3, w4, w5 = (by_round(i) for i in range(1, 6))
        if len(w1) != 8 or len(w2) != 4 or len(w3) != 4 or len(w4) != 2 or len(w5) != 1:
            raise CommandError(
                "Сетка не на 16 участников: "
                f"{len(w1)}/{len(w2)}/{len(w3)}/{len(w4)}/{len(w5)}"
            )
        if len(cons1) != 4 or len(cons2) != 4:
            raise CommandError(
                f"Подвал неполный: 13–16 — {len(cons1)}, 9–12 — {len(cons2)}"
            )

        with transaction.atomic():
            for i, match in enumerate(w1):
                match.next_match = w2[i // 2]
                match.next_slot = i % 2 + 1
                match.loser_next_match = cons1[i // 2]
                match.loser_next_slot = i % 2 + 1

            for i, match in enumerate(cons1):
                match.next_match = cons2[i]
                match.next_slot = 1

            for i, match in enumerate(w2):
                match.next_match = w3[i]
                match.next_slot = 1
                match.loser_next_match = cons2[i ^ 1]
                match.loser_next_slot = 2

            for i, match in enumerate(cons2):
                match.next_match = w3[3 - i]
                match.next_slot = 2

            for i, match in enumerate(w3):
                match.next_match = w4[i // 2]
                match.next_slot = i % 2 + 1

            for i, match in enumerate(w4):
                match.next_match = w5[0]
                match.next_slot = i + 1
                if third:
                    match.loser_next_match = third
                    match.loser_next_slot = i + 1

            Match.objects.bulk_update(
                matches,
                [
                    "slot_index", "next_match", "next_slot",
                    "loser_next_match", "loser_next_slot",
                ],
            )

        self.stdout.write(
            self.style.SUCCESS(
                f"Связано: основная {len(w1)}/{len(w2)}/{len(w3)}/{len(w4)}/1, "
                f"подвал {len(cons1)}/{len(cons2)}"
            )
        )
