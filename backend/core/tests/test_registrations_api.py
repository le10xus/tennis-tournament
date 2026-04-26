import pytest

from core.models import TournamentRegistration


@pytest.mark.django_db
class TestRegistrationsAPI:
    url = "/api/registrations/"

    def test_register_player(self, organizer_client, tournament, player_factory):
        player = player_factory()
        response = organizer_client.post(
            self.url,
            {"tournament": tournament.id, "player": player.id},
            format="json",
        )
        assert response.status_code == 201, response.content
        assert TournamentRegistration.objects.filter(
            tournament=tournament, player=player
        ).exists()

    def test_duplicate_registration_fails(
        self, organizer_client, tournament, player_factory
    ):
        player = player_factory()
        TournamentRegistration.objects.create(
            tournament=tournament, player=player
        )
        response = organizer_client.post(
            self.url,
            {"tournament": tournament.id, "player": player.id},
            format="json",
        )
        assert response.status_code in (400, 409)

    def test_filter_by_tournament(self, api_client, registered_players):
        tournament, players = registered_players
        response = api_client.get(self.url, {"tournament": tournament.id})
        assert response.status_code == 200
        results = response.json()["results"]
        assert len(results) == len(players)

    def test_filter_by_player(self, api_client, registered_players):
        _, players = registered_players
        response = api_client.get(self.url, {"player": players[0].id})
        results = response.json()["results"]
        assert len(results) == 1
        assert results[0]["player"] == players[0].id

    def test_delete_registration(
        self, staff_client, tournament, player_factory
    ):
        player = player_factory()
        reg = TournamentRegistration.objects.create(
            tournament=tournament, player=player
        )
        response = staff_client.delete(f"{self.url}{reg.id}/")
        assert response.status_code == 204
        assert not TournamentRegistration.objects.filter(id=reg.id).exists()

    def test_anon_cannot_register(self, api_client, tournament, player_factory):
        player = player_factory()
        response = api_client.post(
            self.url,
            {"tournament": tournament.id, "player": player.id},
            format="json",
        )
        assert response.status_code == 401
