from collections import defaultdict

from django.db import transaction
from django.db.models import Max
from rest_framework import serializers

from core.models import (
    Player,
    Tournament,
    TournamentPhoto,
    TournamentPointsAward,
    TournamentRegistration,
    TournamentResult,
    TournamentVideo,
)
from .match import PlayerBriefSerializer
from .player import PlayerSerializer
from core.services.age import age_check


class TournamentPhotoSerializer(serializers.ModelSerializer):
    class Meta:
        model = TournamentPhoto
        fields = ["id", "image", "caption", "order"]


class TournamentResultSerializer(serializers.ModelSerializer):
    player_detail = PlayerBriefSerializer(source="player", read_only=True)

    class Meta:
        model = TournamentResult
        fields = ["id", "place", "name", "player", "player_detail"]


class TournamentVideoSerializer(serializers.ModelSerializer):
    class Meta:
        model = TournamentVideo
        fields = ["id", "title", "url", "embed_url", "order"]


class TournamentPointsAwardSerializer(serializers.ModelSerializer):
    player_detail = PlayerBriefSerializer(source="player", read_only=True)

    class Meta:
        model = TournamentPointsAward
        fields = ["id", "player", "player_detail", "place", "points"]


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
    photos = TournamentPhotoSerializer(many=True, read_only=True)
    points_category_display = serializers.CharField(
        source="get_points_category_display", read_only=True
    )
    points_awards = TournamentPointsAwardSerializer(many=True, read_only=True)
    results = TournamentResultSerializer(many=True, read_only=True)
    videos = TournamentVideoSerializer(many=True, read_only=True)

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
            "set_games", "third_set_super_tiebreak",
            "regulation", "summary_text", "photos",
            "source_url", "regulation_url", "results", "videos",
            "points_category", "points_category_display", "points_table",
            "points_awarded_at", "points_awards",
            "age_min", "pair_age_sum_min",
            "created_at",
        ]
        read_only_fields = ["id", "created_at", "points_awarded_at"]

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


class TournamentListSerializer(serializers.ModelSerializer):
    """Облегчённое представление для списков: без фото, итогов и наград."""

    kind_display = serializers.CharField(source="get_kind_display", read_only=True)
    gender_type_display = serializers.CharField(source="get_gender_type_display", read_only=True)
    format_display = serializers.CharField(source="get_format_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    points_category_display = serializers.CharField(
        source="get_points_category_display", read_only=True
    )
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
            "set_games", "third_set_super_tiebreak",
            "points_category", "points_category_display", "points_table",
            "age_min", "pair_age_sum_min",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


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
    age_ok = serializers.SerializerMethodField()
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
            "wildcard", "age_ok",
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

    def _players_for_age(self, obj):
        tournament = obj.tournament
        if not tournament.age_min and not tournament.pair_age_sum_min:
            return None

        if obj.pair_id is None:
            return [obj.player]

        cache = getattr(self, "_pair_players_cache", None)
        if cache is None:
            cache = {}
            self._pair_players_cache = cache
        if obj.tournament_id not in cache:
            grouped = defaultdict(list)
            regs = (
                TournamentRegistration.objects
                .filter(tournament_id=obj.tournament_id)
                .select_related("player")
            )
            for reg in regs:
                if reg.pair_id is not None:
                    grouped[reg.pair_id].append(reg.player)
            cache[obj.tournament_id] = grouped
        return cache[obj.tournament_id].get(obj.pair_id, [obj.player])

    def get_age_ok(self, obj):
        players = self._players_for_age(obj)
        if players is None:
            return True
        ok, _ = age_check(obj.tournament, players)
        return ok

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
        wildcard = (
            False
            if getattr(self, "_is_player_actor", False)
            else bool(validated_data.get("wildcard", False))
        )
        if status == TournamentRegistration.Status.APPROVED:
            # админ заявляет участника сам — возрастной ценз он может обойти через WC
            ok, _ = age_check(
                tournament, [player] + ([partner] if partner else [])
            )
            if not ok:
                wildcard = True
        validated_data["wildcard"] = wildcard

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
                    wildcard=wildcard,
                    invited_by=player if status == TournamentRegistration.Status.PENDING else None,
                )

        return registration
