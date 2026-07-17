import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, FlatList,
  Modal, ActivityIndicator, KeyboardAvoidingView, Platform, Switch, Alert,
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

type Section =
  | 'overview'
  | 'users'
  | 'reports'
  | 'badges'
  | 'flags'
  | 'announce'
  | 'logs';

const SECTIONS: { key: Section; label: string; icon: string }[] = [
  { key: 'overview', label: 'Overview', icon: 'view-dashboard' },
  { key: 'users', label: 'Users', icon: 'account-cog' },
  { key: 'reports', label: 'Reports', icon: 'flag-variant' },
  { key: 'badges', label: 'Badges', icon: 'medal' },
  { key: 'flags', label: 'Toggles', icon: 'toggle-switch' },
  { key: 'announce', label: 'Announce', icon: 'bullhorn' },
  { key: 'logs', label: 'Mod Logs', icon: 'clipboard-list' },
];

// Human labels for feature flag keys
const FLAG_LABELS: Record<string, { title: string; desc: string }> = {
  posts_enabled: { title: 'Posts', desc: 'Allow users to create posts' },
  voice_notes_enabled: { title: 'Voice notes', desc: 'Enable voice notes in chats & rooms' },
  room_creation_enabled: { title: 'Room creation', desc: 'Users can create new rooms' },
  guest_registration_enabled: { title: 'Guest sign-ups', desc: 'New guest accounts can register' },
  google_auth_enabled: { title: 'Google Auth', desc: 'Allow Google sign-in' },
  friends_system_enabled: { title: 'Friends system', desc: 'Send / accept friend requests' },
  direct_messages_enabled: { title: 'Direct messages', desc: '1-on-1 private chats' },
  profanity_filter_enabled: { title: 'Profanity filter', desc: 'Auto-flag & censor messages' },
};

