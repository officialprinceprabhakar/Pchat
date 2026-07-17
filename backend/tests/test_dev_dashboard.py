"""
PChat backend integration tests - Developer Dashboard flows.

Covers:
1. Force change-password flow for seeded devs (PrincePrabhakar starts must_change=true)
2. Feature flags (public + dev endpoints)
3. Global announcements CRUD + dismiss
4. Dev user actions (force-logout, reset-password)
5. Non-dev access denial
6. Regression sanity (rooms, notifications)
"""

import os
import time
import uuid
import pytest
import requests

BASE_URL = (os.environ.get("EXPO_PUBLIC_BACKEND_URL") or "https://modern-social-chat.preview.emergentagent.com").rstrip("/")

# --- Credentials from /app/memory/test_credentials.md ---
DEV_USERNAME = "Prince_Prabhakar"
DEV_PASSWORD = "DevPass123!"

FORCED_DEV_USER = "PrincePrabhakar"
FORCED_DEV_INITIAL_PWD = "PRin09#@"
FORCED_DEV_NEW_PWD = "NewPwd1234"

REGULAR_USER = "testuser1"
REGULAR_PWD = "testpass123"

FEATURE_KEYS = [
    "posts_enabled",
    "voice_notes_enabled",
    "room_creation_enabled",
    "guest_registration_enabled",
    "google_auth_enabled",
    "friends_system_enabled",
    "direct_messages_enabled",
    "profanity_filter_enabled",
]


