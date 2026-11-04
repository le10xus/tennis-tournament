import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0018_tournament_weekend_start"),
    ]

    operations = [
        migrations.AddField(
            model_name="tournament",
            name="set_games",
            field=models.PositiveSmallIntegerField(
                choices=[(4, "До 4 геймов"), (6, "До 6 геймов")],
                default=6,
                verbose_name="Сет до",
            ),
        ),
        migrations.AddField(
            model_name="tournament",
            name="third_set_super_tiebreak",
            field=models.BooleanField(
                default=False, verbose_name="3-й сет — тай-брейк до 10"
            ),
        ),
        migrations.AddField(
            model_name="tournament",
            name="regulation",
            field=models.FileField(
                blank=True,
                null=True,
                upload_to="regulations/",
                verbose_name="Регламент",
            ),
        ),
        migrations.AddField(
            model_name="tournament",
            name="summary_text",
            field=models.TextField(blank=True, verbose_name="Итоги турнира"),
        ),
        migrations.AddField(
            model_name="match",
            name="set1_home",
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="match",
            name="set1_away",
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="match",
            name="set2_home",
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="match",
            name="set2_away",
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="match",
            name="set3_home",
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="match",
            name="set3_away",
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
        migrations.CreateModel(
            name="TournamentPhoto",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("image", models.ImageField(upload_to="tournaments/photos/", verbose_name="Фото")),
                ("caption", models.CharField(blank=True, max_length=200, verbose_name="Подпись")),
                ("order", models.PositiveSmallIntegerField(default=0, verbose_name="Порядок")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "tournament",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="photos",
                        to="core.tournament",
                    ),
                ),
            ],
            options={
                "verbose_name": "Фотография турнира",
                "verbose_name_plural": "Фотографии турнира",
                "ordering": ["order", "id"],
            },
        ),
    ]
