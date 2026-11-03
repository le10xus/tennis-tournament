from django.core.exceptions import ValidationError
from django.db import models

from .choices import GenderType
from .player import Player
from .tournament import Tournament


class Match(models.Model):
    class Status(models.TextChoices):
        SCHEDULED = "scheduled", "Запланирован"
        IN_PROGRESS = "in_progress", "Идёт"
        FINISHED = "finished", "Завершён"
        WALKOVER = "walkover", "Техническое поражение"

    class Bracket(models.TextChoices):
        WINNERS = "winners", "Основная сетка"
        CONSOLATION = "consolation", "Подвал"
        THIRD_PLACE = "third_place", "Матч за 3-е место"

    class Group(models.TextChoices):
        MAIN = "", "Основная"
        PLACES_5_8 = "5-8", "5–8 места"
        PLACES_9_16 = "9-16", "9–16 места"

    tournament = models.ForeignKey(Tournament, on_delete=models.CASCADE, related_name="matches")
    bracket = models.CharField(max_length=20, choices=Bracket.choices, default=Bracket.WINNERS)
    group = models.CharField(max_length=10, choices=Group.choices, blank=True, default="")
    next_match = models.ForeignKey(
        "self", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="feeder_matches",
        help_text="Куда идёт победитель",
    )
    next_slot = models.PositiveSmallIntegerField(null=True, blank=True)
    loser_next_match = models.ForeignKey(
        "self", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="loser_feeder_matches",
        help_text="Куда идёт проигравший (в сетку с подвалом)",
    )
    loser_next_slot = models.PositiveSmallIntegerField(null=True, blank=True)
    gender_type = models.CharField(max_length=10, choices=GenderType.choices, default=GenderType.MALE)
    player1 = models.ForeignKey(
        Player, on_delete=models.PROTECT, null=True, blank=True, related_name="matches_as_p1"
    )
    # для парных матчей: второй игрок первой пары
    pair1_player2 = models.ForeignKey(
        Player, on_delete=models.PROTECT, null=True, blank=True, related_name="matches_as_p1p2"
    )
    player2 = models.ForeignKey(
        Player, on_delete=models.PROTECT, null=True, blank=True, related_name="matches_as_p2"
    )
    # для парных матчей: второй игрок второй пары
    pair2_player2 = models.ForeignKey(
        Player, on_delete=models.PROTECT, null=True, blank=True, related_name="matches_as_p2p2"
    )
    winner = models.ForeignKey(
        Player, on_delete=models.SET_NULL, null=True, blank=True, related_name="won_matches"
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.SCHEDULED)
    round_number = models.PositiveSmallIntegerField(default=1)
    slot_index = models.PositiveSmallIntegerField(default=0)
    scheduled_at = models.DateTimeField(null=True, blank=True)
    court = models.PositiveSmallIntegerField(null=True, blank=True, verbose_name="Корт")
    score = models.CharField(max_length=50, blank=True, help_text='Например: "6:4 7:5"')

    def clean(self):
        errors = {}
        all_ids = [
            i for i in (
                self.player1_id, self.pair1_player2_id,
                self.player2_id, self.pair2_player2_id,
            ) if i
        ]
        if len(all_ids) != len(set(all_ids)):
            errors["pair1_player2"] = "Один игрок не может участвовать в матче дважды."
        if self.winner_id:
            captains = [i for i in (self.player1_id, self.player2_id) if i]
            if captains and self.winner_id not in captains:
                errors["winner"] = "Победитель должен быть капитаном одной из сторон."
        if errors:
            raise ValidationError(errors)

    def __str__(self):
        p1 = self.player1 or "TBD"
        p2 = self.player2 or "TBD"
        return f"{p1} vs {p2} — {self.tournament.name} (R{self.round_number})"

    class Meta:
        ordering = ["round_number", "slot_index", "scheduled_at"]
        verbose_name_plural = "matches"
