from rest_framework import serializers

from core.models import Match, Player


class PlayerBriefSerializer(serializers.ModelSerializer):
    class Meta:
        model = Player
        fields = ["id", "first_name", "last_name", "rating"]


class MatchSerializer(serializers.ModelSerializer):
    gender_type_display = serializers.CharField(source="get_gender_type_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    player1_detail = PlayerBriefSerializer(source="player1", read_only=True)
    player2_detail = PlayerBriefSerializer(source="player2", read_only=True)
    winner_detail = PlayerBriefSerializer(source="winner", read_only=True)

    class Meta:
        model = Match
        fields = [
            "id", "tournament",
            "gender_type", "gender_type_display",
            "player1", "player1_detail",
            "player2", "player2_detail",
            "winner", "winner_detail",
            "status", "status_display",
            "round_number", "scheduled_at", "score",
        ]
        read_only_fields = ["id"]

    def validate(self, data):
        p1 = data.get("player1", getattr(self.instance, "player1", None))
        p2 = data.get("player2", getattr(self.instance, "player2", None))
        winner = data.get("winner", getattr(self.instance, "winner", None))

        if p1 and p2 and p1 == p2:
            raise serializers.ValidationError({"player2": "Игрок не может играть сам с собой."})

        if winner and p1 and p2 and winner not in (p1, p2):
            raise serializers.ValidationError({"winner": "Победитель должен быть одним из участников матча."})

        return data
