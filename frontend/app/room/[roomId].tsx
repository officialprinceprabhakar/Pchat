// Y99-inspired room chat with wallpaper, floating messages, role-colored usernames,
// mentions autocomplete, voice notes with waveform, pinned announcement, date separators,
// typing indicator, scroll-to-newest, and long-press actions.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView,
  Platform, ActivityIndicator, Image, Modal, ImageBackground, ScrollView, Pressable,
  Animated, Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
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
  developer: '#FF9F0A',
  owner: '#FF453A',
  admin: '#0A84FF',
  moderator: '#30D158',
  verified: '#32ADE6',
  vip: '#FFD60A',
  member: '#F2F2F2',
  guest: '#A1A1A8',
};

const REACTIONS = ['❤️', '😂', '👍', '😮', '😢', '🔥'];

const WALLPAPER_PRESETS = [
  { key: 'none', label: 'Solid', color: '#0A0A0C' },
  { key: 'w1', label: 'Ember', url: 'https://images.unsplash.com/photo-1655841439659-0afc60676b70?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMzV8MHwxfHNlYXJjaHwxfHxkYXJrJTIwYWJzdHJhY3QlMjBwcmVtaXVtJTIwbGFuZHNjYXBlJTIwYmFja2dyb3VuZHxlbnwwfHx8fDE3ODQxOTA1MzN8MA&ixlib=rb-4.1.0&q=85' },
  { key: 'w2', label: 'Wave', url: 'https://images.unsplash.com/photo-1709377058964-929af7f2d02f?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMzV8MHwxfHNlYXJjaHw0fHxkYXJrJTIwYWJzdHJhY3QlMjBwcmVtaXVtJTIwbGFuZHNjYXBlJTIwYmFja2dyb3VuZHxlbnwwfHx8fDE3ODQxOTA1MzN8MA&ixlib=rb-4.1.0&q=85' },
  { key: 'w3', label: 'Ribbon', url: 'https://images.unsplash.com/photo-1651833826115-7530e72ce504?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMzV8MHwxfHNlYXJjaHwyfHxkYXJrJTIwYWJzdHJhY3QlMjBwcmVtaXVtJTIwbGFuZHNjYXBlJTIwYmFja2dyb3VuZHxlbnwwfHx8fDE3ODQxOTA1MzN8MA&ixlib=rb-4.1.0&q=85' },
];

type Section = 'chat' | 'members' | 'info';

