from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0027_match_group_bracket"),
    ]

    operations = [
        migrations.AddField(
            model_name="tournament",
            name="points_table",
            field=models.JSONField(
                blank=True, default=dict, verbose_name="Таблица очков турнира"
            ),
        ),
        migrations.AlterField(
            model_name="tournament",
            name="format",
            field=models.CharField(
                choices=[
                    ("round_robin", "Круговой"),
                    ("single_elim", "Олимпийская (с выбыванием)"),
                    ("double_elim", "Двойное выбывание"),
                    ("group_playoff", "Групповой + плей-офф"),
                ],
                default="round_robin",
                max_length=20,
            ),
        ),
    ]
