from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0025_tournament_videos"),
    ]

    operations = [
        migrations.AddField(
            model_name="match",
            name="is_historical",
            field=models.BooleanField(
                default=False, verbose_name="Исторический матч (импорт)"
            ),
        ),
    ]
