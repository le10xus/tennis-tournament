import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0020_tournament_points"),
    ]

    operations = [
        migrations.AddField(
            model_name="tournament",
            name="age_min",
            field=models.PositiveSmallIntegerField(
                blank=True, null=True, verbose_name="Минимальный возраст игрока"
            ),
        ),
        migrations.AddField(
            model_name="tournament",
            name="pair_age_sum_min",
            field=models.PositiveSmallIntegerField(
                blank=True, null=True, verbose_name="Минимальная сумма возрастов пары"
            ),
        ),
        migrations.AddField(
            model_name="tournamentregistration",
            name="wildcard",
            field=models.BooleanField(default=False, verbose_name="Wild card (WC)"),
        ),
    ]
