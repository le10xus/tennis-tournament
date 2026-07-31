from django.db import models

from .choices import GenderType
from .player import Player


class Tournament(models.Model):
    class Kind(models.TextChoices):
        SINGLES = "singles", "Одиночный"
        DOUBLES = "doubles", "Парный"

    class Format(models.TextChoices):
        ROUND_ROBIN = "round_robin", "Круговой"
        SINGLE_ELIM = "single_elim", "Олимпийская (с выбыванием)"
        DOUBLE_ELIM = "double_elim", "Двойное выбывание"

    class Status(models.TextChoices):
        DRAFT = "draft", "Черновик"
        REGISTRATION = "registration", "Регистрация открыта"
        IN_PROGRESS = "in_progress", "Идёт"
        FINISHED = "finished", "Завершён"

    name = models.CharField(max_length=200)
    kind = models.CharField(max_length=10, choices=Kind.choices, default=Kind.SINGLES)
    gender_type = models.CharField(max_length=10, choices=GenderType.choices, default=GenderType.MALE)
    format = models.CharField(max_length=20, choices=Format.choices, default=Format.ROUND_ROBIN)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    location = models.CharField(max_length=200, blank=True)
    description = models.TextField(blank=True)
    max_players = models.PositiveIntegerField(default=16)
    min_rating = models.PositiveIntegerField(null=True, blank=True)
    max_rating = models.PositiveIntegerField(null=True, blank=True)
    players = models.ManyToManyField(Player, through="TournamentRegistration", related_name="tournaments")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.get_status_display()})"

    class Meta:
        ordering = ["-start_date"]


class TournamentRegistration(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Заявка рассматривается"
        APPROVED = "approved", "Подтверждена"

    tournament = models.ForeignKey(Tournament, on_delete=models.CASCADE)
    player = models.ForeignKey(Player, on_delete=models.CASCADE)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.APPROVED)
    registered_at = models.DateTimeField(auto_now_add=True)
    seed = models.PositiveSmallIntegerField(null=True, blank=True)
    pair_id = models.PositiveSmallIntegerField(null=True, blank=True, help_text="Номер пары (для парных турниров)")

    def __str__(self):
        return f"{self.player} @ {self.tournament}"

    class Meta:
        ordering = ["seed", "registered_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["tournament", "player"],
                name="unique_tournament_player",
                violation_error_message="Игрок уже зарегистрирован в этом турнире.",
            )
        ]
