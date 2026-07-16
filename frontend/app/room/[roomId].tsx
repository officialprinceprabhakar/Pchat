import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView,
  Platform, ActivityIndicator, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { theme } from '@/src/theme';
import { useAuth } from '@/src/context/AuthContext';
import { api } from '@/src/api/client';
import { Avatar } from '@/src/components/Avatar';
import { PButton } from '@/src/components/PButton';

type TabT = 'chat' | 'info' | 'members';

export default function RoomScreen() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [room, setRoom] = useState<any>(null);
  const [membership, setMembership] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [tab, setTab] = useState<TabT>('chat');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);
  const pollRef = useRef<any>(null);

  const load = useCallback(async () => {
    try {
      const [r, mm, msgs] = await Promise.all([
        api.getRoom(roomId),
        api.roomMembers(roomId).catch(() => ({ members: [] })),
        api.roomMessages(roomId).catch(() => ({ messages: [] })),
      ]);
      setRoom(r.room);
      setMembership(r.membership);
      setMembers(mm.members || []);
      setMessages(msgs.messages || []);
    } finally { setLoading(false); }
  }, [roomId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (tab !== 'chat') return;
    pollRef.current = setInterval(async () => {
      try {
        const res = await api.roomMessages(roomId);
        setMessages((prev) => (prev.length !== res.messages.length ? res.messages : prev));
      } catch {}
    }, 3500);
    return () => clearInterval(pollRef.current);
  }, [tab, roomId]);

  const join = async () => { await api.joinRoom(roomId); await load(); };
  const leave = async () => { await api.leaveRoom(roomId); router.back(); };

  const send = async () => {
    const t = text.trim();
    if (!t) return;
    setSending(true);
    try {
      const res = await api.sendRoomMessage(roomId, { text: t });
      setMessages((prev) => [...prev, res.message]);
      setText('');
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e: any) {
      // ignore
    } finally { setSending(false); }
  };

  if (loading || !room) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  const isMember = !!membership?.role;
  const canModerate = ['owner', 'admin', 'moderator'].includes(membership?.role);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <LinearGradient colors={['#FF3B30', '#7B0F0F']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.banner}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} testID="room-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color="#fff" />
        </TouchableOpacity>
        <View style={styles.bannerBody}>
          <Text style={styles.roomCode}>{room.room_code}</Text>
          <Text style={styles.roomName} numberOfLines={1}>{room.name}</Text>
          <Text style={styles.roomMeta}>{room.member_count} members · {room.is_private ? 'Private' : 'Public'}</Text>
        </View>
      </LinearGradient>

      <View style={styles.tabs}>
        {(['chat', 'info', 'members'] as TabT[]).map((t) => (
          <TouchableOpacity
            key={t}
            onPress={() => setTab(t)}
            style={[styles.tab, tab === t && styles.tabActive]}
            testID={`room-tab-${t}`}
          >
            <Text style={[styles.tabTxt, tab === t && styles.tabTxtActive]}>{t.toUpperCase()}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'chat' && (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          {!isMember ? (
            <View style={styles.joinBar}>
              <Text style={styles.joinTxt}>Join this room to send messages</Text>
              <PButton title="Join Room" onPress={join} testID="room-join-btn" size="sm" />
            </View>
          ) : null}
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.message_id}
            contentContainerStyle={{ padding: 16, gap: 8 }}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <View style={styles.emptyChat}>
                <Text style={styles.emptyChatTitle}>Say hello!</Text>
                <Text style={styles.emptyChatSub}>{room.welcome_message || 'Be the first to start the conversation.'}</Text>
              </View>
            }
            renderItem={({ item }) => {
              const mine = item.from_id === user?.user_id;
              return (
                <View style={[styles.msgRow, { flexDirection: mine ? 'row-reverse' : 'row' }]}>
                  <Avatar uri={item.from_avatar} name={item.from_display_name || item.from_username} size={30} />
                  <View style={[styles.rmBubble, mine ? styles.rmBubbleMine : styles.rmBubbleOther]}>
                    {!mine ? <Text style={styles.rmAuthor}>@{item.from_username}</Text> : null}
                    <Text style={[styles.rmText, mine && { color: theme.colors.onPrimary }]}>{item.text}</Text>
                  </View>
                </View>
              );
            }}
          />
          {isMember && (
            <View style={styles.inputBar}>
              <TextInput
                style={styles.input}
                placeholder="Message the room..."
                placeholderTextColor={theme.colors.textMuted}
                value={text}
                onChangeText={setText}
                multiline
                testID="room-input"
              />
              <TouchableOpacity
                onPress={send}
                disabled={sending || !text.trim()}
                style={[styles.sendBtn, (!text.trim() || sending) && { opacity: 0.5 }]}
                testID="room-send"
              >
                <MaterialCommunityIcons name="send" size={20} color={theme.colors.onPrimary} />
              </TouchableOpacity>
            </View>
          )}
        </KeyboardAvoidingView>
      )}

      {tab === 'info' && (
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
          <InfoBlock label="Description" text={room.description || 'No description'} />
          <InfoBlock label="Rules" text={room.rules || 'No rules set'} />
          <InfoBlock label="Welcome message" text={room.welcome_message || 'No welcome message'} />
          {room.announcement ? <InfoBlock label="Announcement" text={room.announcement} highlight /> : null}
          {isMember && membership.role !== 'owner' ? (
            <PButton title="Leave Room" variant="outline" onPress={leave} fullWidth testID="room-leave-btn" />
          ) : null}
          {membership?.role === 'owner' ? (
            <PButton
              title="Delete Room"
              variant="outline"
              onPress={async () => { await api.deleteRoom(roomId); router.back(); }}
              fullWidth
              testID="room-delete-btn"
            />
          ) : null}
          <TouchableOpacity style={styles.reportRow} onPress={async () => { await api.report(roomId, 'room', 'inappropriate'); }} testID="room-report-btn">
            <MaterialCommunityIcons name="flag-outline" size={18} color={theme.colors.textDim} />
            <Text style={styles.reportTxt}>Report room</Text>
          </TouchableOpacity>
          {user?.is_developer ? (
            <TouchableOpacity
              onPress={async () => { await api.featureRoom(roomId, !room.featured); await load(); }}
              style={[styles.reportRow, { backgroundColor: theme.colors.primaryGlow, borderRadius: theme.radii.md, borderWidth: 1, borderColor: theme.colors.primary + '55' }]}
              testID="room-feature-btn"
            >
              <MaterialCommunityIcons name={room.featured ? 'star' : 'star-outline'} size={18} color={theme.colors.orange} />
              <Text style={[styles.reportTxt, { color: theme.colors.orange }]}>
                {room.featured ? 'Unfeature (Dev)' : 'Feature this room (Dev)'}
              </Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>
      )}

      {tab === 'members' && (
        <FlatList
          data={members}
          keyExtractor={(m) => m.user_id}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => item.user_id !== user?.user_id && router.push(`/user/${item.user_id}`)}
              style={styles.memberRow}
              testID={`member-${item.username}`}
            >
              <Avatar uri={item.avatar} name={item.display_name || item.username} size={44} />
              <View style={{ flex: 1 }}>
                <Text style={styles.memberName}>{item.display_name || item.username}</Text>
                <Text style={styles.memberRole}>@{item.username} · {item.role}</Text>
              </View>
              {canModerate && item.role !== 'owner' && item.user_id !== user?.user_id ? (
                <TouchableOpacity onPress={async () => { await api.kick(roomId, item.user_id); load(); }} style={styles.kickBtn}>
                  <MaterialCommunityIcons name="account-remove-outline" size={16} color={theme.colors.primary} />
                </TouchableOpacity>
              ) : null}
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

function InfoBlock({ label, text, highlight }: { label: string; text: string; highlight?: boolean }) {
  return (
    <View style={[styles.info, highlight && { borderColor: theme.colors.primary, backgroundColor: theme.colors.primaryGlow }]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoTxt}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  center: { flex: 1, backgroundColor: theme.colors.bg, alignItems: 'center', justifyContent: 'center' },
  banner: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 20 },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  bannerBody: { paddingHorizontal: 8, marginTop: 4 },
  roomCode: { color: '#ffffffcc', fontSize: 11, fontWeight: '700', letterSpacing: 0.6 },
  roomName: { color: '#fff', fontSize: 26, fontWeight: '900', letterSpacing: -0.5, marginTop: 4 },
  roomMeta: { color: '#ffffffcc', fontSize: 12, marginTop: 4 },
  tabs: {
    flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, gap: 8,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100, backgroundColor: theme.colors.surface1 },
  tabActive: { backgroundColor: theme.colors.primary },
  tabTxt: { color: theme.colors.textDim, fontWeight: '700', fontSize: 12, letterSpacing: 0.6 },
  tabTxtActive: { color: theme.colors.onPrimary },
  joinBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    padding: 12, backgroundColor: theme.colors.surface1, borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  joinTxt: { color: theme.colors.textDim, flex: 1, fontSize: 13 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  rmBubble: { maxWidth: '78%', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16 },
  rmBubbleMine: { backgroundColor: theme.colors.primary, borderBottomRightRadius: 4 },
  rmBubbleOther: { backgroundColor: theme.colors.surface2, borderBottomLeftRadius: 4 },
  rmAuthor: { color: theme.colors.primary, fontSize: 11, fontWeight: '700', marginBottom: 2 },
  rmText: { color: theme.colors.text, fontSize: 14 },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 10,
    borderTopWidth: 1, borderTopColor: theme.colors.border,
  },
  input: {
    flex: 1, backgroundColor: theme.colors.surface2, color: theme.colors.text,
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, maxHeight: 100,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  info: {
    padding: 16, backgroundColor: theme.colors.surface1, borderRadius: theme.radii.lg,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  infoLabel: { color: theme.colors.textDim, fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 6 },
  infoTxt: { color: theme.colors.text, fontSize: 14, lineHeight: 20 },
  reportRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, justifyContent: 'center' },
  reportTxt: { color: theme.colors.textDim, fontSize: 13 },
  memberRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12,
    backgroundColor: theme.colors.surface1, borderRadius: theme.radii.lg, borderWidth: 1, borderColor: theme.colors.border,
  },
  memberName: { color: theme.colors.text, fontWeight: '700' },
  memberRole: { color: theme.colors.textDim, fontSize: 12, marginTop: 2, textTransform: 'capitalize' },
  kickBtn: { padding: 8, borderRadius: 20, backgroundColor: theme.colors.primaryGlow },
  emptyChat: { alignItems: 'center', padding: 40 },
  emptyChatTitle: { color: theme.colors.text, fontWeight: '700', fontSize: 18 },
  emptyChatSub: { color: theme.colors.textDim, fontSize: 13, textAlign: 'center', marginTop: 8 },
});
