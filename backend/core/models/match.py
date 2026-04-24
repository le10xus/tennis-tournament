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

    tournament = models.ForeignKey(Tournament, on_delete=models.CASCADE, related_name="matches")
    gender_type = models.CharField(max_length=10, choices=GenderType.choices, default=GenderType.MALE)
    player1 = models.ForeignKey(Player, on_delete=models.PROTECT, related_name="matches_as_p1")
    player2 = models.ForeignKey(Player, on_delete=models.PROTECT, related_name="matches_as_p2")
    winner = models.ForeignKey(
        Player, on_delete=models.SET_NULL, null=True, blank=True, related_name="won_matches"
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.SCHEDULED)
    round_number = models.PositiveSmallIntegerField(default=1)
    scheduled_at = models.DateTimeField(null=True, blank=True)
    score = models.CharField(max_length=50, blank=True, help_text='Например: "6:4 7:5"')

    def clean(self):
        errors = {}
        if self.player1_id and self.player2_id and self.player1_id == self.player2_id:
            errors["player2"] = "Игрок не может играть сам с собой."
        if self.winner_id and self.winner_id not in (self.player1_id, self.player2_id):
            errors["winner"] = "Победитель должен быть одним из участников матча."
        if errors:
            raise ValidationError(errors)

    def __str__(self):
        return f"{self.player1} vs {self.player2} — {self.tournament.name} (R{self.round_number})"

    class Meta:
        ordering = ["round_number", "scheduled_at"]
        verbose_name_plural = "matches"
