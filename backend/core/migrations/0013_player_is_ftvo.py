from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0012_tournament_statuses"),
    ]

    operations = [
        migrations.AddField(
            model_name="player",
            name="is_ftvo",
            field=models.BooleanField(default=False, verbose_name="ФТВО"),
        ),
    ]
