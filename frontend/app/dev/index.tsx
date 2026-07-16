import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, FlatList,
  Modal, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { theme } from '@/src/theme';
import { useAuth } from '@/src/context/AuthContext';
import { api } from '@/src/api/client';
import { Avatar } from '@/src/components/Avatar';
import { BadgeRow, BadgePill } from '@/src/components/BadgePill';
import { PButton } from '@/src/components/PButton';
import { ScreenHeader } from '@/src/components/ScreenHeader';

type Section = 'stats' | 'users' | 'reports' | 'badges' | 'broadcast';

export default function DevDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const [section, setSection] = useState<Section>('stats');
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [badges, setBadges] = useState<any[]>([]);
  const [maintenance, setMaintenance] = useState(false);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [selUser, setSelUser] = useState<any>(null);
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [broadcastBusy, setBroadcastBusy] = useState(false);
  const [newBadge, setNewBadge] = useState({ name: '', icon: 'star', color: '#FFD60A', description: '' });
  const [creatingBadge, setCreatingBadge] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, u, r, b, cfg] = await Promise.all([
        api.devStats().catch(() => null),
        api.devUsers().catch(() => ({ users: [] })),
        api.devReports().catch(() => ({ reports: [] })),
        api.listBadges().catch(() => ({ badges: [] })),
        api.devSettings().catch(() => ({ maintenance: false })),
      ]);
      setStats(s);
      setUsers(u.users || []);
      setReports(r.reports || []);
      setBadges(b.badges || []);
      setMaintenance(!!cfg.maintenance);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const res = await api.devUsers(q);
        if (!cancelled) setUsers(res.users || []);
      } catch {}
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q]);

  if (!user?.is_developer) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }}>
        <View style={styles.center}>
          <MaterialCommunityIcons name="lock" size={44} color={theme.colors.textMuted} />
          <Text style={styles.blockedTxt}>Developer access only</Text>
        </View>
      </SafeAreaView>
    );
  }

  const toggleMaint = async () => {
    const next = !maintenance;
    await api.devMaintenance(next);
    setMaintenance(next);
  };

  const doBroadcast = async () => {
    if (!broadcastTitle.trim() || !broadcastMsg.trim()) return;
    setBroadcastBusy(true);
    try {
      await api.devBroadcast(broadcastTitle.trim(), broadcastMsg.trim());
      setBroadcastTitle(''); setBroadcastMsg('');
    } finally { setBroadcastBusy(false); }
  };

  const createBadge = async () => {
    if (!newBadge.name.trim()) return;
    setCreatingBadge(true);
    try {
      await api.createBadge(newBadge);
      setNewBadge({ name: '', icon: 'star', color: '#FFD60A', description: '' });
      load();
    } finally { setCreatingBadge(false); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={['top', 'bottom']}>
      <ScreenHeader
        title="Developer"
        subtitle="Full control panel"
        onBack={() => router.back()}
        right={
          <TouchableOpacity onPress={toggleMaint} style={[styles.maintBtn, maintenance && styles.maintBtnOn]} testID="dev-maint-toggle">
            <MaterialCommunityIcons name={maintenance ? 'wrench' : 'wrench-outline'} size={16} color={maintenance ? theme.colors.onPrimary : theme.colors.text} />
            <Text style={[styles.maintTxt, maintenance && { color: theme.colors.onPrimary }]}>{maintenance ? 'Maint ON' : 'Maint'}</Text>
          </TouchableOpacity>
        }
      />
      <View style={styles.tabs}>
        {(['stats', 'users', 'reports', 'badges', 'broadcast'] as Section[]).map((s) => (
          <TouchableOpacity
            key={s}
            onPress={() => setSection(s)}
            style={[styles.tab, section === s && styles.tabActive]}
            testID={`dev-tab-${s}`}
          >
            <Text style={[styles.tabTxt, section === s && styles.tabTxtActive]}>{s}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 40 }} />
      ) : section === 'stats' ? (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          <StatBig label="Total Users" value={stats?.users || 0} color={theme.colors.blue} />
          <StatBig label="Active Rooms" value={stats?.rooms || 0} color={theme.colors.orange} />
          <StatBig label="Total Posts" value={stats?.posts || 0} color={theme.colors.purple} />
          <StatBig label="Total Messages" value={stats?.messages || 0} color={theme.colors.green} />
          <StatBig label="Open Reports" value={stats?.reports || 0} color={theme.colors.primary} />
        </ScrollView>
      ) : section === 'users' ? (
        <>
          <View style={styles.searchBox}>
            <MaterialCommunityIcons name="magnify" size={20} color={theme.colors.textDim} />
            <TextInput
              placeholder="Search users..."
              placeholderTextColor={theme.colors.textMuted}
              style={styles.searchInput}
              value={q}
              onChangeText={setQ}
              autoCapitalize="none"
              testID="dev-user-search"
            />
          </View>
          <FlatList
            data={users}
            keyExtractor={(u) => u.user_id}
            contentContainerStyle={{ padding: 16, gap: 8 }}
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => setSelUser(item)} style={styles.userRow} testID={`dev-user-${item.username}`}>
                <Avatar uri={item.avatar} name={item.display_name || item.username} size={40} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                    <Text style={styles.uname}>@{item.username}</Text>
                    {item.banned ? <Text style={styles.bannedTag}>BANNED</Text> : null}
                  </View>
                  <Text style={styles.udim} numberOfLines={1}>{item.display_name} · {item.provider || 'guest'}</Text>
                </View>
                <MaterialCommunityIcons name="dots-vertical" size={18} color={theme.colors.textDim} />
              </TouchableOpacity>
            )}
          />
        </>
      ) : section === 'reports' ? (
        <FlatList
          data={reports}
          keyExtractor={(r) => r.report_id}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          ListEmptyComponent={<Text style={styles.emptyTxt}>No reports</Text>}
          renderItem={({ item }) => (
            <View style={styles.reportCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MaterialCommunityIcons name="flag" size={16} color={theme.colors.primary} />
                <Text style={styles.reportType}>{item.target_type} · {item.status}</Text>
              </View>
              <Text style={styles.reportReason}>{item.reason}</Text>
              <Text style={styles.reportMeta}>Target: {item.target_id}</Text>
              <Text style={styles.reportMeta}>Reporter: {item.reporter}</Text>
            </View>
          )}
        />
      ) : section === 'badges' ? (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Create new badge</Text>
            <TextInput placeholder="Badge name" placeholderTextColor={theme.colors.textMuted} style={styles.input} value={newBadge.name} onChangeText={(t) => setNewBadge((b) => ({ ...b, name: t }))} testID="dev-badge-name" />
            <TextInput placeholder="Icon name (e.g. star)" placeholderTextColor={theme.colors.textMuted} style={styles.input} value={newBadge.icon} onChangeText={(t) => setNewBadge((b) => ({ ...b, icon: t }))} testID="dev-badge-icon" />
            <TextInput placeholder="Color hex (e.g. #FFD60A)" placeholderTextColor={theme.colors.textMuted} style={styles.input} value={newBadge.color} onChangeText={(t) => setNewBadge((b) => ({ ...b, color: t }))} testID="dev-badge-color" />
            <TextInput placeholder="Description" placeholderTextColor={theme.colors.textMuted} style={styles.input} value={newBadge.description} onChangeText={(t) => setNewBadge((b) => ({ ...b, description: t }))} testID="dev-badge-desc" />
            <PButton title="Create badge" onPress={createBadge} loading={creatingBadge} fullWidth testID="dev-badge-create" />
          </View>
          <Text style={styles.cardTitle}>Existing badges ({badges.length})</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {badges.map((b) => (
              <View key={b.badge_id} style={styles.badgeItem}>
                <BadgePill badge={b} />
                <Text style={styles.badgeItemDesc}>{b.description || b.badge_id}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Broadcast announcement</Text>
              <Text style={styles.cardSub}>Notifies every user with an in-app notification and push.</Text>
              <TextInput placeholder="Title" placeholderTextColor={theme.colors.textMuted} style={styles.input} value={broadcastTitle} onChangeText={setBroadcastTitle} testID="dev-broadcast-title" />
              <TextInput placeholder="Message" placeholderTextColor={theme.colors.textMuted} style={[styles.input, { height: 100, textAlignVertical: 'top' }]} value={broadcastMsg} onChangeText={setBroadcastMsg} multiline testID="dev-broadcast-msg" />
              <PButton title="Send broadcast" onPress={doBroadcast} loading={broadcastBusy} fullWidth testID="dev-broadcast-send" />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      <Modal visible={!!selUser} transparent animationType="slide" onRequestClose={() => setSelUser(null)}>
        <View style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>@{selUser?.username}</Text>
              <TouchableOpacity onPress={() => setSelUser(null)}><MaterialCommunityIcons name="close" size={22} color={theme.colors.text} /></TouchableOpacity>
            </View>
            {selUser ? (
              <>
                <Text style={styles.modalDetail}>{selUser.display_name} · {selUser.provider}</Text>
                <BadgeRow badges={selUser.badges} />
                <View style={{ height: 16 }} />
                <PButton
                  title={selUser.banned ? 'Unban user' : 'Ban user'}
                  variant="outline"
                  onPress={async () => {
                    if (selUser.banned) await api.devUnban(selUser.user_id);
                    else await api.devBan(selUser.user_id);
                    setSelUser(null);
                    load();
                  }}
                  fullWidth
                  testID="dev-ban-btn"
                />
                <View style={{ height: 8 }} />
                <Text style={styles.modalSubTitle}>Assign badge</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {badges.map((b) => (
                    <TouchableOpacity
                      key={b.badge_id}
                      onPress={async () => { await api.assignBadge(selUser.user_id, b.badge_id); setSelUser({ ...selUser, badges: [...(selUser.badges || []), b.badge_id] }); }}
                      testID={`dev-assign-${b.badge_id}`}
                    >
                      <BadgePill badge={b} mini />
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={{ height: 8 }} />
                <Text style={styles.modalSubTitle}>Current badges</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {(selUser.badges || []).map((bid: string) => (
                    <TouchableOpacity
                      key={bid}
                      onPress={async () => {
                        await api.removeBadge(selUser.user_id, bid);
                        setSelUser({ ...selUser, badges: (selUser.badges || []).filter((x: string) => x !== bid) });
                      }}
                      testID={`dev-remove-${bid}`}
                    >
                      <BadgePill badge={bid} />
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function StatBig({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={[styles.statBig, { borderColor: color + '55' }]}>
      <View style={[styles.statIcon, { backgroundColor: color + '22' }]}>
        <MaterialCommunityIcons name="chart-line" size={22} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.statLbl}>{label}</Text>
        <Text style={styles.statVal}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  blockedTxt: { color: theme.colors.textDim, fontSize: 14 },
  maintBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 100, backgroundColor: theme.colors.surface2, borderWidth: 1, borderColor: theme.colors.border,
  },
  maintBtnOn: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  maintTxt: { color: theme.colors.text, fontSize: 12, fontWeight: '700' },
  tabs: {
    flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 10, gap: 6,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  tab: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 100,
    backgroundColor: theme.colors.surface1, borderWidth: 1, borderColor: theme.colors.border,
  },
  tabActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  tabTxt: { color: theme.colors.textDim, fontWeight: '700', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 },
  tabTxtActive: { color: theme.colors.onPrimary },
  statBig: {
    flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16,
    backgroundColor: theme.colors.surface1, borderRadius: theme.radii.lg, borderWidth: 1,
  },
  statIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  statLbl: { color: theme.colors.textDim, fontSize: 12 },
  statVal: { color: theme.colors.text, fontSize: 24, fontWeight: '800', marginTop: 2 },
  searchBox: {
    marginHorizontal: 16, marginTop: 12, paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: theme.colors.surface1, borderRadius: theme.radii.full,
    flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: theme.colors.border,
  },
  searchInput: { flex: 1, color: theme.colors.text, fontSize: 14 },
  userRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12,
    backgroundColor: theme.colors.surface1, borderRadius: theme.radii.lg,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  uname: { color: theme.colors.text, fontWeight: '700' },
  udim: { color: theme.colors.textDim, fontSize: 12, marginTop: 2 },
  bannedTag: { color: theme.colors.primary, fontSize: 10, fontWeight: '900', letterSpacing: 0.4 },
  reportCard: {
    padding: 12, backgroundColor: theme.colors.surface1, borderRadius: theme.radii.md,
    borderWidth: 1, borderColor: theme.colors.border, gap: 4,
  },
  reportType: { color: theme.colors.text, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  reportReason: { color: theme.colors.text, fontSize: 14, marginTop: 4 },
  reportMeta: { color: theme.colors.textDim, fontSize: 11 },
  emptyTxt: { color: theme.colors.textDim, textAlign: 'center', paddingTop: 40 },
  card: {
    padding: 16, backgroundColor: theme.colors.surface1, borderRadius: theme.radii.lg,
    borderWidth: 1, borderColor: theme.colors.border, gap: 8,
  },
  cardTitle: { color: theme.colors.text, fontWeight: '800', fontSize: 15 },
  cardSub: { color: theme.colors.textDim, fontSize: 12, marginBottom: 6 },
  input: {
    backgroundColor: theme.colors.surface2, color: theme.colors.text,
    borderRadius: theme.radii.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  badgeItem: { padding: 10, backgroundColor: theme.colors.surface1, borderRadius: theme.radii.md, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'flex-start', gap: 4 },
  badgeItemDesc: { color: theme.colors.textDim, fontSize: 11 },
  modalWrap: { flex: 1, backgroundColor: theme.colors.overlay, justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: theme.colors.surface1, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 20, paddingBottom: 40, gap: 6, maxHeight: '80%',
  },
  modalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  modalTitle: { color: theme.colors.text, fontSize: 18, fontWeight: '800' },
  modalDetail: { color: theme.colors.textDim, fontSize: 13, marginBottom: 8 },
  modalSubTitle: { color: theme.colors.textDim, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 8 },
});
