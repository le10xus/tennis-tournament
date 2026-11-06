from datetime import time

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
        GROUP_PLAYOFF = "group_playoff", "Групповой + плей-офф"

    class Status(models.TextChoices):
        DRAFT = "draft", "Черновик"
        REGISTRATION = "registration", "Регистрация открыта"
        REGISTRATION_CLOSED = "registration_closed", "Регистрация закрыта"
        IN_PROGRESS = "in_progress", "Турнир начался"
        SUMMING_UP = "summing_up", "Подводим итоги"
        FINISHED = "finished", "Завершён"

    class PointsCategory(models.TextChoices):
        NONE = "", "Не начислять очки"
        TWO_DAY = "two_day", "2-дневный ТВД"
        ONE_DAY = "one_day", "1-дневный ТВД или NTRP<3"
        VETERANS = "veterans", "Ветераны"
        REGION = "region", "Чемпионат области"

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
    courts = models.PositiveSmallIntegerField(default=4, verbose_name="Кортов")
    match_duration_minutes = models.PositiveSmallIntegerField(
        default=60, verbose_name="Длительность матча, мин"
    )
    saturday_start_time = models.TimeField(
        default=time(9, 0), verbose_name="Начало в субботу"
    )
    sunday_start_time = models.TimeField(
        default=time(9, 0), verbose_name="Начало в воскресенье"
    )
    set_games = models.PositiveSmallIntegerField(
        default=6,
        choices=[(4, "До 4 геймов"), (6, "До 6 геймов")],
        verbose_name="Сет до",
    )
    third_set_super_tiebreak = models.BooleanField(
        default=False, verbose_name="3-й сет — тай-брейк до 10"
    )
    points_category = models.CharField(
        max_length=20,
        choices=PointsCategory.choices,
        blank=True,
        default=PointsCategory.NONE,
        verbose_name="Категория начисления очков",
    )
    points_awarded_at = models.DateTimeField(
        null=True, blank=True, verbose_name="Очки начислены"
    )
    age_min = models.PositiveSmallIntegerField(
        null=True, blank=True, verbose_name="Минимальный возраст игрока"
    )
    pair_age_sum_min = models.PositiveSmallIntegerField(
        null=True, blank=True, verbose_name="Минимальная сумма возрастов пары"
    )
    regulation = models.FileField(
        upload_to="regulations/", blank=True, null=True, verbose_name="Регламент"
    )
    summary_text = models.TextField(blank=True, verbose_name="Итоги турнира")
    points_table = models.JSONField(
        default=dict, blank=True, verbose_name="Таблица очков турнира"
    )
    source_url = models.URLField(blank=True, verbose_name="Источник (VK)")
    regulation_url = models.URLField(blank=True, verbose_name="Ссылка на регламент")
    min_rating = models.PositiveIntegerField(null=True, blank=True)
    max_rating = models.PositiveIntegerField(null=True, blank=True)
    players = models.ManyToManyField(
        Player,
        through="TournamentRegistration",
        through_fields=("tournament", "player"),
        related_name="tournaments",
    )
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
    wildcard = models.BooleanField(default=False, verbose_name="Wild card (WC)")
    invited_by = models.ForeignKey(
        Player,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="invited_registrations",
        help_text="Кто пригласил игрока в пару",
    )

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

class TournamentPhoto(models.Model):
    tournament = models.ForeignKey(
        Tournament, on_delete=models.CASCADE, related_name="photos"
    )
    image = models.ImageField(upload_to="tournaments/photos/", verbose_name="Фото")
    caption = models.CharField(max_length=200, blank=True, verbose_name="Подпись")
    order = models.PositiveSmallIntegerField(default=0, verbose_name="Порядок")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["order", "id"]
        verbose_name = "Фотография турнира"
        verbose_name_plural = "Фотографии турнира"

    def __str__(self):
        return self.caption or f"Фото #{self.pk}"


class TournamentPointsAward(models.Model):
    tournament = models.ForeignKey(
        Tournament, on_delete=models.CASCADE, related_name="points_awards"
    )
    player = models.ForeignKey(
        Player, on_delete=models.CASCADE, related_name="points_awards"
    )
    place = models.CharField(max_length=10, verbose_name="Место")
    points = models.PositiveIntegerField(default=0, verbose_name="Очки")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-points", "id"]
        verbose_name = "Начисление очков"
        verbose_name_plural = "Начисления очков"
        constraints = [
            models.UniqueConstraint(
                fields=["tournament", "player"],
                name="unique_tournament_points_award",
            )
        ]

    def __str__(self):
        return f"{self.player} — {self.place} ({self.points})"


class TournamentVideo(models.Model):
    tournament = models.ForeignKey(
        Tournament, on_delete=models.CASCADE, related_name="videos"
    )
    title = models.CharField(max_length=200, blank=True, verbose_name="Название")
    url = models.URLField(verbose_name="Ссылка")
    embed_url = models.URLField(blank=True, verbose_name="Ссылка для встраивания")
    order = models.PositiveSmallIntegerField(default=0, verbose_name="Порядок")

    class Meta:
        ordering = ["order", "id"]
        verbose_name = "Видео турнира"
        verbose_name_plural = "Видео турнира"

    def __str__(self):
        return self.title or f"Видео #{self.pk}"


class TournamentResult(models.Model):
    tournament = models.ForeignKey(
        Tournament, on_delete=models.CASCADE, related_name="results"
    )
    place = models.PositiveSmallIntegerField(verbose_name="Место")
    name = models.CharField(max_length=200, verbose_name="Имя как в источнике")
    player = models.ForeignKey(
        Player,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="tournament_results",
    )

    class Meta:
        ordering = ["place", "id"]
        verbose_name = "Результат турнира"
        verbose_name_plural = "Результаты турнира"

    def __str__(self):
        return f"{self.place}. {self.name}"