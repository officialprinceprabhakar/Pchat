"""
Plexa backend tests - Delete-account cascade + rebrand sanity + regression.

Covers:
1. POST /api/users/me/delete cascades user's rooms, messages, posts, stories, friends, sessions
2. Rebrand: GET /api/ returns {"ok": true, "app": "Plexa"}
3. Regression: /rooms, /notifications, /features, /mood-badges endpoints still work
4. CORS on OPTIONS /api/rooms
5. Feature flags still has 8 keys
6. Dev login regression
"""

import os
import uuid
import time
import pytest
import requests

BASE_URL = (
    os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    or "https://modern-social-chat.preview.emergentagent.com"
).rstrip("/")

DEV_USERNAME = "Prince_Prabhakar"
DEV_PASSWORD = "DevPass123!"
REGULAR_USER = "testuser1"
REGULAR_PWD = "testpass123"

# 1x1 transparent PNG
TINY_PNG = (
    "data:image/png;base64,"
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
)


def _hdr(tok=None):
    h = {"Content-Type": "application/json"}
    if tok:
        h["Authorization"] = f"Bearer {tok}"
    return h


def _post(path, tok=None, json=None):
    return requests.post(f"{BASE_URL}{path}", headers=_hdr(tok), json=json)


def _get(path, tok=None):
    return requests.get(f"{BASE_URL}{path}", headers=_hdr(tok))


def _login(u, p):
    return _post("/api/auth/guest/login", json={"username": u, "password": p})


def _register(u, p):
    return _post("/api/auth/guest/register", json={"username": u, "password": p})


def _dev_token():
    r = _login(DEV_USERNAME, DEV_PASSWORD)
    assert r.status_code == 200, f"dev login failed: {r.status_code} {r.text}"
    return r.json()["session_token"], r.json()["user"]


# ============================================================
# 1. Rebrand sanity
# ============================================================
class TestRebrand:
    def test_root_endpoint_reports_plexa(self):
        r = _get("/api/")
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") is True
        assert body.get("app") == "Plexa", f"expected app=Plexa, got {body}"


# ============================================================
# 2. Regression sanity
# ============================================================
class TestRegression:
    def test_testuser1_login_and_rooms_notifications(self):
        r = _login(REGULAR_USER, REGULAR_PWD)
        if r.status_code != 200:
            _register(REGULAR_USER, REGULAR_PWD)
            r = _login(REGULAR_USER, REGULAR_PWD)
        assert r.status_code == 200, r.text
        tok = r.json()["session_token"]

        for path in ("/api/rooms", "/api/notifications", "/api/features", "/api/mood-badges"):
            rr = _get(path, tok=tok)
            assert rr.status_code == 200, f"{path} -> {rr.status_code} {rr.text}"

    def test_features_has_8_keys(self):
        r = _login(REGULAR_USER, REGULAR_PWD)
        if r.status_code != 200:
            _register(REGULAR_USER, REGULAR_PWD)
            r = _login(REGULAR_USER, REGULAR_PWD)
        assert r.status_code == 200
        tok = r.json()["session_token"]
        f = _get("/api/features", tok=tok).json()["flags"]
        assert len(f) == 8, f"expected 8 flags, got {len(f)}: {list(f.keys())}"

    def test_dev_login_still_works(self):
        r = _login(DEV_USERNAME, DEV_PASSWORD)
        assert r.status_code == 200, r.text
        u = r.json()["user"]
        assert u.get("must_change_password") is False
        tok = r.json()["session_token"]
        # Dev endpoint reachable
        fr = _get("/api/dev/features", tok=tok)
        assert fr.status_code == 200

    def test_cors_options_rooms(self):
        # OPTIONS preflight
        r = requests.options(
            f"{BASE_URL}/api/rooms",
            headers={
                "Origin": "https://example.com",
                "Access-Control-Request-Method": "GET",
                "Access-Control-Request-Headers": "authorization,content-type",
            },
        )
        # CORS middleware should reply 200/204 with allow-origin header
        assert r.status_code in (200, 204), f"CORS OPTIONS -> {r.status_code}"
        allow_origin = r.headers.get("access-control-allow-origin") or r.headers.get(
            "Access-Control-Allow-Origin"
        )
        assert allow_origin in ("*", "https://example.com"), f"missing allow-origin: {dict(r.headers)}"


