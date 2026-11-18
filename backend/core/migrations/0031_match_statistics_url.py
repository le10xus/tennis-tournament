from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0030_match_statistics"),
    ]

    operations = [
        migrations.AddField(
            model_name="match",
            name="statistics_url",
            field=models.URLField(
                blank=True,
                default="",
                max_length=500,
                verbose_name="Ссылка на статистику",
            ),
        ),
    ]
