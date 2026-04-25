from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class Role(models.TextChoices):
        PLAYER = "player", "Игрок"
        ORGANIZER = "organizer", "Организатор"

    player = models.OneToOneField(
        "core.Player",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="user",
    )
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.PLAYER)

    class Meta:
        verbose_name = "Пользователь"
        verbose_name_plural = "Пользователи"

    def __str__(self):
        return self.get_full_name() or self.username
