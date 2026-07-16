"""PChat backend - FastAPI + MongoDB.

Endpoints cover: Auth (Emergent Google + Guest), Users, Friends, 1:1 Chat,
Rooms (public/private with roles), Posts (2/week limit), Notifications,
Badges, Developer Dashboard, Push notification registration.
"""
from fastapi import FastAPI, APIRouter, HTTPException, Header, Depends, Request
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import re
import logging
import secrets
import uuid
import bcrypt
import httpx
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Any
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# ---------------- Database ----------------
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

# ---------------- Emergent Push ----------------
PUSH_BASE_URL = "https://integrations.emergentagent.com"
PUSH_KEY = os.environ.get("EMERGENT_PUSH_KEY", "placeholder")
_push_client = httpx.AsyncClient(
    base_url=PUSH_BASE_URL,
    headers={"X-Push-Key": PUSH_KEY},
    timeout=10.0,
)

# ---------------- Emergent Auth ----------------
EMERGENT_AUTH_SESSION_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"

# ---------------- App ----------------
app = FastAPI(title="PChat API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
log = logging.getLogger("pchat")


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def new_id(prefix: str = "u") -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


# ---------------- Models ----------------
class GuestRegisterBody(BaseModel):
    username: str
    password: str
    display_name: Optional[str] = None


class GuestLoginBody(BaseModel):
    username: str
    password: str


class GoogleSessionBody(BaseModel):
    session_id: str


class UpdateProfileBody(BaseModel):
    display_name: Optional[str] = None
    bio: Optional[str] = None
    avatar: Optional[str] = None  # base64


class FriendActionBody(BaseModel):
    user_id: str


class MessageBody(BaseModel):
    text: Optional[str] = None
    image: Optional[str] = None  # base64
    reply_to: Optional[str] = None


class MessageEditBody(BaseModel):
    text: str


class RoomCreateBody(BaseModel):
    name: str
    description: Optional[str] = ""
    is_private: bool = False
    icon: Optional[str] = None
    banner: Optional[str] = None
    rules: Optional[str] = ""
    welcome_message: Optional[str] = ""


class FeatureRoomBody(BaseModel):
    room_id: str
    featured: bool


class RoomMessageBody(BaseModel):
    text: Optional[str] = None
    image: Optional[str] = None


class PostCreateBody(BaseModel):
    image: str  # base64
    caption: str = ""
    visibility: str = "public"  # public | friends


class CommentBody(BaseModel):
    text: str


class ReportBody(BaseModel):
    target_id: str
    target_type: str  # user | room | message | post
    reason: str


class BadgeCreateBody(BaseModel):
    name: str
    icon: str  # emoji or icon name
    color: str
    description: Optional[str] = ""
    enabled: bool = True


class BadgeAssignBody(BaseModel):
    user_id: str
    badge_id: str
    expires_at: Optional[str] = None  # ISO


class DevBanBody(BaseModel):
    user_id: str
    reason: Optional[str] = ""


class DevBroadcastBody(BaseModel):
    title: str
    message: str


class RegisterPushBody(BaseModel):
    user_id: str
    platform: str
    device_token: str


# ---------------- Auth helpers ----------------
DEV_USERNAMES = {"Prince_Prabhakar", "PrincePrabhakar", "Reyansh"}


async def get_user_by_session(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    sess = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not sess:
        raise HTTPException(status_code=401, detail="Invalid session")
    exp = sess.get("expires_at")
    if exp and exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp and exp < now_utc():
        raise HTTPException(status_code=401, detail="Session expired")
    user = await db.users.find_one({"user_id": sess["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    if user.get("banned"):
        raise HTTPException(status_code=403, detail="Account banned")
    # touch last_seen
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"last_seen": now_utc()}})
    return user


async def require_dev(user: dict = Depends(get_user_by_session)) -> dict:
    if not user.get("is_developer"):
        raise HTTPException(status_code=403, detail="Developer only")
    return user


async def create_session(user_id: str) -> str:
    token = secrets.token_urlsafe(32)
    await db.user_sessions.insert_one({
        "session_token": token,
        "user_id": user_id,
        "created_at": now_utc(),
        "expires_at": now_utc() + timedelta(days=7),
    })
    return token


def _sanitize_user(u: dict) -> dict:
    return {
        "user_id": u["user_id"],
        "username": u.get("username"),
        "display_name": u.get("display_name"),
        "email": u.get("email"),
        "avatar": u.get("avatar"),
        "bio": u.get("bio", ""),
        "provider": u.get("provider"),
        "is_developer": bool(u.get("is_developer")),
        "banned": bool(u.get("banned")),
        "friends_count": u.get("friends_count", 0),
        "posts_count": u.get("posts_count", 0),
        "rooms_created": u.get("rooms_created", 0),
        "badges": u.get("badges", []),
        "last_seen": (u.get("last_seen").isoformat() if isinstance(u.get("last_seen"), datetime) else u.get("last_seen")),
        "created_at": (u.get("created_at").isoformat() if isinstance(u.get("created_at"), datetime) else u.get("created_at")),
    }


async def _grant_default_badges(user_id: str, provider: str, is_developer: bool):
    badges = []
    if is_developer:
        badges.append("developer")
    if provider == "google":
        badges.append("verified")
    if provider == "guest":
        badges.append("guest")
    await db.users.update_one({"user_id": user_id}, {"$set": {"badges": badges}})


async def _push_notify(user_ids: List[str], title: str, message: str, action_url: Optional[str] = None):
    if not user_ids:
        return
    try:
        payload: dict = {"recipients": user_ids[:100], "data": {"title": title, "message": message}}
        if action_url:
            payload["data"]["action_url"] = action_url
        resp = await _push_client.post("/api/v1/push/trigger", json=payload)
        if resp.status_code >= 400:
            log.warning(f"push non-2xx: {resp.status_code} {resp.text[:200]}")
    except Exception as e:
        log.warning(f"push failed: {e}")


async def _add_notification(user_id: str, ntype: str, text: str, data: Optional[dict] = None):
    await db.notifications.insert_one({
        "notif_id": new_id("n"),
        "user_id": user_id,
        "type": ntype,
        "text": text,
        "data": data or {},
        "read": False,
        "created_at": now_utc(),
    })


# ---------------- Startup ----------------
@app.on_event("startup")
async def startup():
    # Indexes
    await db.users.create_index("user_id", unique=True)
    await db.users.create_index("username", unique=True, sparse=True)
    await db.users.create_index("email", sparse=True)
    await db.user_sessions.create_index("session_token", unique=True)
    await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
    await db.messages.create_index([("pair_key", 1), ("created_at", 1)])
    await db.rooms.create_index("room_code", unique=True)
    await db.room_messages.create_index([("room_id", 1), ("created_at", 1)])
    await db.friendships.create_index([("a", 1), ("b", 1)], unique=True)
    await db.friend_requests.create_index([("from_id", 1), ("to_id", 1)], unique=True)
    await db.notifications.create_index([("user_id", 1), ("created_at", -1)])
    await db.push_tokens.create_index([("user_id", 1), ("device_token", 1)], unique=True)

    # Seed default badges
    default_badges = [
        ("developer", "Developer", "crown", "#FF9F0A", "Official Developer"),
        ("verified", "Email Verified", "check-circle", "#30D158", "Google verified email"),
        ("guest", "Guest", "user", "#8E8E93", "Guest account"),
        ("moderator", "Moderator", "shield", "#0A84FF", "Trusted moderator"),
        ("vip", "VIP", "star", "#FFD60A", "Very important person"),
        ("owner", "Room Owner", "crown", "#FF453A", "Owns a chat room"),
        ("elite", "Elite", "award", "#BF5AF2", "Elite community member"),
        ("ai", "AI Assistant", "cpu", "#32ADE6", "AI helper bot"),
    ]
    for bid, name, icon, color, desc in default_badges:
        await db.badges.update_one(
            {"badge_id": bid},
            {"$setOnInsert": {
                "badge_id": bid, "name": name, "icon": icon, "color": color,
                "description": desc, "enabled": True, "system": True,
                "created_at": now_utc(),
            }},
            upsert=True,
        )

    # Seed initial developer accounts (as guest with default password)
    for uname in DEV_USERNAMES:
        existing = await db.users.find_one({"username": uname})
        if not existing:
            uid = new_id("u")
            pw_hash = bcrypt.hashpw(b"pchat_dev_2026", bcrypt.gensalt()).decode()
            await db.users.insert_one({
                "user_id": uid,
                "username": uname,
                "display_name": uname,
                "password_hash": pw_hash,
                "provider": "guest",
                "is_developer": True,
                "banned": False,
                "avatar": None,
                "bio": "PChat Developer",
                "friends_count": 0,
                "posts_count": 0,
                "rooms_created": 0,
                "badges": ["developer"],
                "created_at": now_utc(),
                "last_seen": now_utc(),
            })
            log.info(f"Seeded dev account: {uname}")
        else:
            # ensure dev flag + developer badge
            badges = set(existing.get("badges") or [])
            badges.add("developer")
            await db.users.update_one(
                {"user_id": existing["user_id"]},
                {"$set": {"is_developer": True, "badges": list(badges)}},
            )


@app.on_event("shutdown")
async def shutdown():
    await _push_client.aclose()
    client.close()


# ---------------- Auth Endpoints ----------------
@api.get("/")
async def root():
    return {"ok": True, "app": "PChat"}


@api.post("/auth/guest/register")
async def guest_register(body: GuestRegisterBody):
    uname = body.username.strip()
    if not re.match(r"^[A-Za-z0-9_]{3,20}$", uname):
        raise HTTPException(400, "Username must be 3-20 chars, letters/numbers/underscore")
    if len(body.password) < 6:
        raise HTTPException(400, "Password must be 6+ chars")
    existing = await db.users.find_one({"username": uname})
    if existing:
        raise HTTPException(409, "Username taken")
    is_dev = uname in DEV_USERNAMES
    uid = new_id("u")
    pw_hash = bcrypt.hashpw(body.password.encode(), bcrypt.gensalt()).decode()
    badges = ["guest"]
    if is_dev:
        badges.append("developer")
    await db.users.insert_one({
        "user_id": uid,
        "username": uname,
        "display_name": body.display_name or uname,
        "password_hash": pw_hash,
        "provider": "guest",
        "is_developer": is_dev,
        "banned": False,
        "avatar": None,
        "bio": "",
        "friends_count": 0,
        "posts_count": 0,
        "rooms_created": 0,
        "badges": badges,
        "created_at": now_utc(),
        "last_seen": now_utc(),
    })
    token = await create_session(uid)
    user = await db.users.find_one({"user_id": uid}, {"_id": 0})
    return {"session_token": token, "user": _sanitize_user(user)}


@api.post("/auth/guest/login")
async def guest_login(body: GuestLoginBody):
    user = await db.users.find_one({"username": body.username.strip()})
    if not user or user.get("provider") != "guest":
        raise HTTPException(401, "Invalid credentials")
    if not user.get("password_hash"):
        raise HTTPException(401, "Invalid credentials")
    if not bcrypt.checkpw(body.password.encode(), user["password_hash"].encode()):
        raise HTTPException(401, "Invalid credentials")
    if user.get("banned"):
        raise HTTPException(403, "Account banned")
    token = await create_session(user["user_id"])
    user = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return {"session_token": token, "user": _sanitize_user(user)}


@api.post("/auth/google/session")
async def google_session(body: GoogleSessionBody):
    """Called with session_id received from Emergent auth redirect. Verifies with Emergent and creates/updates local user."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as hc:
            r = await hc.get(EMERGENT_AUTH_SESSION_URL, headers={"X-Session-ID": body.session_id})
        if r.status_code != 200:
            raise HTTPException(401, "Invalid session_id")
        data = r.json()
    except HTTPException:
        raise
    except Exception as e:
        log.error(f"emergent auth error: {e}")
        raise HTTPException(502, "Auth provider unavailable")

    email = data.get("email")
    name = data.get("name") or (email.split("@")[0] if email else "user")
    picture = data.get("picture")
    if not email:
        raise HTTPException(400, "Email missing from auth")

    existing = await db.users.find_one({"email": email})
    if existing:
        uid = existing["user_id"]
        # ensure verified badge & google provider
        badges = set(existing.get("badges") or [])
        badges.add("verified")
        await db.users.update_one(
            {"user_id": uid},
            {"$set": {
                "avatar": existing.get("avatar") or picture,
                "provider": existing.get("provider") or "google",
                "badges": list(badges),
                "last_seen": now_utc(),
            }},
        )
    else:
        uid = new_id("u")
        # generate unique username from email prefix
        base_uname = re.sub(r"[^A-Za-z0-9_]", "", email.split("@")[0])[:16] or "user"
        uname = base_uname
        n = 1
        while await db.users.find_one({"username": uname}):
            n += 1
            uname = f"{base_uname}{n}"
        is_dev = uname in DEV_USERNAMES
        badges = ["verified"]
        if is_dev:
            badges.append("developer")
        await db.users.insert_one({
            "user_id": uid,
            "username": uname,
            "display_name": name,
            "email": email,
            "provider": "google",
            "is_developer": is_dev,
            "banned": False,
            "avatar": picture,
            "bio": "",
            "friends_count": 0,
            "posts_count": 0,
            "rooms_created": 0,
            "badges": badges,
            "created_at": now_utc(),
            "last_seen": now_utc(),
        })

    token = await create_session(uid)
    user = await db.users.find_one({"user_id": uid}, {"_id": 0})
    return {"session_token": token, "user": _sanitize_user(user)}


@api.get("/auth/me")
async def me(user: dict = Depends(get_user_by_session)):
    return {"user": _sanitize_user(user)}


@api.post("/auth/logout")
async def logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
        await db.user_sessions.delete_one({"session_token": token})
    return {"ok": True}


# ---------------- Users ----------------
@api.put("/users/me")
async def update_me(body: UpdateProfileBody, user: dict = Depends(get_user_by_session)):
    updates: dict = {}
    if body.display_name is not None:
        updates["display_name"] = body.display_name.strip()[:40]
    if body.bio is not None:
        updates["bio"] = body.bio.strip()[:200]
    if body.avatar is not None:
        updates["avatar"] = body.avatar
    if updates:
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": updates})
    updated = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return {"user": _sanitize_user(updated)}


@api.get("/users/search")
async def search_users(q: str, user: dict = Depends(get_user_by_session)):
    q = q.strip()
    if len(q) < 1:
        return {"users": []}
    regex = re.compile(re.escape(q), re.IGNORECASE)
    cursor = db.users.find(
        {"$or": [{"username": regex}, {"display_name": regex}]},
        {"_id": 0},
    ).limit(20)
    users = [_sanitize_user(u) async for u in cursor if u["user_id"] != user["user_id"]]
    return {"users": users}


@api.get("/users/{user_id}")
async def get_user(user_id: str, user: dict = Depends(get_user_by_session)):
    u = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not u:
        raise HTTPException(404, "User not found")
    data = _sanitize_user(u)
    # friendship status
    a, b = sorted([user["user_id"], user_id])
    fs = await db.friendships.find_one({"a": a, "b": b}, {"_id": 0})
    data["is_friend"] = bool(fs)
    if not fs:
        req = await db.friend_requests.find_one(
            {"$or": [
                {"from_id": user["user_id"], "to_id": user_id},
                {"from_id": user_id, "to_id": user["user_id"]},
            ]},
            {"_id": 0},
        )
        data["friend_request"] = req  # includes direction
    else:
        data["friend_request"] = None
    blocked = await db.blocks.find_one({"blocker": user["user_id"], "blocked": user_id})
    data["blocked"] = bool(blocked)
    return {"user": data}


@api.post("/users/block")
async def block_user(body: FriendActionBody, user: dict = Depends(get_user_by_session)):
    if body.user_id == user["user_id"]:
        raise HTTPException(400, "cannot block self")
    await db.blocks.update_one(
        {"blocker": user["user_id"], "blocked": body.user_id},
        {"$setOnInsert": {"blocker": user["user_id"], "blocked": body.user_id, "created_at": now_utc()}},
        upsert=True,
    )
    return {"ok": True}


@api.post("/users/unblock")
async def unblock_user(body: FriendActionBody, user: dict = Depends(get_user_by_session)):
    await db.blocks.delete_one({"blocker": user["user_id"], "blocked": body.user_id})
    return {"ok": True}


@api.post("/report")
async def report(body: ReportBody, user: dict = Depends(get_user_by_session)):
    await db.reports.insert_one({
        "report_id": new_id("r"),
        "reporter": user["user_id"],
        "target_id": body.target_id,
        "target_type": body.target_type,
        "reason": body.reason,
        "status": "open",
        "created_at": now_utc(),
    })
    return {"ok": True}


# ---------------- Friends ----------------
@api.get("/friends")
async def list_friends(user: dict = Depends(get_user_by_session)):
    uid = user["user_id"]
    cursor = db.friendships.find(
        {"$or": [{"a": uid}, {"b": uid}]}, {"_id": 0}
    )
    friend_ids = []
    async for f in cursor:
        friend_ids.append(f["b"] if f["a"] == uid else f["a"])
    if not friend_ids:
        return {"friends": []}
    users = [
        _sanitize_user(u) async for u in db.users.find(
            {"user_id": {"$in": friend_ids}}, {"_id": 0}
        )
    ]
    return {"friends": users}


@api.get("/friends/requests")
async def list_requests(user: dict = Depends(get_user_by_session)):
    uid = user["user_id"]
    incoming = []
    async for r in db.friend_requests.find({"to_id": uid}, {"_id": 0}):
        u = await db.users.find_one({"user_id": r["from_id"]}, {"_id": 0})
        if u:
            incoming.append({"from": _sanitize_user(u), "created_at": r.get("created_at").isoformat() if isinstance(r.get("created_at"), datetime) else None})
    outgoing = []
    async for r in db.friend_requests.find({"from_id": uid}, {"_id": 0}):
        u = await db.users.find_one({"user_id": r["to_id"]}, {"_id": 0})
        if u:
            outgoing.append({"to": _sanitize_user(u)})
    return {"incoming": incoming, "outgoing": outgoing}


@api.post("/friends/request")
async def friend_request(body: FriendActionBody, user: dict = Depends(get_user_by_session)):
    to_id = body.user_id
    if to_id == user["user_id"]:
        raise HTTPException(400, "cannot friend self")
    a, b = sorted([user["user_id"], to_id])
    if await db.friendships.find_one({"a": a, "b": b}):
        raise HTTPException(409, "already friends")
    try:
        await db.friend_requests.insert_one({
            "from_id": user["user_id"],
            "to_id": to_id,
            "created_at": now_utc(),
        })
    except Exception:
        raise HTTPException(409, "request already exists")
    await _add_notification(to_id, "friend_request", f"{user.get('display_name') or user['username']} sent you a friend request", {"user_id": user["user_id"]})
    await _push_notify([to_id], "New friend request", f"{user.get('display_name') or user['username']} wants to connect")
    return {"ok": True}


@api.post("/friends/accept")
async def friend_accept(body: FriendActionBody, user: dict = Depends(get_user_by_session)):
    from_id = body.user_id
    req = await db.friend_requests.find_one({"from_id": from_id, "to_id": user["user_id"]})
    if not req:
        raise HTTPException(404, "request not found")
    a, b = sorted([user["user_id"], from_id])
    await db.friendships.update_one(
        {"a": a, "b": b},
        {"$setOnInsert": {"a": a, "b": b, "created_at": now_utc()}},
        upsert=True,
    )
    await db.friend_requests.delete_one({"from_id": from_id, "to_id": user["user_id"]})
    await db.users.update_one({"user_id": user["user_id"]}, {"$inc": {"friends_count": 1}})
    await db.users.update_one({"user_id": from_id}, {"$inc": {"friends_count": 1}})
    await _add_notification(from_id, "friend_accept", f"{user.get('display_name') or user['username']} accepted your friend request", {"user_id": user["user_id"]})
    await _push_notify([from_id], "Friend request accepted", f"{user.get('display_name') or user['username']} is now your friend")
    return {"ok": True}


@api.post("/friends/reject")
async def friend_reject(body: FriendActionBody, user: dict = Depends(get_user_by_session)):
    await db.friend_requests.delete_one({"from_id": body.user_id, "to_id": user["user_id"]})
    return {"ok": True}


@api.post("/friends/cancel")
async def friend_cancel(body: FriendActionBody, user: dict = Depends(get_user_by_session)):
    await db.friend_requests.delete_one({"from_id": user["user_id"], "to_id": body.user_id})
    return {"ok": True}


@api.post("/friends/remove")
async def friend_remove(body: FriendActionBody, user: dict = Depends(get_user_by_session)):
    a, b = sorted([user["user_id"], body.user_id])
    res = await db.friendships.delete_one({"a": a, "b": b})
    if res.deleted_count:
        await db.users.update_one({"user_id": user["user_id"]}, {"$inc": {"friends_count": -1}})
        await db.users.update_one({"user_id": body.user_id}, {"$inc": {"friends_count": -1}})
    return {"ok": True}


# ---------------- 1:1 Chat ----------------
def _pair_key(a: str, b: str) -> str:
    x, y = sorted([a, b])
    return f"{x}::{y}"


@api.get("/chats")
async def list_chats(user: dict = Depends(get_user_by_session)):
    uid = user["user_id"]
    pipeline = [
        {"$match": {"$or": [{"from_id": uid}, {"to_id": uid}]}},
        {"$sort": {"created_at": -1}},
        {"$group": {
            "_id": "$pair_key",
            "last": {"$first": "$$ROOT"},
        }},
        {"$limit": 100},
    ]
    chats = []
    async for row in db.messages.aggregate(pipeline):
        last = row["last"]
        other_id = last["to_id"] if last["from_id"] == uid else last["from_id"]
        other = await db.users.find_one({"user_id": other_id}, {"_id": 0})
        if not other:
            continue
        chats.append({
            "user": _sanitize_user(other),
            "last_message": {
                "text": last.get("text"),
                "from_id": last["from_id"],
                "created_at": last["created_at"].isoformat() if isinstance(last.get("created_at"), datetime) else None,
                "has_image": bool(last.get("image")),
            },
        })
    return {"chats": chats}


@api.get("/chats/{other_id}/messages")
async def get_chat_messages(other_id: str, user: dict = Depends(get_user_by_session)):
    key = _pair_key(user["user_id"], other_id)
    uid = user["user_id"]
    msgs = []
    async for m in db.messages.find({"pair_key": key}, {"_id": 0}).sort("created_at", 1).limit(200):
        if uid in (m.get("deleted_for") or []):
            continue
        if m.get("deleted_for_all"):
            m["text"] = None
            m["image"] = None
        m["created_at"] = m["created_at"].isoformat() if isinstance(m.get("created_at"), datetime) else m.get("created_at")
        if isinstance(m.get("edited_at"), datetime):
            m["edited_at"] = m["edited_at"].isoformat()
        msgs.append(m)
    return {"messages": msgs}


@api.post("/chats/{other_id}/messages")
async def send_chat_message(other_id: str, body: MessageBody, user: dict = Depends(get_user_by_session)):
    if not body.text and not body.image:
        raise HTTPException(400, "empty message")
    other = await db.users.find_one({"user_id": other_id}, {"_id": 0})
    if not other:
        raise HTTPException(404, "user not found")
    # blocked?
    if await db.blocks.find_one({"blocker": other_id, "blocked": user["user_id"]}):
        raise HTTPException(403, "you have been blocked")
    key = _pair_key(user["user_id"], other_id)
    msg = {
        "message_id": new_id("m"),
        "pair_key": key,
        "from_id": user["user_id"],
        "to_id": other_id,
        "text": (body.text or "").strip()[:2000] or None,
        "image": body.image,
        "reply_to": body.reply_to,
        "reactions": {},
        "deleted_for": [],
        "deleted_for_all": False,
        "edited_at": None,
        "created_at": now_utc(),
    }
    await db.messages.insert_one(msg)
    await _push_notify([other_id], user.get("display_name") or user["username"], (body.text or "[image]")[:80])
    await _add_notification(other_id, "message", f"New message from {user.get('display_name') or user['username']}", {"from_id": user["user_id"]})
    out = {**msg}
    out.pop("_id", None)
    out["created_at"] = out["created_at"].isoformat()
    return {"message": out}


@api.put("/messages/{message_id}")
async def edit_message(message_id: str, body: MessageEditBody, user: dict = Depends(get_user_by_session)):
    m = await db.messages.find_one({"message_id": message_id}, {"_id": 0})
    if not m:
        raise HTTPException(404, "not found")
    if m["from_id"] != user["user_id"]:
        raise HTTPException(403, "not your message")
    await db.messages.update_one({"message_id": message_id}, {"$set": {"text": body.text.strip()[:2000], "edited_at": now_utc()}})
    return {"ok": True}


@api.post("/messages/{message_id}/delete-me")
async def delete_for_me(message_id: str, user: dict = Depends(get_user_by_session)):
    await db.messages.update_one(
        {"message_id": message_id},
        {"$addToSet": {"deleted_for": user["user_id"]}},
    )
    return {"ok": True}


@api.post("/messages/{message_id}/delete-all")
async def delete_for_all(message_id: str, user: dict = Depends(get_user_by_session)):
    m = await db.messages.find_one({"message_id": message_id}, {"_id": 0})
    if not m:
        raise HTTPException(404, "not found")
    if m["from_id"] != user["user_id"] and not user.get("is_developer"):
        raise HTTPException(403, "not your message")
    await db.messages.update_one({"message_id": message_id}, {"$set": {"deleted_for_all": True, "text": None, "image": None}})
    return {"ok": True}


@api.post("/messages/{message_id}/react")
async def react(message_id: str, body: dict, user: dict = Depends(get_user_by_session)):
    emoji = (body.get("emoji") or "").strip()[:8]
    if not emoji:
        raise HTTPException(400, "emoji required")
    field = f"reactions.{emoji}"
    m = await db.messages.find_one({"message_id": message_id}, {"_id": 0})
    if not m:
        raise HTTPException(404, "not found")
    existing = (m.get("reactions") or {}).get(emoji) or []
    if user["user_id"] in existing:
        await db.messages.update_one({"message_id": message_id}, {"$pull": {field: user["user_id"]}})
    else:
        await db.messages.update_one({"message_id": message_id}, {"$addToSet": {field: user["user_id"]}})
    return {"ok": True}


# ---------------- Rooms ----------------
async def _next_room_code() -> str:
    counter = await db.counters.find_one_and_update(
        {"_id": "rooms"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True,
    )
    seq = counter["seq"] if counter else 1
    return f"pchat/roomid/{seq:05d}"


@api.post("/rooms")
async def create_room(body: RoomCreateBody, user: dict = Depends(get_user_by_session)):
    code = await _next_room_code()
    room_id = new_id("room")
    room = {
        "room_id": room_id,
        "room_code": code,
        "name": body.name.strip()[:60],
        "description": body.description.strip()[:400],
        "is_private": body.is_private,
        "icon": body.icon,
        "banner": body.banner,
        "rules": (body.rules or "").strip()[:1000],
        "welcome_message": (body.welcome_message or "").strip()[:400],
        "owner_id": user["user_id"],
        "member_count": 1,
        "active_users": 0,
        "featured": False,
        "featured_at": None,
        "pinned_message_id": None,
        "announcement": None,
        "deleted": False,
        "created_at": now_utc(),
    }
    await db.rooms.insert_one(room)
    await db.room_members.insert_one({
        "room_id": room_id, "user_id": user["user_id"], "role": "owner", "muted": False, "joined_at": now_utc(),
    })
    await db.users.update_one({"user_id": user["user_id"]}, {"$inc": {"rooms_created": 1}})
    room.pop("_id", None)
    room["created_at"] = room["created_at"].isoformat()
    return {"room": room}


def _serialize_room(r: dict) -> dict:
    out = {k: v for k, v in r.items() if k != "_id"}
    if isinstance(out.get("created_at"), datetime):
        out["created_at"] = out["created_at"].isoformat()
    return out


@api.get("/rooms")
async def list_rooms(q: Optional[str] = None, user: dict = Depends(get_user_by_session)):
    """Public room list. Featured first, then by member_count DESC, active_users DESC, created_at DESC."""
    query: dict = {"is_private": False, "deleted": {"$ne": True}}
    if q:
        regex = re.compile(re.escape(q.strip()), re.IGNORECASE)
        query["$or"] = [{"name": regex}, {"description": regex}, {"room_code": regex}]

    # compute active_users on the fly: distinct authors who posted in the room in last 15min
    active_since = now_utc() - timedelta(minutes=15)
    active_by_room: dict[str, int] = {}
    async for row in db.room_messages.aggregate([
        {"$match": {"created_at": {"$gte": active_since}}},
        {"$group": {"_id": "$room_id", "users": {"$addToSet": "$from_id"}}},
    ]):
        active_by_room[row["_id"]] = len(row.get("users") or [])

    rooms = []
    async for r in db.rooms.find(query, {"_id": 0}).limit(200):
        r["active_users"] = active_by_room.get(r["room_id"], 0)
        rooms.append(r)

    # sort: featured DESC, member_count DESC, active_users DESC, created_at DESC
    def _key(r: dict):
        return (
            0 if r.get("featured") else 1,
            -int(r.get("member_count") or 0),
            -int(r.get("active_users") or 0),
            -(r.get("created_at").timestamp() if isinstance(r.get("created_at"), datetime) else 0),
        )
    rooms.sort(key=_key)
    return {"rooms": [_serialize_room(r) for r in rooms[:80]]}


@api.get("/rooms/featured")
async def featured_rooms(user: dict = Depends(get_user_by_session)):
    rooms = []
    async for r in db.rooms.find({"featured": True, "deleted": {"$ne": True}}, {"_id": 0}).sort("featured_at", -1).limit(20):
        rooms.append(_serialize_room(r))
    return {"rooms": rooms}


@api.post("/rooms/feature")
async def feature_room(body: FeatureRoomBody, user: dict = Depends(require_dev)):
    await db.rooms.update_one(
        {"room_id": body.room_id},
        {"$set": {"featured": body.featured, "featured_at": now_utc() if body.featured else None}},
    )
    return {"ok": True}


@api.get("/rooms/my")
async def my_rooms(user: dict = Depends(get_user_by_session)):
    memberships = db.room_members.find({"user_id": user["user_id"]}, {"_id": 0})
    room_ids = [m["room_id"] async for m in memberships]
    if not room_ids:
        return {"rooms": []}
    rooms = []
    async for r in db.rooms.find({"room_id": {"$in": room_ids}, "deleted": {"$ne": True}}, {"_id": 0}):
        rooms.append(_serialize_room(r))
    return {"rooms": rooms}


@api.get("/rooms/{room_id}")
async def get_room(room_id: str, user: dict = Depends(get_user_by_session)):
    r = await db.rooms.find_one({"room_id": room_id}, {"_id": 0})
    if not r or r.get("deleted"):
        raise HTTPException(404, "room not found")
    mem = await db.room_members.find_one({"room_id": room_id, "user_id": user["user_id"]}, {"_id": 0})
    return {"room": _serialize_room(r), "membership": {"role": mem["role"] if mem else None, "muted": bool(mem and mem.get("muted"))}}


@api.post("/rooms/{room_id}/join")
async def join_room(room_id: str, user: dict = Depends(get_user_by_session)):
    r = await db.rooms.find_one({"room_id": room_id}, {"_id": 0})
    if not r:
        raise HTTPException(404, "room not found")
    existing = await db.room_members.find_one({"room_id": room_id, "user_id": user["user_id"]})
    if existing:
        return {"ok": True, "already": True}
    await db.room_members.insert_one({
        "room_id": room_id, "user_id": user["user_id"], "role": "member", "muted": False, "joined_at": now_utc(),
    })
    await db.rooms.update_one({"room_id": room_id}, {"$inc": {"member_count": 1}})
    return {"ok": True}


@api.post("/rooms/{room_id}/leave")
async def leave_room(room_id: str, user: dict = Depends(get_user_by_session)):
    r = await db.rooms.find_one({"room_id": room_id}, {"_id": 0})
    if not r:
        raise HTTPException(404, "room not found")
    if r["owner_id"] == user["user_id"]:
        raise HTTPException(400, "owner cannot leave; delete room or transfer ownership")
    res = await db.room_members.delete_one({"room_id": room_id, "user_id": user["user_id"]})
    if res.deleted_count:
        await db.rooms.update_one({"room_id": room_id}, {"$inc": {"member_count": -1}})
    return {"ok": True}


@api.get("/rooms/{room_id}/members")
async def room_members(room_id: str, user: dict = Depends(get_user_by_session)):
    members = []
    async for m in db.room_members.find({"room_id": room_id}, {"_id": 0}):
        u = await db.users.find_one({"user_id": m["user_id"]}, {"_id": 0})
        if u:
            data = _sanitize_user(u)
            data["role"] = m["role"]
            data["muted"] = bool(m.get("muted"))
            members.append(data)
    return {"members": members}


@api.get("/rooms/{room_id}/messages")
async def get_room_messages(room_id: str, user: dict = Depends(get_user_by_session)):
    mem = await db.room_members.find_one({"room_id": room_id, "user_id": user["user_id"]})
    if not mem:
        # allow view for public rooms
        r = await db.rooms.find_one({"room_id": room_id}, {"_id": 0})
        if not r or r.get("is_private"):
            raise HTTPException(403, "not a member")
    msgs = []
    async for m in db.room_messages.find({"room_id": room_id}, {"_id": 0}).sort("created_at", -1).limit(200):
        m["created_at"] = m["created_at"].isoformat() if isinstance(m.get("created_at"), datetime) else m.get("created_at")
        msgs.append(m)
    msgs.reverse()
    return {"messages": msgs}


@api.post("/rooms/{room_id}/messages")
async def send_room_message(room_id: str, body: RoomMessageBody, user: dict = Depends(get_user_by_session)):
    mem = await db.room_members.find_one({"room_id": room_id, "user_id": user["user_id"]})
    if not mem:
        raise HTTPException(403, "not a member")
    if mem.get("muted"):
        raise HTTPException(403, "you are muted")
    if not body.text and not body.image:
        raise HTTPException(400, "empty message")
    msg = {
        "message_id": new_id("rm"),
        "room_id": room_id,
        "from_id": user["user_id"],
        "from_username": user.get("username"),
        "from_display_name": user.get("display_name"),
        "from_avatar": user.get("avatar"),
        "text": (body.text or "").strip()[:2000] or None,
        "image": body.image,
        "reactions": {},
        "created_at": now_utc(),
    }
    await db.room_messages.insert_one(msg)
    out = {**msg}
    out.pop("_id", None)
    out["created_at"] = out["created_at"].isoformat()
    return {"message": out}


@api.post("/rooms/{room_id}/kick")
async def kick_member(room_id: str, body: FriendActionBody, user: dict = Depends(get_user_by_session)):
    my = await db.room_members.find_one({"room_id": room_id, "user_id": user["user_id"]})
    if not my or my["role"] not in ("owner", "admin", "moderator"):
        raise HTTPException(403, "insufficient role")
    target = await db.room_members.find_one({"room_id": room_id, "user_id": body.user_id})
    if not target:
        raise HTTPException(404, "not a member")
    if target["role"] == "owner":
        raise HTTPException(403, "cannot kick owner")
    await db.room_members.delete_one({"room_id": room_id, "user_id": body.user_id})
    await db.rooms.update_one({"room_id": room_id}, {"$inc": {"member_count": -1}})
    return {"ok": True}


@api.post("/rooms/{room_id}/mute")
async def mute_member(room_id: str, body: FriendActionBody, user: dict = Depends(get_user_by_session)):
    my = await db.room_members.find_one({"room_id": room_id, "user_id": user["user_id"]})
    if not my or my["role"] not in ("owner", "admin", "moderator"):
        raise HTTPException(403, "insufficient role")
    await db.room_members.update_one({"room_id": room_id, "user_id": body.user_id}, {"$set": {"muted": True}})
    return {"ok": True}


@api.post("/rooms/{room_id}/promote")
async def promote(room_id: str, body: dict, user: dict = Depends(get_user_by_session)):
    role = body.get("role")
    target_id = body.get("user_id")
    if role not in ("admin", "moderator", "member"):
        raise HTTPException(400, "invalid role")
    r = await db.rooms.find_one({"room_id": room_id}, {"_id": 0})
    if not r or r["owner_id"] != user["user_id"]:
        raise HTTPException(403, "owner only")
    await db.room_members.update_one({"room_id": room_id, "user_id": target_id}, {"$set": {"role": role}})
    return {"ok": True}


@api.delete("/rooms/{room_id}")
async def delete_room(room_id: str, user: dict = Depends(get_user_by_session)):
    r = await db.rooms.find_one({"room_id": room_id}, {"_id": 0})
    if not r:
        raise HTTPException(404, "not found")
    if r["owner_id"] != user["user_id"] and not user.get("is_developer"):
        raise HTTPException(403, "owner only")
    await db.rooms.update_one({"room_id": room_id}, {"$set": {"deleted": True}})
    return {"ok": True}


# ---------------- Posts ----------------
@api.post("/posts")
async def create_post(body: PostCreateBody, user: dict = Depends(get_user_by_session)):
    if body.visibility not in ("public", "friends"):
        raise HTTPException(400, "invalid visibility")
    # 2 posts per week
    week_ago = now_utc() - timedelta(days=7)
    count = await db.posts.count_documents({"user_id": user["user_id"], "created_at": {"$gte": week_ago}})
    if count >= 2 and not user.get("is_developer"):
        raise HTTPException(429, "Weekly post limit reached (2/week)")
    post = {
        "post_id": new_id("p"),
        "user_id": user["user_id"],
        "username": user.get("username"),
        "display_name": user.get("display_name"),
        "avatar": user.get("avatar"),
        "image": body.image,
        "caption": (body.caption or "").strip()[:500],
        "visibility": body.visibility,
        "likes": [],
        "likes_count": 0,
        "comments_count": 0,
        "created_at": now_utc(),
    }
    await db.posts.insert_one(post)
    await db.users.update_one({"user_id": user["user_id"]}, {"$inc": {"posts_count": 1}})
    post.pop("_id", None)
    post["created_at"] = post["created_at"].isoformat()
    return {"post": post}


@api.get("/posts")
async def list_posts(user: dict = Depends(get_user_by_session)):
    uid = user["user_id"]
    # friends set
    friend_ids = set()
    async for f in db.friendships.find({"$or": [{"a": uid}, {"b": uid}]}, {"_id": 0}):
        friend_ids.add(f["a"] if f["a"] != uid else f["b"])
    posts = []
    async for p in db.posts.find({}, {"_id": 0}).sort("created_at", -1).limit(100):
        if p["visibility"] == "friends" and p["user_id"] != uid and p["user_id"] not in friend_ids:
            continue
        p["liked_by_me"] = uid in (p.get("likes") or [])
        p["created_at"] = p["created_at"].isoformat() if isinstance(p.get("created_at"), datetime) else p.get("created_at")
        p.pop("likes", None)
        posts.append(p)
    return {"posts": posts}


@api.post("/posts/{post_id}/like")
async def like_post(post_id: str, user: dict = Depends(get_user_by_session)):
    p = await db.posts.find_one({"post_id": post_id}, {"_id": 0})
    if not p:
        raise HTTPException(404, "not found")
    uid = user["user_id"]
    if uid in (p.get("likes") or []):
        await db.posts.update_one({"post_id": post_id}, {"$pull": {"likes": uid}, "$inc": {"likes_count": -1}})
        return {"liked": False}
    await db.posts.update_one({"post_id": post_id}, {"$addToSet": {"likes": uid}, "$inc": {"likes_count": 1}})
    if p["user_id"] != uid:
        await _add_notification(p["user_id"], "like", f"{user.get('display_name') or user['username']} liked your post", {"post_id": post_id})
    return {"liked": True}


@api.post("/posts/{post_id}/comment")
async def comment_post(post_id: str, body: CommentBody, user: dict = Depends(get_user_by_session)):
    p = await db.posts.find_one({"post_id": post_id}, {"_id": 0})
    if not p:
        raise HTTPException(404, "not found")
    cid = new_id("c")
    await db.comments.insert_one({
        "comment_id": cid,
        "post_id": post_id,
        "user_id": user["user_id"],
        "username": user.get("username"),
        "display_name": user.get("display_name"),
        "avatar": user.get("avatar"),
        "text": body.text.strip()[:500],
        "created_at": now_utc(),
    })
    await db.posts.update_one({"post_id": post_id}, {"$inc": {"comments_count": 1}})
    if p["user_id"] != user["user_id"]:
        await _add_notification(p["user_id"], "comment", f"{user.get('display_name') or user['username']} commented on your post", {"post_id": post_id})
    return {"comment_id": cid}


@api.get("/posts/{post_id}/comments")
async def list_comments(post_id: str, user: dict = Depends(get_user_by_session)):
    comments = []
    async for c in db.comments.find({"post_id": post_id}, {"_id": 0}).sort("created_at", 1):
        c["created_at"] = c["created_at"].isoformat() if isinstance(c.get("created_at"), datetime) else c.get("created_at")
        comments.append(c)
    return {"comments": comments}


@api.delete("/posts/{post_id}")
async def delete_post(post_id: str, user: dict = Depends(get_user_by_session)):
    p = await db.posts.find_one({"post_id": post_id}, {"_id": 0})
    if not p:
        raise HTTPException(404, "not found")
    if p["user_id"] != user["user_id"] and not user.get("is_developer"):
        raise HTTPException(403, "not your post")
    await db.posts.delete_one({"post_id": post_id})
    await db.users.update_one({"user_id": p["user_id"]}, {"$inc": {"posts_count": -1}})
    return {"ok": True}


# ---------------- Notifications ----------------
@api.get("/notifications")
async def list_notifications(user: dict = Depends(get_user_by_session)):
    items = []
    async for n in db.notifications.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).limit(100):
        n["created_at"] = n["created_at"].isoformat() if isinstance(n.get("created_at"), datetime) else n.get("created_at")
        items.append(n)
    return {"notifications": items}


@api.post("/notifications/read-all")
async def read_all(user: dict = Depends(get_user_by_session)):
    await db.notifications.update_many({"user_id": user["user_id"]}, {"$set": {"read": True}})
    return {"ok": True}


# ---------------- Badges ----------------
@api.get("/badges")
async def list_badges(user: dict = Depends(get_user_by_session)):
    items = []
    async for b in db.badges.find({}, {"_id": 0}).sort("created_at", 1):
        if isinstance(b.get("created_at"), datetime):
            b["created_at"] = b["created_at"].isoformat()
        items.append(b)
    return {"badges": items}


@api.post("/badges")
async def create_badge(body: BadgeCreateBody, user: dict = Depends(require_dev)):
    bid = new_id("b")
    b = {
        "badge_id": bid,
        "name": body.name[:40],
        "icon": body.icon[:40],
        "color": body.color[:20],
        "description": (body.description or "")[:200],
        "enabled": body.enabled,
        "system": False,
        "created_at": now_utc(),
    }
    await db.badges.insert_one(b)
    b.pop("_id", None)
    b["created_at"] = b["created_at"].isoformat()
    return {"badge": b}


@api.put("/badges/{badge_id}")
async def edit_badge(badge_id: str, body: BadgeCreateBody, user: dict = Depends(require_dev)):
    await db.badges.update_one({"badge_id": badge_id}, {"$set": {
        "name": body.name[:40],
        "icon": body.icon[:40],
        "color": body.color[:20],
        "description": (body.description or "")[:200],
        "enabled": body.enabled,
    }})
    return {"ok": True}


@api.post("/badges/assign")
async def assign_badge(body: BadgeAssignBody, user: dict = Depends(require_dev)):
    await db.users.update_one({"user_id": body.user_id}, {"$addToSet": {"badges": body.badge_id}})
    return {"ok": True}


@api.post("/badges/remove")
async def remove_badge(body: BadgeAssignBody, user: dict = Depends(require_dev)):
    await db.users.update_one({"user_id": body.user_id}, {"$pull": {"badges": body.badge_id}})
    return {"ok": True}


# ---------------- Developer Dashboard ----------------
@api.get("/dev/stats")
async def dev_stats(user: dict = Depends(require_dev)):
    return {
        "users": await db.users.count_documents({}),
        "rooms": await db.rooms.count_documents({"deleted": {"$ne": True}}),
        "posts": await db.posts.count_documents({}),
        "messages": await db.messages.count_documents({}) + await db.room_messages.count_documents({}),
        "reports": await db.reports.count_documents({"status": "open"}),
    }


@api.get("/dev/users")
async def dev_list_users(q: Optional[str] = None, user: dict = Depends(require_dev)):
    query = {}
    if q:
        regex = re.compile(re.escape(q), re.IGNORECASE)
        query = {"$or": [{"username": regex}, {"display_name": regex}, {"email": regex}]}
    users = []
    async for u in db.users.find(query, {"_id": 0}).limit(50):
        users.append(_sanitize_user(u))
    return {"users": users}


@api.get("/dev/reports")
async def dev_reports(user: dict = Depends(require_dev)):
    items = []
    async for r in db.reports.find({}, {"_id": 0}).sort("created_at", -1).limit(100):
        if isinstance(r.get("created_at"), datetime):
            r["created_at"] = r["created_at"].isoformat()
        items.append(r)
    return {"reports": items}


@api.post("/dev/ban")
async def dev_ban(body: DevBanBody, user: dict = Depends(require_dev)):
    await db.users.update_one({"user_id": body.user_id}, {"$set": {"banned": True, "ban_reason": body.reason}})
    return {"ok": True}


@api.post("/dev/unban")
async def dev_unban(body: DevBanBody, user: dict = Depends(require_dev)):
    await db.users.update_one({"user_id": body.user_id}, {"$set": {"banned": False}, "$unset": {"ban_reason": ""}})
    return {"ok": True}


@api.post("/dev/broadcast")
async def dev_broadcast(body: DevBroadcastBody, user: dict = Depends(require_dev)):
    # Notify all users
    all_ids = [u["user_id"] async for u in db.users.find({}, {"_id": 0, "user_id": 1})]
    for uid in all_ids:
        await _add_notification(uid, "announcement", body.message, {"title": body.title})
    # Push in chunks of 100
    for i in range(0, len(all_ids), 100):
        await _push_notify(all_ids[i:i+100], body.title, body.message)
    return {"ok": True, "count": len(all_ids)}


@api.post("/dev/maintenance")
async def dev_maintenance(body: dict, user: dict = Depends(require_dev)):
    enabled = bool(body.get("enabled"))
    await db.settings.update_one({"_id": "maintenance"}, {"$set": {"enabled": enabled}}, upsert=True)
    return {"ok": True, "enabled": enabled}


@api.get("/dev/settings")
async def dev_settings(user: dict = Depends(require_dev)):
    doc = await db.settings.find_one({"_id": "maintenance"}) or {}
    return {"maintenance": bool(doc.get("enabled"))}


# ---------------- Push registration ----------------
@api.post("/register-push", status_code=201)
async def register_push(body: RegisterPushBody):
    # Store locally too so we can debug — but Emergent relay tracks tokens.
    await db.push_tokens.update_one(
        {"user_id": body.user_id, "device_token": body.device_token},
        {"$set": {"platform": body.platform, "updated_at": now_utc()}},
        upsert=True,
    )
    try:
        resp = await _push_client.post("/api/v1/push/users/register", json=body.model_dump())
        if resp.status_code == 401:
            raise HTTPException(500, "EMERGENT_PUSH_KEY missing or invalid")
        if resp.status_code >= 500:
            raise HTTPException(502, "Push provider unavailable")
    except HTTPException:
        raise
    except Exception as e:
        log.warning(f"push register non-blocking fail: {e}")
    return {"status": "registered"}


# ---------------- Mount router ----------------
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