function timeShort(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}
function dateLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date(); yest.setDate(yest.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yest.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function RoomScreen() {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const { roomId, highlightMessage } = useLocalSearchParams<{ roomId: string; highlightMessage?: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [room, setRoom] = useState<any>(null);
  const [membership, setMembership] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [tab, setTab] = useState<Section>('chat');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<any>(null);
  const [contextMsg, setContextMsg] = useState<any>(null);
  const [showMemberSheet, setShowMemberSheet] = useState<any>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordErr, setPasswordErr] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [showWallpaperSheet, setShowWallpaperSheet] = useState(false);
  const [showAnnouncement, setShowAnnouncement] = useState(false);
  const [announcementDraft, setAnnouncementDraft] = useState('');
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);

  // voice recording
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

  const load = useCallback(async () => {
    try {
      const r = await api.getRoom(roomId);
      setRoom(r.room);
      setMembership(r.membership);
      const [mm, msgs] = await Promise.all([
        api.roomMembers(roomId).catch(() => ({ members: [] })),
        r.membership?.role || !r.room.is_private
          ? api.roomMessages(roomId).catch(() => ({ messages: [] }))
          : Promise.resolve({ messages: [] }),
      ]);
      setMembers(mm.members || []);
      setMessages(msgs.messages || []);
    } catch (e: any) {
      // password protected on private is fine, ignore
    } finally { setLoading(false); }
  }, [roomId]);

  useEffect(() => { load(); }, [load]);

  // realtime-ish poll: messages + typing
  useEffect(() => {
    if (tab !== 'chat') return;
    pollRef.current = setInterval(async () => {
      try {
        const [msgRes, typ] = await Promise.all([
          api.roomMessages(roomId),
          api.roomTypingList(roomId).catch(() => ({ users: [] })),
        ]);
        setMessages((prev) => (prev.length !== msgRes.messages.length ? msgRes.messages : prev));
        setTypingUsers(typ.users || []);
      } catch {}
    }, 3000);
    return () => clearInterval(pollRef.current);
  }, [tab, roomId]);

  // ask audio perm once
  useEffect(() => {
    (async () => {
      try { await AudioModule.requestRecordingPermissionsAsync(); } catch {}
    })();
  }, []);

  // highlight animation for mention target
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

  const send = useCallback(async () => {
    const raw = text.trim();
    if (!raw && !recording) return;
    setSending(true);
    try {
      // parse @mentions
      const mentionUsernames = Array.from(new Set((raw.match(/@[A-Za-z0-9_]{3,20}/g) || []).map((m) => m.slice(1))));
      const mentions: string[] = [];
      members.forEach((m) => {
        if (mentionUsernames.includes(m.username)) mentions.push(m.user_id);
      });
      const res = await api.sendRoomMessage(roomId, {
        text: raw,
        reply_to: replyTo?.message_id,
        mentions,
      });
      setMessages((prev) => [...prev, res.message]);
      setText('');
      setReplyTo(null);
      setMentionQuery(null);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e: any) {
      Alert.alert('Send failed', e.message || 'Please try again.');
    } finally { setSending(false); }
  }, [text, replyTo, members, roomId, recording]);

  const sendImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, quality: 0.4, base64: true,
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
    } catch (e: any) {
      Alert.alert('Record failed', e.message || 'unable to start');
    }
  };

  const cancelRecording = async () => {
    clearInterval(recordTimer.current);
    setRecording(false);
    setRecordDuration(0);
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
      // convert to base64
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
    } catch (e: any) {
      // ignore
    } finally {
      setRecordDuration(0);
      setSending(false);
    }
  };

  const onChangeText = (v: string) => {
    setText(v);
    // debounce typing
    const now = Date.now();
    if (now - typingSentAt.current > 3000) {
      typingSentAt.current = now;
      api.roomTyping(roomId).catch(() => {});
    }
    // mention autocomplete
    const cursor = v.slice(-30);
    const m = cursor.match(/@([A-Za-z0-9_]{0,20})$/);
    setMentionQuery(m ? m[1] : null);
  };

  const insertMention = (uname: string) => {
    const newText = text.replace(/@([A-Za-z0-9_]{0,20})$/, `@${uname} `);
    setText(newText);
    setMentionQuery(null);
    inputRef.current?.focus();
  };

  const doJoin = async (pw?: string) => {
    setPasswordErr(null);
    try {
      await api.joinRoom(roomId, pw);
      setShowPasswordModal(false);
      setPasswordInput('');
      await load();
    } catch (e: any) {
      setPasswordErr(e.message || 'Failed to join');
    }
  };

  const applyWallpaper = async (w: typeof WALLPAPER_PRESETS[number]) => {
    setShowWallpaperSheet(false);
    try {
      await api.updateRoomSettings(roomId, {
        wallpaper: w.key === 'none' ? null : w.url,
      });
      await load();
    } catch {}
  };

  const saveAnnouncement = async () => {
    try {
      await api.setAnnouncement(roomId, announcementDraft.trim() || null);
      setShowAnnouncement(false);
      await load();
    } catch {}
  };

  if (loading || !room) {
    return <View style={styles.center}><ActivityIndicator color={t.colors.primary} /></View>;
  }

  const isMember = !!membership?.role;
  const canModerate = ['owner', 'admin', 'moderator', 'developer'].includes(membership?.role || '') || user?.is_developer;
  const canAdmin = ['owner', 'admin'].includes(membership?.role || '') || user?.is_developer;

  // Filter members for mention autocomplete
  const mentionMatches = mentionQuery !== null
    ? members.filter((m) => m.user_id !== user?.user_id && m.username.toLowerCase().startsWith(mentionQuery.toLowerCase())).slice(0, 5)
    : [];

  // build message list with date separators + author grouping
  const withSeparators: any[] = [];
  let prevDate = '';
  let prevAuthor = '';
  messages.forEach((m) => {
    const d = dateLabel(m.created_at);
    if (d !== prevDate) {
      withSeparators.push({ _type: 'sep', label: d, id: 'sep-' + m.message_id });
      prevDate = d;
      prevAuthor = '';
    }
    m._showAuthor = prevAuthor !== m.from_id;
    withSeparators.push(m);
    prevAuthor = m.from_id;
  });

  const wallpaper = room.wallpaper;
  const wallpaperBlur = room.wallpaper_blur;

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.bg }}>
      {/* Wallpaper layer */}
      {wallpaper ? (
        <ImageBackground source={{ uri: wallpaper }} style={StyleSheet.absoluteFillObject} blurRadius={wallpaperBlur ? 15 : 0}>
          <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: t.mode === 'dark' ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.3)' }} />
        </ImageBackground>
      ) : null}

      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.hIconBtn} testID="room-back">
            <MaterialCommunityIcons name="chevron-left" size={26} color={t.colors.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setTab('info')} style={{ flex: 1 }}>
            <Text style={styles.hTitle} numberOfLines={1}>{room.name}</Text>
            <Text style={styles.hSub} numberOfLines={1}>
              {room.room_code} · {room.member_count} members
              {typingUsers.length > 0 ? ` · ${typingUsers.slice(0, 2).join(', ')} typing…` : ''}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setTab('members')} style={styles.hIconBtn} testID="room-members-btn">
            <MaterialCommunityIcons name="account-multiple" size={20} color={t.colors.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setTab('info')} style={styles.hIconBtn} testID="room-info-btn">
            <MaterialCommunityIcons name="dots-vertical" size={20} color={t.colors.text} />
          </TouchableOpacity>
        </View>

        {/* Announcement banner */}
        {room.announcement && tab === 'chat' ? (
          <BlurView intensity={30} tint={t.mode === 'dark' ? 'dark' : 'light'} style={styles.annBanner}>
            <MaterialCommunityIcons name="bullhorn" size={16} color={t.colors.orange} />
            <Text style={styles.annTxt} numberOfLines={2}>{room.announcement}</Text>
            {canAdmin ? (
              <TouchableOpacity onPress={() => { setAnnouncementDraft(room.announcement || ''); setShowAnnouncement(true); }} testID="room-ann-edit">
                <MaterialCommunityIcons name="pencil" size={14} color={t.colors.textDim} />
              </TouchableOpacity>
            ) : null}
          </BlurView>
        ) : null}

        {tab === 'chat' && (
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            {!isMember && !user?.is_developer ? (
              <View style={styles.joinCard}>
                <MaterialCommunityIcons name={room.has_password ? 'lock' : 'account-plus'} size={32} color={t.colors.primary} />
                <Text style={styles.joinTitle}>Join {room.name}</Text>
                {room.welcome_message ? <Text style={styles.joinSub}>{room.welcome_message}</Text> : null}
                <TouchableOpacity
                  onPress={() => (room.has_password ? setShowPasswordModal(true) : doJoin())}
                  style={styles.joinBtn}
                  testID="room-join-btn"
                >
                  <Text style={styles.joinBtnTxt}>{room.has_password ? 'Enter password' : 'Join Room'}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <FlatList
                  ref={listRef}
                  data={withSeparators}
                  keyExtractor={(m: any) => m._type === 'sep' ? m.id : m.message_id}
                  contentContainerStyle={{ padding: 12, paddingBottom: 16 }}
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
                        <View style={styles.sepWrap}>
                          <View style={styles.sepPill}>
                            <Text style={styles.sepTxt}>{item.label}</Text>
                          </View>
                        </View>
                      );
                    }
                    const isHighlighted = highlightId.current === item.message_id;
                    const roleColor = ROLE_COLORS[item.from_role || 'member'] || t.colors.text;
                    const isMine = item.from_id === user?.user_id;
                    return (
                      <Pressable
                        onLongPress={() => setContextMsg(item)}
                        style={[styles.msgRow, item._showAuthor ? { marginTop: 10 } : { marginTop: 2 }]}
                      >
                        <TouchableOpacity onPress={() => setShowMemberSheet(item)}>
                          {item._showAuthor ? (
                            <Avatar uri={item.from_avatar} name={item.from_display_name || item.from_username} size={32} />
                          ) : (
                            <View style={{ width: 32 }} />
                          )}
                        </TouchableOpacity>
                        <Animated.View
                          style={[
                            styles.msgBubble,
                            {
                              backgroundColor: highlightAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [t.colors.glass, t.colors.primaryGlow],
                              }) as any,
                              borderColor: isHighlighted ? t.colors.primary : t.colors.tabBorder,
                            },
                          ]}
                        >
                          {item._showAuthor ? (
                            <View style={styles.authorLine}>
                              <TouchableOpacity onPress={() => setShowMemberSheet(item)}>
                                <Text style={[styles.authorName, { color: roleColor }]}>@{item.from_username}</Text>
                              </TouchableOpacity>
                              {(item.from_badges || []).slice(0, 2).map((b: string) => (
                                <BadgePill key={b} badge={b} mini />
                              ))}
                              <Text style={styles.msgTime}>{timeShort(item.created_at)}</Text>
                            </View>
                          ) : null}
                          {item.reply_to ? (
                            <View style={styles.replyPreview}>
                              <MaterialCommunityIcons name="reply" size={11} color={t.colors.textDim} />
                              <Text style={styles.replyPreviewTxt} numberOfLines={1}>replied</Text>
                            </View>
                          ) : null}
                          {item.deleted_for_all ? (
                            <Text style={[styles.msgText, { fontStyle: 'italic', color: t.colors.textDim }]}>Message deleted</Text>
                          ) : (
                            <>
                              {item.image ? (
                                <Image source={{ uri: item.image }} style={styles.msgImage} />
                              ) : null}
                              {item.voice ? (
                                <VoiceMessage uri={item.voice} duration={item.voice_duration || 0} tint={roleColor} />
                              ) : null}
                              {item.text ? (
                                <MentionText text={item.text} isMine={isMine} color={t.colors.text} primary={t.colors.primary} />
                              ) : null}
                            </>
                          )}
                          {Object.keys(item.reactions || {}).length > 0 ? (
                            <View style={styles.reactRow}>
                              {Object.entries(item.reactions).filter(([, arr]: any) => arr.length > 0).map(([e, arr]: any) => (
                                <View key={e} style={styles.reactChip}>
                                  <Text style={{ fontSize: 12 }}>{e}</Text>
                                  <Text style={styles.reactCount}>{arr.length}</Text>
                                </View>
                              ))}
                            </View>
                          ) : null}
                        </Animated.View>
                      </Pressable>
                    );
                  }}
                />

                {/* Scroll-to-newest floating btn */}
                {showScrollDown ? (
                  <TouchableOpacity
                    onPress={() => listRef.current?.scrollToEnd({ animated: true })}
                    style={[styles.scrollDown, { bottom: 90 }]}
                    testID="room-scroll-down"
                  >
                    <MaterialCommunityIcons name="chevron-down" size={20} color={t.colors.onPrimary} />
                  </TouchableOpacity>
                ) : null}

                {/* Mention autocomplete */}
                {mentionMatches.length > 0 ? (
                  <BlurView intensity={40} tint={t.mode === 'dark' ? 'dark' : 'light'} style={styles.mentionPop}>
                    {mentionMatches.map((m) => (
                      <TouchableOpacity
                        key={m.user_id}
                        onPress={() => insertMention(m.username)}
                        style={styles.mentionRow}
                        testID={`mention-${m.username}`}
                      >
                        <Avatar uri={m.avatar} name={m.display_name || m.username} size={28} />
                        <Text style={[styles.mentionName, { color: ROLE_COLORS[m.role] || t.colors.text }]}>@{m.username}</Text>
                        <Text style={styles.mentionRole}>{m.role}</Text>
                      </TouchableOpacity>
                    ))}
                  </BlurView>
                ) : null}

                {/* Reply preview */}
                {replyTo ? (
                  <View style={styles.replyBar}>
                    <MaterialCommunityIcons name="reply" size={16} color={t.colors.primary} />
                    <Text style={styles.replyBarTxt} numberOfLines={1}>{replyTo.text || 'media'}</Text>
                    <TouchableOpacity onPress={() => setReplyTo(null)} testID="reply-cancel">
                      <MaterialCommunityIcons name="close" size={16} color={t.colors.textDim} />
                    </TouchableOpacity>
                  </View>
                ) : null}

                {/* Input bar */}
                <BlurView intensity={30} tint={t.mode === 'dark' ? 'dark' : 'light'} style={styles.inputBar}>
                  {recording ? (
                    <View style={styles.recordingBar}>
                      <View style={styles.recDot} />
                      <Text style={styles.recTxt}>Recording {recordDuration.toFixed(1)}s / 30s</Text>
                      <TouchableOpacity onPress={cancelRecording} style={styles.recCancel} testID="room-record-cancel">
                        <MaterialCommunityIcons name="close" size={18} color={t.colors.text} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={stopRecording} style={styles.recSend} testID="room-record-send">
                        <MaterialCommunityIcons name="send" size={18} color={t.colors.onPrimary} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <>
                      <TouchableOpacity onPress={sendImage} style={styles.iconBtn} testID="room-image">
                        <MaterialCommunityIcons name="image-plus" size={22} color={t.colors.textDim} />
                      </TouchableOpacity>
                      <TextInput
                        ref={inputRef}
                        value={text}
                        onChangeText={onChangeText}
                        placeholder="Type a message... (@ to mention)"
                        placeholderTextColor={t.colors.textMuted}
                        style={styles.input}
                        multiline
                        testID="room-input"
                      />
                      {text.trim().length > 0 ? (
                        <TouchableOpacity onPress={send} disabled={sending} style={styles.sendBtn} testID="room-send">
                          <MaterialCommunityIcons name="send" size={20} color={t.colors.onPrimary} />
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity onPress={startRecording} style={styles.iconBtn} testID="room-record">
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

        {tab === 'members' && (
          <>
            <View style={styles.subHead}>
              <TouchableOpacity onPress={() => setTab('chat')} style={styles.subBack} testID="members-back">
                <MaterialCommunityIcons name="chevron-left" size={20} color={t.colors.text} />
                <Text style={styles.subBackTxt}>Back to chat</Text>
              </TouchableOpacity>
              <Text style={styles.subTxt}>{members.length} members</Text>
            </View>
            <FlatList
              data={members}
              keyExtractor={(m) => m.user_id}
              contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 120 + insets.bottom }}
              renderItem={({ item }) => {
                const roleColor = ROLE_COLORS[item.role] || t.colors.text;
                return (
                  <TouchableOpacity
                    onPress={() => setShowMemberSheet(item)}
                    style={styles.memRow}
                    testID={`member-${item.username}`}
                  >
                    <Avatar uri={item.avatar} name={item.display_name || item.username} size={40} />
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[styles.memName, { color: roleColor }]}>@{item.username}</Text>
                        {item.role !== 'member' ? (
                          <View style={[styles.roleTag, { borderColor: roleColor, backgroundColor: roleColor + '22' }]}>
                            <Text style={[styles.roleTagTxt, { color: roleColor }]}>{item.role.toUpperCase()}</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={styles.memSub} numberOfLines={1}>{item.display_name || item.username}</Text>
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={18} color={t.colors.textDim} />
                  </TouchableOpacity>
                );
              }}
            />
          </>
        )}

        {tab === 'info' && (
          <ScrollView contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 120 + insets.bottom }}>
            <TouchableOpacity onPress={() => setTab('chat')} style={styles.subBack} testID="info-back">
              <MaterialCommunityIcons name="chevron-left" size={20} color={t.colors.text} />
              <Text style={styles.subBackTxt}>Back to chat</Text>
            </TouchableOpacity>
            <InfoBlock t={t} label="Description" text={room.description || 'No description'} />
            <InfoBlock t={t} label="Rules" text={room.rules || 'No rules set'} />
            <InfoBlock t={t} label="Welcome" text={room.welcome_message || 'No welcome message'} />
            {canAdmin ? (
              <>
                <TouchableOpacity
                  onPress={() => { setAnnouncementDraft(room.announcement || ''); setShowAnnouncement(true); }}
                  style={styles.adminBtn}
                  testID="room-set-announcement"
                >
                  <MaterialCommunityIcons name="bullhorn" size={18} color={t.colors.orange} />
                  <Text style={styles.adminBtnTxt}>Set announcement</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowWallpaperSheet(true)} style={styles.adminBtn} testID="room-change-wallpaper">
                  <MaterialCommunityIcons name="wallpaper" size={18} color={t.colors.blue} />
                  <Text style={styles.adminBtnTxt}>Change wallpaper</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={async () => { await api.updateRoomSettings(roomId, { wallpaper_blur: !room.wallpaper_blur }); await load(); }}
                  style={styles.adminBtn}
                  testID="room-toggle-blur"
                >
                  <MaterialCommunityIcons name="blur" size={18} color={t.colors.purple} />
                  <Text style={styles.adminBtnTxt}>{room.wallpaper_blur ? 'Disable blur' : 'Enable blur'}</Text>
                </TouchableOpacity>
              </>
            ) : null}
            {user?.is_developer ? (
              <>
                <TouchableOpacity
                  onPress={async () => { await api.pinRoom(roomId, !room.pinned); await load(); }}
                  style={[styles.adminBtn, { borderColor: t.colors.orange }]}
                  testID="room-dev-pin"
                >
                  <MaterialCommunityIcons name={room.pinned ? 'pin' : 'pin-outline'} size={18} color={t.colors.orange} />
                  <Text style={[styles.adminBtnTxt, { color: t.colors.orange }]}>{room.pinned ? 'Unpin (Dev)' : 'Pin room (Dev)'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={async () => { await api.featureRoom(roomId, !room.featured); await load(); }}
                  style={[styles.adminBtn, { borderColor: t.colors.orange }]}
                  testID="room-dev-feature"
                >
                  <MaterialCommunityIcons name={room.featured ? 'star' : 'star-outline'} size={18} color={t.colors.orange} />
                  <Text style={[styles.adminBtnTxt, { color: t.colors.orange }]}>{room.featured ? 'Unfeature (Dev)' : 'Feature (Dev)'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={async () => { await api.hideRoom(roomId, !room.hidden); await load(); }}
                  style={[styles.adminBtn, { borderColor: t.colors.textDim }]}
                  testID="room-dev-hide"
                >
                  <MaterialCommunityIcons name={room.hidden ? 'eye' : 'eye-off'} size={18} color={t.colors.textDim} />
                  <Text style={[styles.adminBtnTxt, { color: t.colors.textDim }]}>{room.hidden ? 'Unhide (Dev)' : 'Hide (Dev)'}</Text>
                </TouchableOpacity>
              </>
            ) : null}
            {isMember && membership.role !== 'owner' ? (
              <TouchableOpacity onPress={async () => { await api.leaveRoom(roomId); router.back(); }} style={styles.dangerBtn} testID="room-leave-btn">
                <MaterialCommunityIcons name="exit-run" size={18} color={t.colors.primary} />
                <Text style={styles.dangerBtnTxt}>Leave room</Text>
              </TouchableOpacity>
            ) : null}
            {membership?.role === 'owner' ? (
              <TouchableOpacity onPress={async () => { await api.deleteRoom(roomId); router.back(); }} style={styles.dangerBtn} testID="room-delete-btn">
                <MaterialCommunityIcons name="delete" size={18} color={t.colors.primary} />
                <Text style={styles.dangerBtnTxt}>Delete room</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity onPress={() => api.report(roomId, 'room', 'inappropriate')} style={styles.reportRow} testID="room-report-btn">
              <MaterialCommunityIcons name="flag-outline" size={16} color={t.colors.textDim} />
              <Text style={styles.reportTxt}>Report room</Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {/* Long-press context menu */}
        <Modal visible={!!contextMsg} transparent animationType="fade" onRequestClose={() => setContextMsg(null)}>
          <Pressable style={styles.sheetWrap} onPress={() => setContextMsg(null)}>
            <View style={styles.sheet}>
              <View style={styles.emojiRow}>
                {REACTIONS.map((e) => (
                  <TouchableOpacity
                    key={e}
                    onPress={async () => { await api.react(contextMsg.message_id, e); setContextMsg(null); await load(); }}
                    style={styles.emojiBtn}
                    testID={`react-${e}`}
                  >
                    <Text style={{ fontSize: 24 }}>{e}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.sheetDivider} />
              <SheetAction icon="reply" label="Reply" onPress={() => { setReplyTo(contextMsg); setContextMsg(null); }} t={t} />
              <SheetAction icon="content-copy" label="Copy" onPress={async () => { await Clipboard.setStringAsync(contextMsg?.text || ''); setContextMsg(null); }} t={t} />
              <SheetAction icon="at" label={`Mention @${contextMsg?.from_username}`} onPress={() => { setText((v) => `${v}@${contextMsg.from_username} `); setContextMsg(null); inputRef.current?.focus(); }} t={t} />
              {canModerate || contextMsg?.from_id === user?.user_id ? (
                <SheetAction icon="delete" label="Delete for everyone" onPress={async () => { await api.deleteForAll(contextMsg.message_id); setContextMsg(null); await load(); }} t={t} danger />
              ) : null}
              <SheetAction icon="flag-outline" label="Report" onPress={async () => { await api.report(contextMsg.message_id, 'message', 'inappropriate'); setContextMsg(null); }} t={t} />
            </View>
          </Pressable>
        </Modal>

        {/* Member profile mini-sheet */}
        <Modal visible={!!showMemberSheet} transparent animationType="slide" onRequestClose={() => setShowMemberSheet(null)}>
          <Pressable style={styles.sheetWrap} onPress={() => setShowMemberSheet(null)}>
            <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
              {showMemberSheet ? (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <Avatar uri={showMemberSheet.avatar || showMemberSheet.from_avatar} name={showMemberSheet.display_name || showMemberSheet.username || showMemberSheet.from_display_name} size={48} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.msName, { color: ROLE_COLORS[showMemberSheet.role || showMemberSheet.from_role] || t.colors.text }]}>
                        @{showMemberSheet.username || showMemberSheet.from_username}
                      </Text>
                      <Text style={styles.msRole}>{showMemberSheet.role || showMemberSheet.from_role || 'member'}</Text>
                    </View>
                  </View>
                  <SheetAction icon="account" label="Open profile" onPress={() => { const uid = showMemberSheet.user_id || showMemberSheet.from_id; setShowMemberSheet(null); router.push(`/user/${uid}`); }} t={t} />
                  <SheetAction icon="at" label="Mention" onPress={() => { setText((v) => `${v}@${showMemberSheet.username || showMemberSheet.from_username} `); setShowMemberSheet(null); inputRef.current?.focus(); }} t={t} />
                  <SheetAction icon="account-plus" label="Add friend" onPress={async () => { try { await api.sendRequest(showMemberSheet.user_id || showMemberSheet.from_id); } catch {} setShowMemberSheet(null); }} t={t} />
                  <SheetAction icon="block-helper" label="Block" onPress={async () => { await api.block(showMemberSheet.user_id || showMemberSheet.from_id); setShowMemberSheet(null); }} t={t} danger />
                  {canAdmin && showMemberSheet.user_id !== room.owner_id ? (
                    <>
                      <View style={styles.sheetDivider} />
                      <Text style={styles.modLabel}>MODERATION</Text>
                      <SheetAction icon="account-remove-outline" label="Kick" onPress={async () => { await api.kick(roomId, showMemberSheet.user_id); setShowMemberSheet(null); await load(); }} t={t} />
                      <SheetAction icon="volume-off" label="Mute" onPress={async () => { await api.mute(roomId, showMemberSheet.user_id); setShowMemberSheet(null); await load(); }} t={t} />
                      {membership?.role === 'owner' || user?.is_developer ? (
                        <>
                          <SheetAction icon="shield-star" label="Make admin" onPress={async () => { await api.setRoomRole(roomId, showMemberSheet.user_id, 'admin'); setShowMemberSheet(null); await load(); }} t={t} />
                          <SheetAction icon="shield" label="Make moderator" onPress={async () => { await api.setRoomRole(roomId, showMemberSheet.user_id, 'moderator'); setShowMemberSheet(null); await load(); }} t={t} />
                          <SheetAction icon="star" label="Make VIP" onPress={async () => { await api.setRoomRole(roomId, showMemberSheet.user_id, 'vip'); setShowMemberSheet(null); await load(); }} t={t} />
                        </>
                      ) : null}
                      <SheetAction icon="gavel" label="Ban from room" onPress={async () => { await api.banFromRoom(roomId, showMemberSheet.user_id); setShowMemberSheet(null); await load(); }} t={t} danger />
                    </>
                  ) : null}
                </>
              ) : null}
            </Pressable>
          </Pressable>
        </Modal>

        {/* Password modal */}
        <Modal visible={showPasswordModal} transparent animationType="fade" onRequestClose={() => setShowPasswordModal(false)}>
          <View style={styles.sheetWrap}>
            <View style={[styles.sheet, { paddingBottom: 24 }]}>
              <Text style={styles.modalTitle}>Password required</Text>
              <TextInput
                value={passwordInput}
                onChangeText={setPasswordInput}
                placeholder="Room password"
                placeholderTextColor={t.colors.textMuted}
                secureTextEntry
                style={styles.pwInput}
                testID="room-password-input"
              />
              {passwordErr ? <Text style={styles.pwErr}>{passwordErr}</Text> : null}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <TouchableOpacity onPress={() => { setShowPasswordModal(false); setPasswordErr(null); }} style={[styles.pwBtn, { backgroundColor: t.colors.surface2 }]}>
                  <Text style={[styles.pwBtnTxt, { color: t.colors.text }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => doJoin(passwordInput)} style={[styles.pwBtn, { backgroundColor: t.colors.primary }]} testID="room-password-submit">
                  <Text style={styles.pwBtnTxt}>Join</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Wallpaper picker */}
        <Modal visible={showWallpaperSheet} transparent animationType="slide" onRequestClose={() => setShowWallpaperSheet(false)}>
          <Pressable style={styles.sheetWrap} onPress={() => setShowWallpaperSheet(false)}>
            <View style={styles.sheet}>
              <Text style={styles.modalTitle}>Choose wallpaper</Text>
              <View style={styles.wpGrid}>
                {WALLPAPER_PRESETS.map((w) => (
                  <TouchableOpacity key={w.key} onPress={() => applyWallpaper(w)} style={styles.wpItem} testID={`wallpaper-${w.key}`}>
                    {w.url ? (
                      <Image source={{ uri: w.url }} style={styles.wpImg} />
                    ) : (
                      <View style={[styles.wpImg, { backgroundColor: w.color }]} />
                    )}
                    <Text style={styles.wpLabel}>{w.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </Pressable>
        </Modal>

        {/* Announcement editor */}
        <Modal visible={showAnnouncement} transparent animationType="slide" onRequestClose={() => setShowAnnouncement(false)}>
          <View style={styles.sheetWrap}>
            <View style={styles.sheet}>
              <Text style={styles.modalTitle}>Announcement</Text>
              <TextInput
                value={announcementDraft}
                onChangeText={setAnnouncementDraft}
                placeholder="Pinned message for the whole room..."
                placeholderTextColor={t.colors.textMuted}
                multiline
                style={[styles.pwInput, { height: 100, textAlignVertical: 'top' }]}
                testID="room-announcement-input"
              />
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <TouchableOpacity onPress={() => setShowAnnouncement(false)} style={[styles.pwBtn, { backgroundColor: t.colors.surface2 }]}>
                  <Text style={[styles.pwBtnTxt, { color: t.colors.text }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={saveAnnouncement} style={[styles.pwBtn, { backgroundColor: t.colors.primary }]} testID="room-announcement-save">
                  <Text style={styles.pwBtnTxt}>Save</Text>
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
    <View style={{ padding: 16, backgroundColor: t.colors.surface1, borderRadius: t.radii.lg, borderWidth: 1, borderColor: t.colors.border }}>
      <Text style={{ color: t.colors.textDim, fontSize: 11, fontWeight: '800', letterSpacing: 0.6, marginBottom: 6 }}>{label}</Text>
      <Text style={{ color: t.colors.text, fontSize: 14, lineHeight: 20 }}>{text}</Text>
    </View>
  );
}

function SheetAction({ icon, label, onPress, t, danger }: any) {
  return (
    <TouchableOpacity onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 }} testID={`sheet-${icon}`}>
      <MaterialCommunityIcons name={icon} size={20} color={danger ? t.colors.primary : t.colors.text} />
      <Text style={{ color: danger ? t.colors.primary : t.colors.text, fontSize: 15, fontWeight: '600' }}>{label}</Text>
    </TouchableOpacity>
  );
}

function MentionText({ text, color, primary }: { text: string; isMine?: boolean; color: string; primary: string }) {
  const parts = text.split(/(@[A-Za-z0-9_]+)/g);
  return (
    <Text style={{ color, fontSize: 15, lineHeight: 20 }}>
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
  const bars = useMemo(() => Array.from({ length: 24 }, () => 6 + Math.random() * 18), []);
  return (
    <View style={voiceStyles.wrap}>
      <TouchableOpacity
        onPress={() => {
          if (playing) { player.pause(); setPlaying(false); }
          else { player.seekTo(0); player.play(); setPlaying(true); setTimeout(() => setPlaying(false), (duration || 1) * 1000); }
        }}
        style={[voiceStyles.playBtn, { backgroundColor: tint + '33', borderColor: tint }]}
      >
        <MaterialCommunityIcons name={playing ? 'pause' : 'play'} size={16} color={tint} />
      </TouchableOpacity>
      <View style={voiceStyles.waveform}>
        {bars.map((h, i) => (
          <View key={i} style={[voiceStyles.bar, { height: h, backgroundColor: tint + (playing ? 'ff' : '77') }]} />
        ))}
      </View>
      <Text style={[voiceStyles.dur, { color: tint }]}>{duration.toFixed(1)}s</Text>
    </View>
  );
}

const voiceStyles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  playBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  waveform: { flexDirection: 'row', alignItems: 'center', gap: 2, flex: 1 },
  bar: { width: 3, borderRadius: 2 },
  dur: { fontSize: 11, fontWeight: '700', marginLeft: 4 },
});

const makeStyles = (t: ReturnType<typeof useTheme>) => StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 8, gap: 4,
    backgroundColor: t.mode === 'dark' ? 'rgba(20,20,24,0.65)' : 'rgba(255,255,255,0.75)',
    borderBottomWidth: 1, borderBottomColor: t.colors.tabBorder,
  },
  hIconBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19 },
  hTitle: { color: t.colors.text, fontSize: 16, fontWeight: '800' },
  hSub: { color: t.colors.textDim, fontSize: 11, marginTop: 2 },
  annBanner: {
    marginHorizontal: 12, marginTop: 8, paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 8, overflow: 'hidden',
    borderWidth: 1, borderColor: t.colors.orange + '55',
  },
  annTxt: { flex: 1, color: t.colors.text, fontSize: 12 },
  joinCard: {
    margin: 20, padding: 24, alignItems: 'center', gap: 12,
    backgroundColor: t.colors.glass, borderRadius: t.radii.xl, borderWidth: 1, borderColor: t.colors.tabBorder,
  },
  joinTitle: { color: t.colors.text, fontSize: 20, fontWeight: '800' },
  joinSub: { color: t.colors.textDim, fontSize: 13, textAlign: 'center' },
  joinBtn: {
    marginTop: 6, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: t.colors.primary, borderRadius: 100,
  },
  joinBtnTxt: { color: t.colors.onPrimary, fontWeight: '800', fontSize: 14 },
  sepWrap: { alignItems: 'center', marginVertical: 12 },
  sepPill: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100, backgroundColor: t.colors.glass,
    borderWidth: 1, borderColor: t.colors.tabBorder,
  },
  sepTxt: { color: t.colors.textDim, fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
  msgRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', paddingHorizontal: 4 },
  msgBubble: {
    flex: 1, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16,
    borderWidth: 1, borderColor: t.colors.tabBorder,
    backgroundColor: t.mode === 'dark' ? 'rgba(20,20,24,0.7)' : 'rgba(255,255,255,0.85)',
  },
  authorLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' },
  authorName: { fontSize: 13, fontWeight: '800' },
  msgTime: { color: t.colors.textDim, fontSize: 10, marginLeft: 'auto' },
  msgText: { color: t.colors.text, fontSize: 15, lineHeight: 20 },
  msgImage: { width: '100%', maxWidth: 240, height: 180, borderRadius: 12, marginTop: 2 },
  replyPreview: {
    flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 6, borderLeftWidth: 2, borderLeftColor: t.colors.primary,
    marginBottom: 4,
  },
  replyPreviewTxt: { color: t.colors.textDim, fontSize: 11 },
  reactRow: { flexDirection: 'row', gap: 4, marginTop: 6, flexWrap: 'wrap' },
  reactChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 100,
    backgroundColor: t.colors.surface2, borderWidth: 1, borderColor: t.colors.border,
  },
  reactCount: { color: t.colors.textDim, fontSize: 11 },
  scrollDown: {
    position: 'absolute', right: 16, width: 40, height: 40, borderRadius: 20,
    backgroundColor: t.colors.primary, alignItems: 'center', justifyContent: 'center',
    shadowColor: t.colors.primary, shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
  },
  mentionPop: {
    position: 'absolute', left: 12, right: 12, bottom: 74, borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: t.colors.tabBorder,
  },
  mentionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10 },
  mentionName: { fontWeight: '700', fontSize: 14 },
  mentionRole: { color: t.colors.textDim, fontSize: 11, marginLeft: 'auto', textTransform: 'uppercase' },
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
  sendBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: t.colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  recordingBar: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8,
    backgroundColor: t.colors.primaryGlow, borderRadius: 100, borderWidth: 1, borderColor: t.colors.primary + '55',
  },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: t.colors.primary },
  recTxt: { flex: 1, color: t.colors.text, fontWeight: '700', fontSize: 13 },
  recCancel: { padding: 6 },
  recSend: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: t.colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
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
  memName: { fontWeight: '800', fontSize: 14 },
  memSub: { color: t.colors.textDim, fontSize: 12, marginTop: 2 },
  roleTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 100, borderWidth: 1 },
  roleTagTxt: { fontSize: 9, fontWeight: '900', letterSpacing: 0.4 },
  msName: { fontSize: 16, fontWeight: '800' },
  msRole: { color: t.colors.textDim, fontSize: 12, textTransform: 'capitalize', marginTop: 2 },
  modLabel: { color: t.colors.textDim, fontSize: 10, fontWeight: '800', letterSpacing: 0.6, marginTop: 6, paddingLeft: 12 },
  adminBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14,
    backgroundColor: t.colors.surface1, borderRadius: t.radii.md, borderWidth: 1, borderColor: t.colors.border,
  },
  adminBtnTxt: { color: t.colors.text, fontWeight: '700', fontSize: 14 },
  dangerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14,
    backgroundColor: t.colors.primaryGlow, borderRadius: t.radii.md,
    borderWidth: 1, borderColor: t.colors.primary,
  },
  dangerBtnTxt: { color: t.colors.primary, fontWeight: '800', fontSize: 14 },
  reportRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 12 },
  reportTxt: { color: t.colors.textDim, fontSize: 13 },
  sheetWrap: { flex: 1, backgroundColor: t.colors.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: t.colors.surface1, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 16, paddingBottom: 32, gap: 4, borderWidth: 1, borderColor: t.colors.border,
  },
  emojiRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 4 },
  emojiBtn: { padding: 6 },
  sheetDivider: { height: 1, backgroundColor: t.colors.border, marginVertical: 6 },
  modalTitle: { color: t.colors.text, fontSize: 18, fontWeight: '800', marginBottom: 12 },
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
