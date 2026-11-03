import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0010_player_ntrp_city_points"),
    ]

    operations = [
        migrations.AddField(
            model_name="tournamentregistration",
            name="invited_by",
            field=models.ForeignKey(
                blank=True,
                help_text="Кто пригласил игрока в пару",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="invited_registrations",
                to="core.player",
            ),
        ),
    ]
