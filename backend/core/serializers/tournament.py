from rest_framework import serializers

from core.models import Player, Tournament, TournamentRegistration
from .player import PlayerSerializer


def registration_eligibility_error(tournament, player):
    if tournament.status != Tournament.Status.REGISTRATION:
        return "tournament", "Регистрация на турнир закрыта."
    if (
        tournament.gender_type != "mixed"
        and tournament.gender_type != player.gender
    ):
        return "player", "Пол игрока не соответствует категории турнира."
    if tournament.min_rating is not None and player.rating < tournament.min_rating:
        return "player", f"Рейтинг игрока должен быть не ниже {tournament.min_rating}."
    if tournament.max_rating is not None and player.rating > tournament.max_rating:
        return "player", f"Рейтинг игрока должен быть не выше {tournament.max_rating}."
    return None


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
            "max_players", "min_rating", "max_rating", "players_count",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def validate(self, data):
        start = data.get("start_date", getattr(self.instance, "start_date", None))
        end = data.get("end_date", getattr(self.instance, "end_date", None))
        if start and end and end < start:
            raise serializers.ValidationError({"end_date": "Дата окончания не может быть раньше даты начала."})
        min_rating = data.get("min_rating", getattr(self.instance, "min_rating", None))
        max_rating = data.get("max_rating", getattr(self.instance, "max_rating", None))
        if (
            min_rating is not None
            and max_rating is not None
            and min_rating > max_rating
        ):
            raise serializers.ValidationError(
                {"max_rating": "Максимальный рейтинг не может быть меньше минимального."}
            )
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
    player = serializers.PrimaryKeyRelatedField(queryset=Player.objects.all(), required=False)
    player_detail = PlayerSerializer(source="player", read_only=True)
    tournament_detail = TournamentNestedSerializer(source="tournament", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    is_current_user = serializers.SerializerMethodField()

    class Meta:
        model = TournamentRegistration
        fields = [
            "id", "tournament", "tournament_detail",
            "player", "player_detail",
            "status", "status_display", "is_current_user",
            "registered_at", "seed", "pair_id",
        ]
        read_only_fields = ["id", "status", "registered_at"]
        validators = []

    def get_is_current_user(self, obj):
        request = self.context.get("request")
        return bool(
            request
            and request.user.is_authenticated
            and request.user.player_id == obj.player_id
        )

    def validate(self, data):
        if self.instance:
            return data

        request = self.context["request"]
        user = request.user
        submitted_player = data.get("player")

        if not user.is_staff and getattr(user, "role", "player") == "player":
            if not user.player_id:
                raise serializers.ValidationError(
                    {"player": "К аккаунту не привязан профиль игрока."}
                )
            if submitted_player and submitted_player.pk != user.player_id:
                raise serializers.ValidationError(
                    {"player": "Можно подать заявку только за себя."}
                )
            player = user.player
            data["player"] = player
        else:
            if not submitted_player:
                raise serializers.ValidationError(
                    {"player": "Выберите игрока."}
                )
            player = submitted_player

        tournament = data["tournament"]
        eligibility_error = registration_eligibility_error(tournament, player)
        if eligibility_error:
            field, message = eligibility_error
            raise serializers.ValidationError({field: message})
        if TournamentRegistration.objects.filter(
            tournament=tournament, player=player
        ).exists():
            raise serializers.ValidationError(
                {"player": "Игрок уже подал заявку на этот турнир."}
            )
        approved_count = TournamentRegistration.objects.filter(
            tournament=tournament,
            status=TournamentRegistration.Status.APPROVED,
        ).count()
        if approved_count >= tournament.max_players:
            raise serializers.ValidationError(
                {"tournament": "В турнире нет свободных мест."}
            )

        return data
