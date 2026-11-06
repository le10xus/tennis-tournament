import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0024_tournament_results"),
    ]

    operations = [
        migrations.CreateModel(
            name="TournamentVideo",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(blank=True, max_length=200, verbose_name="Название")),
                ("url", models.URLField(verbose_name="Ссылка")),
                ("embed_url", models.URLField(blank=True, verbose_name="Ссылка для встраивания")),
                ("order", models.PositiveSmallIntegerField(default=0, verbose_name="Порядок")),
                (
                    "tournament",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="videos",
                        to="core.tournament",
                    ),
                ),
            ],
            options={
                "verbose_name": "Видео турнира",
                "verbose_name_plural": "Видео турнира",
                "ordering": ["order", "id"],
            },
        ),
    ]
