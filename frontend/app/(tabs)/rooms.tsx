import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { theme } from '@/src/theme';
import { api } from '@/src/api/client';

const BANNER_GRADIENTS: [string, string][] = [
  ['#FF3B30', '#7B0F0F'],
  ['#0A84FF', '#0A2E7B'],
  ['#BF5AF2', '#4A0F7B'],
  ['#30D158', '#0F5A2E'],
  ['#FFD60A', '#7B5A0F'],
  ['#32ADE6', '#0F5A7B'],
];

export default function RoomsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [rooms, setRooms] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'discover' | 'my'>('discover');

  const load = useCallback(async () => {
    try {
      const res = tab === 'my' ? await api.myRooms() : await api.listRooms();
      setRooms(res.rooms || []);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: theme.colors.bg }}>
        <View style={styles.header}>
          <Text style={styles.title}>Rooms</Text>
          <TouchableOpacity
            onPress={() => router.push('/room/create')}
            style={styles.newBtn}
            testID="rooms-create-btn"
          >
            <MaterialCommunityIcons name="plus" size={20} color={theme.colors.onPrimary} />
            <Text style={styles.newTxt}>Create</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.chipRow}>
          {(['discover', 'my'] as const).map((t) => (
            <TouchableOpacity
              key={t}
              onPress={() => setTab(t)}
              style={[styles.chip, tab === t && styles.chipActive]}
              testID={`rooms-tab-${t}`}
            >
              <Text style={[styles.chipTxt, tab === t && styles.chipTxtActive]}>
                {t === 'discover' ? 'Discover' : 'My Rooms'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </SafeAreaView>

      {loading ? (
        <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={rooms}
          keyExtractor={(r) => r.room_id}
          contentContainerStyle={{ padding: 16, paddingBottom: 120 + insets.bottom, gap: 14 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialCommunityIcons name="account-group-outline" size={44} color={theme.colors.textMuted} />
              <Text style={styles.emptyTitle}>{tab === 'my' ? 'No rooms joined' : 'No rooms available'}</Text>
              <Text style={styles.emptySub}>Create your first room to start conversations.</Text>
            </View>
          }
          renderItem={({ item, index }) => {
            const grad = BANNER_GRADIENTS[index % BANNER_GRADIENTS.length];
            return (
              <TouchableOpacity
                onPress={() => router.push(`/room/${item.room_id}`)}
                style={styles.card}
                activeOpacity={0.85}
                testID={`room-card-${item.room_code}`}
              >
                <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.banner}>
                  <View style={styles.bannerOverlay}>
                    <View style={styles.codePill}>
                      <Text style={styles.codeTxt}>{item.room_code}</Text>
                    </View>
                    {item.is_private ? (
                      <View style={styles.lockPill}>
                        <MaterialCommunityIcons name="lock" size={12} color="#fff" />
                        <Text style={styles.lockTxt}>Private</Text>
                      </View>
                    ) : null}
                  </View>
                </LinearGradient>
                <View style={styles.cardBody}>
                  <Text style={styles.roomName} numberOfLines={1}>{item.name}</Text>
                  {item.description ? (
                    <Text style={styles.roomDesc} numberOfLines={2}>{item.description}</Text>
                  ) : null}
                  <View style={styles.metaRow}>
                    <View style={styles.metaChip}>
                      <MaterialCommunityIcons name="account-multiple" size={12} color={theme.colors.textDim} />
                      <Text style={styles.metaTxt}>{item.member_count}</Text>
                    </View>
                    <View style={[styles.metaChip, { backgroundColor: theme.colors.green + '22', borderColor: theme.colors.green }]}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.green }} />
                      <Text style={[styles.metaTxt, { color: theme.colors.green }]}>Active</Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
  },
  title: { color: theme.colors.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  newBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: theme.colors.primary, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 100,
  },
  newTxt: { color: theme.colors.onPrimary, fontWeight: '700', fontSize: 13 },
  chipRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 12 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100,
    backgroundColor: theme.colors.surface1, borderWidth: 1, borderColor: theme.colors.border,
  },
  chipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  chipTxt: { color: theme.colors.textDim, fontWeight: '600', fontSize: 13 },
  chipTxtActive: { color: theme.colors.onPrimary },
  card: {
    backgroundColor: theme.colors.surface1, borderRadius: theme.radii.lg, overflow: 'hidden',
    borderWidth: 1, borderColor: theme.colors.border,
  },
  banner: { height: 100, padding: 12, justifyContent: 'space-between' },
  bannerOverlay: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  codePill: {
    backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  codeTxt: { color: '#fff', fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
  lockPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 100,
  },
  lockTxt: { color: '#fff', fontSize: 11, fontWeight: '600' },
  cardBody: { padding: 14 },
  roomName: { color: theme.colors.text, fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  roomDesc: { color: theme.colors.textDim, fontSize: 13, marginTop: 4 },
  metaRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  metaChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100,
    backgroundColor: theme.colors.surface2, borderWidth: 1, borderColor: theme.colors.border,
  },
  metaTxt: { color: theme.colors.textDim, fontSize: 12, fontWeight: '600' },
  empty: { alignItems: 'center', padding: 40, gap: 8 },
  emptyTitle: { color: theme.colors.text, fontWeight: '700', fontSize: 16, marginTop: 8 },
  emptySub: { color: theme.colors.textDim, fontSize: 13, textAlign: 'center' },
});
