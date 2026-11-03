from django.db import transaction
from django.db.models import Max
from rest_framework import serializers

from core.models import Player, Tournament, TournamentRegistration
from .player import PlayerSerializer


def registration_eligibility_error(tournament, player, check_status=True):
    if check_status and tournament.status != Tournament.Status.REGISTRATION:
        return "tournament", "Регистрация на турнир закрыта."
    if (
        tournament.gender_type != "mixed"
        and tournament.gender_type != player.gender
    ):
        return "player", "Пол игрока не соответствует категории турнира."

    rating = (
        player.points_doubles
        if tournament.kind == Tournament.Kind.DOUBLES
        else player.points_singles
    )
    if tournament.min_rating is not None and rating < tournament.min_rating:
        return "player", f"Рейтинг игрока должен быть не ниже {tournament.min_rating}."
    if tournament.max_rating is not None and rating > tournament.max_rating:
        return "player", f"Рейтинг игрока должен быть не выше {tournament.max_rating}."
    return None


def next_pair_id(tournament):
    current = (
        TournamentRegistration.objects
        .filter(tournament=tournament)
        .aggregate(value=Max("pair_id"))["value"]
    )
    return (current or 0) + 1


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
            "courts", "match_duration_minutes",
            "saturday_start_time", "sunday_start_time",
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
    invited_by_detail = PlayerSerializer(source="invited_by", read_only=True)
    # только для записи: заявка сразу на пару (игрок + партнёр)
    partner = serializers.PrimaryKeyRelatedField(
        queryset=Player.objects.all(),
        required=False,
        write_only=True,
    )

    class Meta:
        model = TournamentRegistration
        fields = [
            "id", "tournament", "tournament_detail",
            "player", "player_detail",
            "status", "status_display", "is_current_user",
            "registered_at", "seed", "pair_id",
            "invited_by", "invited_by_detail",
            "partner",
        ]
        read_only_fields = ["id", "status", "registered_at", "invited_by"]
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
        submitted_partner = data.get("partner")

        is_player_actor = (
            not user.is_staff
            and getattr(user, "role", "player") == "player"
        )
        self._is_player_actor = is_player_actor

        if is_player_actor:
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

        if submitted_partner:
            if tournament.kind != Tournament.Kind.DOUBLES:
                raise serializers.ValidationError(
                    {"partner": "Партнёр указывается только для парного турнира."}
                )
            if submitted_partner.pk == player.pk:
                raise serializers.ValidationError(
                    {"partner": "Партнёр не может совпадать с заявленным игроком."}
                )
            partner = submitted_partner
        else:
            partner = None

        if tournament.kind == Tournament.Kind.DOUBLES and is_player_actor and partner is None:
            raise serializers.ValidationError(
                {"partner": "Для парного турнира выберите партнёра."}
            )

        targets = [player] + ([partner] if partner else [])
        for target in targets:
            eligibility_error = registration_eligibility_error(
                tournament, target, check_status=is_player_actor
            )
            if eligibility_error:
                field, message = eligibility_error
                if target is partner:
                    field = "partner"
                raise serializers.ValidationError({field: message})

        duplicates = TournamentRegistration.objects.filter(
            tournament=tournament, player__in=targets
        )
        if duplicates.exists():
            raise serializers.ValidationError(
                {"player": "Игрок уже подал заявку на этот турнир."}
            )

        approved_count = TournamentRegistration.objects.filter(
            tournament=tournament,
            status=TournamentRegistration.Status.APPROVED,
        ).count()
        needed = len(targets)
        if approved_count + needed > tournament.max_players:
            raise serializers.ValidationError(
                {"tournament": "В турнире нет свободных мест."}
            )

        return data

    def create(self, validated_data):
        partner = validated_data.pop("partner", None)
        submitted_pair_id = validated_data.pop("pair_id", None)
        tournament = validated_data["tournament"]
        player = validated_data["player"]
        status = (
            TournamentRegistration.Status.PENDING
            if getattr(self, "_is_player_actor", False)
            else TournamentRegistration.Status.APPROVED
        )

        with transaction.atomic():
            if partner:
                # блокируем турнир, чтобы параллельные заявки не получили одинаковый pair_id
                Tournament.objects.select_for_update().get(pk=tournament.pk)
                pair_id = next_pair_id(tournament)
            else:
                pair_id = submitted_pair_id
            registration = TournamentRegistration.objects.create(
                status=status,
                pair_id=pair_id,
                **validated_data,
            )
            if partner:
                TournamentRegistration.objects.create(
                    tournament=tournament,
                    player=partner,
                    status=status,
                    pair_id=pair_id,
                    invited_by=player if status == TournamentRegistration.Status.PENDING else None,
                )

        return registration
