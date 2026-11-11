from datetime import date

import pytest

from core.models import Match, Player, Tournament, TournamentPointsAward, TournamentResult


@pytest.mark.django_db
class TestPlayersAPI:
    url = "/api/players/"

    def test_create_minimal(self, organizer_client):
        payload = {
            "first_name": "Иван",
            "last_name": "Петров",
            "email": "ivan@example.com",
        }
        response = organizer_client.post(self.url, payload, format="json")
        assert response.status_code == 201, response.content
        data = response.json()
        assert data["rating"] == 1000
        assert data["gender"] == Player.Gender.MALE
        assert data["rating_type"] == Player.RatingType.ELO
        assert data["gender_display"] == "Мужской"

    def test_create_duplicate_email_fails(self, organizer_client, player_factory):
        existing = player_factory(email="dup@example.com")
        response = organizer_client.post(
            self.url,
            {"first_name": "A", "last_name": "B", "email": existing.email},
            format="json",
        )
        assert response.status_code == 400
        assert "email" in response.json()

    def test_list_ordered_by_rating_desc(self, api_client, player_factory):
        player_factory(rating=1500)
        player_factory(rating=2000)
        player_factory(rating=1200)
        response = api_client.get(self.url)
        assert response.status_code == 200
        ratings = [p["rating"] for p in response.json()["results"]]
        assert ratings == sorted(ratings, reverse=True)

    def test_filter_by_gender(self, api_client, player_factory):
        player_factory(gender=Player.Gender.MALE)
        player_factory(gender=Player.Gender.FEMALE)
        player_factory(gender=Player.Gender.FEMALE)
        response = api_client.get(self.url, {"gender": "female"})
        assert response.status_code == 200
        results = response.json()["results"]
        assert len(results) == 2
        assert all(p["gender"] == "female" for p in results)

    def test_pagination_envelope(self, api_client, player_factory):
        player_factory()
        response = api_client.get(self.url)
        body = response.json()
        assert set(body.keys()) >= {"count", "results"}

    def test_patch_rating(self, organizer_client, player_factory):
        p = player_factory(rating=1000)
        response = organizer_client.patch(
            f"{self.url}{p.id}/", {"rating": 1337}, format="json"
        )
        assert response.status_code == 200
        assert response.json()["rating"] == 1337
        p.refresh_from_db()
        assert p.rating == 1337

    def test_delete(self, staff_client, player_factory):
        p = player_factory()
        response = staff_client.delete(f"{self.url}{p.id}/")
        assert response.status_code == 204
        assert not Player.objects.filter(id=p.id).exists()

    def test_anon_cannot_post(self, api_client):
        response = api_client.post(
            self.url,
            {"first_name": "X", "last_name": "Y", "email": "x@x.com"},
            format="json",
        )
        assert response.status_code == 401

    def test_organizer_cannot_delete(self, organizer_client, player_factory):
        p = player_factory()
        response = organizer_client.delete(f"{self.url}{p.id}/")
        assert response.status_code == 403


def _tournament(name, **overrides):
    defaults = {
        "name": name,
        "start_date": date.today(),
        "status": Tournament.Status.FINISHED,
        "format": Tournament.Format.SINGLE_ELIM,
    }
    defaults.update(overrides)
    return Tournament.objects.create(**defaults)


def _match(tournament, player1, player2, winner, **overrides):
    defaults = {
        "tournament": tournament,
        "bracket": Match.Bracket.WINNERS,
        "round_number": 1,
        "player1": player1,
        "player2": player2,
        "winner": winner,
        "status": Match.Status.FINISHED,
    }
    defaults.update(overrides)
    return Match.objects.create(**defaults)


@pytest.mark.django_db
class TestPlayerRecord:
    def test_win_loss_ignores_bye_and_unfinished(self, api_client, player_factory):
        player = player_factory()
        opponent = player_factory()
        other = player_factory()
        cup = _tournament("Cup")

        _match(cup, player, opponent, player, round_number=2)
        _match(cup, other, player, other)
        _match(cup, player, None, player, status=Match.Status.WALKOVER)
        _match(cup, player, other, None, status=Match.Status.SCHEDULED, round_number=3)

        data = api_client.get(f"/api/players/{player.id}/").json()
        assert data["wins"] == 1
        assert data["losses"] == 1

    def test_doubles_partner_shares_the_result(self, api_client, player_factory):
        captain = player_factory()
        partner = player_factory()
        opponent = player_factory()
        opponent_partner = player_factory()
        cup = _tournament("Doubles")
        _match(
            cup,
            captain,
            opponent,
            captain,
            pair1_player2=partner,
            pair2_player2=opponent_partner,
        )

        assert api_client.get(f"/api/players/{partner.id}/").json()["wins"] == 1
        assert api_client.get(f"/api/players/{opponent_partner.id}/").json()["losses"] == 1

    def test_prize_places_once_per_tournament(self, api_client, player_factory):
        player = player_factory()
        cup = _tournament("Cup")
        TournamentResult.objects.create(tournament=cup, place=1, name="A", player=player)
        TournamentPointsAward.objects.create(
            tournament=cup, player=player, place="1", points=40
        )
        fifth = _tournament("Fifth")
        TournamentResult.objects.create(tournament=fifth, place=5, name="A", player=player)
        third = _tournament("Third")
        TournamentPointsAward.objects.create(
            tournament=third, player=player, place="3", points=10
        )

        data = api_client.get(f"/api/players/{player.id}/").json()
        assert data["prize_places"] == {"1": 1, "2": 0, "3": 1}

    def test_prize_place_from_finished_bracket_only(self, api_client, player_factory):
        winner = player_factory()
        loser = player_factory()
        finished = _tournament("Final")
        _match(finished, winner, loser, winner)
        live = _tournament("Live", status=Tournament.Status.IN_PROGRESS)
        _match(live, winner, loser, winner)

        winner_data = api_client.get(f"/api/players/{winner.id}/").json()
        loser_data = api_client.get(f"/api/players/{loser.id}/").json()
        assert winner_data["wins"] == 2
        assert winner_data["prize_places"] == {"1": 1, "2": 0, "3": 0}
        assert loser_data["losses"] == 2
        assert loser_data["prize_places"]["2"] == 1

    def test_list_omits_record(self, api_client, player_factory):
        player = player_factory()
        row = next(item for item in api_client.get("/api/players/").json()["results"] if item["id"] == player.id)
        assert "wins" not in row
        assert "prize_places" not in row