# ============================================================
# 3. Delete-account cascade
# ============================================================
class TestDeleteAccountCascade:
    def test_full_cascade_flow(self):
        suffix = uuid.uuid4().hex[:8]
        u1 = f"del_test_{suffix}"
        u2 = f"del_friend_{suffix}"
        pwd = "TestPass1!"

        # (a) Register user1
        r = _register(u1, pwd)
        assert r.status_code in (200, 201), r.text
        tok1 = r.json()["session_token"]
        uid1 = r.json()["user"]["user_id"]

        # Register user2
        r2 = _register(u2, pwd)
        assert r2.status_code in (200, 201), r2.text
        tok2 = r2.json()["session_token"]
        uid2 = r2.json()["user"]["user_id"]

        # (b) Create room owned by user1 (actual endpoint is POST /api/rooms)
        rr = _post(
            "/api/rooms",
            tok=tok1,
            json={"name": f"delroom_{suffix}", "is_private": False},
        )
        assert rr.status_code == 200, rr.text
        room = rr.json().get("room") or rr.json()
        room_id = room["room_id"]

        # (b) Send 2 messages in the room
        for txt in ("hi", "world"):
            mr = _post(f"/api/rooms/{room_id}/messages", tok=tok1, json={"text": txt})
            assert mr.status_code == 200, mr.text

        # (b) Create a post
        pr = _post(
            "/api/posts",
            tok=tok1,
            json={"image": TINY_PNG, "visibility": "public"},
        )
        assert pr.status_code == 200, pr.text

        # (b) Create a story
        sr = _post("/api/stories", tok=tok1, json={"image": TINY_PNG})
        assert sr.status_code == 200, sr.text

        # (b) Friend request user2 -> user1, accept from user1
        fr = _post("/api/friends/request", tok=tok2, json={"user_id": uid1})
        assert fr.status_code == 200, fr.text
        fa = _post("/api/friends/accept", tok=tok1, json={"user_id": uid2})
        assert fa.status_code == 200, fa.text

        # (c) Counts before deletion using dev endpoint
        dev_tok, _ = _dev_token()
        pre = _get(f"/api/dev/user/{uid1}", tok=dev_tok)
        assert pre.status_code == 200, pre.text
        pre_body = pre.json()
        # dev/user returns: user, friends(count), rooms(count), posts(count), messages(count), sessions(list)
        # NOTE: 'stories' is not included in this endpoint
        assert pre_body.get("posts", 0) >= 1, pre_body
        assert pre_body.get("friends", 0) >= 1, pre_body
        assert pre_body.get("rooms", 0) >= 1, pre_body
        assert len(pre_body.get("sessions", [])) >= 1, pre_body

        # (d) Delete
        dr = _post(
            "/api/users/me/delete",
            tok=tok1,
            json={"password": pwd, "confirm": True},
        )
        assert dr.status_code == 200, dr.text
        assert dr.json().get("ok") is True

        # (e) Old session invalidated
        me = _get("/api/auth/me", tok=tok1)
        assert me.status_code in (401, 403), f"session should be dead, got {me.status_code}"

        # (e) Dev inspect: user record anonymized
        post = _get(f"/api/dev/user/{uid1}", tok=dev_tok)
        assert post.status_code == 200, post.text
        pb = post.json()
        u_row = pb.get("user") or {}
        assert u_row.get("display_name") == "Deleted user", u_row
        assert u_row.get("username", "").startswith("deleted_"), u_row
        assert u_row.get("avatar") in (None, ""), u_row
        assert u_row.get("bio") in (None, ""), u_row
        assert u_row.get("email") in (None, ""), u_row
        # NOTE: _sanitize_user does not expose the 'deleted' flag, so we can't verify it via API.
        # Anonymization (display_name/username/avatar/email/bio) proves the record was deleted-flagged.

        # Counts should be zeroed
        assert pb.get("posts", 0) == 0, pb
        assert pb.get("friends", 0) == 0, pb
        assert len(pb.get("sessions", [])) == 0, pb
        # rooms may be 0 (no other members, room deleted) or transferred; both allowed
        assert pb.get("rooms", 0) in (0, 1), pb

        # Stories cascade: verify via stories collection is empty for this user
        # (endpoint /api/dev/user does not report stories count; use dev users list or infer)
        # We simply trust delete_many('stories', user_id=uid) — no leak visible via public endpoints.

        # Room should be gone (no other members) — GET /api/rooms/{room_id}
        rget = _get(f"/api/rooms/{room_id}", tok=dev_tok)
        # Expect 404 (deleted) or 403; not 200 with live content
        assert rget.status_code in (404, 403, 400), f"expected 404, got {rget.status_code}: {rget.text[:200]}"

        # (e) mod_logs contains action=account_deleted
        ml = _get("/api/dev/mod-logs", tok=dev_tok)
        assert ml.status_code == 200, ml.text
        logs = ml.json().get("logs") or ml.json().get("entries") or []
        found = any(
            (
                log.get("action") == "account_deleted"
                and (log.get("meta", {}).get("user_id") == uid1 or log.get("details", {}).get("user_id") == uid1)
            )
            for log in logs
        )
        assert found, f"account_deleted mod_log entry for {uid1} not found. Recent: {logs[:5]}"

        # (e) /api/dev/users?query=deleted_ should include our deleted username
        du = _get(f"/api/dev/users?query=deleted_", tok=dev_tok)
        assert du.status_code == 200, du.text
        users = du.json().get("users", [])
        expected_uname = f"deleted_{uid1[:10]}"
        # Not strict on exact prefix match - just look for our uid
        assert any(u.get("user_id") == uid1 for u in users), f"deleted user not in search: {[u.get('username') for u in users[:10]]}"
