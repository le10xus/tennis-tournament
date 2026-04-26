import itertools
from datetime import date, timedelta

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from core.models import Player, Tournament, TournamentRegistration

User = get_user_model()


@pytest.fixture
def api_client():
    """Анонимный клиент — только чтение (GET)."""
    return APIClient()


@pytest.fixture
def staff_client(db):
    """Клиент с правами is_staff — полный CRUD (POST/PATCH/DELETE)."""
    user = User.objects.create_user(
        username="staff_user",
        password="testpass123",
        is_staff=True,
    )
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def organizer_client(db):
    """Клиент с ролью organizer — POST и PATCH, без DELETE."""
    user = User.objects.create_user(
        username="organizer_user",
        password="testpass123",
        role=User.Role.ORGANIZER,
    )
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def player_factory(db):
    counter = itertools.count(1)

    def _make(**overrides):
        i = next(counter)
        defaults = {
            "first_name": f"First{i}",
            "last_name": f"Last{i}",
            "email": f"player{i}@example.com",
        }
        defaults.update(overrides)
        return Player.objects.create(**defaults)

    return _make


@pytest.fixture
def tournament(db):
    return Tournament.objects.create(
        name="Test Cup",
        start_date=date.today(),
        end_date=date.today() + timedelta(days=3),
        status=Tournament.Status.REGISTRATION,
    )


@pytest.fixture
def registered_players(tournament, player_factory):
    players = [player_factory() for _ in range(4)]
    for p in players:
        TournamentRegistration.objects.create(tournament=tournament, player=p)
    return tournament, players
