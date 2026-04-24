from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.urls import reverse
from django.utils.html import format_html

from .models import Match, Player, Tournament, TournamentRegistration, User


# ---------------------------------------------------------------------------
# Player Admin
# ---------------------------------------------------------------------------

class UserInline(admin.StackedInline):
    """Показывает привязанный аккаунт прямо в карточке игрока."""

    model = User
    fk_name = "player"  # User.player = OneToOneField(Player) → reverse inline работает
    can_delete = False
    verbose_name_plural = "Аккаунт пользователя"
    fields = ("username", "email", "is_active", "is_staff")
    readonly_fields = ("username",)
    extra = 0
    max_num = 1


@admin.register(Player)
class PlayerAdmin(admin.ModelAdmin):
    inlines = [UserInline]
    list_display = ("last_name", "first_name", "email", "gender", "rating", "rating_type", "created_at")
    list_filter = ("gender", "rating_type")
    search_fields = ("first_name", "last_name", "email")
    ordering = ("-rating",)
    readonly_fields = ("created_at",)
    fieldsets = (
        (None, {"fields": ("first_name", "last_name", "email", "phone")}),
        ("Теннис", {"fields": ("gender", "birth_date", "rating", "rating_type")}),
        ("Мета", {"fields": ("created_at",)}),
    )


# ---------------------------------------------------------------------------
# User Admin
# ---------------------------------------------------------------------------

@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """
    Расширяет стандартный Django UserAdmin.
    При создании нового пользователя сигнал auto-создаёт Player.
    При обновлении синхронизирует имя/фамилию в Player.
    """

    list_display = ("username", "email", "first_name", "last_name", "is_staff", "player_link")
    readonly_fields = ("player_link",)

    fieldsets = BaseUserAdmin.fieldsets + (
        ("Профиль игрока", {"fields": ("player", "player_link")}),
    )

    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        (
            "Имя и email (используются для профиля игрока)",
            {
                "classes": ("wide",),
                "fields": ("first_name", "last_name", "email"),
            },
        ),
    )

    def player_link(self, obj):
        if obj.player_id:
            url = reverse("admin:core_player_change", args=[obj.player_id])
            return format_html('<a href="{}">Открыть профиль игрока →</a>', url)
        return "—"

    player_link.short_description = "Профиль игрока"

    def save_model(self, request, obj, form, change):
        """При обновлении User синхронизирует first_name/last_name в Player."""
        super().save_model(request, obj, form, change)
        if change and obj.player:
            player = obj.player
            updated_fields = []
            if obj.first_name and player.first_name != obj.first_name:
                player.first_name = obj.first_name
                updated_fields.append("first_name")
            if obj.last_name and player.last_name != obj.last_name:
                player.last_name = obj.last_name
                updated_fields.append("last_name")
            if updated_fields:
                player.save(update_fields=updated_fields)


# ---------------------------------------------------------------------------
# Tournament Admin
# ---------------------------------------------------------------------------

class TournamentRegistrationInline(admin.TabularInline):
    model = TournamentRegistration
    extra = 0
    fields = ("player", "seed", "registered_at")
    readonly_fields = ("registered_at",)
    autocomplete_fields = ("player",)


@admin.register(Tournament)
class TournamentAdmin(admin.ModelAdmin):
    inlines = [TournamentRegistrationInline]
    list_display = ("name", "format", "gender_type", "status", "start_date", "end_date", "max_players")
    list_filter = ("status", "format", "gender_type")
    search_fields = ("name", "location")
    ordering = ("-start_date",)
    readonly_fields = ("created_at",)
    fieldsets = (
        (None, {"fields": ("name", "gender_type", "format", "status")}),
        ("Расписание", {"fields": ("start_date", "end_date", "location")}),
        ("Детали", {"fields": ("max_players", "description")}),
        ("Мета", {"fields": ("created_at",)}),
    )


# ---------------------------------------------------------------------------
# TournamentRegistration Admin
# ---------------------------------------------------------------------------

@admin.register(TournamentRegistration)
class TournamentRegistrationAdmin(admin.ModelAdmin):
    list_display = ("player", "tournament", "seed", "registered_at")
    list_filter = ("tournament",)
    search_fields = ("player__first_name", "player__last_name", "tournament__name")
    autocomplete_fields = ("player", "tournament")
    readonly_fields = ("registered_at",)


# ---------------------------------------------------------------------------
# Match Admin
# ---------------------------------------------------------------------------

@admin.register(Match)
class MatchAdmin(admin.ModelAdmin):
    list_display = (
        "tournament", "round_number", "gender_type",
        "player1", "player2", "winner", "status", "scheduled_at",
    )
    list_filter = ("status", "tournament", "gender_type")
    search_fields = (
        "player1__first_name", "player1__last_name",
        "player2__first_name", "player2__last_name",
        "tournament__name",
    )
    autocomplete_fields = ("player1", "player2", "winner", "tournament")
    ordering = ("round_number", "scheduled_at")
    fieldsets = (
        (None, {"fields": ("tournament", "gender_type", "round_number", "status")}),
        ("Игроки", {"fields": ("player1", "player2", "winner")}),
        ("Детали", {"fields": ("scheduled_at", "score")}),
    )
