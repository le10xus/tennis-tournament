import datetime

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0017_tournament_match_duration"),
    ]

    operations = [
        migrations.AddField(
            model_name="tournament",
            name="saturday_start_time",
            field=models.TimeField(
                default=datetime.time(9, 0), verbose_name="Начало в субботу"
            ),
        ),
        migrations.AddField(
            model_name="tournament",
            name="sunday_start_time",
            field=models.TimeField(
                default=datetime.time(9, 0), verbose_name="Начало в воскресенье"
            ),
        ),
    ]
