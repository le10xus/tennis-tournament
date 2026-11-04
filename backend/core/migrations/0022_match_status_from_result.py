from django.db import migrations


def forwards(apps, schema_editor):
    """Матч с победителем или счётом считается завершённым."""
    Match = apps.get_model("core", "Match")
    Match.objects.filter(winner__isnull=False).exclude(status="walkover").update(
        status="finished"
    )
    Match.objects.exclude(score="").exclude(status__in=["walkover", "finished"]).update(
        status="finished"
    )


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0021_tournament_age_wildcard"),
    ]

    operations = [
        migrations.RunPython(forwards, migrations.RunPython.noop),
    ]
