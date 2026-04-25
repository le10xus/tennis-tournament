from rest_framework.permissions import BasePermission, SAFE_METHODS


class RolePermission(BasePermission):
    """
    is_staff  → полный CRUD
    organizer → чтение + создание + редактирование (без DELETE)
    player    → только чтение
    аноним    → 401
    """
    message = "У вас недостаточно прав для выполнения этого действия."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_staff:
            return True
        if request.method in SAFE_METHODS:
            return True
        if request.method == "DELETE":
            return False
        return getattr(request.user, "role", "player") == "organizer"


class IsAdminUser(BasePermission):
    """Только администраторы (is_staff)."""
    message = "Только администраторы имеют доступ к этому разделу."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_staff
        )
