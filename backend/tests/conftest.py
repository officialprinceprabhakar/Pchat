import os
import pytest
import requests


BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or "https://modern-social-chat.preview.emergentagent.com"
BASE_URL = BASE_URL.rstrip("/")


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def login(session: requests.Session, username: str, password: str) -> dict:
    r = session.post(f"{BASE_URL}/api/auth/guest/login", json={"username": username, "password": password})
    assert r.status_code == 200, f"login failed {username}: {r.status_code} {r.text}"
    return r.json()


def register(session: requests.Session, username: str, password: str) -> dict:
    r = session.post(f"{BASE_URL}/api/auth/guest/register", json={"username": username, "password": password})
    assert r.status_code in (200, 201), f"register failed {username}: {r.status_code} {r.text}"
    return r.json()
