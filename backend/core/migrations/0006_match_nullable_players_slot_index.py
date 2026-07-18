from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0005_add_registration_pair_id"),
    ]

    operations = [
        migrations.AddField(
            model_name="match",
            name="slot_index",
            field=models.PositiveSmallIntegerField(default=0),
        ),
        migrations.AlterField(
            model_name="match",
            name="player1",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="matches_as_p1",
                to="core.player",
            ),
        ),
        migrations.AlterField(
            model_name="match",
            name="player2",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="matches_as_p2",
                to="core.player",
            ),
        ),
        migrations.AlterModelOptions(
            name="match",
            options={"ordering": ["round_number", "slot_index", "scheduled_at"], "verbose_name_plural": "matches"},
        ),
    ]
