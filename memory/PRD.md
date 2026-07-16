# PChat — Premium Social Chat App

## Overview
PChat is a premium Android-first social chat mobile application built with Expo (React Native) + FastAPI + MongoDB. Material 3 inspired dark theme, glassmorphic floating tab bar, red accent, staggered layout.

## Auth
- **Google Sign-In** via Emergent-managed OAuth → auto grants `verified` badge.
- **Guest Auth** — username + password (no phone), auto grants `guest` badge.
- Developer usernames (`Prince_Prabhakar`, `PrincePrabhakar`, `Reyansh`) auto-seeded with `developer` badge and unrestricted access.

## Navigation (5-tab floating glassmorphic bar)
- **Home** — welcome, user search, friends strip, trending rooms, latest posts.
- **Messages** — 1:1 chat list + friends strip → chat screen.
- **Rooms** — Discover/My rooms with cards + create button.
- **Discover** — post feed with like/comment/share, camera icon to create.
- **Profile** — cover, avatar, badges, stats, edit modal, sign-out, dev dashboard link (if dev).

## 1-to-1 Chat (`/chat/[userId]`)
- Message bubbles (primary color mine, surface2 others), image sharing (base64), typing indicator, online/last seen.
- Long-press context menu: reactions (❤️😂👍😮😢🔥), reply, edit (own text messages), delete for me, delete for everyone.

## Rooms (`/room/[roomId]`)
- Auto-generated room codes `pchat/roomid/00001+`, banner gradient, member count, private lock.
- Tabs: CHAT / INFO / MEMBERS.
- Info: description, rules, welcome message, announcement, leave/delete/report.
- Members: list with role (owner/admin/moderator/member); moderators can kick.

## Posts (`/post/create`)
- Photo + caption + public/friends visibility. Enforced **2 posts / week** at API level (429 if exceeded, developer bypass).
- Likes, comments, delete own.

## Friends System
- Send / accept / reject / cancel / remove. In-app + push notifications on each event.

## Badges (`/dev` badge tab for management)
- Defaults: developer, verified, guest, moderator, vip, owner, elite, ai.
- Developers can create custom badges (name, icon, color, description, enabled flag) and assign/remove per user.

## Developer Dashboard (`/dev`)
- Sections: **Stats**, **Users** (search + ban/unban + badge assignment), **Reports**, **Badges** (create + list), **Broadcast** (title + message → all users push).
- Toggle maintenance mode.

## Backend (FastAPI + MongoDB)
- All routes prefixed `/api`. Auth via `Authorization: Bearer <session_token>`.
- MongoDB collections: `users`, `user_sessions` (TTL), `friendships`, `friend_requests`, `messages`, `rooms`, `room_members`, `room_messages`, `posts`, `comments`, `notifications`, `badges`, `blocks`, `reports`, `settings`, `push_tokens`, `counters`.
- Emergent Push relay wired via `EMERGENT_PUSH_KEY` (placeholder → real key on deploy).

## Not in MVP (documented for v2)
- Voice notes (30s), announcement / pinned message UI, AI Welcome Bot chat commands, real-time WebSockets (currently 3s polling), typing indicator wire-up over sockets, image upload for room banner/icon, in-room search UI.

## Known Limitations
- Preview environment uses HTTP polling (3s). WebSockets can be added in v2.
- Push notifications only fire on real builds (not Expo Go).
