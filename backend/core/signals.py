from django.db.models.signals import post_save
from django.dispatch import receiver

from .models.player import Player
from .models.user import User


@receiver(post_save, sender=User)
def create_player_for_new_user(sender, instance, created, **kwargs):
    """
    При создании нового пользователя автоматически создаёт связанного игрока.
    Не срабатывает при обновлениях (created=False).
    Пропускает, если player уже привязан.
    """
    if not created or instance.player_id is not None:
        return

    player = Player.objects.create(
        first_name=instance.first_name or instance.username,
        last_name=instance.last_name or "",
        email=instance.email or f"{instance.username}@placeholder.local",
    )
    # Используем update() вместо instance.save(), чтобы не тригерить сигнал снова
    User.objects.filter(pk=instance.pk).update(player=player)
    instance.player = player
