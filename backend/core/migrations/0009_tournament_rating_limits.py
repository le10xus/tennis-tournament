from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0008_tournamentregistration_status"),
    ]

    operations = [
        migrations.AddField(
            model_name="tournament",
            name="max_rating",
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="tournament",
            name="min_rating",
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
    ]
