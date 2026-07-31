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
            tournament=tournament,
            player=player,
            status=TournamentRegistration.Status.APPROVED,
        ).exists()

    def test_player_applies_for_self(self, player_client, player_user, tournament):
        response = player_client.post(
            self.url,
            {"tournament": tournament.id},
            format="json",
        )
        assert response.status_code == 201, response.content
        assert response.json()["status"] == TournamentRegistration.Status.PENDING
        assert response.json()["is_current_user"] is True
        assert TournamentRegistration.objects.filter(
            tournament=tournament,
            player=player_user.player,
            status=TournamentRegistration.Status.PENDING,
        ).exists()

    def test_player_cannot_apply_for_another_player(
        self, player_client, tournament, player_factory
    ):
        another_player = player_factory()
        response = player_client.post(
            self.url,
            {"tournament": tournament.id, "player": another_player.id},
            format="json",
        )
        assert response.status_code == 400
        assert "player" in response.json()

    def test_player_must_match_tournament_gender(
        self, player_client, player_user, tournament
    ):
        player_user.player.gender = "female"
        player_user.player.save(update_fields=["gender"])

        response = player_client.post(
            self.url,
            {"tournament": tournament.id},
            format="json",
        )
        assert response.status_code == 400
        assert "player" in response.json()

    @pytest.mark.parametrize(
        ("field", "limit"),
        [
            ("min_rating", 1001),
            ("max_rating", 999),
        ],
    )
    def test_player_rating_must_be_within_tournament_limits(
        self, player_client, tournament, field, limit
    ):
        setattr(tournament, field, limit)
        tournament.save(update_fields=[field])

        response = player_client.post(
            self.url,
            {"tournament": tournament.id},
            format="json",
        )

        assert response.status_code == 400
        assert "player" in response.json()

    def test_player_cannot_apply_when_registration_closed(
        self, player_client, tournament
    ):
        tournament.status = "in_progress"
        tournament.save(update_fields=["status"])

        response = player_client.post(
            self.url,
            {"tournament": tournament.id},
            format="json",
        )
        assert response.status_code == 400
        assert "tournament" in response.json()

    def test_player_cannot_apply_when_tournament_is_full(
        self, player_client, tournament, player_factory
    ):
        tournament.max_players = 1
        tournament.save(update_fields=["max_players"])
        TournamentRegistration.objects.create(
            tournament=tournament,
            player=player_factory(),
            status=TournamentRegistration.Status.APPROVED,
        )

        response = player_client.post(
            self.url,
            {"tournament": tournament.id},
            format="json",
        )
        assert response.status_code == 400
        assert "tournament" in response.json()

    def test_organizer_can_approve_application(
        self, organizer_client, tournament, player_factory
    ):
        registration = TournamentRegistration.objects.create(
            tournament=tournament,
            player=player_factory(),
            status=TournamentRegistration.Status.PENDING,
        )

        response = organizer_client.post(f"{self.url}{registration.id}/approve/")

        assert response.status_code == 200, response.content
        registration.refresh_from_db()
        assert registration.status == TournamentRegistration.Status.APPROVED

    def test_organizer_cannot_approve_player_outside_rating_limits(
        self, organizer_client, tournament, player_factory
    ):
        tournament.min_rating = 1200
        tournament.save(update_fields=["min_rating"])
        registration = TournamentRegistration.objects.create(
            tournament=tournament,
            player=player_factory(rating=1100),
            status=TournamentRegistration.Status.PENDING,
        )

        response = organizer_client.post(f"{self.url}{registration.id}/approve/")

        assert response.status_code == 400
        registration.refresh_from_db()
        assert registration.status == TournamentRegistration.Status.PENDING

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

    def test_pending_application_visibility(
        self, api_client, player_client, player_user, organizer_client, tournament,
        player_factory,
    ):
        approved = TournamentRegistration.objects.create(
            tournament=tournament,
            player=player_factory(),
            status=TournamentRegistration.Status.APPROVED,
        )
        own_pending = TournamentRegistration.objects.create(
            tournament=tournament,
            player=player_user.player,
            status=TournamentRegistration.Status.PENDING,
        )
        other_pending = TournamentRegistration.objects.create(
            tournament=tournament,
            player=player_factory(),
            status=TournamentRegistration.Status.PENDING,
        )

        anon_ids = {
            item["id"]
            for item in api_client.get(
                self.url, {"tournament": tournament.id}
            ).json()["results"]
        }
        player_ids = {
            item["id"]
            for item in player_client.get(
                self.url, {"tournament": tournament.id}
            ).json()["results"]
        }
        organizer_ids = {
            item["id"]
            for item in organizer_client.get(
                self.url, {"tournament": tournament.id}
            ).json()["results"]
        }

        assert anon_ids == {approved.id}
        assert player_ids == {approved.id, own_pending.id}
        assert organizer_ids == {approved.id, own_pending.id, other_pending.id}

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
