// PChat Room Chat — Compact, lightweight classic-room styled experience.
// Rules from user:
//  • single-tap username → insert @username into input + focus (NO profile, no admin sheet)
//  • long-press username → tiny sheet with only View Profile / Add Friend / Block / Report
//  • messages: colored username + badge · time · text below · NO oversized cards · wallpaper visible
//  • header: back · name · online count · share · menu (no room code)
//  • share sheet: Copy invite link, native share, share with friends, search+invite, recent friends
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView,
  Platform, ActivityIndicator, Image, Modal, ImageBackground, ScrollView, Pressable, Animated, Alert, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { AudioModule, useAudioPlayer, useAudioRecorder, RecordingPresets } from 'expo-audio';

import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { api } from '@/src/api/client';
import { Avatar } from '@/src/components/Avatar';
import { BadgePill } from '@/src/components/BadgePill';

const ROLE_COLORS: Record<string, string> = {
  developer: '#FF9F0A',       // orange-gold developer accent
  owner: '#FFD60A',           // GOLD username
  admin: '#FF453A',           // RED username
  moderator: '#0A2E7A',       // DARK BLUE username
  verified: '#32ADE6',
  vip: '#FF9500',
  member: '',                 // '' → use adaptive color based on wallpaper
  guest: '',
};
const REACTIONS = ['❤️', '😂', '👍', '😮', '😢', '🔥'];

// Compute an adaptive username color that is readable on any wallpaper.
// When wallpaper is present, we bias toward pure white with a subtle shadow.
// When no wallpaper, we fall back to theme text color.
function useAdaptiveMemberColor(hasWallpaper: boolean, themeText: string) {
  return hasWallpaper ? '#FFFFFF' : themeText;
}
const WALLPAPER_PRESETS = [
  { key: 'none', label: 'Solid', color: '#0A0A0C' },
  { key: 'w1', label: 'Ember', url: 'https://images.unsplash.com/photo-1655841439659-0afc60676b70?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMzV8MHwxfHNlYXJjaHwxfHxkYXJrJTIwYWJzdHJhY3QlMjBwcmVtaXVtJTIwbGFuZHNjYXBlJTIwYmFja2dyb3VuZHxlbnwwfHx8fDE3ODQxOTA1MzN8MA&ixlib=rb-4.1.0&q=85' },
  { key: 'w2', label: 'Wave', url: 'https://images.unsplash.com/photo-1709377058964-929af7f2d02f?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMzV8MHwxfHNlYXJjaHw0fHxkYXJrJTIwYWJzdHJhY3QlMjBwcmVtaXVtJTIwbGFuZHNjYXBlJTIwYmFja2dyb3VuZHxlbnwwfHx8fDE3ODQxOTA1MzN8MA&ixlib=rb-4.1.0&q=85' },
  { key: 'w3', label: 'Ribbon', url: 'https://images.unsplash.com/photo-1651833826115-7530e72ce504?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMzV8MHwxfHNlYXJjaHwyfHxkYXJrJTIwYWJzdHJhY3QlMjBwcmVtaXVtJTIwbGFuZHNjYXBlJTIwYmFja2dyb3VuZHxlbnwwfHx8fDE3ODQxOTA1MzN8MA&ixlib=rb-4.1.0&q=85' },
];

