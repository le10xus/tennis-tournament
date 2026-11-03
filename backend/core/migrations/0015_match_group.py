from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0014_match_bracket_links"),
    ]

    operations = [
        migrations.AddField(
            model_name="match",
            name="group",
            field=models.CharField(
                blank=True,
                choices=[
                    ("", "Основная"),
                    ("5-8", "5–8 места"),
                    ("9-16", "9–16 места"),
                ],
                default="",
                max_length=10,
            ),
        ),
        migrations.AlterField(
            model_name="match",
            name="bracket",
            field=models.CharField(
                choices=[
                    ("winners", "Основная сетка"),
                    ("consolation", "Подвал"),
                    ("third_place", "Матч за 3-е место"),
                ],
                default="winners",
                max_length=20,
            ),
        ),
    ]