def _post(path, token=None, json=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return requests.post(f"{BASE_URL}{path}", headers=headers, json=json)


def _get(path, token=None):
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return requests.get(f"{BASE_URL}{path}", headers=headers)


def _login(username, password):
    r = _post("/api/auth/guest/login", json={"username": username, "password": password})
    return r


def _dev_token():
    r = _login(DEV_USERNAME, DEV_PASSWORD)
    assert r.status_code == 200, f"dev login failed: {r.status_code} {r.text}"
    data = r.json()
    return data["session_token"], data["user"]


def _regular_token():
    r = _login(REGULAR_USER, REGULAR_PWD)
    if r.status_code != 200:
        # try to register
        _post("/api/auth/guest/register", json={"username": REGULAR_USER, "password": REGULAR_PWD})
        r = _login(REGULAR_USER, REGULAR_PWD)
    assert r.status_code == 200, f"regular login failed: {r.status_code} {r.text}"
    return r.json()["session_token"], r.json()["user"]


# ============================================================
# 1. Force change-password flow
# ============================================================
class TestForceChangePassword:
    """Seeded dev PrincePrabhakar starts with must_change_password=true.
    We can only run this once; after the flow, must_change is cleared.
    So the test is defensive: if user already changed, we just skip / verify state.
    """

    def test_forced_login_and_change_password_flow(self):
        r = _login(FORCED_DEV_USER, FORCED_DEV_INITIAL_PWD)
        if r.status_code != 200:
            # perhaps already changed; try new pwd
            r2 = _login(FORCED_DEV_USER, FORCED_DEV_NEW_PWD)
            if r2.status_code == 200 and not r2.json()["user"].get("must_change_password"):
                pytest.skip(f"{FORCED_DEV_USER} already went through change-password flow. Current pwd={FORCED_DEV_NEW_PWD}")
            # if initial login fails and new pwd fails, try reset via dev
            dev_tok, _ = _dev_token()
            uid = r2.json().get("user", {}).get("user_id") if r2.status_code == 200 else None
            if uid is None:
                # Look up user via dev users list
                lst = _get("/api/dev/users", token=dev_tok).json()
                for u in lst.get("users", []):
                    if u.get("username") == FORCED_DEV_USER:
                        uid = u["user_id"]
                        break
            assert uid, f"cannot find {FORCED_DEV_USER}"
            rr = _post(f"/api/dev/user/{uid}/reset-password", token=dev_tok)
            assert rr.status_code == 200
            r = _login(FORCED_DEV_USER, FORCED_DEV_INITIAL_PWD)

        assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
        data = r.json()
        assert data["user"]["must_change_password"] is True, f"expected must_change=true, got {data['user']}"
        token = data["session_token"]

        # POST change-password with only new_password (no current_password)
        cp = _post("/api/auth/change-password", token=token, json={"new_password": FORCED_DEV_NEW_PWD})
        assert cp.status_code == 200, f"change-password failed: {cp.status_code} {cp.text}"

        # GET /me should now have must_change=false
        me = _get("/api/auth/me", token=token)
        assert me.status_code == 200
        assert me.json()["user"]["must_change_password"] is False

        # Second call without current_password should now 400
        cp2 = _post("/api/auth/change-password", token=token, json={"new_password": "AnotherPwd12"})
        assert cp2.status_code == 400, f"expected 400 (current pwd required), got {cp2.status_code}: {cp2.text}"


# ============================================================
# 2. Feature flags
# ============================================================
class TestFeatureFlags:

    def test_features_public_shape(self):
        tok, _ = _regular_token()
        r = _get("/api/features", token=tok)
        assert r.status_code == 200, r.text
        flags = r.json()["flags"]
        for k in FEATURE_KEYS:
            assert k in flags, f"missing flag {k}"
        assert isinstance(flags["posts_enabled"], bool)

    def test_dev_features_non_dev_forbidden(self):
        tok, _ = _regular_token()
        r = _get("/api/dev/features", token=tok)
        assert r.status_code == 403, f"expected 403, got {r.status_code}"

    def test_dev_features_dev_ok(self):
        tok, _ = _dev_token()
        r = _get("/api/dev/features", token=tok)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "flags" in body and "defaults" in body
        assert set(body["defaults"].keys()) == set(FEATURE_KEYS)

    def test_dev_toggle_feature_and_reset(self):
        tok, _ = _dev_token()
        # Set posts_enabled = false
        r = _post("/api/dev/features", token=tok, json={"key": "posts_enabled", "enabled": False})
        assert r.status_code == 200, r.text
        # Verify reflected in /features
        utok, _ = _regular_token()
        f = _get("/api/features", token=utok).json()["flags"]
        assert f["posts_enabled"] is False, f
        # Reset to true
        r = _post("/api/dev/features", token=tok, json={"key": "posts_enabled", "enabled": True})
        assert r.status_code == 200
        f = _get("/api/features", token=utok).json()["flags"]
        assert f["posts_enabled"] is True

    def test_dev_toggle_unknown_flag_400(self):
        tok, _ = _dev_token()
        r = _post("/api/dev/features", token=tok, json={"key": "unknown_flag", "enabled": True})
        assert r.status_code == 400


# ============================================================
# 3. Announcements
# ============================================================
class TestAnnouncements:

    def test_create_dismiss_deactivate_lifecycle(self):
        dev_tok, _ = _dev_token()
        user_tok, _ = _regular_token()

        # Create
        title = f"TEST_ann_{uuid.uuid4().hex[:6]}"
        r = _post("/api/dev/announcements", token=dev_tok, json={
            "title": title, "message": "hello", "severity": "info", "ttl_hours": 1
        })
        assert r.status_code == 200, r.text
        ann_id = r.json()["ann_id"]
        assert ann_id

        # GET /active for a regular user should return this ann (latest)
        act = _get("/api/announcements/active", token=user_tok).json()
        assert act.get("announcement") is not None, act
        assert act["announcement"]["ann_id"] == ann_id, act

        # Dismiss
        d = _post(f"/api/announcements/{ann_id}/dismiss", token=user_tok)
        assert d.status_code == 200

        # After dismiss, /active should be null OR a different active ann
        act2 = _get("/api/announcements/active", token=user_tok).json()
        assert (act2.get("announcement") is None) or (act2["announcement"]["ann_id"] != ann_id), act2

        # Dev list should contain it
        lst = _get("/api/dev/announcements", token=dev_tok).json()["announcements"]
        assert any(a["ann_id"] == ann_id for a in lst)

        # Fresh new user should NOT see the announcement (either null or different one) if they haven't dismissed... actually a fresh user WILL see it since they haven't dismissed. Update: the task says "null (or a different active ann only)". Let's just create a random guest and see.
        rand = f"TEST_guest_{uuid.uuid4().hex[:8]}"
        rr = _post("/api/auth/guest/register", json={"username": rand, "password": "Passw0rd!"})
        assert rr.status_code in (200, 201), rr.text
        fresh_tok = rr.json()["session_token"]
        # a brand new user WILL see it since they haven't dismissed. Deactivate it first
        # Per the request: after we deactivate below, the fresh user should get null
        dea = _post(f"/api/dev/announcements/{ann_id}/deactivate", token=dev_tok)
        assert dea.status_code == 200

        fresh_active = _get("/api/announcements/active", token=fresh_tok).json()
        # If any other active ann exists it might be non-null, but our specific ann_id should not appear
        if fresh_active.get("announcement") is not None:
            assert fresh_active["announcement"]["ann_id"] != ann_id


# ============================================================
# 4. Dev user actions
# ============================================================
class TestDevUserActions:

    def test_force_logout_and_reset_password(self):
        dev_tok, _ = _dev_token()

        # Register a temp user
        uname = f"TEST_tmp_{uuid.uuid4().hex[:6]}"
        pwd = "InitPwd123!"
        r = _post("/api/auth/guest/register", json={"username": uname, "password": pwd})
        assert r.status_code in (200, 201), r.text
        tmp_user = r.json()["user"]
        tmp_uid = tmp_user["user_id"]
        tmp_tok = r.json()["session_token"]

        # Confirm session works
        me = _get("/api/auth/me", token=tmp_tok)
        assert me.status_code == 200

        # Logout all
        lo = _post(f"/api/dev/user/{tmp_uid}/logout-all", token=dev_tok)
        assert lo.status_code == 200, lo.text
        assert lo.json()["sessions_removed"] >= 0
        # Session should now be invalidated
        me2 = _get("/api/auth/me", token=tmp_tok)
        assert me2.status_code in (401, 403), f"session should be dead, got {me2.status_code}"

        # Reset password
        rp = _post(f"/api/dev/user/{tmp_uid}/reset-password", token=dev_tok)
        assert rp.status_code == 200, rp.text
        assert rp.json()["temp_password"] == "PRin09#@"

        # Login with new temp password
        login2 = _login(uname, "PRin09#@")
        assert login2.status_code == 200, login2.text
        assert login2.json()["user"]["must_change_password"] is True


# ============================================================
# 5. Non-dev access denial
# ============================================================
class TestNonDevForbidden:

    def test_non_dev_forbidden_dev_endpoints(self):
        tok, _ = _regular_token()
        for path in ("/api/dev/stats", "/api/dev/features", "/api/dev/announcements"):
            r = _get(path, token=tok)
            assert r.status_code == 403, f"expected 403 on {path}, got {r.status_code}"


# ============================================================
# 6. Regression sanity
# ============================================================
class TestRegression:

    def test_rooms_list_ok(self):
        tok, _ = _regular_token()
        r = _get("/api/rooms", token=tok)
        assert r.status_code == 200, r.text

    def test_notifications_list_ok(self):
        tok, _ = _regular_token()
        r = _get("/api/notifications", token=tok)
        assert r.status_code == 200, r.text
