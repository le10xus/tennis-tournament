from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0009_tournament_rating_limits"),
    ]

    operations = [
        migrations.AddField(
            model_name="player",
            name="birth_year",
            field=models.PositiveSmallIntegerField(
                blank=True, null=True, verbose_name="Год рождения"
            ),
        ),
        migrations.AddField(
            model_name="player",
            name="city",
            field=models.CharField(blank=True, max_length=100, verbose_name="Город"),
        ),
        migrations.AddField(
            model_name="player",
            name="ntrp_doubles",
            field=models.CharField(
                blank=True, max_length=8, verbose_name="NTRP (парный)"
            ),
        ),
        migrations.AddField(
            model_name="player",
            name="ntrp_singles",
            field=models.CharField(
                blank=True, max_length=8, verbose_name="NTRP (одиночный)"
            ),
        ),
        migrations.AddField(
            model_name="player",
            name="points_doubles",
            field=models.PositiveIntegerField(
                default=0, verbose_name="Очки (парный)"
            ),
        ),
        migrations.AddField(
            model_name="player",
            name="points_singles",
            field=models.PositiveIntegerField(
                default=0, verbose_name="Очки (одиночный)"
            ),
        ),
    ]