function timeShort(iso: string) {
  try { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } catch { return ''; }
}
function dateLabel(iso: string) {
  const d = new Date(iso), today = new Date(), y = new Date(); y.setDate(y.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

type Tab = 'chat' | 'members' | 'info';

export default function RoomScreen() {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const { roomId, highlightMessage } = useLocalSearchParams<{ roomId: string; highlightMessage?: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [room, setRoom] = useState<any>(null);
  const [membership, setMembership] = useState<any>(null);
  const [onlineCount, setOnlineCount] = useState(0);
  const [members, setMembers] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [tab, setTab] = useState<Tab>('chat');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<any>(null);
  const [contextMsg, setContextMsg] = useState<any>(null);
  const [userSheet, setUserSheet] = useState<any>(null); // long-press username sheet
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordErr, setPasswordErr] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [showWallpaperSheet, setShowWallpaperSheet] = useState(false);
  const [showAnnouncement, setShowAnnouncement] = useState(false);
  const [announcementDraft, setAnnouncementDraft] = useState('');
  const [showShare, setShowShare] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [inviteQ, setInviteQ] = useState('');
  const [inviteResults, setInviteResults] = useState<any[]>([]);
  const [showScrollDown, setShowScrollDown] = useState(false);

  const recorder = useAudioRecorder(RecordingPresets.LOW_QUALITY);
  const [recording, setRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const recordTimer = useRef<any>(null);
  const recordStart = useRef<number>(0);
  const highlightAnim = useRef(new Animated.Value(0)).current;
  const highlightId = useRef<string | null>(null);

  const listRef = useRef<FlatList>(null);
  const pollRef = useRef<any>(null);
  const typingSentAt = useRef<number>(0);
  const inputRef = useRef<TextInput>(null);
  const [inputSelection, setInputSelection] = useState<{ start: number; end: number } | undefined>();

  const load = useCallback(async () => {
    try {
      const r = await api.getRoom(roomId);
      setRoom(r.room);
      setMembership(r.membership);
      setOnlineCount(r.online_count || 0);
      const [mm, msgs] = await Promise.all([
        api.roomMembers(roomId).catch(() => ({ members: [] })),
        r.membership?.role || !r.room.is_private
          ? api.roomMessages(roomId).catch(() => ({ messages: [] }))
          : Promise.resolve({ messages: [] }),
      ]);
      setMembers(mm.members || []);
      setMessages(msgs.messages || []);
    } catch {} finally { setLoading(false); }
  }, [roomId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (tab !== 'chat') return;
    pollRef.current = setInterval(async () => {
      try {
        const [r, msgRes, typ] = await Promise.all([
          api.getRoom(roomId),
          api.roomMessages(roomId),
          api.roomTypingList(roomId).catch(() => ({ users: [] })),
        ]);
        setOnlineCount(r.online_count || 0);
        setMessages((prev) => (prev.length !== msgRes.messages.length ? msgRes.messages : prev));
        setTypingUsers(typ.users || []);
      } catch {}
    }, 3000);
    return () => clearInterval(pollRef.current);
  }, [tab, roomId]);

  useEffect(() => { (async () => { try { await AudioModule.requestRecordingPermissionsAsync(); } catch {} })(); }, []);

  // mention deep-link highlight
  useEffect(() => {
    if (highlightMessage && messages.length > 0) {
      highlightId.current = String(highlightMessage);
      const idx = messages.findIndex((m) => m.message_id === highlightMessage);
      if (idx >= 0) {
        setTimeout(() => {
          try { listRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 }); } catch {}
          Animated.sequence([
            Animated.timing(highlightAnim, { toValue: 1, duration: 300, useNativeDriver: false }),
            Animated.delay(1000),
            Animated.timing(highlightAnim, { toValue: 0, duration: 500, useNativeDriver: false }),
          ]).start();
        }, 400);
      }
    }
  }, [highlightMessage, messages, highlightAnim]);

  // ==== USERNAME BEHAVIOR ====
  const insertMentionAtCursor = useCallback((username: string) => {
    // classic-room style: insert `@username ` at current cursor (or end) and continue.
    setText((prev) => {
      const start = inputSelection?.start ?? prev.length;
      const end = inputSelection?.end ?? prev.length;
      const before = prev.slice(0, start);
      const after = prev.slice(end);
      const needsSpaceBefore = before.length > 0 && !/\s$/.test(before);
      const insertion = `${needsSpaceBefore ? ' ' : ''}@${username} `;
      const nextText = before + insertion + after;
      // move cursor after insertion
      const cursor = (before + insertion).length;
      setTimeout(() => setInputSelection({ start: cursor, end: cursor }), 0);
      return nextText;
    });
    setTimeout(() => inputRef.current?.focus(), 30);
  }, [inputSelection]);

  const send = useCallback(async () => {
    const raw = text.trim();
    if (!raw) return;
    setSending(true);
    try {
      const mentionUsernames = Array.from(new Set((raw.match(/@[A-Za-z0-9_]{3,20}/g) || []).map((m) => m.slice(1))));
      const mentions: string[] = [];
      members.forEach((m) => { if (mentionUsernames.includes(m.username)) mentions.push(m.user_id); });
      const res = await api.sendRoomMessage(roomId, {
        text: raw,
        reply_to: replyTo?.message_id,
        mentions,
      });
      setMessages((prev) => [...prev, res.message]);
      setText('');
      setReplyTo(null);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e: any) {
      Alert.alert('Send failed', e.message || 'try again');
    } finally { setSending(false); }
  }, [text, replyTo, members, roomId]);

  const sendImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.4, base64: true,
    });
    if (res.canceled || !res.assets[0]?.base64) return;
    const img = `data:image/jpeg;base64,${res.assets[0].base64}`;
    setSending(true);
    try {
      const out = await api.sendRoomMessage(roomId, { image: img });
      setMessages((prev) => [...prev, out.message]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } finally { setSending(false); }
  };

  const startRecording = async () => {
    try {
      const { granted } = await AudioModule.requestRecordingPermissionsAsync();
      if (!granted) { Alert.alert('Microphone', 'Permission required'); return; }
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecording(true);
      setRecordDuration(0);
      recordStart.current = Date.now();
      recordTimer.current = setInterval(() => {
        const elapsed = (Date.now() - recordStart.current) / 1000;
        setRecordDuration(elapsed);
        if (elapsed >= 30) stopRecording();
      }, 100);
    } catch (e: any) { Alert.alert('Record failed', e.message || 'unable to start'); }
  };
  const cancelRecording = async () => {
    clearInterval(recordTimer.current);
    setRecording(false); setRecordDuration(0);
    try { await recorder.stop(); } catch {}
  };
  const stopRecording = async () => {
    clearInterval(recordTimer.current);
    setRecording(false);
    const dur = recordDuration;
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri || dur < 0.5) { setRecordDuration(0); return; }
      const resp = await fetch(uri);
      const blob = await resp.blob();
      const b64 = await new Promise<string>((res) => {
        const reader = new FileReader();
        reader.onloadend = () => res(String(reader.result || ''));
        reader.readAsDataURL(blob);
      });
      setSending(true);
      const out = await api.sendRoomMessage(roomId, { voice: b64, voice_duration: dur });
      setMessages((prev) => [...prev, out.message]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch {} finally { setRecordDuration(0); setSending(false); }
  };

  const onChangeText = (v: string) => {
    setText(v);
    const now = Date.now();
    if (now - typingSentAt.current > 3000) {
      typingSentAt.current = now;
      api.roomTyping(roomId).catch(() => {});
    }
  };

  // ==== SHARE ====
  const inviteLink = useMemo(() => `https://pchat.app/room/${roomId}`, [roomId]);
  const doCopy = async () => {
    await Clipboard.setStringAsync(inviteLink);
    Alert.alert('Copied', 'Invite link copied to clipboard');
  };
  const doNativeShare = async () => {
    try {
      await Share.share({ message: `Join me on Plexa in "${room.name}": ${inviteLink}` });
    } catch {}
  };

  // debounce invite search across all users
  useEffect(() => {
    let cancelled = false;
    if (!showShare) return;
    const q = inviteQ.trim();
    if (!q) { setInviteResults([]); return; }
    const to = setTimeout(async () => {
      try {
        const res = await api.searchUsers(q);
        if (!cancelled) setInviteResults(res.users || []);
      } catch {}
    }, 300);
    return () => { cancelled = true; clearTimeout(to); };
  }, [inviteQ, showShare]);

  const [friends, setFriends] = useState<any[]>([]);
  useEffect(() => {
    if (showShare && friends.length === 0) {
      api.friends().then((r) => setFriends(r.friends || [])).catch(() => {});
    }
  }, [showShare, friends.length]);

  const invite = async (target: any) => {
    try {
      await api.inviteToRoom(roomId, target.user_id);
      Alert.alert('Invited', `Invite sent to @${target.username}`);
    } catch (e: any) {
      Alert.alert('Failed', e.message || 'unable to invite');
    }
  };

  const doJoin = async (pw?: string) => {
    setPasswordErr(null);
    try {
      await api.joinRoom(roomId, pw);
      setShowPasswordModal(false); setPasswordInput('');
      await load();
    } catch (e: any) { setPasswordErr(e.message || 'Failed to join'); }
  };

  const applyWallpaper = async (w: typeof WALLPAPER_PRESETS[number]) => {
    setShowWallpaperSheet(false);
    try { await api.updateRoomSettings(roomId, { wallpaper: w.key === 'none' ? null : w.url }); await load(); } catch {}
  };
  const saveAnnouncement = async () => {
    try { await api.setAnnouncement(roomId, announcementDraft.trim() || null); setShowAnnouncement(false); await load(); } catch {}
  };

  if (loading || !room) {
    return <View style={s.center}><ActivityIndicator color={t.colors.primary} /></View>;
  }

  const isMember = !!membership?.role;
  const isOwner = membership?.role === 'owner' || user?.is_developer;
  const canAdmin = ['owner', 'admin'].includes(membership?.role || '') || user?.is_developer;
  const canChangeWallpaper = ['owner', 'admin', 'moderator'].includes(membership?.role || '') || user?.is_developer;

  // Build compact message list w/ date separators.
  // NOTE (per user requirement): every message renders its own avatar/username/badge — no author grouping.
  const items: any[] = [];
  let prevDate = '';
  messages.forEach((m) => {
    const d = dateLabel(m.created_at);
    if (d !== prevDate) { items.push({ _type: 'sep', label: d, id: 'sep-' + m.message_id }); prevDate = d; }
    m._showAuthor = true;
    items.push(m);
  });

  const wallpaper = room.wallpaper;

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.bg }}>
      {wallpaper ? (
        <ImageBackground source={{ uri: wallpaper }} style={StyleSheet.absoluteFillObject} blurRadius={room.wallpaper_blur ? 15 : 0}>
          <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: t.mode === 'dark' ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.3)' }} />
        </ImageBackground>
      ) : null}

      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        {/* ==== HEADER (name only, no code, no typing, no counts) ==== */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.hIconBtn} testID="room-back">
            <MaterialCommunityIcons name="chevron-left" size={26} color={t.colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.hTitle} numberOfLines={1}>{room.name}</Text>
          </View>
          <TouchableOpacity onPress={() => setTab('members')} style={s.hIconBtn} testID="room-members-btn">
            <MaterialCommunityIcons name="account-multiple" size={20} color={t.colors.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowMenu(true)} style={s.hIconBtn} testID="room-menu">
            <MaterialCommunityIcons name="dots-vertical" size={20} color={t.colors.text} />
          </TouchableOpacity>
        </View>

        {/* Announcement banner */}
        {room.announcement && tab === 'chat' ? (
          <BlurView intensity={30} tint={t.mode === 'dark' ? 'dark' : 'light'} style={s.annBanner}>
            <MaterialCommunityIcons name="bullhorn" size={14} color={t.colors.orange} />
            <Text style={s.annTxt} numberOfLines={2}>{room.announcement}</Text>
            {canAdmin ? (
              <TouchableOpacity onPress={() => { setAnnouncementDraft(room.announcement || ''); setShowAnnouncement(true); }} testID="room-ann-edit">
                <MaterialCommunityIcons name="pencil" size={13} color={t.colors.textDim} />
              </TouchableOpacity>
            ) : null}
          </BlurView>
        ) : null}

        {tab === 'chat' && (
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            {!isMember && !user?.is_developer ? (
              <View style={s.joinCard}>
                <MaterialCommunityIcons name={room.has_password ? 'lock' : 'account-plus'} size={30} color={t.colors.primary} />
                <Text style={s.joinTitle}>Join {room.name}</Text>
                {room.welcome_message ? <Text style={s.joinSub}>{room.welcome_message}</Text> : null}
                <TouchableOpacity onPress={() => (room.has_password ? setShowPasswordModal(true) : doJoin())} style={s.joinBtn} testID="room-join-btn">
                  <Text style={s.joinBtnTxt}>{room.has_password ? 'Enter password' : 'Join Room'}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <FlatList
                  ref={listRef}
                  data={items}
                  keyExtractor={(m: any) => m._type === 'sep' ? m.id : m.message_id}
                  contentContainerStyle={{ paddingHorizontal: 10, paddingVertical: 8, paddingBottom: 12 }}
                  onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
                  onScroll={(e) => {
                    const layout = e.nativeEvent.layoutMeasurement.height;
                    const off = e.nativeEvent.contentOffset.y;
                    const total = e.nativeEvent.contentSize.height;
                    setShowScrollDown(total - (off + layout) > 200);
                  }}
                  scrollEventThrottle={200}
                  renderItem={({ item }: any) => {
                    if (item._type === 'sep') {
                      return (
                        <View style={s.sepWrap}>
                          <View style={s.sepPill}><Text style={s.sepTxt}>{item.label}</Text></View>
                        </View>
                      );
                    }
                    const isHighlighted = highlightId.current === item.message_id;
                    const rawRoleColor = ROLE_COLORS[item.from_role || 'member'];
                    const hasWallpaper = !!wallpaper;
                    const roleColor = rawRoleColor && rawRoleColor.length > 0
                      ? rawRoleColor
                      : (hasWallpaper ? '#FFFFFF' : t.colors.text);
                    // For roles with dark blue color on dark themes, add subtle glow for visibility
                    const nameShadow = hasWallpaper ? {
                      textShadowColor: 'rgba(0,0,0,0.85)',
                      textShadowOffset: { width: 0, height: 1 },
                      textShadowRadius: 3,
                    } : undefined;
                    return (
                      <Animated.View
                        style={[
                          s.msgWrap,
                          { marginTop: 6 },
                          {
                            backgroundColor: highlightAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: ['transparent', t.colors.primaryGlow],
                            }) as any,
                            borderRadius: isHighlighted ? 8 : 0,
                            paddingHorizontal: isHighlighted ? 6 : 0,
                            paddingVertical: isHighlighted ? 4 : 0,
                          },
                        ]}
                      >
                        <Pressable onLongPress={() => setContextMsg(item)}>
                          <View style={s.authorLine}>
                            <TouchableOpacity onPress={() => insertMentionAtCursor(item.from_username)} testID={`tap-user-${item.from_username}`}>
                              <Avatar uri={item.from_avatar} name={item.from_display_name || item.from_username} size={22} />
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => insertMentionAtCursor(item.from_username)}
                              onLongPress={() => setUserSheet({ user_id: item.from_id, username: item.from_username, avatar: item.from_avatar, display_name: item.from_display_name, role: item.from_role })}
                              testID={`username-${item.from_username}`}
                            >
                              <Text style={[s.authorName, { color: roleColor }, nameShadow]}>@{item.from_username}</Text>
                            </TouchableOpacity>
                            {(item.from_badges || []).slice(0, 3).map((b: string) => (
                              <BadgePill key={b} badge={b} mini />
                            ))}
                            <Text style={s.msgTime}>{timeShort(item.created_at)}</Text>
                          </View>
                          {item.reply_to ? (
                            <View style={s.replyPreview}>
                              <MaterialCommunityIcons name="reply" size={10} color={t.colors.textDim} />
                              <Text style={s.replyPreviewTxt} numberOfLines={1}>replied</Text>
                            </View>
                          ) : null}
                          {item.deleted_for_all ? (
                            <Text style={[s.msgText, { fontStyle: 'italic', color: t.colors.textDim }]}>Message deleted</Text>
                          ) : (
                            <View style={s.msgBody}>
                              {item.image ? <Image source={{ uri: item.image }} style={s.msgImage} /> : null}
                              {item.voice ? <VoiceMessage uri={item.voice} duration={item.voice_duration || 0} tint={roleColor} /> : null}
                              {item.text ? <MentionText text={item.text} color={t.colors.text} primary={t.colors.primary} /> : null}
                            </View>
                          )}
                          {Object.keys(item.reactions || {}).length > 0 ? (
                            <View style={s.reactRow}>
                              {Object.entries(item.reactions).filter(([, arr]: any) => arr.length > 0).map(([e, arr]: any) => (
                                <View key={e} style={s.reactChip}>
                                  <Text style={{ fontSize: 11 }}>{e}</Text>
                                  <Text style={s.reactCount}>{arr.length}</Text>
                                </View>
                              ))}
                            </View>
                          ) : null}
                        </Pressable>
                      </Animated.View>
                    );
                  }}
                />

                {showScrollDown ? (
                  <TouchableOpacity onPress={() => listRef.current?.scrollToEnd({ animated: true })} style={[s.scrollDown, { bottom: 88 }]} testID="room-scroll-down">
                    <MaterialCommunityIcons name="chevron-down" size={20} color={t.colors.onPrimary} />
                  </TouchableOpacity>
                ) : null}

                {replyTo ? (
                  <View style={s.replyBar}>
                    <MaterialCommunityIcons name="reply" size={14} color={t.colors.primary} />
                    <Text style={s.replyBarTxt} numberOfLines={1}>{replyTo.text || 'media'}</Text>
                    <TouchableOpacity onPress={() => setReplyTo(null)} testID="reply-cancel">
                      <MaterialCommunityIcons name="close" size={16} color={t.colors.textDim} />
                    </TouchableOpacity>
                  </View>
                ) : null}

                <BlurView intensity={30} tint={t.mode === 'dark' ? 'dark' : 'light'} style={s.inputBar}>
                  {recording ? (
                    <View style={s.recordingBar}>
                      <View style={s.recDot} />
                      <Text style={s.recTxt}>Recording {recordDuration.toFixed(1)}s / 30s</Text>
                      <TouchableOpacity onPress={cancelRecording} style={s.recCancel} testID="room-record-cancel">
                        <MaterialCommunityIcons name="close" size={18} color={t.colors.text} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={stopRecording} style={s.recSend} testID="room-record-send">
                        <MaterialCommunityIcons name="send" size={18} color={t.colors.onPrimary} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <>
                      <TouchableOpacity onPress={sendImage} style={s.iconBtn} testID="room-image">
                        <MaterialCommunityIcons name="image-plus" size={22} color={t.colors.textDim} />
                      </TouchableOpacity>
                      <TextInput
                        ref={inputRef}
                        value={text}
                        onChangeText={onChangeText}
                        onSelectionChange={(e) => setInputSelection(e.nativeEvent.selection)}
                        selection={inputSelection}
                        placeholder="Type a message..."
                        placeholderTextColor={t.colors.textMuted}
                        style={s.input}
                        multiline
                        testID="room-input"
                      />
                      {text.trim().length > 0 ? (
                        <TouchableOpacity onPress={send} disabled={sending} style={s.sendBtn} testID="room-send">
                          <MaterialCommunityIcons name="send" size={20} color={t.colors.onPrimary} />
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity onPress={startRecording} style={s.iconBtn} testID="room-record">
                          <MaterialCommunityIcons name="microphone" size={22} color={t.colors.primary} />
                        </TouchableOpacity>
                      )}
                    </>
                  )}
                </BlurView>
              </>
            )}
          </KeyboardAvoidingView>
        )}

        {tab === 'members' && (() => {
          const activeSince = Date.now() - 120_000;
          const isOnline = (m: any) => m.last_seen && new Date(m.last_seen).getTime() > activeSince;
          const ROLE_ORDER = ['owner', 'admin', 'moderator', 'vip', 'verified', 'member', 'guest'];
          const online = members.filter(isOnline).sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role));
          const offline = members.filter((m) => !isOnline(m)).sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role));
          const renderRow = (item: any) => {
            const roleColor = ROLE_COLORS[item.role] || t.colors.text;
            const dotColor = isOnline(item) ? t.colors.green : t.colors.textMuted;
            return (
              <TouchableOpacity
                key={item.user_id}
                onPress={() => { setTab('chat'); insertMentionAtCursor(item.username); }}
                onLongPress={() => setUserSheet(item)}
                style={s.memRow}
                testID={`member-${item.username}`}
              >
                <View>
                  <Avatar uri={item.avatar} name={item.display_name || item.username} size={36} />
                  <View style={[s.memDot, { backgroundColor: dotColor, borderColor: t.colors.surface1 }]} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[s.memName, { color: roleColor }]}>@{item.username}</Text>
                    {item.role !== 'member' ? (
                      <View style={[s.roleTag, { borderColor: roleColor, backgroundColor: roleColor + '22' }]}>
                        <Text style={[s.roleTagTxt, { color: roleColor }]}>{item.role.toUpperCase()}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={s.memSub} numberOfLines={1}>{item.display_name || item.username}</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={16} color={t.colors.textDim} />
              </TouchableOpacity>
            );
          };
          const grouped = (list: any[]) => {
            const groups: Record<string, any[]> = {};
            list.forEach((m) => { (groups[m.role] = groups[m.role] || []).push(m); });
            return ROLE_ORDER.filter((r) => groups[r]?.length).map((r) => ({ role: r, items: groups[r] }));
          };
          return (
            <ScrollView contentContainerStyle={{ padding: 12, gap: 12, paddingBottom: 40 }}>
              <TouchableOpacity onPress={() => setTab('chat')} style={s.subBack} testID="members-back">
                <MaterialCommunityIcons name="chevron-left" size={20} color={t.colors.text} />
                <Text style={s.subBackTxt}>Back to chat</Text>
              </TouchableOpacity>
              {online.length > 0 && (
                <View>
                  <Text style={s.memSection}>ONLINE · {online.length}</Text>
                  {grouped(online).map((g) => (
                    <View key={g.role} style={{ marginTop: 6 }}>
                      <Text style={s.memRoleLbl}>{g.role.toUpperCase()}</Text>
                      <View style={{ gap: 6 }}>{g.items.map(renderRow)}</View>
                    </View>
                  ))}
                </View>
              )}
              {offline.length > 0 && (
                <View>
                  <Text style={s.memSection}>OFFLINE · {offline.length}</Text>
                  {grouped(offline).map((g) => (
                    <View key={g.role} style={{ marginTop: 6 }}>
                      <Text style={s.memRoleLbl}>{g.role.toUpperCase()}</Text>
                      <View style={{ gap: 6 }}>{g.items.map(renderRow)}</View>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>
          );
        })()}

        {tab === 'info' && (
          <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}>
            <TouchableOpacity onPress={() => setTab('chat')} style={s.subBack} testID="info-back">
              <MaterialCommunityIcons name="chevron-left" size={20} color={t.colors.text} />
              <Text style={s.subBackTxt}>Back to chat</Text>
            </TouchableOpacity>
            <InfoBlock t={t} label="Description" text={room.description || 'No description'} />
            <InfoBlock t={t} label="Rules" text={room.rules || 'No rules set'} />
            <InfoBlock t={t} label="Welcome" text={room.welcome_message || 'No welcome message'} />

            {/* Owner-only: Role Management */}
            {isOwner ? (
              <TouchableOpacity
                onPress={() => router.push(`/room/${roomId}/roles`)}
                style={[s.adminBtn, { borderColor: t.colors.primary + '55', backgroundColor: t.colors.primaryGlow }]}
                testID="room-role-management"
              >
                <MaterialCommunityIcons name="shield-crown" size={18} color={t.colors.primary} />
                <Text style={[s.adminBtnTxt, { color: t.colors.primary }]}>Role Management (Owner)</Text>
                <MaterialCommunityIcons name="chevron-right" size={18} color={t.colors.primary} />
              </TouchableOpacity>
            ) : null}

            {canChangeWallpaper ? (
              <>
                {canAdmin ? (
                  <TouchableOpacity onPress={() => { setAnnouncementDraft(room.announcement || ''); setShowAnnouncement(true); }} style={s.adminBtn} testID="room-set-announcement">
                    <MaterialCommunityIcons name="bullhorn" size={18} color={t.colors.orange} />
                    <Text style={s.adminBtnTxt}>Set announcement</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity onPress={() => setShowWallpaperSheet(true)} style={s.adminBtn} testID="room-change-wallpaper">
                  <MaterialCommunityIcons name="wallpaper" size={18} color={t.colors.blue} />
                  <Text style={s.adminBtnTxt}>Change wallpaper</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={async () => { await api.updateRoomSettings(roomId, { wallpaper_blur: !room.wallpaper_blur }); await load(); }}
                  style={s.adminBtn}
                  testID="room-toggle-blur"
                >
                  <MaterialCommunityIcons name="blur" size={18} color={t.colors.purple} />
                  <Text style={s.adminBtnTxt}>{room.wallpaper_blur ? 'Disable blur' : 'Enable blur'}</Text>
                </TouchableOpacity>
              </>
            ) : null}
            {user?.is_developer ? (
              <>
                <TouchableOpacity onPress={async () => { await api.pinRoom(roomId, !room.pinned); await load(); }} style={[s.adminBtn, { borderColor: t.colors.orange }]} testID="room-dev-pin">
                  <MaterialCommunityIcons name={room.pinned ? 'pin' : 'pin-outline'} size={18} color={t.colors.orange} />
                  <Text style={[s.adminBtnTxt, { color: t.colors.orange }]}>{room.pinned ? 'Unpin (Dev)' : 'Pin room (Dev)'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={async () => { await api.featureRoom(roomId, !room.featured); await load(); }} style={[s.adminBtn, { borderColor: t.colors.orange }]} testID="room-dev-feature">
                  <MaterialCommunityIcons name={room.featured ? 'star' : 'star-outline'} size={18} color={t.colors.orange} />
                  <Text style={[s.adminBtnTxt, { color: t.colors.orange }]}>{room.featured ? 'Unfeature (Dev)' : 'Feature (Dev)'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={async () => { await api.hideRoom(roomId, !room.hidden); await load(); }} style={[s.adminBtn, { borderColor: t.colors.textDim }]} testID="room-dev-hide">
                  <MaterialCommunityIcons name={room.hidden ? 'eye' : 'eye-off'} size={18} color={t.colors.textDim} />
                  <Text style={[s.adminBtnTxt, { color: t.colors.textDim }]}>{room.hidden ? 'Unhide (Dev)' : 'Hide (Dev)'}</Text>
                </TouchableOpacity>
              </>
            ) : null}
            {isMember && membership.role !== 'owner' ? (
              <TouchableOpacity onPress={async () => { await api.leaveRoom(roomId); router.back(); }} style={s.dangerBtn} testID="room-leave-btn">
                <MaterialCommunityIcons name="exit-run" size={18} color={t.colors.primary} />
                <Text style={s.dangerBtnTxt}>Leave room</Text>
              </TouchableOpacity>
            ) : null}
            {membership?.role === 'owner' ? (
              <TouchableOpacity onPress={async () => { await api.deleteRoom(roomId); router.back(); }} style={s.dangerBtn} testID="room-delete-btn">
                <MaterialCommunityIcons name="delete" size={18} color={t.colors.primary} />
                <Text style={s.dangerBtnTxt}>Delete room</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity onPress={() => api.report(roomId, 'room', 'inappropriate')} style={s.reportRow} testID="room-report-btn">
              <MaterialCommunityIcons name="flag-outline" size={16} color={t.colors.textDim} />
              <Text style={s.reportTxt}>Report room</Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {/* Three-dot menu bottom sheet */}
        <Modal visible={showMenu} transparent animationType="slide" onRequestClose={() => setShowMenu(false)}>
          <Pressable style={s.sheetWrap} onPress={() => setShowMenu(false)}>
            <Pressable style={s.sheet} onPress={(e) => e.stopPropagation()}>
              <Text style={s.modalTitle}>{room.name}</Text>
              <SheetAction icon="share-variant" label="Share Room" onPress={() => { setShowMenu(false); setShowShare(true); }} t={t} />
              <SheetAction icon="information-outline" label="About Room" onPress={() => { setShowMenu(false); setTab('info'); }} t={t} />
              {canChangeWallpaper ? (
                <SheetAction icon="wallpaper" label="Change Wallpaper" onPress={() => { setShowMenu(false); setShowWallpaperSheet(true); }} t={t} />
              ) : null}
              {isMember && membership.role !== 'owner' ? (
                <SheetAction
                  icon="exit-run"
                  label="Leave Room"
                  onPress={async () => { setShowMenu(false); await api.leaveRoom(roomId); router.back(); }}
                  t={t}
                  danger
                />
              ) : null}
              <SheetAction
                icon="flag-outline"
                label="Report Room"
                onPress={async () => { setShowMenu(false); await api.report(roomId, 'room', 'inappropriate'); Alert.alert('Reported'); }}
                t={t}
              />
            </Pressable>
          </Pressable>
        </Modal>

        {/* Long-press message → context menu */}
        <Modal visible={!!contextMsg} transparent animationType="fade" onRequestClose={() => setContextMsg(null)}>
          <Pressable style={s.sheetWrap} onPress={() => setContextMsg(null)}>
            <View style={s.sheet}>
              <View style={s.emojiRow}>
                {REACTIONS.map((e) => (
                  <TouchableOpacity
                    key={e}
                    onPress={async () => { await api.react(contextMsg.message_id, e); setContextMsg(null); await load(); }}
                    style={s.emojiBtn}
                    testID={`react-${e}`}
                  >
                    <Text style={{ fontSize: 24 }}>{e}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={s.sheetDivider} />
              <SheetAction icon="reply" label="Reply" onPress={() => { setReplyTo(contextMsg); setContextMsg(null); }} t={t} />
              <SheetAction icon="content-copy" label="Copy" onPress={async () => { await Clipboard.setStringAsync(contextMsg?.text || ''); setContextMsg(null); }} t={t} />
              <SheetAction icon="at" label={`Mention @${contextMsg?.from_username}`} onPress={() => { const uname = contextMsg.from_username; setContextMsg(null); insertMentionAtCursor(uname); }} t={t} />
              {canAdmin || contextMsg?.from_id === user?.user_id ? (
                <SheetAction icon="delete" label="Delete for everyone" onPress={async () => { await api.deleteForAll(contextMsg.message_id); setContextMsg(null); await load(); }} t={t} danger />
              ) : null}
              <SheetAction icon="flag-outline" label="Report" onPress={async () => { await api.report(contextMsg.message_id, 'message', 'inappropriate'); setContextMsg(null); }} t={t} />
            </View>
          </Pressable>
        </Modal>

        {/* Long-press username → 4-option sheet only */}
        <Modal visible={!!userSheet} transparent animationType="slide" onRequestClose={() => setUserSheet(null)}>
          <Pressable style={s.sheetWrap} onPress={() => setUserSheet(null)}>
            <Pressable style={s.sheet} onPress={(e) => e.stopPropagation()}>
              {userSheet ? (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <Avatar uri={userSheet.avatar || userSheet.from_avatar} name={userSheet.display_name || userSheet.username} size={40} />
                    <Text style={[s.msName, { color: ROLE_COLORS[userSheet.role] || t.colors.text }]}>@{userSheet.username || userSheet.from_username}</Text>
                  </View>
                  <SheetAction icon="account" label="View Profile" onPress={() => { setUserSheet(null); router.push(`/user/${userSheet.user_id || userSheet.from_id}`); }} t={t} />
                  <SheetAction icon="account-plus" label="Send Friend Request" onPress={async () => { try { await api.sendRequest(userSheet.user_id || userSheet.from_id); Alert.alert('Sent', 'Friend request sent'); } catch (e: any) { Alert.alert('Failed', e.message || 'try again'); } setUserSheet(null); }} t={t} />
                  <SheetAction icon="chat" label="Send Message" onPress={() => { setUserSheet(null); router.push(`/chat/${userSheet.user_id || userSheet.from_id}`); }} t={t} />
                  <SheetAction icon="content-copy" label="Copy Username" onPress={async () => { await Clipboard.setStringAsync('@' + (userSheet.username || userSheet.from_username || '')); setUserSheet(null); Alert.alert('Copied'); }} t={t} />
                  <SheetAction icon="block-helper" label="Block" onPress={async () => { await api.block(userSheet.user_id || userSheet.from_id); Alert.alert('Blocked', 'User has been blocked'); setUserSheet(null); }} t={t} danger />
                  <SheetAction icon="flag-outline" label="Report" onPress={async () => { await api.report(userSheet.user_id || userSheet.from_id, 'user', 'inappropriate'); Alert.alert('Reported'); setUserSheet(null); }} t={t} />
                </>
              ) : null}
            </Pressable>
          </Pressable>
        </Modal>

        {/* Share sheet */}
        <Modal visible={showShare} transparent animationType="slide" onRequestClose={() => setShowShare(false)}>
          <Pressable style={s.sheetWrap} onPress={() => setShowShare(false)}>
            <Pressable style={[s.sheet, { maxHeight: '85%' }]} onPress={(e) => e.stopPropagation()}>
              <Text style={s.modalTitle}>Share &quot;{room.name}&quot;</Text>
              <View style={s.shareActions}>
                <TouchableOpacity onPress={doCopy} style={s.shareChip} testID="share-copy">
                  <MaterialCommunityIcons name="link-variant" size={20} color={t.colors.text} />
                  <Text style={s.shareChipTxt}>Copy link</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={doNativeShare} style={s.shareChip} testID="share-native">
                  <MaterialCommunityIcons name="share-variant" size={20} color={t.colors.text} />
                  <Text style={s.shareChipTxt}>Share via…</Text>
                </TouchableOpacity>
              </View>

              <Text style={s.shareLabel}>SEARCH USERS</Text>
              <View style={s.searchWrap}>
                <MaterialCommunityIcons name="magnify" size={18} color={t.colors.textDim} />
                <TextInput
                  value={inviteQ}
                  onChangeText={setInviteQ}
                  placeholder="Search @username"
                  placeholderTextColor={t.colors.textMuted}
                  autoCapitalize="none"
                  style={s.searchInput}
                  testID="share-search"
                />
              </View>

              <ScrollView style={{ maxHeight: 300 }} keyboardShouldPersistTaps="handled">
                {inviteQ.trim().length > 0 ? (
                  inviteResults.length === 0 ? (
                    <Text style={s.emptyShare}>No matches</Text>
                  ) : (
                    inviteResults.map((u) => (
                      <View key={u.user_id} style={s.shareRow}>
                        <Avatar uri={u.avatar} name={u.display_name || u.username} size={34} />
                        <View style={{ flex: 1 }}>
                          <Text style={s.shareName}>@{u.username}</Text>
                          <Text style={s.shareDim}>{u.display_name || u.username}</Text>
                        </View>
                        <TouchableOpacity onPress={() => invite(u)} style={s.inviteBtn} testID={`share-invite-${u.username}`}>
                          <Text style={s.inviteBtnTxt}>Invite</Text>
                        </TouchableOpacity>
                      </View>
                    ))
                  )
                ) : (
                  <>
                    <Text style={s.shareLabel}>RECENT FRIENDS</Text>
                    {friends.length === 0 ? (
                      <Text style={s.emptyShare}>No friends yet</Text>
                    ) : (
                      friends.slice(0, 20).map((u) => (
                        <View key={u.user_id} style={s.shareRow}>
                          <Avatar uri={u.avatar} name={u.display_name || u.username} size={34} />
                          <View style={{ flex: 1 }}>
                            <Text style={s.shareName}>@{u.username}</Text>
                            <Text style={s.shareDim}>{u.display_name || u.username}</Text>
                          </View>
                          <TouchableOpacity onPress={() => invite(u)} style={s.inviteBtn} testID={`share-invite-${u.username}`}>
                            <Text style={s.inviteBtnTxt}>Invite</Text>
                          </TouchableOpacity>
                        </View>
                      ))
                    )}
                  </>
                )}
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>

        {/* Password modal */}
        <Modal visible={showPasswordModal} transparent animationType="fade" onRequestClose={() => setShowPasswordModal(false)}>
          <View style={s.sheetWrap}>
            <View style={[s.sheet, { paddingBottom: 24 }]}>
              <Text style={s.modalTitle}>Password required</Text>
              <TextInput
                value={passwordInput}
                onChangeText={setPasswordInput}
                placeholder="Room password"
                placeholderTextColor={t.colors.textMuted}
                secureTextEntry
                style={s.pwInput}
                testID="room-password-input"
              />
              {passwordErr ? <Text style={s.pwErr}>{passwordErr}</Text> : null}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <TouchableOpacity onPress={() => { setShowPasswordModal(false); setPasswordErr(null); }} style={[s.pwBtn, { backgroundColor: t.colors.surface2 }]}>
                  <Text style={[s.pwBtnTxt, { color: t.colors.text }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => doJoin(passwordInput)} style={[s.pwBtn, { backgroundColor: t.colors.primary }]} testID="room-password-submit">
                  <Text style={s.pwBtnTxt}>Join</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Wallpaper picker */}
        <Modal visible={showWallpaperSheet} transparent animationType="slide" onRequestClose={() => setShowWallpaperSheet(false)}>
          <Pressable style={s.sheetWrap} onPress={() => setShowWallpaperSheet(false)}>
            <View style={s.sheet}>
              <Text style={s.modalTitle}>Choose wallpaper</Text>
              <View style={s.wpGrid}>
                {WALLPAPER_PRESETS.map((w) => (
                  <TouchableOpacity key={w.key} onPress={() => applyWallpaper(w)} style={s.wpItem} testID={`wallpaper-${w.key}`}>
                    {w.url ? <Image source={{ uri: w.url }} style={s.wpImg} /> : <View style={[s.wpImg, { backgroundColor: w.color }]} />}
                    <Text style={s.wpLabel}>{w.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </Pressable>
        </Modal>

        {/* Announcement editor */}
        <Modal visible={showAnnouncement} transparent animationType="slide" onRequestClose={() => setShowAnnouncement(false)}>
          <View style={s.sheetWrap}>
            <View style={s.sheet}>
              <Text style={s.modalTitle}>Announcement</Text>
              <TextInput
                value={announcementDraft}
                onChangeText={setAnnouncementDraft}
                placeholder="Pinned message for the whole room..."
                placeholderTextColor={t.colors.textMuted}
                multiline
                style={[s.pwInput, { height: 100, textAlignVertical: 'top' }]}
                testID="room-announcement-input"
              />
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <TouchableOpacity onPress={() => setShowAnnouncement(false)} style={[s.pwBtn, { backgroundColor: t.colors.surface2 }]}>
                  <Text style={[s.pwBtnTxt, { color: t.colors.text }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={saveAnnouncement} style={[s.pwBtn, { backgroundColor: t.colors.primary }]} testID="room-announcement-save">
                  <Text style={s.pwBtnTxt}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

function InfoBlock({ t, label, text }: { t: ReturnType<typeof useTheme>; label: string; text: string }) {
  return (
    <View style={{ padding: 14, backgroundColor: t.colors.surface1, borderRadius: t.radii.lg, borderWidth: 1, borderColor: t.colors.border }}>
      <Text style={{ color: t.colors.textDim, fontSize: 11, fontWeight: '800', letterSpacing: 0.6, marginBottom: 4 }}>{label}</Text>
      <Text style={{ color: t.colors.text, fontSize: 14, lineHeight: 20 }}>{text}</Text>
    </View>
  );
}

function SheetAction({ icon, label, onPress, t, danger }: any) {
  return (
    <TouchableOpacity onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 6 }} testID={`sheet-${icon}`}>
      <MaterialCommunityIcons name={icon} size={20} color={danger ? t.colors.primary : t.colors.text} />
      <Text style={{ color: danger ? t.colors.primary : t.colors.text, fontSize: 15, fontWeight: '600' }}>{label}</Text>
    </TouchableOpacity>
  );
}

function MentionText({ text, color, primary }: { text: string; color: string; primary: string }) {
  const parts = text.split(/(@[A-Za-z0-9_]+)/g);
  return (
    <Text style={{ color, fontSize: 14, lineHeight: 19 }}>
      {parts.map((p, i) => p.startsWith('@')
        ? <Text key={i} style={{ color: primary, fontWeight: '700' }}>{p}</Text>
        : <Text key={i}>{p}</Text>
      )}
    </Text>
  );
}

function VoiceMessage({ uri, duration, tint }: { uri: string; duration: number; tint: string }) {
  const player = useAudioPlayer({ uri });
  const [playing, setPlaying] = useState(false);
  const bars = useMemo(() => Array.from({ length: 20 }, () => 4 + Math.random() * 14), []);
  return (
    <View style={voiceStyles.wrap}>
      <TouchableOpacity
        onPress={() => {
          if (playing) { player.pause(); setPlaying(false); }
          else { player.seekTo(0); player.play(); setPlaying(true); setTimeout(() => setPlaying(false), (duration || 1) * 1000); }
        }}
        style={[voiceStyles.playBtn, { backgroundColor: tint + '33', borderColor: tint }]}
      >
        <MaterialCommunityIcons name={playing ? 'pause' : 'play'} size={14} color={tint} />
      </TouchableOpacity>
      <View style={voiceStyles.waveform}>
        {bars.map((h, i) => <View key={i} style={[voiceStyles.bar, { height: h, backgroundColor: tint + (playing ? 'ff' : '77') }]} />)}
      </View>
      <Text style={[voiceStyles.dur, { color: tint }]}>{duration.toFixed(1)}s</Text>
    </View>
  );
}

const voiceStyles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  playBtn: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  waveform: { flexDirection: 'row', alignItems: 'center', gap: 2, flex: 1 },
  bar: { width: 2, borderRadius: 2 },
  dur: { fontSize: 10, fontWeight: '700', marginLeft: 4 },
});

const makeStyles = (t: ReturnType<typeof useTheme>) => StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, paddingVertical: 6, gap: 2,
    backgroundColor: t.mode === 'dark' ? 'rgba(20,20,24,0.65)' : 'rgba(255,255,255,0.75)',
    borderBottomWidth: 1, borderBottomColor: t.colors.tabBorder,
  },
  hIconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18 },
  hTitle: { color: t.colors.text, fontSize: 16, fontWeight: '800' },
  hSub: { color: t.colors.textDim, fontSize: 11, marginTop: 2 },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: t.colors.green },
  annBanner: {
    marginHorizontal: 10, marginTop: 6, paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 6, overflow: 'hidden',
    borderWidth: 1, borderColor: t.colors.orange + '55',
  },
  annTxt: { flex: 1, color: t.colors.text, fontSize: 12 },
  joinCard: {
    margin: 16, padding: 20, alignItems: 'center', gap: 10,
    backgroundColor: t.colors.glass, borderRadius: t.radii.xl, borderWidth: 1, borderColor: t.colors.tabBorder,
  },
  joinTitle: { color: t.colors.text, fontSize: 18, fontWeight: '800' },
  joinSub: { color: t.colors.textDim, fontSize: 13, textAlign: 'center' },
  joinBtn: { marginTop: 4, paddingHorizontal: 22, paddingVertical: 10, backgroundColor: t.colors.primary, borderRadius: 100 },
  joinBtnTxt: { color: t.colors.onPrimary, fontWeight: '800', fontSize: 13 },
  sepWrap: { alignItems: 'center', marginVertical: 8 },
  sepPill: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100, backgroundColor: t.colors.glass,
    borderWidth: 1, borderColor: t.colors.tabBorder,
  },
  sepTxt: { color: t.colors.textDim, fontSize: 10, fontWeight: '700', letterSpacing: 0.4 },
  msgWrap: { paddingHorizontal: 6 },
  authorLine: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 1, flexWrap: 'wrap' },
  authorName: { fontSize: 13, fontWeight: '800' },
  msgTime: { color: t.colors.textDim, fontSize: 10, marginLeft: 'auto' },
  msgBody: { paddingLeft: 27 }, // indent under avatar
  msgText: { color: t.colors.text, fontSize: 14, lineHeight: 19 },
  msgImage: { width: 200, height: 150, borderRadius: 10, marginTop: 2, marginBottom: 2 },
  replyPreview: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingLeft: 27, marginBottom: 1 },
  replyPreviewTxt: { color: t.colors.textDim, fontSize: 10 },
  reactRow: { flexDirection: 'row', gap: 3, marginTop: 3, flexWrap: 'wrap', paddingLeft: 27 },
  reactChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 100,
    backgroundColor: t.mode === 'dark' ? 'rgba(20,20,24,0.75)' : 'rgba(255,255,255,0.85)',
    borderWidth: 1, borderColor: t.colors.border,
  },
  reactCount: { color: t.colors.textDim, fontSize: 10 },
  scrollDown: {
    position: 'absolute', right: 14, width: 38, height: 38, borderRadius: 19,
    backgroundColor: t.colors.primary, alignItems: 'center', justifyContent: 'center',
    shadowColor: t.colors.primary, shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
  },
  replyBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: t.colors.surface1, borderTopWidth: 1, borderTopColor: t.colors.border,
  },
  replyBarTxt: { flex: 1, color: t.colors.textDim, fontSize: 12 },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 6, paddingHorizontal: 8, paddingVertical: 8,
    borderTopWidth: 1, borderTopColor: t.colors.tabBorder,
    backgroundColor: t.mode === 'dark' ? 'rgba(20,20,24,0.7)' : 'rgba(255,255,255,0.85)',
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  input: {
    flex: 1, backgroundColor: t.colors.surface2, color: t.colors.text,
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, maxHeight: 100,
    borderWidth: 1, borderColor: t.colors.border,
  },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: t.colors.primary, alignItems: 'center', justifyContent: 'center' },
  recordingBar: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8,
    backgroundColor: t.colors.primaryGlow, borderRadius: 100, borderWidth: 1, borderColor: t.colors.primary + '55',
  },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: t.colors.primary },
  recTxt: { flex: 1, color: t.colors.text, fontWeight: '700', fontSize: 13 },
  recCancel: { padding: 6 },
  recSend: { width: 32, height: 32, borderRadius: 16, backgroundColor: t.colors.primary, alignItems: 'center', justifyContent: 'center' },
  subHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: t.colors.tabBorder,
    backgroundColor: t.mode === 'dark' ? 'rgba(20,20,24,0.6)' : 'rgba(255,255,255,0.75)',
  },
  subBack: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  subBackTxt: { color: t.colors.text, fontSize: 14, fontWeight: '600' },
  subTxt: { color: t.colors.textDim, fontSize: 12 },
  memRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10,
    backgroundColor: t.colors.surface1, borderRadius: t.radii.md, borderWidth: 1, borderColor: t.colors.border,
  },
  memDot: {
    position: 'absolute', right: -2, bottom: -2, width: 12, height: 12, borderRadius: 6, borderWidth: 2,
  },
  memSection: { color: t.colors.text, fontSize: 13, fontWeight: '800', letterSpacing: 0.5, marginBottom: 4 },
  memRoleLbl: { color: t.colors.textDim, fontSize: 10, fontWeight: '800', letterSpacing: 0.5, marginBottom: 4 },
  memName: { fontWeight: '800', fontSize: 14 },
  memSub: { color: t.colors.textDim, fontSize: 12, marginTop: 2 },
  roleTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 100, borderWidth: 1 },
  roleTagTxt: { fontSize: 9, fontWeight: '900', letterSpacing: 0.4 },
  msName: { fontSize: 15, fontWeight: '800' },
  adminBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12,
    backgroundColor: t.colors.surface1, borderRadius: t.radii.md, borderWidth: 1, borderColor: t.colors.border,
  },
  adminBtnTxt: { color: t.colors.text, fontWeight: '700', fontSize: 14, flex: 1 },
  dangerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12,
    backgroundColor: t.colors.primaryGlow, borderRadius: t.radii.md, borderWidth: 1, borderColor: t.colors.primary,
  },
  dangerBtnTxt: { color: t.colors.primary, fontWeight: '800', fontSize: 14 },
  reportRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 10 },
  reportTxt: { color: t.colors.textDim, fontSize: 13 },
  sheetWrap: { flex: 1, backgroundColor: t.colors.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: t.colors.surface1, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 16, paddingBottom: 32, gap: 2, borderWidth: 1, borderColor: t.colors.border,
  },
  emojiRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 4 },
  emojiBtn: { padding: 6 },
  sheetDivider: { height: 1, backgroundColor: t.colors.border, marginVertical: 6 },
  modalTitle: { color: t.colors.text, fontSize: 18, fontWeight: '800', marginBottom: 12 },
  shareActions: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  shareChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, backgroundColor: t.colors.surface2, borderRadius: 100, borderWidth: 1, borderColor: t.colors.border,
  },
  shareChipTxt: { color: t.colors.text, fontWeight: '700', fontSize: 13 },
  shareLabel: { color: t.colors.textDim, fontSize: 11, fontWeight: '800', letterSpacing: 0.5, marginTop: 8, marginBottom: 6 },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: t.colors.surface2, borderRadius: 100, borderWidth: 1, borderColor: t.colors.border, marginBottom: 8,
  },
  searchInput: { flex: 1, color: t.colors.text, fontSize: 14 },
  shareRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  shareName: { color: t.colors.text, fontWeight: '700', fontSize: 14 },
  shareDim: { color: t.colors.textDim, fontSize: 12, marginTop: 2 },
  inviteBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: t.colors.primary, borderRadius: 100 },
  inviteBtnTxt: { color: t.colors.onPrimary, fontWeight: '800', fontSize: 12 },
  emptyShare: { color: t.colors.textDim, textAlign: 'center', paddingVertical: 20, fontSize: 13 },
  pwInput: {
    backgroundColor: t.colors.surface2, color: t.colors.text, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, borderWidth: 1, borderColor: t.colors.border,
  },
  pwErr: { color: t.colors.primary, fontSize: 13, marginTop: 6 },
  pwBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 100 },
  pwBtnTxt: { color: '#fff', fontWeight: '800' },
  wpGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  wpItem: { width: '30%', aspectRatio: 1, borderRadius: 12, overflow: 'hidden', alignItems: 'center' },
  wpImg: { width: '100%', height: '80%', borderRadius: 12 },
  wpLabel: { color: t.colors.text, fontSize: 11, marginTop: 4, fontWeight: '600' },
});
