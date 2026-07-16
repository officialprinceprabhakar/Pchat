// Owner-only Role Management: assign/remove admins & moderators, view lists.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { api } from '@/src/api/client';
import { Avatar } from '@/src/components/Avatar';
import { ScreenHeader } from '@/src/components/ScreenHeader';

const ROLE_COLORS: Record<string, string> = {
  developer: '#FF9F0A', owner: '#FF453A', admin: '#0A84FF', moderator: '#30D158',
  verified: '#32ADE6', vip: '#FFD60A', member: '#F2F2F2', guest: '#A1A1A8',
};

export default function RoleManagementScreen() {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [room, setRoom] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [assignRole, setAssignRole] = useState<'admin' | 'moderator'>('admin');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [r, mm] = await Promise.all([api.getRoom(roomId), api.roomMembers(roomId)]);
      setRoom(r.room);
      setMembers(mm.members || []);
    } finally { setLoading(false); }
  }, [roomId]);

  useEffect(() => { load(); }, [load]);

  if (loading || !room) {
    return <View style={s.center}><ActivityIndicator color={t.colors.primary} /></View>;
  }

  const isOwner = room.owner_id === user?.user_id || user?.is_developer;
  if (!isOwner) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.bg }} edges={['top', 'bottom']}>
        <ScreenHeader title="Role Management" onBack={() => router.back()} />
        <View style={s.blocked}>
          <MaterialCommunityIcons name="lock" size={44} color={t.colors.textMuted} />
          <Text style={s.blockedTxt}>Only the room owner can manage roles</Text>
        </View>
      </SafeAreaView>
    );
  }

  const admins = members.filter((m) => m.role === 'admin');
  const mods = members.filter((m) => m.role === 'moderator');
  const searchable = members.filter((m) => {
    if (m.user_id === room.owner_id) return false;
    if (!q.trim()) return true;
    const needle = q.replace(/^@/, '').toLowerCase();
    return (m.username || '').toLowerCase().includes(needle) || (m.display_name || '').toLowerCase().includes(needle);
  }).slice(0, 8);

  const doAssign = async (target: any) => {
    setBusy(target.user_id);
    try {
      await api.setRoomRole(roomId, target.user_id, assignRole);
      Alert.alert('Role assigned', `@${target.username} is now ${assignRole}`);
      setQ('');
      await load();
    } catch (e: any) {
      Alert.alert('Failed', e.message || 'unable to assign');
    } finally { setBusy(null); }
  };

  const doDemote = async (target: any) => {
    setBusy(target.user_id);
    try {
      await api.setRoomRole(roomId, target.user_id, 'member');
      await load();
    } finally { setBusy(null); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.bg }} edges={['top', 'bottom']}>
      <ScreenHeader title="Role Management" subtitle={room.name} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 20, paddingBottom: 40 }}>
        {/* Assign section */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>ASSIGN ROLE</Text>
          <View style={s.card}>
            <View style={s.segment}>
              {(['admin', 'moderator'] as const).map((r) => (
                <TouchableOpacity
                  key={r}
                  onPress={() => setAssignRole(r)}
                  style={[s.segBtn, assignRole === r && s.segBtnActive]}
                  testID={`role-assign-${r}`}
                >
                  <MaterialCommunityIcons name={r === 'admin' ? 'shield-star' : 'shield'} size={16} color={assignRole === r ? t.colors.onPrimary : t.colors.text} />
                  <Text style={[s.segTxt, assignRole === r && s.segTxtActive]}>{r === 'admin' ? 'Admin' : 'Moderator'}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={s.searchWrap}>
              <MaterialCommunityIcons name="magnify" size={18} color={t.colors.textDim} />
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder="Type @username..."
                placeholderTextColor={t.colors.textMuted}
                autoCapitalize="none"
                style={s.searchInput}
                testID="role-search-input"
              />
            </View>
            {q.trim().length > 0 ? (
              <View style={{ gap: 6 }}>
                {searchable.length === 0 ? (
                  <Text style={s.emptyTxt}>No matching members. They must join the room first.</Text>
                ) : (
                  searchable.map((m) => (
                    <View key={m.user_id} style={s.memRow}>
                      <Avatar uri={m.avatar} name={m.display_name || m.username} size={36} />
                      <View style={{ flex: 1 }}>
                        <Text style={[s.memName, { color: ROLE_COLORS[m.role] || t.colors.text }]}>@{m.username}</Text>
                        <Text style={s.memRole}>Current: {m.role}</Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => doAssign(m)}
                        disabled={busy === m.user_id || m.role === assignRole}
                        style={[s.assignBtn, (busy === m.user_id || m.role === assignRole) && { opacity: 0.5 }]}
                        testID={`role-assign-btn-${m.username}`}
                      >
                        <Text style={s.assignBtnTxt}>{m.role === assignRole ? 'Already' : 'Assign'}</Text>
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </View>
            ) : (
              <Text style={s.hint}>Start typing a member&apos;s username to assign the {assignRole} role.</Text>
            )}
          </View>
        </View>

        {/* Admins list */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>ADMINS · {admins.length}</Text>
          <View style={s.card}>
            {admins.length === 0 ? (
              <Text style={s.emptyTxt}>No admins yet.</Text>
            ) : (
              admins.map((m) => (
                <View key={m.user_id} style={s.memRow}>
                  <Avatar uri={m.avatar} name={m.display_name || m.username} size={36} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.memName, { color: ROLE_COLORS.admin }]}>@{m.username}</Text>
                    <Text style={s.memRole}>{m.display_name || m.username}</Text>
                  </View>
                  <TouchableOpacity onPress={() => doDemote(m)} style={s.demoteBtn} testID={`role-remove-admin-${m.username}`}>
                    <Text style={s.demoteBtnTxt}>Remove</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        </View>

        {/* Moderators list */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>MODERATORS · {mods.length}</Text>
          <View style={s.card}>
            {mods.length === 0 ? (
              <Text style={s.emptyTxt}>No moderators yet.</Text>
            ) : (
              mods.map((m) => (
                <View key={m.user_id} style={s.memRow}>
                  <Avatar uri={m.avatar} name={m.display_name || m.username} size={36} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.memName, { color: ROLE_COLORS.moderator }]}>@{m.username}</Text>
                    <Text style={s.memRole}>{m.display_name || m.username}</Text>
                  </View>
                  <TouchableOpacity onPress={() => doDemote(m)} style={s.demoteBtn} testID={`role-remove-mod-${m.username}`}>
                    <Text style={s.demoteBtnTxt}>Remove</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        </View>

        <Text style={s.foot}>Admins cannot create Admins. Admins cannot create Moderators. Moderators cannot assign roles. Only the Owner has complete role management.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (t: ReturnType<typeof useTheme>) => StyleSheet.create({
  center: { flex: 1, backgroundColor: t.colors.bg, alignItems: 'center', justifyContent: 'center' },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  blockedTxt: { color: t.colors.textDim, fontSize: 14 },
  section: { gap: 8 },
  sectionLabel: { color: t.colors.textDim, fontSize: 11, fontWeight: '800', letterSpacing: 0.6, paddingHorizontal: 4 },
  card: { backgroundColor: t.colors.surface1, borderRadius: t.radii.lg, borderWidth: 1, borderColor: t.colors.border, padding: 14, gap: 10 },
  segment: { flexDirection: 'row', backgroundColor: t.colors.surface2, borderRadius: 100, padding: 4, gap: 4 },
  segBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 100 },
  segBtnActive: { backgroundColor: t.colors.primary },
  segTxt: { color: t.colors.text, fontWeight: '700', fontSize: 13 },
  segTxtActive: { color: t.colors.onPrimary },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: t.colors.surface2, borderRadius: 100, borderWidth: 1, borderColor: t.colors.border },
  searchInput: { flex: 1, color: t.colors.text, fontSize: 14 },
  hint: { color: t.colors.textDim, fontSize: 12, textAlign: 'center', paddingVertical: 6 },
  emptyTxt: { color: t.colors.textDim, fontSize: 12, textAlign: 'center', paddingVertical: 12 },
  memRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  memName: { fontWeight: '800', fontSize: 14 },
  memRole: { color: t.colors.textDim, fontSize: 11, marginTop: 2, textTransform: 'capitalize' },
  assignBtn: { paddingHorizontal: 12, paddingVertical: 7, backgroundColor: t.colors.primary, borderRadius: 100 },
  assignBtnTxt: { color: t.colors.onPrimary, fontWeight: '800', fontSize: 12 },
  demoteBtn: { paddingHorizontal: 12, paddingVertical: 7, backgroundColor: t.colors.surface2, borderRadius: 100, borderWidth: 1, borderColor: t.colors.border },
  demoteBtnTxt: { color: t.colors.text, fontWeight: '700', fontSize: 12 },
  foot: { color: t.colors.textMuted, fontSize: 11, textAlign: 'center', marginTop: 8 },
});
