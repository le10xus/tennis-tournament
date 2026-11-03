import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0013_player_is_ftvo"),
    ]

    operations = [
        migrations.AddField(
            model_name="match",
            name="bracket",
            field=models.CharField(
                choices=[
                    ("winners", "Основная сетка"),
                    ("losers", "Подвал"),
                    ("final", "Финал"),
                ],
                default="winners",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="match",
            name="loser_next_match",
            field=models.ForeignKey(
                blank=True,
                help_text="Куда идёт проигравший (в сетку с подвалом)",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="loser_feeder_matches",
                to="core.match",
            ),
        ),
        migrations.AddField(
            model_name="match",
            name="loser_next_slot",
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="match",
            name="next_match",
            field=models.ForeignKey(
                blank=True,
                help_text="Куда идёт победитель",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="feeder_matches",
                to="core.match",
            ),
        ),
        migrations.AddField(
            model_name="match",
            name="next_slot",
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
    ]
