from django.contrib.auth import get_user_model
from django.db import migrations

ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "!Ad123min4"


def create_admin_user(apps, schema_editor):
    User = get_user_model()
    if User.objects.filter(username=ADMIN_USERNAME).exists():
        return
    User.objects.create_superuser(
        username=ADMIN_USERNAME,
        password=ADMIN_PASSWORD,
        email="admin@localhost",
    )


def remove_admin_user(apps, schema_editor):
    User = get_user_model()
    User.objects.filter(username=ADMIN_USERNAME).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0006_match_nullable_players_slot_index"),
    ]

    operations = [
        migrations.RunPython(create_admin_user, remove_admin_user),
    ]
