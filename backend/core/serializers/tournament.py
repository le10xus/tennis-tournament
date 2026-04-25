from rest_framework import serializers

from core.models import Tournament, TournamentRegistration
from .player import PlayerSerializer


class TournamentSerializer(serializers.ModelSerializer):
    kind_display = serializers.CharField(source="get_kind_display", read_only=True)
    gender_type_display = serializers.CharField(source="get_gender_type_display", read_only=True)
    format_display = serializers.CharField(source="get_format_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    players_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Tournament
        fields = [
            "id", "name",
            "kind", "kind_display",
            "gender_type", "gender_type_display",
            "format", "format_display",
            "status", "status_display",
            "start_date", "end_date", "location", "description",
            "max_players", "players_count",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def validate(self, data):
        start = data.get("start_date", getattr(self.instance, "start_date", None))
        end = data.get("end_date", getattr(self.instance, "end_date", None))
        if start and end and end < start:
            raise serializers.ValidationError({"end_date": "Дата окончания не может быть раньше даты начала."})
        return data


class TournamentNestedSerializer(serializers.ModelSerializer):
    """Краткое представление турнира для вложенных сериализаторов (без players_count)."""
    kind_display = serializers.CharField(source="get_kind_display", read_only=True)
    format_display = serializers.CharField(source="get_format_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = Tournament
        fields = [
            "id", "name",
            "kind", "kind_display",
            "format", "format_display",
            "status", "status_display",
            "start_date", "end_date", "location",
        ]


class TournamentRegistrationSerializer(serializers.ModelSerializer):
    player_detail = PlayerSerializer(source="player", read_only=True)
    tournament_detail = TournamentNestedSerializer(source="tournament", read_only=True)

    class Meta:
        model = TournamentRegistration
        fields = ["id", "tournament", "tournament_detail", "player", "player_detail", "registered_at", "seed"]
        read_only_fields = ["id", "registered_at"]
