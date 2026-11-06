from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0028_points_table_format"),
    ]

    operations = [
        migrations.AlterField(
            model_name="match",
            name="group",
            field=models.CharField(
                blank=True,
                choices=[
                    ("", "Основная"),
                    ("5-8", "5–8 места"),
                    ("9-16", "9–16 места"),
                    ("third", "3-е место утешительного"),
                ],
                default="",
                max_length=10,
            ),
        ),
    ]
