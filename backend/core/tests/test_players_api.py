import pytest

from core.models import Player


@pytest.mark.django_db
class TestPlayersAPI:
    url = "/api/players/"

    def test_create_minimal(self, api_client):
        payload = {
            "first_name": "Иван",
            "last_name": "Петров",
            "email": "ivan@example.com",
        }
        response = api_client.post(self.url, payload, format="json")
        assert response.status_code == 201, response.content
        data = response.json()
        assert data["rating"] == 1000
        assert data["gender"] == Player.Gender.MALE
        assert data["rating_type"] == Player.RatingType.ELO
        assert data["gender_display"] == "Мужской"

    def test_create_duplicate_email_fails(self, api_client, player_factory):
        existing = player_factory(email="dup@example.com")
        response = api_client.post(
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

    def test_patch_rating(self, api_client, player_factory):
        p = player_factory(rating=1000)
        response = api_client.patch(
            f"{self.url}{p.id}/", {"rating": 1337}, format="json"
        )
        assert response.status_code == 200
        assert response.json()["rating"] == 1337
        p.refresh_from_db()
        assert p.rating == 1337

    def test_delete(self, api_client, player_factory):
        p = player_factory()
        response = api_client.delete(f"{self.url}{p.id}/")
        assert response.status_code == 204
        assert not Player.objects.filter(id=p.id).exists()
