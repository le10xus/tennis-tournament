from django.contrib.auth.hashers import make_password
from django.db import migrations

ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "!Ad123min4"


def create_admin_user(apps, schema_editor):
    # Historical model, not get_user_model(): on a fresh database the current
    # User.save() triggers post_save -> Player.objects.create(), but the Player
    # table at this migration does not yet have later fields (birth_year etc.).
    User = apps.get_model("core", "User")
    if User.objects.filter(username=ADMIN_USERNAME).exists():
        return
    User.objects.create(
        username=ADMIN_USERNAME,
        password=make_password(ADMIN_PASSWORD),
        email="admin@localhost",
        is_staff=True,
        is_superuser=True,
        is_active=True,
    )


def remove_admin_user(apps, schema_editor):
    User = apps.get_model("core", "User")
    User.objects.filter(username=ADMIN_USERNAME).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0006_match_nullable_players_slot_index"),
    ]

    operations = [
        migrations.RunPython(create_admin_user, remove_admin_user),
    ]
