import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0023_unique_points_award"),
    ]

    operations = [
        migrations.AddField(
            model_name="tournament",
            name="source_url",
            field=models.URLField(blank=True, verbose_name="Источник (VK)"),
        ),
        migrations.AddField(
            model_name="tournament",
            name="regulation_url",
            field=models.URLField(blank=True, verbose_name="Ссылка на регламент"),
        ),
        migrations.CreateModel(
            name="TournamentResult",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("place", models.PositiveSmallIntegerField(verbose_name="Место")),
                ("name", models.CharField(max_length=200, verbose_name="Имя как в источнике")),
                (
                    "player",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="tournament_results",
                        to="core.player",
                    ),
                ),
                (
                    "tournament",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="results",
                        to="core.tournament",
                    ),
                ),
            ],
            options={
                "verbose_name": "Результат турнира",
                "verbose_name_plural": "Результаты турнира",
                "ordering": ["place", "id"],
            },
        ),
    ]