export default function DevDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const [section, setSection] = useState<Section>('overview');

  // Data state
  const [stats, setStats] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [badges, setBadges] = useState<any[]>([]);
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [flagDefaults, setFlagDefaults] = useState<Record<string, boolean>>({});
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [modLogs, setModLogs] = useState<any[]>([]);
  const [maintenance, setMaintenance] = useState(false);

  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  // Modals
  const [selUser, setSelUser] = useState<any>(null);
  const [userDetail, setUserDetail] = useState<any>(null);

  // Announcement form
  const [annTitle, setAnnTitle] = useState('');
  const [annMsg, setAnnMsg] = useState('');
  const [annSeverity, setAnnSeverity] = useState<'info' | 'warning' | 'critical'>('info');
  const [annTtl, setAnnTtl] = useState('24');
  const [annBusy, setAnnBusy] = useState(false);

  // Badge form
  const [newBadge, setNewBadge] = useState({ name: '', icon: 'star', color: '#FFD60A', description: '' });
  const [creatingBadge, setCreatingBadge] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      const [s, an, u, r, b, cfg, f, anns, ml] = await Promise.all([
        api.devStats().catch(() => null),
        api.devAnalytics().catch(() => null),
        api.devUsers().catch(() => ({ users: [] })),
        api.devReports().catch(() => ({ reports: [] })),
        api.listBadges().catch(() => ({ badges: [] })),
        api.devSettings().catch(() => ({ maintenance: false })),
        api.devGetFeatures().catch(() => ({ flags: {}, defaults: {} })),
        api.devListAnnouncements().catch(() => ({ announcements: [] })),
        api.devModLogs().catch(() => ({ logs: [] })),
      ]);
      setStats(s);
      setAnalytics(an);
      setUsers(u.users || []);
      setReports(r.reports || []);
      setBadges(b.badges || []);
      setMaintenance(!!cfg.maintenance);
      setFlags(f.flags || {});
      setFlagDefaults(f.defaults || {});
      setAnnouncements(anns.announcements || []);
      setModLogs(ml.logs || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Debounced user search
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

  const openUser = useCallback(async (u: any) => {
    setSelUser(u);
    setUserDetail(null);
    try {
      const detail = await api.devUserDetail(u.user_id);
      setUserDetail(detail);
    } catch {}
  }, []);

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
    setMaintenance(next);
    try { await api.devMaintenance(next); } catch { setMaintenance(!next); }
  };

  const toggleFlag = async (key: string, val: boolean) => {
    setFlags((f) => ({ ...f, [key]: val }));
    try { await api.devSetFeature(key, val); } catch {
      setFlags((f) => ({ ...f, [key]: !val }));
      Alert.alert('Failed', 'Could not update flag');
    }
  };

  const doBroadcast = async () => {
    if (!annTitle.trim() || !annMsg.trim()) return;
    setAnnBusy(true);
    try {
      await api.devCreateAnnouncement({
        title: annTitle.trim(),
        message: annMsg.trim(),
        severity: annSeverity,
        ttl_hours: Math.max(1, Math.min(720, Number(annTtl) || 24)),
      });
      setAnnTitle('');
      setAnnMsg('');
      setAnnTtl('24');
      setAnnSeverity('info');
      // reload announcements list
      const anns = await api.devListAnnouncements().catch(() => ({ announcements: [] }));
      setAnnouncements(anns.announcements || []);
      Alert.alert('Announcement sent', 'All users will see it.');
    } catch (e: any) {
      Alert.alert('Failed', e?.message || 'Could not broadcast');
    } finally {
      setAnnBusy(false);
    }
  };

  const deactivateAnn = async (ann_id: string) => {
    try {
      await api.devDeactivateAnnouncement(ann_id);
      setAnnouncements((prev) => prev.map((a) => a.ann_id === ann_id ? { ...a, active: false } : a));
    } catch (e: any) { Alert.alert('Failed', e?.message); }
  };

  const createBadge = async () => {
    if (!newBadge.name.trim()) return;
    setCreatingBadge(true);
    try {
      await api.createBadge(newBadge);
      setNewBadge({ name: '', icon: 'star', color: '#FFD60A', description: '' });
      const b = await api.listBadges().catch(() => ({ badges: [] }));
      setBadges(b.badges || []);
    } finally { setCreatingBadge(false); }
  };

  const doBan = async () => {
    if (!selUser) return;
    if (selUser.banned) await api.devUnban(selUser.user_id);
    else await api.devBan(selUser.user_id);
    setUsers((prev) => prev.map((x) => x.user_id === selUser.user_id ? { ...x, banned: !selUser.banned } : x));
    setSelUser({ ...selUser, banned: !selUser.banned });
  };

  const doForceLogout = async () => {
    if (!selUser) return;
    try {
      const r = await api.devLogoutAll(selUser.user_id);
      Alert.alert('Force logout', `${r.sessions_removed} sessions removed`);
    } catch (e: any) { Alert.alert('Failed', e?.message); }
  };

  const doResetPassword = async () => {
    if (!selUser) return;
    Alert.alert(
      'Reset password?',
      `Reset @${selUser.username} to temp password and force change on next login?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              const r = await api.devResetPassword(selUser.user_id);
              Alert.alert('Password reset', `Temporary password: ${r.temp_password}`);
            } catch (e: any) { Alert.alert('Failed', e?.message); }
          },
        },
      ],
    );
  };

  const doDeleteAccount = async () => {
    if (!selUser) return;
    Alert.alert(
      'Delete account?',
      `This will ban and mark @${selUser.username} as deleted. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.devDeleteAccount(selUser.user_id, 'admin action');
              setUsers((prev) => prev.filter((x) => x.user_id !== selUser.user_id));
              setSelUser(null);
            } catch (e: any) { Alert.alert('Failed', e?.message); }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={['top', 'bottom']}>
      <ScreenHeader
        title="Developer"
        subtitle={`Signed in as @${user.username}`}
        onBack={() => router.back()}
        right={
          <TouchableOpacity onPress={toggleMaint} style={[styles.maintBtn, maintenance && styles.maintBtnOn]} testID="dev-maint-toggle">
            <MaterialCommunityIcons name={maintenance ? 'wrench' : 'wrench-outline'} size={16} color={maintenance ? theme.colors.onPrimary : theme.colors.text} />
            <Text style={[styles.maintTxt, maintenance && { color: theme.colors.onPrimary }]}>{maintenance ? 'Maint ON' : 'Maint'}</Text>
          </TouchableOpacity>
        }
      />
      <View style={styles.tabsWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {SECTIONS.map((s) => (
            <TouchableOpacity
              key={s.key}
              onPress={() => setSection(s.key)}
              style={[styles.tab, section === s.key && styles.tabActive]}
              testID={`dev-tab-${s.key}`}
            >
              <MaterialCommunityIcons name={s.icon as any} size={14} color={section === s.key ? theme.colors.onPrimary : theme.colors.textDim} />
              <Text style={[styles.tabTxt, section === s.key && styles.tabTxtActive]}>{s.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 40 }} />
      ) : section === 'overview' ? (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 120 }}>
          <Text style={styles.sectionTitle}>Core stats</Text>
          <View style={styles.statsRow}>
            <StatSmall label="Users" value={stats?.users || 0} color={theme.colors.blue} icon="account-multiple" />
            <StatSmall label="Rooms" value={stats?.rooms || 0} color={theme.colors.orange} icon="pound-box" />
          </View>
          <View style={styles.statsRow}>
            <StatSmall label="Messages" value={stats?.messages || 0} color={theme.colors.green} icon="message-text" />
            <StatSmall label="Posts" value={stats?.posts || 0} color={theme.colors.purple} icon="image-multiple" />
          </View>
          <View style={styles.statsRow}>
            <StatSmall label="Open reports" value={stats?.reports || 0} color={theme.colors.primary} icon="flag" />
            <StatSmall label="Banned users" value={analytics?.banned_users || 0} color="#8E8E93" icon="account-cancel" />
          </View>

          <Text style={styles.sectionTitle}>Growth</Text>
          <View style={styles.statsRow}>
            <StatSmall label="New users 24h" value={analytics?.new_users_24h || 0} color={theme.colors.green} icon="account-plus" />
            <StatSmall label="New users 7d" value={analytics?.new_users_7d || 0} color={theme.colors.blue} icon="chart-line" />
          </View>
          <View style={styles.statsRow}>
            <StatSmall label="Messages 24h" value={analytics?.total_messages_24h || 0} color={theme.colors.orange} icon="message-flash" />
            <StatSmall label="Posts 7d" value={analytics?.posts_7d || 0} color={theme.colors.purple} icon="image-plus" />
          </View>
          <View style={styles.statsRow}>
            <StatSmall label="Featured rooms" value={analytics?.featured_rooms || 0} color="#FFD60A" icon="star" />
            <StatSmall label="Pinned rooms" value={analytics?.pinned_rooms || 0} color={theme.colors.primary} icon="pin" />
          </View>

          <View style={styles.actionCard}>
            <Text style={styles.actionTitle}>Quick actions</Text>
            <View style={{ height: 8 }} />
            <PButton title="Send global announcement" onPress={() => setSection('announce')} icon={<MaterialCommunityIcons name="bullhorn" size={16} color={theme.colors.onPrimary} />} fullWidth />
            <View style={{ height: 8 }} />
            <PButton title="Manage feature toggles" variant="outline" onPress={() => setSection('flags')} fullWidth />
          </View>
        </ScrollView>
      ) : section === 'users' ? (
        <>
          <View style={styles.searchBox}>
            <MaterialCommunityIcons name="magnify" size={20} color={theme.colors.textDim} />
            <TextInput
              placeholder="Search by username, name, or email..."
              placeholderTextColor={theme.colors.textMuted}
              style={styles.searchInput}
              value={q}
              onChangeText={setQ}
              autoCapitalize="none"
              testID="dev-user-search"
            />
            {q ? (
              <TouchableOpacity onPress={() => setQ('')}>
                <MaterialCommunityIcons name="close-circle" size={18} color={theme.colors.textDim} />
              </TouchableOpacity>
            ) : null}
          </View>
          <FlatList
            data={users}
            keyExtractor={(u) => u.user_id}
            contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 120 }}
            ListEmptyComponent={<Text style={styles.emptyTxt}>No users match.</Text>}
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => openUser(item)} style={styles.userRow} testID={`dev-user-${item.username}`}>
                <Avatar uri={item.avatar} name={item.display_name || item.username} size={40} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                    <Text style={styles.uname}>@{item.username}</Text>
                    {item.is_developer ? <Text style={styles.devTag}>DEV</Text> : null}
                    {item.banned ? <Text style={styles.bannedTag}>BANNED</Text> : null}
                  </View>
                  <Text style={styles.udim} numberOfLines={1}>{item.display_name} · {item.provider || 'guest'}</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={theme.colors.textDim} />
              </TouchableOpacity>
            )}
          />
        </>
      ) : section === 'reports' ? (
        <FlatList
          data={reports}
          keyExtractor={(r) => r.report_id || `${r.target_id}-${r.reason}`}
          contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 120 }}
          ListEmptyComponent={<Text style={styles.emptyTxt}>No reports</Text>}
          renderItem={({ item }) => (
            <View style={styles.reportCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MaterialCommunityIcons name="flag" size={16} color={theme.colors.primary} />
                <Text style={styles.reportType}>{item.target_type} · {item.status}</Text>
              </View>
              <Text style={styles.reportReason}>{item.reason}</Text>
              <Text style={styles.reportMeta}>Target: {item.target_id}</Text>
              <Text style={styles.reportMeta}>Reporter: {item.reporter || item.reporter_id}</Text>
              {item.created_at ? <Text style={styles.reportMeta}>At: {item.created_at}</Text> : null}
            </View>
          )}
        />
      ) : section === 'badges' ? (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 120 }}>
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
      ) : section === 'flags' ? (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 120 }}>
          <Text style={styles.sectionTitle}>Feature toggles</Text>
          <Text style={styles.helperTxt}>Toggles apply globally to all users instantly. Disabling can hide features from the UI.</Text>
          {Object.keys(FLAG_LABELS).map((k) => {
            const meta = FLAG_LABELS[k];
            const val = !!flags[k];
            const isDefault = flagDefaults[k] === val;
            return (
              <View key={k} style={styles.flagRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.flagTitle}>{meta.title}</Text>
                  <Text style={styles.flagDesc}>{meta.desc}</Text>
                  {!isDefault ? <Text style={styles.flagOverride}>Overridden</Text> : null}
                </View>
                <Switch
                  value={val}
                  onValueChange={(v) => toggleFlag(k, v)}
                  trackColor={{ true: theme.colors.primary, false: '#3A3A44' }}
                  thumbColor="#fff"
                  testID={`dev-flag-${k}`}
                />
              </View>
            );
          })}
        </ScrollView>
      ) : section === 'announce' ? (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 120 }}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Global announcement</Text>
              <Text style={styles.cardSub}>Every user sees a popup on next app open. Also sent as notification + push.</Text>
              <TextInput placeholder="Title (max 120)" placeholderTextColor={theme.colors.textMuted} style={styles.input} value={annTitle} onChangeText={setAnnTitle} maxLength={120} testID="dev-ann-title" />
              <TextInput placeholder="Message (max 600)" placeholderTextColor={theme.colors.textMuted} style={[styles.input, { height: 100, textAlignVertical: 'top' }]} value={annMsg} onChangeText={setAnnMsg} multiline maxLength={600} testID="dev-ann-msg" />
              <View style={styles.sevRow}>
                {(['info', 'warning', 'critical'] as const).map((s) => (
                  <TouchableOpacity
                    key={s}
                    onPress={() => setAnnSeverity(s)}
                    style={[styles.sevChip, annSeverity === s && styles.sevChipActive, annSeverity === s && s === 'critical' && { backgroundColor: '#FF3B30' }, annSeverity === s && s === 'warning' && { backgroundColor: '#FF9F0A' }]}
                    testID={`dev-ann-sev-${s}`}
                  >
                    <Text style={[styles.sevTxt, annSeverity === s && styles.sevTxtActive]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.ttlRow}>
                <Text style={styles.ttlLabel}>Show for (hours):</Text>
                <TextInput
                  value={annTtl}
                  onChangeText={setAnnTtl}
                  placeholder="24"
                  placeholderTextColor={theme.colors.textMuted}
                  keyboardType="number-pad"
                  style={styles.ttlInput}
                  testID="dev-ann-ttl"
                />
              </View>
              <PButton title="Send to everyone" onPress={doBroadcast} loading={annBusy} fullWidth testID="dev-ann-send" />
            </View>
            <Text style={styles.sectionTitle}>Recent announcements</Text>
            {announcements.length === 0 ? (
              <Text style={styles.emptyTxt}>No announcements sent yet.</Text>
            ) : (
              announcements.map((a) => (
                <View key={a.ann_id} style={styles.annCard}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={[styles.sevDot, { backgroundColor: a.severity === 'critical' ? '#FF3B30' : a.severity === 'warning' ? '#FF9F0A' : theme.colors.blue }]} />
                    <Text style={styles.annTitle}>{a.title}</Text>
                    {a.active ? <Text style={styles.activeDot}>ACTIVE</Text> : <Text style={styles.inactiveDot}>ENDED</Text>}
                  </View>
                  <Text style={styles.annMsg}>{a.message}</Text>
                  <Text style={styles.annMeta}>Dismissed by {a.dismissed_count || 0} · expires {a.expires_at?.slice(0, 16).replace('T', ' ')}</Text>
                  {a.active ? (
                    <TouchableOpacity onPress={() => deactivateAnn(a.ann_id)} style={styles.deactBtn}>
                      <Text style={styles.deactTxt}>End early</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ))
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      ) : (
        <FlatList
          data={modLogs}
          keyExtractor={(l) => `${l.actor}-${l.at}-${l.action}`}
          contentContainerStyle={{ padding: 16, gap: 6, paddingBottom: 120 }}
          ListEmptyComponent={<Text style={styles.emptyTxt}>No moderation logs yet.</Text>}
          renderItem={({ item }) => (
            <View style={styles.logRow}>
              <MaterialCommunityIcons name="shield-check" size={16} color={theme.colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.logAction}>{item.action}</Text>
                <Text style={styles.logMeta}>By {item.actor} · {item.at}</Text>
                <Text style={styles.logDetail} numberOfLines={2}>{JSON.stringify(item.meta || {})}</Text>
              </View>
            </View>
          )}
        />
      )}

      {/* Enhanced User Detail Modal */}
      <Modal visible={!!selUser} transparent animationType="slide" onRequestClose={() => setSelUser(null)}>
        <View style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <View style={styles.modalHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>@{selUser?.username}</Text>
                <Text style={styles.modalSub}>{selUser?.display_name} · {selUser?.provider || 'guest'}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelUser(null)}>
                <MaterialCommunityIcons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {selUser ? (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <Avatar uri={selUser.avatar} name={selUser.display_name || selUser.username} size={54} />
                    <View style={{ flex: 1 }}>
                      <BadgeRow badges={selUser.badges} />
                      {selUser.banned ? <Text style={styles.bannedBanner}>Account BANNED · {selUser.ban_reason || ''}</Text> : null}
                    </View>
                  </View>

                  {userDetail ? (
                    <View style={styles.detailBox}>
                      <DetailKV label="Friends" value={userDetail.friends} />
                      <DetailKV label="Rooms owned" value={userDetail.rooms} />
                      <DetailKV label="Posts" value={userDetail.posts} />
                      <DetailKV label="Messages sent" value={userDetail.messages} />
                      <DetailKV label="Active sessions" value={userDetail.sessions?.length || 0} />
                    </View>
                  ) : <ActivityIndicator style={{ marginVertical: 12 }} color={theme.colors.primary} />}

                  <View style={{ gap: 8, marginTop: 8 }}>
                    <PButton
                      title={selUser.banned ? 'Unban user' : 'Ban user'}
                      variant="outline"
                      onPress={doBan}
                      fullWidth
                      testID="dev-ban-btn"
                    />
                    <PButton title="Force logout all sessions" variant="ghost" onPress={doForceLogout} fullWidth />
                    {selUser.provider === 'guest' ? (
                      <PButton title="Reset password (temp)" variant="ghost" onPress={doResetPassword} fullWidth />
                    ) : null}
                    <PButton title="Delete account" variant="ghost" onPress={doDeleteAccount} fullWidth />
                  </View>

                  <Text style={styles.modalSubTitle}>Assign badge</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {badges.map((b) => (
                      <TouchableOpacity
                        key={b.badge_id}
                        onPress={async () => {
                          await api.assignBadge(selUser.user_id, b.badge_id);
                          setSelUser({ ...selUser, badges: [...(selUser.badges || []), b.badge_id] });
                        }}
                        testID={`dev-assign-${b.badge_id}`}
                      >
                        <BadgePill badge={b} mini />
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.modalSubTitle}>Current badges (tap to remove)</Text>
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
                  <View style={{ height: 24 }} />
                </>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function StatSmall({ label, value, color, icon }: { label: string; value: number | string; color: string; icon: string }) {
  return (
    <View style={[styles.statSmall, { borderColor: color + '55' }]}>
      <View style={[styles.statSmallIcon, { backgroundColor: color + '22' }]}>
        <MaterialCommunityIcons name={icon as any} size={16} color={color} />
      </View>
      <Text style={styles.statSmallVal}>{value}</Text>
      <Text style={styles.statSmallLbl}>{label}</Text>
    </View>
  );
}

function DetailKV({ label, value }: { label: string; value: any }) {
  return (
    <View style={styles.kv}>
      <Text style={styles.kvLbl}>{label}</Text>
      <Text style={styles.kvVal}>{value}</Text>
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
  tabsWrap: {
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  tabs: {
    paddingHorizontal: 12, paddingVertical: 10, gap: 6, alignItems: 'center',
  },
  tab: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 100, flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: theme.colors.surface1, borderWidth: 1, borderColor: theme.colors.border,
  },
  tabActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  tabTxt: { color: theme.colors.textDim, fontWeight: '700', fontSize: 11, letterSpacing: 0.4 },
  tabTxtActive: { color: theme.colors.onPrimary },

  sectionTitle: { color: theme.colors.text, fontSize: 15, fontWeight: '800', marginTop: 4 },
  helperTxt: { color: theme.colors.textDim, fontSize: 12 },

  statsRow: { flexDirection: 'row', gap: 10 },
  statSmall: {
    flex: 1, padding: 12, borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.surface1, borderWidth: 1, gap: 4,
  },
  statSmallIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  statSmallVal: { color: theme.colors.text, fontSize: 20, fontWeight: '800' },
  statSmallLbl: { color: theme.colors.textDim, fontSize: 11 },

  actionCard: {
    padding: 14, borderRadius: theme.radii.lg, backgroundColor: theme.colors.surface1,
    borderWidth: 1, borderColor: theme.colors.border, marginTop: 4,
  },
  actionTitle: { color: theme.colors.text, fontWeight: '800', fontSize: 14 },

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
  devTag: { color: theme.colors.onPrimary, fontSize: 9, fontWeight: '900', letterSpacing: 0.4, backgroundColor: theme.colors.primary, paddingHorizontal: 6, borderRadius: 4, overflow: 'hidden' },

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

  flagRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
    backgroundColor: theme.colors.surface1, borderRadius: theme.radii.lg,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  flagTitle: { color: theme.colors.text, fontWeight: '700', fontSize: 14 },
  flagDesc: { color: theme.colors.textDim, fontSize: 12, marginTop: 2 },
  flagOverride: { color: theme.colors.primary, fontSize: 10, fontWeight: '800', marginTop: 4, letterSpacing: 0.4 },

  sevRow: { flexDirection: 'row', gap: 8 },
  sevChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100,
    backgroundColor: theme.colors.surface2, borderWidth: 1, borderColor: theme.colors.border,
  },
  sevChipActive: { backgroundColor: theme.colors.blue, borderColor: theme.colors.blue },
  sevTxt: { color: theme.colors.textDim, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  sevTxtActive: { color: theme.colors.onPrimary },
  ttlRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ttlLabel: { color: theme.colors.textDim, fontSize: 13, flex: 1 },
  ttlInput: {
    backgroundColor: theme.colors.surface2, color: theme.colors.text,
    borderRadius: theme.radii.md, paddingHorizontal: 12, paddingVertical: 8,
    fontSize: 14, borderWidth: 1, borderColor: theme.colors.border, width: 80, textAlign: 'center',
  },

  annCard: { padding: 12, backgroundColor: theme.colors.surface1, borderRadius: theme.radii.md, borderWidth: 1, borderColor: theme.colors.border, gap: 4 },
  annTitle: { color: theme.colors.text, fontWeight: '800', fontSize: 14, flex: 1 },
  annMsg: { color: theme.colors.text, fontSize: 13 },
  annMeta: { color: theme.colors.textDim, fontSize: 11 },
  activeDot: { color: theme.colors.green, fontSize: 9, fontWeight: '900', letterSpacing: 0.4 },
  inactiveDot: { color: theme.colors.textMuted, fontSize: 9, fontWeight: '900', letterSpacing: 0.4 },
  sevDot: { width: 8, height: 8, borderRadius: 4 },
  deactBtn: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: theme.colors.border, marginTop: 4 },
  deactTxt: { color: theme.colors.textDim, fontSize: 11, fontWeight: '700' },

  logRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, backgroundColor: theme.colors.surface1, borderRadius: theme.radii.md, borderWidth: 1, borderColor: theme.colors.border },
  logAction: { color: theme.colors.text, fontWeight: '700', fontSize: 13, textTransform: 'capitalize' },
  logMeta: { color: theme.colors.textDim, fontSize: 11 },
  logDetail: { color: theme.colors.textMuted, fontSize: 10, marginTop: 2, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },

  modalWrap: { flex: 1, backgroundColor: theme.colors.overlay, justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: theme.colors.surface1, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 20, paddingBottom: 40, gap: 6, maxHeight: '88%',
  },
  modalHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 4 },
  modalTitle: { color: theme.colors.text, fontSize: 18, fontWeight: '800' },
  modalSub: { color: theme.colors.textDim, fontSize: 12, marginTop: 2 },
  modalSubTitle: { color: theme.colors.textDim, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 14, marginBottom: 4 },
  detailBox: { padding: 12, backgroundColor: theme.colors.surface2, borderRadius: theme.radii.md, gap: 6, marginTop: 8 },
  kv: { flexDirection: 'row', justifyContent: 'space-between' },
  kvLbl: { color: theme.colors.textDim, fontSize: 12 },
  kvVal: { color: theme.colors.text, fontSize: 13, fontWeight: '700' },
  bannedBanner: { color: theme.colors.primary, fontSize: 11, fontWeight: '800', marginTop: 4 },
});
