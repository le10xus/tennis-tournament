from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0026_match_historical"),
    ]

    operations = [
        migrations.AlterField(
            model_name="match",
            name="bracket",
            field=models.CharField(
                choices=[
                    ("winners", "Основная сетка"),
                    ("consolation", "Подвал"),
                    ("third_place", "Матч за 3-е место"),
                    ("group", "Групповой этап"),
                ],
                default="winners",
                max_length=20,
            ),
        ),
    ]
