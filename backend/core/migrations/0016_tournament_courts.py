from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0015_match_group"),
    ]

    operations = [
        migrations.AddField(
            model_name="tournament",
            name="courts",
            field=models.PositiveSmallIntegerField(default=4, verbose_name="Кортов"),
        ),
        migrations.AddField(
            model_name="match",
            name="court",
            field=models.PositiveSmallIntegerField(
                blank=True, null=True, verbose_name="Корт"
            ),
        ),
    ]
