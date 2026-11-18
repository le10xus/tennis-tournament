import pytest

from core.models import Match


@pytest.mark.django_db
class TestHeadToHead:
    url = "/api/head-to-head/"

    def test_excludes_partners_keeps_opponents(
        self, api_client, tournament, player_factory
    ):
        a, b, c, d = [player_factory() for _ in range(4)]
        singles = Match.objects.create(
            tournament=tournament,
            player1=a,
            player2=b,
            winner=a,
            score="6:4 6:3",
            status=Match.Status.FINISHED,
        )
        Match.objects.create(
            tournament=tournament,
            player1=a,
            pair1_player2=b,
            player2=c,
            pair2_player2=d,
            winner=a,
            status=Match.Status.FINISHED,
        )
        Match.objects.create(
            tournament=tournament,
            player1=c,
            pair1_player2=d,
            player2=a,
            pair2_player2=b,
            winner=c,
            status=Match.Status.FINISHED,
        )
        opponents = Match.objects.create(
            tournament=tournament,
            player1=a,
            pair1_player2=c,
            player2=d,
            pair2_player2=b,
            winner=d,
            score="7:5 6:4",
            status=Match.Status.FINISHED,
        )

        response = api_client.get(self.url, {"player1": a.id, "player2": b.id})

        assert response.status_code == 200
        data = response.json()
        assert data["count"] == 2
        by_id = {row["id"]: row for row in data["matches"]}
        assert set(by_id) == {singles.id, opponents.id}
        assert by_id[singles.id]["winner_side"] == 1
        assert by_id[singles.id]["score"] == "6:4 6:3"
        assert by_id[opponents.id]["winner_side"] == 2
        assert by_id[opponents.id]["score"] == "7:5 6:4"
        assert data["wins1"] == 1
        assert data["wins2"] == 1

    def test_credits_partner_on_away_side(self, api_client, tournament, player_factory):
        a, b, c, d = [player_factory() for _ in range(4)]
        # Дома A/C, в гостях D/B. Выиграла гостевая пара, B — её партнёр.
        Match.objects.create(
            tournament=tournament,
            player1=a,
            pair1_player2=c,
            player2=d,
            pair2_player2=b,
            winner=d,
            score="4:3(5) 2:4 10:6",
            status=Match.Status.FINISHED,
        )
        Match.objects.create(
            tournament=tournament,
            player1=a,
            player2=b,
            winner=a,
            score="6:4 6:3",
            status=Match.Status.FINISHED,
        )
        Match.objects.create(
            tournament=tournament,
            player1=a,
            player2=b,
            winner=b,
            score="отказ",
            status=Match.Status.WALKOVER,
        )
        Match.objects.create(
            tournament=tournament,
            player1=a,
            player2=b,
            winner=b,
            score="19/12 23/13",
            status=Match.Status.FINISHED,
        )
        # Капитан домашней стороны пуст, победителя нет — это не победа.
        Match.objects.create(
            tournament=tournament,
            pair1_player2=a,
            player2=b,
        )

        response = api_client.get(self.url, {"player1": b.id, "player2": a.id})

        assert response.status_code == 200
        data = response.json()
        assert data["count"] == 5
        assert data["wins1"] == 3
        assert data["wins2"] == 1
        by_score = {row["score"]: row["winner_side"] for row in data["matches"]}
        assert by_score == {
            "3(5):4 4:2 6:10": 1,
            "4:6 3:6": 2,
            "отказ": 1,
            "12/19 13/23": 1,
            "": 0,
        }
