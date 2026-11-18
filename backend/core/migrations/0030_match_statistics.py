from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0029_match_group_consolation_third"),
    ]

    operations = [
        migrations.AddField(
            model_name="match",
            name="statistics",
            field=models.JSONField(
                blank=True,
                help_text="Подача и очки по сторонам (home/away); опционально по игрокам в doubles.",
                null=True,
                verbose_name="Статистика матча",
            ),
        ),
    ]
