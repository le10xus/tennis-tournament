from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0011_registration_invited_by"),
    ]

    operations = [
        migrations.AlterField(
            model_name="tournament",
            name="status",
            field=models.CharField(
                choices=[
                    ("draft", "Черновик"),
                    ("registration", "Регистрация открыта"),
                    ("registration_closed", "Регистрация закрыта"),
                    ("in_progress", "Турнир начался"),
                    ("summing_up", "Подводим итоги"),
                    ("finished", "Завершён"),
                ],
                default="draft",
                max_length=20,
            ),
        ),
    ]
