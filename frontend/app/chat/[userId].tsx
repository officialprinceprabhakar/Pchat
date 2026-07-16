import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView,
  Platform, ActivityIndicator, Image, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import { theme } from '@/src/theme';
import { useAuth } from '@/src/context/AuthContext';
import { api } from '@/src/api/client';
import { Avatar } from '@/src/components/Avatar';
import { ScreenHeader } from '@/src/components/ScreenHeader';

const REACTIONS = ['❤️', '😂', '👍', '😮', '😢', '🔥'];

export default function ChatScreen() {
  const router = useRouter();
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { user } = useAuth();
  const [other, setOther] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<any>(null);
  const [contextMsg, setContextMsg] = useState<any>(null);
  const [editingMsg, setEditingMsg] = useState<any>(null);
  const [typing, setTyping] = useState(false);
  const listRef = useRef<FlatList>(null);
  const pollRef = useRef<any>(null);

  const load = useCallback(async () => {
    try {
      const [u, m] = await Promise.all([api.getUser(userId), api.getChatMessages(userId)]);
      setOther(u.user);
      setMessages(m.messages || []);
    } finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  // Poll for new messages every 3s
  useEffect(() => {
    pollRef.current = setInterval(async () => {
      try {
        const m = await api.getChatMessages(userId);
        setMessages((prev) => {
          if (prev.length !== m.messages.length) return m.messages;
          return prev;
        });
      } catch {}
    }, 3000);
    return () => clearInterval(pollRef.current);
  }, [userId]);

  const send = async () => {
    const t = text.trim();
    if (!t) return;
    setSending(true);
    try {
      if (editingMsg) {
        await api.editMessage(editingMsg.message_id, t);
        setMessages((prev) => prev.map((m) => m.message_id === editingMsg.message_id ? { ...m, text: t, edited_at: new Date().toISOString() } : m));
        setEditingMsg(null);
      } else {
        const res = await api.sendChatMessage(userId, { text: t, reply_to: replyTo?.message_id });
        setMessages((prev) => [...prev, res.message]);
        setReplyTo(null);
      }
      setText('');
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e: any) {
      // ignore
    } finally { setSending(false); }
  };

  const sendImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, quality: 0.5, base64: true,
    });
    if (res.canceled || !res.assets[0]?.base64) return;
    const img = `data:image/jpeg;base64,${res.assets[0].base64}`;
    setSending(true);
    try {
      const out = await api.sendChatMessage(userId, { image: img });
      setMessages((prev) => [...prev, out.message]);
    } finally { setSending(false); }
  };

  const react = async (msg: any, emoji: string) => {
    setContextMsg(null);
    try {
      await api.react(msg.message_id, emoji);
      // optimistic
      setMessages((prev) => prev.map((m) => {
        if (m.message_id !== msg.message_id) return m;
        const r = { ...(m.reactions || {}) };
        const arr = r[emoji] || [];
        r[emoji] = arr.includes(user!.user_id) ? arr.filter((x: string) => x !== user!.user_id) : [...arr, user!.user_id];
        if (r[emoji].length === 0) delete r[emoji];
        return { ...m, reactions: r };
      }));
    } catch {}
  };

  const deleteMe = async () => {
    if (!contextMsg) return;
    await api.deleteForMe(contextMsg.message_id);
    setMessages((prev) => prev.filter((m) => m.message_id !== contextMsg.message_id));
    setContextMsg(null);
  };
  const deleteAll = async () => {
    if (!contextMsg) return;
    await api.deleteForAll(contextMsg.message_id);
    setMessages((prev) => prev.map((m) => m.message_id === contextMsg.message_id ? { ...m, deleted_for_all: true, text: null, image: null } : m));
    setContextMsg(null);
  };

  if (loading || !other) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  const onlineRecent = (() => {
    if (!other.last_seen) return false;
    const t = new Date(other.last_seen).getTime();
    return Date.now() - t < 120_000;
  })();

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <ScreenHeader
        onBack={() => router.back()}
        title={other.display_name || other.username}
        subtitle={onlineRecent ? 'Online' : 'Last seen recently'}
        right={
          <TouchableOpacity onPress={() => router.push(`/user/${userId}`)} testID="chat-profile-btn">
            <Avatar uri={other.avatar} name={other.display_name || other.username} size={36} online={onlineRecent} />
          </TouchableOpacity>
        }
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.message_id}
          contentContainerStyle={{ padding: 16, gap: 6 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => {
            const mine = item.from_id === user?.user_id;
            const deleted = item.deleted_for_all;
            const reactions = Object.entries(item.reactions || {}).filter(([, arr]: any) => arr.length > 0);
            return (
              <TouchableOpacity
                onLongPress={() => !deleted && setContextMsg(item)}
                activeOpacity={0.9}
                style={[styles.bubbleWrap, { alignItems: mine ? 'flex-end' : 'flex-start' }]}
              >
                {item.reply_to ? (
                  <View style={styles.replyPreview}>
                    <MaterialCommunityIcons name="reply" size={12} color={theme.colors.textDim} />
                    <Text style={styles.replyTxt} numberOfLines={1}>Reply</Text>
                  </View>
                ) : null}
                <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther, deleted && styles.bubbleDeleted]}>
                  {deleted ? (
                    <Text style={[styles.msgTxt, { color: theme.colors.textDim, fontStyle: 'italic' }]}>Message deleted</Text>
                  ) : (
                    <>
                      {item.image ? (
                        <Image source={{ uri: item.image }} style={styles.msgImg} />
                      ) : null}
                      {item.text ? <Text style={[styles.msgTxt, mine && { color: theme.colors.onPrimary }]}>{item.text}</Text> : null}
                      {item.edited_at ? <Text style={[styles.editedTag, mine && { color: '#FFC7C4' }]}>edited</Text> : null}
                    </>
                  )}
                </View>
                {reactions.length > 0 ? (
                  <View style={styles.reactionsRow}>
                    {reactions.map(([emoji, arr]: any) => (
                      <View key={emoji} style={styles.reactionPill}>
                        <Text style={{ fontSize: 12 }}>{emoji}</Text>
                        <Text style={styles.reactionCount}>{arr.length}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          }}
        />

        {replyTo ? (
          <View style={styles.replyBar}>
            <MaterialCommunityIcons name="reply" size={16} color={theme.colors.primary} />
            <Text style={styles.replyBarTxt} numberOfLines={1}>{replyTo.text || 'photo'}</Text>
            <TouchableOpacity onPress={() => setReplyTo(null)}>
              <MaterialCommunityIcons name="close" size={16} color={theme.colors.textDim} />
            </TouchableOpacity>
          </View>
        ) : null}
        {editingMsg ? (
          <View style={styles.replyBar}>
            <MaterialCommunityIcons name="pencil" size={16} color={theme.colors.blue} />
            <Text style={styles.replyBarTxt} numberOfLines={1}>Editing message</Text>
            <TouchableOpacity onPress={() => { setEditingMsg(null); setText(''); }}>
              <MaterialCommunityIcons name="close" size={16} color={theme.colors.textDim} />
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.inputBar}>
          <TouchableOpacity onPress={sendImage} style={styles.attachBtn} testID="chat-attach">
            <MaterialCommunityIcons name="image-plus" size={22} color={theme.colors.textDim} />
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            placeholder="Message..."
            placeholderTextColor={theme.colors.textMuted}
            value={text}
            onChangeText={setText}
            multiline
            testID="chat-input"
          />
          <TouchableOpacity
            onPress={send}
            disabled={sending || !text.trim()}
            style={[styles.sendBtn, (!text.trim() || sending) && { opacity: 0.5 }]}
            testID="chat-send"
          >
            <MaterialCommunityIcons name="send" size={20} color={theme.colors.onPrimary} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={!!contextMsg} transparent animationType="fade" onRequestClose={() => setContextMsg(null)}>
        <TouchableOpacity style={styles.ctxWrap} activeOpacity={1} onPress={() => setContextMsg(null)}>
          <View style={styles.ctxCard}>
            <View style={styles.ctxEmojis}>
              {REACTIONS.map((e) => (
                <TouchableOpacity key={e} onPress={() => react(contextMsg, e)} style={styles.ctxEmoji}>
                  <Text style={{ fontSize: 22 }}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.ctxDivider} />
            <CtxAction icon="reply" label="Reply" onPress={() => { setReplyTo(contextMsg); setContextMsg(null); }} />
            {contextMsg?.from_id === user?.user_id && !contextMsg?.image ? (
              <CtxAction icon="pencil" label="Edit" onPress={() => { setEditingMsg(contextMsg); setText(contextMsg.text || ''); setContextMsg(null); }} />
            ) : null}
            <CtxAction icon="delete-outline" label="Delete for me" onPress={deleteMe} />
            {contextMsg?.from_id === user?.user_id ? (
              <CtxAction icon="delete-forever" label="Delete for everyone" onPress={deleteAll} danger />
            ) : null}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

function CtxAction({ icon, label, onPress, danger }: any) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.ctxAction} testID={`ctx-${label}`}>
      <MaterialCommunityIcons name={icon} size={20} color={danger ? theme.colors.primary : theme.colors.text} />
      <Text style={[styles.ctxActionTxt, danger && { color: theme.colors.primary }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  center: { flex: 1, backgroundColor: theme.colors.bg, alignItems: 'center', justifyContent: 'center' },
  bubbleWrap: { marginVertical: 2 },
  bubble: {
    maxWidth: '78%', paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 20,
  },
  bubbleMine: {
    backgroundColor: theme.colors.primary,
    borderBottomRightRadius: 6,
  },
  bubbleOther: {
    backgroundColor: theme.colors.surface2,
    borderBottomLeftRadius: 6,
  },
  bubbleDeleted: { backgroundColor: theme.colors.surface1 },
  msgTxt: { color: theme.colors.text, fontSize: 15, lineHeight: 20 },
  msgImg: { width: 220, height: 220, borderRadius: 12, marginBottom: 6 },
  editedTag: { color: theme.colors.textDim, fontSize: 10, marginTop: 4 },
  replyPreview: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  replyTxt: { color: theme.colors.textDim, fontSize: 11 },
  reactionsRow: { flexDirection: 'row', gap: 4, marginTop: 4 },
  reactionPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: theme.colors.surface2, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 100,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  reactionCount: { color: theme.colors.textDim, fontSize: 11 },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 10,
    borderTopWidth: 1, borderTopColor: theme.colors.border, backgroundColor: theme.colors.bg,
  },
  attachBtn: { padding: 10 },
  input: {
    flex: 1, backgroundColor: theme.colors.surface2, color: theme.colors.text,
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, maxHeight: 100,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  replyBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: theme.colors.surface1, borderTopWidth: 1, borderTopColor: theme.colors.border,
  },
  replyBarTxt: { flex: 1, color: theme.colors.textDim, fontSize: 12 },
  ctxWrap: { flex: 1, backgroundColor: theme.colors.overlay, justifyContent: 'flex-end' },
  ctxCard: {
    backgroundColor: theme.colors.surface1, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 16, gap: 8, paddingBottom: 32,
  },
  ctxEmojis: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 6 },
  ctxEmoji: { padding: 8 },
  ctxDivider: { height: 1, backgroundColor: theme.colors.border, marginVertical: 4 },
  ctxAction: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: theme.radii.md },
  ctxActionTxt: { color: theme.colors.text, fontSize: 15, fontWeight: '600' },
});
