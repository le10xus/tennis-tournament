from rest_framework import serializers

from core.models import Player
from core.services.player_stats import player_record


class PlayerSerializer(serializers.ModelSerializer):
    gender_display = serializers.CharField(source="get_gender_display", read_only=True)
    rating_type_display = serializers.CharField(source="get_rating_type_display", read_only=True)

    class Meta:
        model = Player
        fields = [
            "id", "first_name", "last_name", "email", "phone", "birth_date",
            "birth_year", "city",
            "gender", "gender_display",
            "rating", "rating_type", "rating_type_display",
            "ntrp_singles", "ntrp_doubles", "points_singles", "points_doubles",
            "is_ftvo",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class PlayerDetailSerializer(PlayerSerializer):
    """Карточка игрока: W-L и призовые места. В списке этих полей нет."""

    wins = serializers.SerializerMethodField()
    losses = serializers.SerializerMethodField()
    prize_places = serializers.SerializerMethodField()

    class Meta(PlayerSerializer.Meta):
        fields = [*PlayerSerializer.Meta.fields, "wins", "losses", "prize_places"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._records = {}

    def _record(self, player):
        record = self._records.get(player.pk)
        if record is None:
            record = player_record(player.pk)
            self._records[player.pk] = record
        return record

    def get_wins(self, player):
        return self._record(player)["wins"]

    def get_losses(self, player):
        return self._record(player)["losses"]

    def get_prize_places(self, player):
        return self._record(player)["prize_places"]
