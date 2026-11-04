from rest_framework import serializers

from core.models import Match, Player


class PlayerBriefSerializer(serializers.ModelSerializer):
    class Meta:
        model = Player
        fields = ["id", "first_name", "last_name", "rating"]


class MatchSerializer(serializers.ModelSerializer):
    tournament_name = serializers.CharField(source="tournament.name", read_only=True)
    gender_type_display = serializers.CharField(source="get_gender_type_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    bracket_display = serializers.CharField(source="get_bracket_display", read_only=True)
    kind = serializers.SerializerMethodField()
    kind_display = serializers.SerializerMethodField()

    def get_kind(self, obj):
        return "doubles" if obj.pair1_player2_id else "singles"

    def get_kind_display(self, obj):
        return "Парный" if obj.pair1_player2_id else "Одиночный"
    player1_detail = PlayerBriefSerializer(source="player1", read_only=True, allow_null=True)
    pair1_player2_detail = PlayerBriefSerializer(source="pair1_player2", read_only=True, allow_null=True)
    player2_detail = PlayerBriefSerializer(source="player2", read_only=True, allow_null=True)
    pair2_player2_detail = PlayerBriefSerializer(source="pair2_player2", read_only=True, allow_null=True)
    winner_detail = PlayerBriefSerializer(source="winner", read_only=True)

    class Meta:
        model = Match
        fields = [
            "id", "tournament", "tournament_name",
            "kind", "kind_display",
            "gender_type", "gender_type_display",
            "player1", "player1_detail",
            "pair1_player2", "pair1_player2_detail",
            "player2", "player2_detail",
            "pair2_player2", "pair2_player2_detail",
            "winner", "winner_detail",
            "status", "status_display",
            "bracket", "bracket_display",
            "next_match", "next_slot", "loser_next_match", "loser_next_slot",
            "round_number", "slot_index", "scheduled_at", "court", "score",
            "set1_home", "set1_away", "set2_home", "set2_away",
            "set3_home", "set3_away",
        ]
        read_only_fields = [
            "id", "bracket", "next_match", "next_slot",
            "loser_next_match", "loser_next_slot",
        ]

    def validate(self, data):
        p1 = data.get("player1", getattr(self.instance, "player1", None))
        p1p2 = data.get("pair1_player2", getattr(self.instance, "pair1_player2", None))
        p2 = data.get("player2", getattr(self.instance, "player2", None))
        p2p2 = data.get("pair2_player2", getattr(self.instance, "pair2_player2", None))
        winner = data.get("winner", getattr(self.instance, "winner", None))
        tournament = data.get("tournament", getattr(self.instance, "tournament", None))

        # категория матча задаётся турниром и не редактируется отдельно
        if tournament is not None:
            data["gender_type"] = tournament.gender_type

        all_players = [p for p in (p1, p1p2, p2, p2p2) if p]
        if len(all_players) != len(set(p.pk for p in all_players)):
            raise serializers.ValidationError(
                {"pair1_player2": "Один игрок не может участвовать в матче дважды."}
            )

        if winner:
            captains = [p for p in (p1, p2) if p]
            if captains and winner not in captains:
                raise serializers.ValidationError(
                    {"winner": "Победитель должен быть капитаном одной из сторон (player1 или player2)."}
                )

        # счёт по сетам; строка score собирается из заполненных сетов
        set_fields = (
            ("set1_home", "set1_away"),
            ("set2_home", "set2_away"),
            ("set3_home", "set3_away"),
        )
        sets = []
        for home_field, away_field in set_fields:
            home = data.get(home_field, getattr(self.instance, home_field, None))
            away = data.get(away_field, getattr(self.instance, away_field, None))
            if home is not None and away is not None:
                sets.append(f"{home}:{away}")

        sets_provided = any(f in data for pair in set_fields for f in pair)
        if sets_provided:
            data["score"] = " ".join(sets)

        # статус не выбирается вручную: есть счёт/победитель — матч сыгран,
        # иначе он ещё не игрался (идёт или скоро начнётся — решает время)
        if sets_provided or "winner" in data:
            has_result = bool(sets) or bool(winner)
            is_walkover = bool(
                self.instance and self.instance.status == Match.Status.WALKOVER
            )
            if is_walkover and not sets:
                # техническое поражение сохраняем, пока не ввели настоящий счёт
                pass
            else:
                data["status"] = (
                    Match.Status.FINISHED if has_result else Match.Status.SCHEDULED
                )

        return data
