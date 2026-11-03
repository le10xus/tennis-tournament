from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0016_tournament_courts"),
    ]

    operations = [
        migrations.AddField(
            model_name="tournament",
            name="match_duration_minutes",
            field=models.PositiveSmallIntegerField(
                default=60, verbose_name="Длительность матча, мин"
            ),
        ),
    ]
