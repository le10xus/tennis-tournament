from rest_framework.permissions import BasePermission, SAFE_METHODS


class RolePermission(BasePermission):
    """
    аноним    → только чтение (GET/HEAD/OPTIONS)
    player    → только чтение
    organizer → чтение + создание + редактирование (без DELETE)
    is_staff  → полный CRUD
    """
    message = "У вас недостаточно прав для выполнения этого действия."

    def has_permission(self, request, view):
        # Анонимный просмотр разрешён
        if request.method in SAFE_METHODS:
            return True
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_staff:
            return True
        if request.method == "DELETE":
            return False
        return getattr(request.user, "role", "player") == "organizer"


class TournamentRegistrationPermission(BasePermission):
    """Игрок подаёт заявку, organizer/staff управляют регистрациями."""
    message = "У вас недостаточно прав для выполнения этого действия."

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_staff:
            return True

        role = getattr(request.user, "role", "player")
        if request.method == "POST" and view.action == "create":
            return role in {"player", "organizer"}
        if request.method == "DELETE":
            return False
        return role == "organizer"


class IsAdminUser(BasePermission):
    """Только администраторы (is_staff)."""
    message = "Только администраторы имеют доступ к этому разделу."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_staff
        )
