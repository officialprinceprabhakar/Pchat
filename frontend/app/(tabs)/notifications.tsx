import React, { useCallback, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useTheme } from '@/src/context/ThemeContext';
import { api } from '@/src/api/client';

const ICONS: Record<string, { name: string; color: string }> = {
  friend_request: { name: 'account-plus', color: '#0A84FF' },
  friend_accept: { name: 'account-check', color: '#30D158' },
  message: { name: 'chat', color: '#FF3B30' },
  like: { name: 'heart', color: '#FF3B30' },
  comment: { name: 'comment-text', color: '#BF5AF2' },
  mention: { name: 'at', color: '#FFD60A' },
  announcement: { name: 'bullhorn', color: '#FF9F0A' },
  room_invite: { name: 'account-group', color: '#32ADE6' },
  room_join: { name: 'account-plus-outline', color: '#30D158' },
  room_leave: { name: 'account-minus-outline', color: '#8E8E93' },
  reply: { name: 'reply', color: '#0A84FF' },
  promotion: { name: 'shield-star', color: '#FFD60A' },
  badge_received: { name: 'medal', color: '#BF5AF2' },
  warning: { name: 'alert', color: '#FF9F0A' },
};

type FilterT = 'all' | 'unread' | 'mentions' | 'social';

function timeAgo(iso: string) {
  const d = Date.now() - new Date(iso).getTime();
  const s = Math.floor(d / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function NotificationsTab() {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<any[]>([]);
  const [filter, setFilter] = useState<FilterT>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.notifications();
      setItems(res.notifications || []);
    } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const doOpen = (item: any) => {
    if (item.type === 'mention' && item.data?.room_id) {
      router.push({ pathname: `/room/${item.data.room_id}`, params: { highlightMessage: item.data.message_id } });
    } else if (item.type === 'announcement' && item.data?.room_id) {
      router.push(`/room/${item.data.room_id}`);
    } else if (item.data?.room_id) {
      router.push(`/room/${item.data.room_id}`);
    } else if (item.data?.user_id) {
      router.push(`/user/${item.data.user_id}`);
    } else if (item.data?.from_id) {
      router.push(`/chat/${item.data.from_id}`);
    }
  };

  const filtered = items.filter((n) => {
    if (filter === 'unread') return !n.read;
    if (filter === 'mentions') return n.type === 'mention';
    if (filter === 'social') return ['friend_request', 'friend_accept', 'like', 'comment'].includes(n.type);
    return true;
  });

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: t.colors.bg }}>
        <View style={styles.header}>
          <Text style={styles.title}>Alerts</Text>
          <TouchableOpacity onPress={async () => { await api.markAllRead(); load(); }} style={styles.readAllBtn} testID="notif-read-all">
            <MaterialCommunityIcons name="check-all" size={16} color={t.colors.text} />
            <Text style={styles.readAllTxt}>Mark all read</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.chipRow}>
          {([
            ['all', 'All'],
            ['unread', 'Unread'],
            ['mentions', 'Mentions'],
            ['social', 'Social'],
          ] as [FilterT, string][]).map(([id, label]) => (
            <TouchableOpacity
              key={id}
              onPress={() => setFilter(id)}
              style={[styles.chip, filter === id && styles.chipActive]}
              testID={`notif-filter-${id}`}
            >
              <Text style={[styles.chipTxt, filter === id && styles.chipTxtActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </SafeAreaView>

      {loading ? (
        <ActivityIndicator color={t.colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(n) => n.notif_id}
          contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 130 + insets.bottom }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.colors.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialCommunityIcons name="bell-off-outline" size={44} color={t.colors.textMuted} />
              <Text style={styles.emptyTitle}>Nothing here yet</Text>
              <Text style={styles.emptyTxt}>You&apos;ll see mentions, friend requests, and room events here.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const meta = ICONS[item.type] || { name: 'bell', color: t.colors.textDim };
            return (
              <TouchableOpacity
                onPress={() => doOpen(item)}
                style={[styles.row, !item.read && styles.rowUnread]}
                testID={`notif-${item.notif_id}`}
                activeOpacity={0.85}
              >
                <View style={[styles.iconWrap, { backgroundColor: meta.color + '22', borderColor: meta.color + '55' }]}>
                  <MaterialCommunityIcons name={meta.name as any} size={20} color={meta.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.txt} numberOfLines={2}>{item.text}</Text>
                  <Text style={styles.time}>{timeAgo(item.created_at)}</Text>
                </View>
                {!item.read ? <View style={styles.dot} /> : null}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const makeStyles = (t: ReturnType<typeof useTheme>) => StyleSheet.create({
  root: { flex: 1, backgroundColor: t.colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
  },
  title: { color: t.colors.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  readAllBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7,
    backgroundColor: t.colors.surface1, borderRadius: 100,
    borderWidth: 1, borderColor: t.colors.border,
  },
  readAllTxt: { color: t.colors.text, fontSize: 12, fontWeight: '700' },
  chipRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 12 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100,
    backgroundColor: t.colors.surface1, borderWidth: 1, borderColor: t.colors.border,
    height: 36, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  chipActive: { backgroundColor: t.colors.primary, borderColor: t.colors.primary },
  chipTxt: { color: t.colors.textDim, fontWeight: '700', fontSize: 12 },
  chipTxtActive: { color: t.colors.onPrimary },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12,
    backgroundColor: t.colors.surface1, borderRadius: t.radii.lg,
    borderWidth: 1, borderColor: t.colors.border,
  },
  rowUnread: { borderColor: t.colors.primary + '55' },
  iconWrap: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },
  txt: { color: t.colors.text, fontSize: 14, lineHeight: 19 },
  time: { color: t.colors.textDim, fontSize: 11, marginTop: 3 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: t.colors.primary },
  empty: {
    padding: 40, alignItems: 'center', gap: 8,
    backgroundColor: t.colors.surface1, borderRadius: t.radii.lg,
    borderWidth: 1, borderColor: t.colors.border, borderStyle: 'dashed', marginTop: 8,
  },
  emptyTitle: { color: t.colors.text, fontWeight: '700', fontSize: 16, marginTop: 8 },
  emptyTxt: { color: t.colors.textDim, fontSize: 13, textAlign: 'center' },
});
