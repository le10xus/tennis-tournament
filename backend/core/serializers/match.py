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
    pair1_player2_detail = PlayerBriefSerializer(source="pair1_player2", read_only=True)
    player2_detail = PlayerBriefSerializer(source="player2", read_only=True)
    pair2_player2_detail = PlayerBriefSerializer(source="pair2_player2", read_only=True)
    winner_detail = PlayerBriefSerializer(source="winner", read_only=True)

    class Meta:
        model = Match
        fields = [
            "id", "tournament",
            "gender_type", "gender_type_display",
            "player1", "player1_detail",
            "pair1_player2", "pair1_player2_detail",
            "player2", "player2_detail",
            "pair2_player2", "pair2_player2_detail",
            "winner", "winner_detail",
            "status", "status_display",
            "round_number", "scheduled_at", "score",
        ]
        read_only_fields = ["id"]

    def validate(self, data):
        p1 = data.get("player1", getattr(self.instance, "player1", None))
        p1p2 = data.get("pair1_player2", getattr(self.instance, "pair1_player2", None))
        p2 = data.get("player2", getattr(self.instance, "player2", None))
        p2p2 = data.get("pair2_player2", getattr(self.instance, "pair2_player2", None))
        winner = data.get("winner", getattr(self.instance, "winner", None))

        all_players = [p for p in (p1, p1p2, p2, p2p2) if p]
        if len(all_players) != len(set(p.pk for p in all_players)):
            raise serializers.ValidationError(
                {"pair1_player2": "Один игрок не может участвовать в матче дважды."}
            )

        if winner and p1 and p2 and winner not in (p1, p2):
            raise serializers.ValidationError(
                {"winner": "Победитель должен быть капитаном одной из сторон (player1 или player2)."}
            )

        return data
