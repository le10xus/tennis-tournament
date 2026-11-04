import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0019_match_sets_photos"),
    ]

    operations = [
        migrations.AddField(
            model_name="tournament",
            name="points_category",
            field=models.CharField(
                blank=True,
                choices=[
                    ("", "Не начислять очки"),
                    ("two_day", "2-дневный ТВД"),
                    ("one_day", "1-дневный ТВД или NTRP<3"),
                    ("veterans", "Ветераны"),
                    ("region", "Чемпионат области"),
                ],
                default="",
                max_length=20,
                verbose_name="Категория начисления очков",
            ),
        ),
        migrations.AddField(
            model_name="tournament",
            name="points_awarded_at",
            field=models.DateTimeField(
                blank=True, null=True, verbose_name="Очки начислены"
            ),
        ),
        migrations.CreateModel(
            name="TournamentPointsAward",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("place", models.CharField(max_length=10, verbose_name="Место")),
                ("points", models.PositiveIntegerField(default=0, verbose_name="Очки")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "player",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="points_awards",
                        to="core.player",
                    ),
                ),
                (
                    "tournament",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="points_awards",
                        to="core.tournament",
                    ),
                ),
            ],
            options={
                "verbose_name": "Начисление очков",
                "verbose_name_plural": "Начисления очков",
                "ordering": ["-points", "id"],
            },
        ),
    ]
