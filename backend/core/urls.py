from django.urls import path
from rest_framework.routers import DefaultRouter

from core.views import MatchViewSet, PlayerViewSet, TournamentRegistrationViewSet, TournamentViewSet, UserViewSet
from core.views.head_to_head import head_to_head
from core.views.user import CurrentUserView

router = DefaultRouter()
router.register("players", PlayerViewSet, basename="player")
router.register("tournaments", TournamentViewSet, basename="tournament")
router.register("registrations", TournamentRegistrationViewSet, basename="registration")
router.register("matches", MatchViewSet, basename="match")
router.register("users", UserViewSet, basename="user")

urlpatterns = [
    path("users/me/", CurrentUserView.as_view(), name="current-user"),
    path("head-to-head/", head_to_head, name="head-to-head"),
    *router.urls,
]
