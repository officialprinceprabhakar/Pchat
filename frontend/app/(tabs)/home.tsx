import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl,
  ActivityIndicator, TextInput, FlatList,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { api } from '@/src/api/client';

const BANNER_GRADIENTS: [string, string][] = [
  ['#FF3B30', '#7B0F0F'],
  ['#0A84FF', '#0A2E7B'],
  ['#BF5AF2', '#4A0F7B'],
  ['#30D158', '#0F5A2E'],
  ['#FFD60A', '#7B5A0F'],
  ['#32ADE6', '#0F5A7B'],
  ['#FF9F0A', '#7B4A0F'],
];

export default function HomeScreen() {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [featured, setFeatured] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notifCount, setNotifCount] = useState(0);

  const load = useCallback(async () => {
    try {
      const [f, r, n] = await Promise.all([
        api.featuredRooms().catch(() => ({ rooms: [] })),
        api.listRooms(search.trim() || undefined).catch(() => ({ rooms: [] })),
        api.notifications().catch(() => ({ notifications: [] })),
      ]);
      setFeatured(f.rooms || []);
      const featIds = new Set((f.rooms || []).map((x: any) => x.room_id));
      setRooms((r.rooms || []).filter((x: any) => !featIds.has(x.room_id)));
      setNotifCount((n.notifications || []).filter((x: any) => !x.read).length);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // debounce search
  useEffect(() => {
    const to = setTimeout(load, 300);
    return () => clearTimeout(to);
  }, [search, load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const renderFeaturedCard = ({ item, index }: any) => {
    const grad = BANNER_GRADIENTS[index % BANNER_GRADIENTS.length];
    return (
      <TouchableOpacity
        onPress={() => router.push(`/room/${item.room_id}`)}
        style={styles.featCard}
        activeOpacity={0.85}
        testID={`home-featured-${item.room_code}`}
      >
        <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.featBanner}>
          <View style={styles.featBadge}>
            <MaterialCommunityIcons name="star-four-points" size={11} color="#fff" />
            <Text style={styles.featBadgeTxt}>FEATURED</Text>
          </View>
        </LinearGradient>
        <View style={styles.featBody}>
          <Text style={styles.featName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.featCode} numberOfLines={1}>{item.room_code}</Text>
          <View style={styles.featMeta}>
            <MaterialCommunityIcons name="account-multiple" size={12} color={t.colors.textDim} />
            <Text style={styles.featMetaTxt}>{item.member_count}</Text>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: t.colors.green, marginLeft: 6 }} />
            <Text style={styles.featMetaTxt}>{item.active_users || 0} active</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: t.colors.bg }}>
        <View style={styles.header}>
          <View>
            <Text style={styles.hello}>Welcome</Text>
            <Text style={styles.name}>{user?.display_name || user?.username}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              testID="home-notif-btn"
              onPress={() => router.push('/(tabs)/notifications')}
              style={styles.iconBtn}
            >
              <MaterialCommunityIcons name="bell" size={20} color={t.colors.text} />
              {notifCount > 0 ? <View style={styles.badgeDot} /> : null}
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 130 + insets.bottom }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Search */}
        <View style={styles.searchBox}>
          <MaterialCommunityIcons name="magnify" size={20} color={t.colors.textDim} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search rooms..."
            placeholderTextColor={t.colors.textMuted}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            testID="home-room-search"
          />
          {search.length > 0 ? (
            <TouchableOpacity onPress={() => setSearch('')} testID="home-search-clear">
              <MaterialCommunityIcons name="close-circle" size={18} color={t.colors.textDim} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Create Room CTA */}
        <TouchableOpacity
          onPress={() => router.push('/room/create')}
          style={styles.createBtn}
          activeOpacity={0.85}
          testID="home-create-room"
        >
          <View style={styles.createBtnIcon}>
            <MaterialCommunityIcons name="plus" size={20} color={t.colors.onPrimary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.createBtnTitle}>Create your own room</Text>
            <Text style={styles.createBtnSub}>Start a public or private conversation</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color={t.colors.onPrimary} />
        </TouchableOpacity>

        {loading ? (
          <ActivityIndicator color={t.colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* Featured Rooms */}
            {featured.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHead}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <MaterialCommunityIcons name="star-four-points" size={16} color={t.colors.orange} />
                    <Text style={styles.sectionTitle}>Featured Rooms</Text>
                  </View>
                </View>
                <FlatList
                  horizontal
                  data={featured}
                  keyExtractor={(item) => item.room_id}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
                  renderItem={renderFeaturedCard}
                />
              </View>
            )}

            {/* Trending Rooms */}
            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <MaterialCommunityIcons name="fire" size={16} color={t.colors.primary} />
                  <Text style={styles.sectionTitle}>Trending Rooms</Text>
                </View>
                <TouchableOpacity onPress={() => router.push('/(tabs)/rooms')} testID="home-see-all-rooms">
                  <Text style={styles.linkText}>See all</Text>
                </TouchableOpacity>
              </View>
              {rooms.length === 0 && !search ? (
                <View style={styles.empty}>
                  <MaterialCommunityIcons name="pound-box-outline" size={40} color={t.colors.textMuted} />
                  <Text style={styles.emptyTitle}>No rooms yet</Text>
                  <Text style={styles.emptyTxt}>Be the first — create one above!</Text>
                </View>
              ) : rooms.length === 0 ? (
                <View style={styles.empty}>
                  <Text style={styles.emptyTitle}>No matches</Text>
                  <Text style={styles.emptyTxt}>Try a different search term.</Text>
                </View>
              ) : (
                rooms.map((r, i) => {
                  const grad = BANNER_GRADIENTS[i % BANNER_GRADIENTS.length];
                  return (
                    <TouchableOpacity
                      key={r.room_id}
                      onPress={() => router.push(`/room/${r.room_id}`)}
                      style={styles.trendCard}
                      activeOpacity={0.85}
                      testID={`home-trending-${r.room_code}`}
                    >
                      <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.trendIcon}>
                        <MaterialCommunityIcons name="pound" size={22} color="#fff" />
                      </LinearGradient>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.trendName} numberOfLines={1}>{r.name}</Text>
                        <Text style={styles.trendCode} numberOfLines={1}>{r.room_code}</Text>
                        <View style={styles.trendMeta}>
                          <MaterialCommunityIcons name="account-multiple" size={11} color={t.colors.textDim} />
                          <Text style={styles.trendMetaTxt}>{r.member_count}</Text>
                          {r.active_users > 0 ? (
                            <>
                              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: t.colors.green, marginLeft: 8 }} />
                              <Text style={[styles.trendMetaTxt, { color: t.colors.green }]}>{r.active_users} active</Text>
                            </>
                          ) : null}
                          {r.is_private ? (
                            <>
                              <MaterialCommunityIcons name="lock" size={11} color={t.colors.textDim} style={{ marginLeft: 8 }} />
                              <Text style={styles.trendMetaTxt}>Private</Text>
                            </>
                          ) : null}
                        </View>
                      </View>
                      <MaterialCommunityIcons name="chevron-right" size={20} color={t.colors.textDim} />
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const makeStyles = (t: ReturnType<typeof useTheme>) => StyleSheet.create({
  root: { flex: 1, backgroundColor: t.colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
  },
  hello: { color: t.colors.textDim, fontSize: 13 },
  name: { color: t.colors.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: t.colors.surface2,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: t.colors.border,
  },
  badgeDot: {
    position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4,
    backgroundColor: t.colors.primary,
  },
  searchBox: {
    marginHorizontal: 16, marginBottom: 12, paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: t.colors.surface1, borderRadius: t.radii.full,
    flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: t.colors.border,
  },
  searchInput: { flex: 1, color: t.colors.text, fontSize: 14 },
  createBtn: {
    marginHorizontal: 16, marginBottom: 20, paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: t.colors.primary, borderRadius: t.radii.lg,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  createBtnIcon: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  createBtnTitle: { color: t.colors.onPrimary, fontWeight: '800', fontSize: 15 },
  createBtnSub: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2 },
  section: { paddingVertical: 12 },
  sectionHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, marginBottom: 12,
  },
  sectionTitle: { color: t.colors.text, fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  linkText: { color: t.colors.primary, fontWeight: '700', fontSize: 13 },

  featCard: {
    width: 220, borderRadius: t.radii.lg, overflow: 'hidden',
    backgroundColor: t.colors.surface1, borderWidth: 1, borderColor: t.colors.border,
  },
  featBanner: { height: 90, padding: 10, justifyContent: 'space-between' },
  featBadge: {
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 100,
  },
  featBadgeTxt: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 0.4 },
  featBody: { padding: 12 },
  featName: { color: t.colors.text, fontWeight: '800', fontSize: 15 },
  featCode: { color: t.colors.textDim, fontSize: 11, marginTop: 2 },
  featMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  featMetaTxt: { color: t.colors.textDim, fontSize: 11, fontWeight: '600' },

  trendCard: {
    marginHorizontal: 16, marginBottom: 10, padding: 12,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: t.colors.surface1, borderRadius: t.radii.lg,
    borderWidth: 1, borderColor: t.colors.border,
  },
  trendIcon: {
    width: 46, height: 46, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  trendName: { color: t.colors.text, fontWeight: '700', fontSize: 15 },
  trendCode: { color: t.colors.textDim, fontSize: 11, marginTop: 2 },
  trendMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  trendMetaTxt: { color: t.colors.textDim, fontSize: 11, fontWeight: '600' },

  empty: {
    marginHorizontal: 20, paddingVertical: 32, alignItems: 'center', gap: 6,
    backgroundColor: t.colors.surface1, borderRadius: t.radii.lg,
    borderWidth: 1, borderColor: t.colors.border, borderStyle: 'dashed',
  },
  emptyTitle: { color: t.colors.text, fontWeight: '700', fontSize: 15, marginTop: 4 },
  emptyTxt: { color: t.colors.textDim, fontSize: 13, textAlign: 'center' },
});
