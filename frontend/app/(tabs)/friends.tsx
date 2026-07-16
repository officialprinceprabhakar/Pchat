import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, FlatList, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { api } from '@/src/api/client';
import { Avatar } from '@/src/components/Avatar';
import { PButton } from '@/src/components/PButton';

type Section = 'search' | 'requests' | 'friends' | 'suggested';

function isOnline(last_seen?: string) {
  if (!last_seen) return false;
  return Date.now() - new Date(last_seen).getTime() < 120_000;
}

export default function FriendsTab() {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [tab, setTab] = useState<Section>('friends');
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [incoming, setIncoming] = useState<any[]>([]);
  const [outgoing, setOutgoing] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [suggested, setSuggested] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [f, r, s] = await Promise.all([
        api.friends().catch(() => ({ friends: [] })),
        api.friendRequests().catch(() => ({ incoming: [], outgoing: [] })),
        api.searchUsers('').catch(() => ({ users: [] })),
      ]);
      setFriends(f.friends || []);
      setIncoming(r.incoming || []);
      setOutgoing(r.outgoing || []);
      const friendIds = new Set((f.friends || []).map((x: any) => x.user_id));
      const outIds = new Set((r.outgoing || []).map((x: any) => x.to?.user_id));
      const inIds = new Set((r.incoming || []).map((x: any) => x.from?.user_id));
      setSuggested((s.users || []).filter((u: any) => !friendIds.has(u.user_id) && !outIds.has(u.user_id) && !inIds.has(u.user_id)).slice(0, 10));
    } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // debounce user search
  useEffect(() => {
    let cancelled = false;
    const q = search.trim();
    if (!q) { setSearchResults([]); return; }
    const to = setTimeout(async () => {
      try {
        const res = await api.searchUsers(q);
        if (!cancelled) setSearchResults(res.users || []);
      } catch {}
    }, 300);
    return () => { cancelled = true; clearTimeout(to); };
  }, [search]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const doAction = async (fn: () => Promise<any>) => { try { await fn(); } catch {} await load(); };

  const onlineFriends = friends.filter((f) => isOnline(f.last_seen));

  const renderUserRow = (u: any, actions: React.ReactNode, key?: string) => (
    <TouchableOpacity
      key={key || u.user_id}
      onPress={() => router.push(`/user/${u.user_id}`)}
      style={styles.row}
      testID={`friends-row-${u.username}`}
    >
      <Avatar uri={u.avatar} name={u.display_name || u.username} size={44} online={isOnline(u.last_seen)} />
      <View style={{ flex: 1 }}>
        <Text style={styles.name} numberOfLines={1}>{u.display_name || u.username}</Text>
        <Text style={styles.uname} numberOfLines={1}>@{u.username}</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 6 }}>{actions}</View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: t.colors.bg }}>
        <View style={styles.header}>
          <Text style={styles.title}>Friends</Text>
          {incoming.length > 0 ? (
            <View style={styles.pillBadge}>
              <Text style={styles.pillBadgeTxt}>{incoming.length} new</Text>
            </View>
          ) : null}
        </View>

        {/* Search - always visible at top */}
        <View style={styles.searchBox}>
          <MaterialCommunityIcons name="magnify" size={20} color={t.colors.textDim} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search @username"
            placeholderTextColor={t.colors.textMuted}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            testID="friends-search-input"
          />
          {search.length > 0 ? (
            <TouchableOpacity onPress={() => setSearch('')} testID="friends-search-clear">
              <MaterialCommunityIcons name="close-circle" size={18} color={t.colors.textDim} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Chip row */}
        {search.trim() === '' ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {([
              ['friends', `Friends · ${friends.length}`],
              ['requests', `Requests · ${incoming.length + outgoing.length}`],
              ['suggested', 'Suggested'],
            ] as [Section, string][]).map(([id, label]) => (
              <TouchableOpacity
                key={id}
                onPress={() => setTab(id)}
                style={[styles.chip, tab === id && styles.chipActive]}
                testID={`friends-chip-${id}`}
              >
                <Text style={[styles.chipTxt, tab === id && styles.chipTxtActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : null}
      </SafeAreaView>

      {loading ? (
        <ActivityIndicator color={t.colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 130 + insets.bottom }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.colors.primary} />}
          showsVerticalScrollIndicator={false}
        >
          {/* Search results override */}
          {search.trim() !== '' ? (
            searchResults.length === 0 ? (
              <View style={styles.empty}>
                <MaterialCommunityIcons name="account-search-outline" size={40} color={t.colors.textMuted} />
                <Text style={styles.emptyTxt}>No users found</Text>
              </View>
            ) : (
              searchResults.map((u) => {
                const isFriend = friends.find((f) => f.user_id === u.user_id);
                const sentPending = outgoing.find((o) => o.to?.user_id === u.user_id);
                const gotPending = incoming.find((i) => i.from?.user_id === u.user_id);
                return renderUserRow(u, (
                  isFriend ? (
                    <TouchableOpacity onPress={() => router.push(`/chat/${u.user_id}`)} style={styles.iconAct} testID={`friends-msg-${u.username}`}>
                      <MaterialCommunityIcons name="chat" size={16} color={t.colors.primary} />
                    </TouchableOpacity>
                  ) : gotPending ? (
                    <PButton title="Accept" size="sm" onPress={() => doAction(() => api.acceptRequest(u.user_id))} testID={`friends-accept-${u.username}`} />
                  ) : sentPending ? (
                    <PButton title="Pending" size="sm" variant="outline" onPress={() => doAction(() => api.cancelRequest(u.user_id))} testID={`friends-cancel-${u.username}`} />
                  ) : (
                    <PButton title="Add" size="sm" onPress={() => doAction(() => api.sendRequest(u.user_id))} testID={`friends-add-${u.username}`} />
                  )
                ), u.user_id);
              })
            )
          ) : (
            <>
              {/* FRIENDS tab */}
              {tab === 'friends' && (
                <>
                  {/* Online strip */}
                  {onlineFriends.length > 0 && (
                    <View style={styles.onlineWrap}>
                      <Text style={styles.subHead}>ONLINE NOW · {onlineFriends.length}</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 16, gap: 12 }}>
                        {onlineFriends.map((f) => (
                          <TouchableOpacity
                            key={f.user_id}
                            onPress={() => router.push(`/chat/${f.user_id}`)}
                            style={styles.onlineChip}
                            testID={`friends-online-${f.username}`}
                          >
                            <Avatar uri={f.avatar} name={f.display_name || f.username} size={54} online />
                            <Text style={styles.onlineName} numberOfLines={1}>{f.display_name || f.username}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                  {friends.length === 0 ? (
                    <View style={styles.empty}>
                      <MaterialCommunityIcons name="account-multiple-outline" size={44} color={t.colors.textMuted} />
                      <Text style={styles.emptyTitle}>No friends yet</Text>
                      <Text style={styles.emptyTxt}>Search @usernames above or check suggestions.</Text>
                    </View>
                  ) : (
                    friends.map((u) => renderUserRow(u, (
                      <>
                        <TouchableOpacity onPress={() => router.push(`/chat/${u.user_id}`)} style={styles.iconAct} testID={`friends-message-${u.username}`}>
                          <MaterialCommunityIcons name="chat" size={16} color={t.colors.primary} />
                        </TouchableOpacity>
                      </>
                    )))
                  )}
                </>
              )}

              {/* REQUESTS tab */}
              {tab === 'requests' && (
                <>
                  {incoming.length === 0 && outgoing.length === 0 ? (
                    <View style={styles.empty}>
                      <MaterialCommunityIcons name="email-outline" size={44} color={t.colors.textMuted} />
                      <Text style={styles.emptyTitle}>No pending requests</Text>
                    </View>
                  ) : null}
                  {incoming.length > 0 && (
                    <>
                      <Text style={styles.subHead}>RECEIVED · {incoming.length}</Text>
                      {incoming.map((r) => renderUserRow(r.from, (
                        <>
                          <PButton title="Accept" size="sm" onPress={() => doAction(() => api.acceptRequest(r.from.user_id))} testID={`friends-req-accept-${r.from.username}`} />
                          <PButton title="Reject" size="sm" variant="ghost" onPress={() => doAction(() => api.rejectRequest(r.from.user_id))} testID={`friends-req-reject-${r.from.username}`} />
                        </>
                      ), 'in-' + r.from.user_id))}
                    </>
                  )}
                  {outgoing.length > 0 && (
                    <>
                      <Text style={[styles.subHead, { marginTop: 16 }]}>SENT · {outgoing.length}</Text>
                      {outgoing.map((r) => renderUserRow(r.to, (
                        <PButton title="Cancel" size="sm" variant="outline" onPress={() => doAction(() => api.cancelRequest(r.to.user_id))} testID={`friends-req-cancel-${r.to.username}`} />
                      ), 'out-' + r.to.user_id))}
                    </>
                  )}
                </>
              )}

              {/* SUGGESTED tab */}
              {tab === 'suggested' && (
                suggested.length === 0 ? (
                  <View style={styles.empty}>
                    <MaterialCommunityIcons name="account-heart-outline" size={44} color={t.colors.textMuted} />
                    <Text style={styles.emptyTitle}>No suggestions right now</Text>
                    <Text style={styles.emptyTxt}>Come back after joining a few rooms.</Text>
                  </View>
                ) : (
                  suggested.map((u) => renderUserRow(u, (
                    <PButton title="Add" size="sm" onPress={() => doAction(() => api.sendRequest(u.user_id))} testID={`friends-sugg-add-${u.username}`} />
                  )))
                )
              )}
            </>
          )}
        </ScrollView>
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
  pillBadge: {
    backgroundColor: t.colors.primary, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100,
  },
  pillBadgeTxt: { color: t.colors.onPrimary, fontSize: 11, fontWeight: '800' },
  searchBox: {
    marginHorizontal: 16, marginBottom: 12, paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: t.colors.surface1, borderRadius: t.radii.full,
    flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: t.colors.border,
  },
  searchInput: { flex: 1, color: t.colors.text, fontSize: 14 },
  chipRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 12 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100,
    backgroundColor: t.colors.surface1, borderWidth: 1, borderColor: t.colors.border,
    height: 36, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  chipActive: { backgroundColor: t.colors.primary, borderColor: t.colors.primary },
  chipTxt: { color: t.colors.textDim, fontWeight: '700', fontSize: 12 },
  chipTxtActive: { color: t.colors.onPrimary },
  subHead: { color: t.colors.textDim, fontSize: 11, fontWeight: '800', letterSpacing: 0.6, marginBottom: 4 },
  onlineWrap: { marginBottom: 8, paddingLeft: 0 },
  onlineChip: { alignItems: 'center', width: 72, marginTop: 8 },
  onlineName: { color: t.colors.text, fontSize: 12, marginTop: 6, textAlign: 'center' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12,
    backgroundColor: t.colors.surface1, borderRadius: t.radii.lg,
    borderWidth: 1, borderColor: t.colors.border,
  },
  name: { color: t.colors.text, fontWeight: '700' },
  uname: { color: t.colors.textDim, fontSize: 12, marginTop: 2 },
  iconAct: {
    width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center',
    backgroundColor: t.colors.primaryGlow, borderWidth: 1, borderColor: t.colors.primary + '55',
  },
  empty: {
    padding: 40, alignItems: 'center', gap: 6,
    backgroundColor: t.colors.surface1, borderRadius: t.radii.lg,
    borderWidth: 1, borderColor: t.colors.border, borderStyle: 'dashed',
  },
  emptyTitle: { color: t.colors.text, fontWeight: '700', fontSize: 15, marginTop: 4 },
  emptyTxt: { color: t.colors.textDim, fontSize: 13, textAlign: 'center' },
});
