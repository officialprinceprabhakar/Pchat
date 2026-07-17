// Central API client - reads session token from secure storage on every call.
import { storage } from '@/src/utils/storage';

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const TOKEN_KEY = 'pchat_session_token';

export const TOKEN_STORAGE_KEY = TOKEN_KEY;

type Options = {
  method?: string;
  body?: any;
  auth?: boolean;
};

export async function apiFetch<T = any>(path: string, opts: Options = {}): Promise<T> {
  const url = `${BASE}/api${path}`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.auth !== false) {
    const token = await storage.secureGet(TOKEN_KEY, null);
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(url, {
    method: opts.method || 'GET',
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let json: any;
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
  if (!res.ok) {
    const err: any = new Error(json?.detail || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = json;
    throw err;
  }
  return json as T;
}

export const api = {
  // Auth
  guestRegister: (username: string, password: string, display_name?: string) =>
    apiFetch('/auth/guest/register', { method: 'POST', body: { username, password, display_name }, auth: false }),
  guestLogin: (username: string, password: string) =>
    apiFetch('/auth/guest/login', { method: 'POST', body: { username, password }, auth: false }),
  googleSession: (session_id: string) =>
    apiFetch('/auth/google/session', { method: 'POST', body: { session_id }, auth: false }),
  me: () => apiFetch('/auth/me'),
  logout: () => apiFetch('/auth/logout', { method: 'POST' }),
  // Users
  updateMe: (body: any) => apiFetch('/users/me', { method: 'PUT', body }),
  searchUsers: (q: string) => apiFetch(`/users/search?q=${encodeURIComponent(q)}`),
  getUser: (user_id: string) => apiFetch(`/users/${user_id}`),
  block: (user_id: string) => apiFetch('/users/block', { method: 'POST', body: { user_id } }),
  unblock: (user_id: string) => apiFetch('/users/unblock', { method: 'POST', body: { user_id } }),
  report: (target_id: string, target_type: string, reason: string) =>
    apiFetch('/report', { method: 'POST', body: { target_id, target_type, reason } }),
  // Friends
  friends: () => apiFetch('/friends'),
  friendRequests: () => apiFetch('/friends/requests'),
  sendRequest: (user_id: string) => apiFetch('/friends/request', { method: 'POST', body: { user_id } }),
  acceptRequest: (user_id: string) => apiFetch('/friends/accept', { method: 'POST', body: { user_id } }),
  rejectRequest: (user_id: string) => apiFetch('/friends/reject', { method: 'POST', body: { user_id } }),
  cancelRequest: (user_id: string) => apiFetch('/friends/cancel', { method: 'POST', body: { user_id } }),
  removeFriend: (user_id: string) => apiFetch('/friends/remove', { method: 'POST', body: { user_id } }),
  // Chats
  listChats: () => apiFetch('/chats'),
  getChatMessages: (other_id: string) => apiFetch(`/chats/${other_id}/messages`),
  sendChatMessage: (other_id: string, body: any) =>
    apiFetch(`/chats/${other_id}/messages`, { method: 'POST', body }),
  editMessage: (id: string, text: string) => apiFetch(`/messages/${id}`, { method: 'PUT', body: { text } }),
  deleteForMe: (id: string) => apiFetch(`/messages/${id}/delete-me`, { method: 'POST' }),
  deleteForAll: (id: string) => apiFetch(`/messages/${id}/delete-all`, { method: 'POST' }),
  react: (id: string, emoji: string) => apiFetch(`/messages/${id}/react`, { method: 'POST', body: { emoji } }),
  // Rooms
  createRoom: (body: any) => apiFetch('/rooms', { method: 'POST', body }),
  listRooms: (q?: string) => apiFetch(`/rooms${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  featuredRooms: () => apiFetch('/rooms/featured'),
  pinnedRooms: () => apiFetch('/rooms/pinned'),
  featureRoom: (room_id: string, featured: boolean) =>
    apiFetch('/rooms/feature', { method: 'POST', body: { room_id, featured } }),
  pinRoom: (room_id: string, pinned: boolean) =>
    apiFetch('/rooms/pin', { method: 'POST', body: { room_id, pinned } }),
  hideRoom: (room_id: string, hidden: boolean) =>
    apiFetch('/rooms/hide', { method: 'POST', body: { room_id, hidden } }),
  inviteToRoom: (room_id: string, user_id: string) =>
    apiFetch(`/rooms/${room_id}/invite`, { method: 'POST', body: { user_id } }),
  updateRoomSettings: (room_id: string, body: any) =>
    apiFetch(`/rooms/${room_id}/settings`, { method: 'POST', body }),
  setAnnouncement: (room_id: string, text: string | null) =>
    apiFetch(`/rooms/${room_id}/announcement`, { method: 'POST', body: { text } }),
  banFromRoom: (room_id: string, user_id: string, reason?: string) =>
    apiFetch(`/rooms/${room_id}/ban`, { method: 'POST', body: { user_id, reason } }),
  setRoomRole: (room_id: string, user_id: string, role: string) =>
    apiFetch(`/rooms/${room_id}/roles`, { method: 'POST', body: { user_id, role } }),
  roomTyping: (room_id: string) => apiFetch(`/rooms/${room_id}/typing`, { method: 'POST' }),
  roomTypingList: (room_id: string) => apiFetch(`/rooms/${room_id}/typing`),
  chatTyping: (other_id: string) => apiFetch(`/chats/${other_id}/typing`, { method: 'POST' }),
  chatIsTyping: (other_id: string) => apiFetch(`/chats/${other_id}/typing`),
  markChatRead: (other_id: string) => apiFetch(`/chats/${other_id}/read`, { method: 'POST' }),
  myRooms: () => apiFetch('/rooms/my'),
  getRoom: (room_id: string) => apiFetch(`/rooms/${room_id}`),
  joinRoom: (room_id: string, password?: string) =>
    apiFetch(`/rooms/${room_id}/join`, { method: 'POST', body: password ? { password } : {} }),
  leaveRoom: (room_id: string) => apiFetch(`/rooms/${room_id}/leave`, { method: 'POST' }),
  roomMembers: (room_id: string) => apiFetch(`/rooms/${room_id}/members`),
  roomMessages: (room_id: string) => apiFetch(`/rooms/${room_id}/messages`),
  sendRoomMessage: (room_id: string, body: any) =>
    apiFetch(`/rooms/${room_id}/messages`, { method: 'POST', body }),
  kick: (room_id: string, user_id: string) =>
    apiFetch(`/rooms/${room_id}/kick`, { method: 'POST', body: { user_id } }),
  mute: (room_id: string, user_id: string) =>
    apiFetch(`/rooms/${room_id}/mute`, { method: 'POST', body: { user_id } }),
  promote: (room_id: string, user_id: string, role: string) =>
    apiFetch(`/rooms/${room_id}/promote`, { method: 'POST', body: { user_id, role } }),
  deleteRoom: (room_id: string) => apiFetch(`/rooms/${room_id}`, { method: 'DELETE' }),
  // Posts
  createPost: (body: any) => apiFetch('/posts', { method: 'POST', body }),
  listPosts: () => apiFetch('/posts'),
  likePost: (id: string) => apiFetch(`/posts/${id}/like`, { method: 'POST' }),
  commentPost: (id: string, text: string) => apiFetch(`/posts/${id}/comment`, { method: 'POST', body: { text } }),
  listComments: (id: string) => apiFetch(`/posts/${id}/comments`),
  deletePost: (id: string) => apiFetch(`/posts/${id}`, { method: 'DELETE' }),
  // Notifications
  notifications: () => apiFetch('/notifications'),
  markAllRead: () => apiFetch('/notifications/read-all', { method: 'POST' }),
  unreadCount: () => apiFetch('/notifications/unread-count'),
  getNotifPrefs: () => apiFetch('/notifications/prefs'),
  setNotifPrefs: (body: any) => apiFetch('/notifications/prefs', { method: 'POST', body }),
  listBlocks: () => apiFetch('/blocks'),
  changeUsername: (username: string) => apiFetch('/users/change-username', { method: 'POST', body: { username } }),
  changePassword: (current_password: string | undefined, new_password: string) =>
    apiFetch('/auth/change-password', { method: 'POST', body: { current_password, new_password } }),
  // Badges
  listBadges: () => apiFetch('/badges'),
  createBadge: (body: any) => apiFetch('/badges', { method: 'POST', body }),
  assignBadge: (user_id: string, badge_id: string) =>
    apiFetch('/badges/assign', { method: 'POST', body: { user_id, badge_id } }),
  removeBadge: (user_id: string, badge_id: string) =>
    apiFetch('/badges/remove', { method: 'POST', body: { user_id, badge_id } }),
  // Dev
  devStats: () => apiFetch('/dev/stats'),
  devUsers: (q: string = '') => apiFetch(`/dev/users${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  devUserDetail: (user_id: string) => apiFetch(`/dev/user/${user_id}`),
  devReports: () => apiFetch('/dev/reports'),
  devModLogs: () => apiFetch('/dev/mod-logs'),
  devDeletedMessages: () => apiFetch('/dev/deleted-messages'),
  devDeleteAccount: (user_id: string, reason?: string) =>
    apiFetch('/dev/delete-account', { method: 'POST', body: { user_id, reason } }),
  devAnalytics: () => apiFetch('/dev/analytics'),
  devBan: (user_id: string, reason?: string) =>
    apiFetch('/dev/ban', { method: 'POST', body: { user_id, reason } }),
  devUnban: (user_id: string) =>
    apiFetch('/dev/unban', { method: 'POST', body: { user_id } }),
  devBroadcast: (title: string, message: string) =>
    apiFetch('/dev/broadcast', { method: 'POST', body: { title, message } }),
  devMaintenance: (enabled: boolean) => apiFetch('/dev/maintenance', { method: 'POST', body: { enabled } }),
  devSettings: () => apiFetch('/dev/settings'),
  // Push
  registerPush: (user_id: string, platform: string, device_token: string) =>
    apiFetch('/register-push', { method: 'POST', body: { user_id, platform, device_token }, auth: false }),
};
