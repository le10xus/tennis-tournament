from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """
    Кастомная модель пользователя.
    Каждый пользователь сайта = игрок: при создании User автоматически
    создаётся связанный Player (через post_save сигнал в core/signals.py).
    """

    player = models.OneToOneField(
        "core.Player",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="user",
    )

    class Meta:
        verbose_name = "Пользователь"
        verbose_name_plural = "Пользователи"

    def __str__(self):
        return self.get_full_name() or self.username
