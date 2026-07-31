from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0007_create_default_admin"),
    ]

    operations = [
        migrations.AddField(
            model_name="tournamentregistration",
            name="status",
            field=models.CharField(
                choices=[
                    ("pending", "Заявка рассматривается"),
                    ("approved", "Подтверждена"),
                ],
                default="approved",
                max_length=20,
            ),
        ),
    ]
