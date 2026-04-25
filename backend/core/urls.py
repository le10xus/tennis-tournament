from rest_framework.routers import DefaultRouter

from core.views import MatchViewSet, PlayerViewSet, TournamentRegistrationViewSet, TournamentViewSet, UserViewSet

router = DefaultRouter()
router.register("players", PlayerViewSet, basename="player")
router.register("tournaments", TournamentViewSet, basename="tournament")
router.register("registrations", TournamentRegistrationViewSet, basename="registration")
router.register("matches", MatchViewSet, basename="match")
router.register("users", UserViewSet, basename="user")

urlpatterns = router.urls
