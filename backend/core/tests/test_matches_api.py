import pytest

from core.models import Match


@pytest.mark.django_db
class TestMatchesAPI:
    url = "/api/matches/"

    def test_create_match(self, organizer_client, registered_players):
        tournament, players = registered_players
        response = organizer_client.post(
            self.url,
            {
                "tournament": tournament.id,
                "player1": players[0].id,
                "player2": players[1].id,
                "round_number": 1,
            },
            format="json",
        )
        assert response.status_code == 201, response.content
        data = response.json()
        assert data["status"] == Match.Status.SCHEDULED
        assert data["player1_detail"]["id"] == players[0].id
        assert data["player2_detail"]["id"] == players[1].id
        assert data["status_display"] == "Запланирован"

    def test_player1_equals_player2_fails(
        self, organizer_client, registered_players
    ):
        tournament, players = registered_players
        response = organizer_client.post(
            self.url,
            {
                "tournament": tournament.id,
                "player1": players[0].id,
                "player2": players[0].id,
            },
            format="json",
        )
        assert response.status_code == 400
        # В одиночном формате ошибка на player2, в парном — на pair1_player2
        error_keys = set(response.json().keys())
        assert error_keys & {"player2", "pair1_player2", "non_field_errors"}

    def test_winner_must_be_participant(
        self, organizer_client, registered_players
    ):
        tournament, players = registered_players
        response = organizer_client.post(
            self.url,
            {
                "tournament": tournament.id,
                "player1": players[0].id,
                "player2": players[1].id,
                "winner": players[2].id,
            },
            format="json",
        )
        assert response.status_code == 400
        assert "winner" in response.json()

    def test_finish_match(self, organizer_client, registered_players):
        tournament, players = registered_players
        match = Match.objects.create(
            tournament=tournament,
            player1=players[0],
            player2=players[1],
        )
        response = organizer_client.patch(
            f"{self.url}{match.id}/",
            {
                "winner": players[0].id,
                "score": "6:4 7:5",
                "status": Match.Status.FINISHED,
            },
            format="json",
        )
        assert response.status_code == 200
        data = response.json()
        assert data["winner"] == players[0].id
        assert data["score"] == "6:4 7:5"
        assert data["status"] == "finished"

    def test_filter_by_tournament(self, api_client, registered_players):
        tournament, players = registered_players
        Match.objects.create(
            tournament=tournament, player1=players[0], player2=players[1]
        )
        Match.objects.create(
            tournament=tournament, player1=players[2], player2=players[3]
        )
        response = api_client.get(self.url, {"tournament": tournament.id})
        assert response.status_code == 200
        assert response.json()["count"] == 2

    def test_filter_by_status(self, api_client, registered_players):
        tournament, players = registered_players
        Match.objects.create(
            tournament=tournament,
            player1=players[0],
            player2=players[1],
            status=Match.Status.SCHEDULED,
        )
        Match.objects.create(
            tournament=tournament,
            player1=players[2],
            player2=players[3],
            status=Match.Status.FINISHED,
        )
        response = api_client.get(self.url, {"status": "finished"})
        results = response.json()["results"]
        assert len(results) == 1
        assert results[0]["status"] == "finished"

    def test_anon_cannot_create_match(self, api_client, registered_players):
        tournament, players = registered_players
        response = api_client.post(
            self.url,
            {
                "tournament": tournament.id,
                "player1": players[0].id,
                "player2": players[1].id,
            },
            format="json",
        )
        assert response.status_code == 401
