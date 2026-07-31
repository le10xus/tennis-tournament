from datetime import date, timedelta

import pytest

from core.models import Match, Tournament, TournamentRegistration


@pytest.mark.django_db
class TestTournamentsAPI:
    url = "/api/tournaments/"

    def test_create_valid(self, organizer_client):
        payload = {
            "name": "Кубок весны",
            "start_date": str(date.today()),
            "end_date": str(date.today() + timedelta(days=5)),
            "gender_type": "male",
            "format": "round_robin",
            "max_players": 16,
            "min_rating": 900,
            "max_rating": 1400,
        }
        response = organizer_client.post(self.url, payload, format="json")
        assert response.status_code == 201, response.content
        data = response.json()
        assert data["name"] == "Кубок весны"
        assert data["status"] == Tournament.Status.DRAFT
        assert data["format_display"] == "Круговой"
        assert data["min_rating"] == 900
        assert data["max_rating"] == 1400

    def test_create_end_before_start_fails(self, organizer_client):
        payload = {
            "name": "Bad",
            "start_date": str(date.today() + timedelta(days=5)),
            "end_date": str(date.today()),
        }
        response = organizer_client.post(self.url, payload, format="json")
        assert response.status_code == 400
        assert "end_date" in response.json()

    def test_create_min_rating_above_max_rating_fails(self, organizer_client):
        response = organizer_client.post(
            self.url,
            {
                "name": "Bad rating range",
                "start_date": str(date.today()),
                "min_rating": 1500,
                "max_rating": 1000,
            },
            format="json",
        )

        assert response.status_code == 400
        assert "max_rating" in response.json()

    def test_players_count_annotation(self, api_client, tournament, player_factory):
        TournamentRegistration.objects.create(
            tournament=tournament, player=player_factory()
        )
        TournamentRegistration.objects.create(
            tournament=tournament, player=player_factory()
        )
        response = api_client.get(f"{self.url}{tournament.id}/")
        assert response.status_code == 200
        assert response.json()["players_count"] == 2

    def test_players_count_ignores_pending(
        self, api_client, tournament, player_factory
    ):
        TournamentRegistration.objects.create(
            tournament=tournament,
            player=player_factory(),
            status=TournamentRegistration.Status.APPROVED,
        )
        TournamentRegistration.objects.create(
            tournament=tournament,
            player=player_factory(),
            status=TournamentRegistration.Status.PENDING,
        )

        response = api_client.get(f"{self.url}{tournament.id}/")

        assert response.status_code == 200
        assert response.json()["players_count"] == 1

    def test_generate_bracket_ignores_pending(
        self, organizer_client, tournament, player_factory
    ):
        TournamentRegistration.objects.create(
            tournament=tournament,
            player=player_factory(),
            status=TournamentRegistration.Status.APPROVED,
        )
        TournamentRegistration.objects.create(
            tournament=tournament,
            player=player_factory(),
            status=TournamentRegistration.Status.PENDING,
        )

        response = organizer_client.post(
            f"{self.url}{tournament.id}/generate_bracket/"
        )

        assert response.status_code == 400
        assert Match.objects.filter(tournament=tournament).count() == 0

    def test_filter_by_status(self, api_client, tournament):
        Tournament.objects.create(
            name="Finished Cup",
            start_date=date.today(),
            status=Tournament.Status.FINISHED,
        )
        response = api_client.get(self.url, {"status": "registration"})
        assert response.status_code == 200
        results = response.json()["results"]
        assert len(results) == 1
        assert results[0]["id"] == tournament.id

    def test_filter_by_gender_type(self, api_client):
        Tournament.objects.create(
            name="Male Cup", start_date=date.today(), gender_type="male"
        )
        Tournament.objects.create(
            name="Female Cup", start_date=date.today(), gender_type="female"
        )
        response = api_client.get(self.url, {"gender_type": "female"})
        results = response.json()["results"]
        assert len(results) == 1
        assert results[0]["name"] == "Female Cup"

    def test_status_transitions(self, organizer_client, tournament):
        for new_status in ["registration", "in_progress", "finished"]:
            response = organizer_client.patch(
                f"{self.url}{tournament.id}/",
                {"status": new_status},
                format="json",
            )
            assert response.status_code == 200
            assert response.json()["status"] == new_status

    def test_anon_cannot_create(self, api_client):
        response = api_client.post(
            self.url,
            {"name": "Hack Cup", "start_date": str(date.today())},
            format="json",
        )
        assert response.status_code == 401
