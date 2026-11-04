from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0022_match_status_from_result"),
    ]

    operations = [
        migrations.AddConstraint(
            model_name="tournamentpointsaward",
            constraint=models.UniqueConstraint(
                fields=("tournament", "player"),
                name="unique_tournament_points_award",
            ),
        ),
    ]
