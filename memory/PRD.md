# PChat — Premium Social Chat App (Y99-inspired room experience)

## Stack
Expo SDK 54 (React Native + expo-router) frontend, FastAPI + MongoDB backend. Emergent-managed Google Auth. Emergent push notifications wiring (deploy required to fire).

## Auth
- Google Sign-In (Emergent Auth) → auto-badge `verified` (Verified Gmail).
- Guest username+password (no phone) → auto-badge `guest`.
- Seeded developer accounts (`Prince_Prabhakar`, `PrincePrabhakar`, `Reyansh`) → auto-badge `developer` and unrestricted access.

## Bottom navigation (6 tabs, floating glassmorphic)
Home · Rooms · Friends · Messages · Notifications · Profile

## Home
Search rooms · Create-room CTA · **Featured Rooms** (horizontal, dev-pinnable) · **Trending Rooms**. Sort: `pinned → featured → active_users → member_count → recency`. Developer-hidden rooms stay searchable.

## Rooms (Y99-inspired, original UI)
- Auto-incrementing room codes `pchat/roomid/00001+`.
- Types: **Public / Private / Password-protected** (bcrypt hashed).
- Roles: **Developer / Owner / Admin / Moderator / Verified / VIP / Member / Guest** — usernames rendered in role color.
- Room chat features: **wallpaper support** (preset picker) + **blur toggle**, floating bubbles over wallpaper, small avatar beside every message, role-colored username above, badges inline, timestamp, smooth animations, **pinned announcement banner**, **date separators**, **typing indicator**, **scroll-to-newest** floating pill, online member count, message grouping.
- Bottom input: emoji-ready textbox, image attach (base64), **voice notes ≤ 30 s** with waveform + play/pause, send button, animated record UI with cancel.
- Long-press message: react (❤️😂👍😮😢🔥), reply, copy, mention, report, delete for everyone (permission-gated).
- Tap username → mini profile sheet: open profile, mention, add friend, block; admins get kick/mute/promote/ban.
- **`@` autocomplete** listing room members by role color; sent mentions produce instant notifications (Alerts tab → Mentions filter) that deep-link and highlight the target message.
- Room admin: change wallpaper, toggle blur, set announcement, kick/mute/ban, promote to admin/moderator/VIP.
- Developer only: pin, feature, hide, delete any room.

## Private Chat
Friend required to DM. Reply, delete for me / for everyone, image, voice notes (30s), read receipts (`read_by[]` on backend), typing indicator, online/last-seen.

## Friends tab
User search @username · Friends · Received / Sent requests · Suggested users · Online-now strip. Add/accept/reject/cancel/remove/block.

## Posts (Discover flow reachable via Post-composer route)
Max 2 posts/week per user (429 on breach, developer bypass). Public / Friends-only. Like, comment, share. Developer can delete any post.

## Notifications tab
Categories: All / Unread / Mentions / Social. Types: friend_request, friend_accept, message, like, comment, mention, announcement, room_invite, room_join, room_leave, reply, promotion, badge_received, warning. Unread badge count via `/notifications/unread-count`. Tap mention → deep link into exact message with highlight animation.

## Profile & Badges
Profile banner gradient, avatar, bio, username, badges, friends/posts/rooms/joined date. Default badges: developer, verified, guest, moderator, vip, owner, elite, ai. Developers can create unlimited custom badges + assign/remove.

## Developer Dashboard (hidden, unlocked from Profile crown icon)
- Search any user + full profile detail (`/api/dev/user/{id}` with friends/rooms/posts/messages/sessions).
- View reports, **moderation logs** (`/api/dev/mod-logs`), **deleted messages archive**, analytics (`/api/dev/analytics`: user/room/message counts, 24h/7d).
- Ban / unban / **delete account** / **broadcast** (push to all).
- Pin / feature / hide rooms · custom badges · assign roles.
- Maintenance mode toggle.

## Settings
- **Theme** — Dark ↔ Light segmented control, persisted via AsyncStorage.
- **Notifications** — per-category toggles (mentions, messages, friend_requests, room_events, announcements).
- **Privacy** — blocked users list with unblock action.
- **Account** — change username, language selector (6 languages listed; localisation deferred), sign out.

## Safety
Reports on user/room/message/post targets, block/unblock, rate limits via slow mode per room, developer moderation logs of ban/kick/mute actions.

## Notes / Deferred
- Chat polling every 3 s (WebSockets deferred).
- Voice recording uses `expo-audio` (recorder + player); only fires on device build (Expo Go audio recording works on iOS/Android, web preview may be limited).
- Push notifications require deploy + native build to fire on device.
- Full multi-language content is UI-listed; string translations deferred.
