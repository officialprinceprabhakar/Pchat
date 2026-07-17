// Privacy & Safety Settings — controls who can see/send what.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useTheme } from '@/src/context/ThemeContext';
import { api } from '@/src/api/client';
import { useAuth } from '@/src/context/AuthContext';
import { ScreenHeader } from '@/src/components/ScreenHeader';

const VIS_OPTIONS = [
  { key: 'everyone', label: 'Everyone' },
  { key: 'friends', label: 'Only friends' },
  { key: 'nobody', label: 'Nobody' },
];
const FRIEND_OPTIONS = [
  { key: 'everyone', label: 'Everyone' },
  { key: 'friends_of_friends', label: 'Friends of friends' },
  { key: 'nobody', label: 'Nobody' },
];
const STORY_OPTIONS = [
  { key: 'everyone', label: 'Everyone' },
  { key: 'friends', label: 'Only friends' },
  { key: 'close_friends', label: 'Close friends' },
  { key: 'nobody', label: 'Nobody' },
];

const SECTIONS: { key: keyof typeof LABELS; icon: string; group: 'account' | 'visibility' | 'messaging' | 'story' }[] = [
  { key: 'last_seen_visibility', icon: 'clock-outline', group: 'visibility' },
  { key: 'online_status_visibility', icon: 'circle-slice-8', group: 'visibility' },
  { key: 'active_status_visibility', icon: 'motion-sensor', group: 'visibility' },
  { key: 'profile_visibility', icon: 'account-box', group: 'visibility' },
  { key: 'who_can_message', icon: 'message-text', group: 'messaging' },
  { key: 'who_can_friend_request', icon: 'account-plus', group: 'messaging' },
  { key: 'story_visibility', icon: 'image-multiple', group: 'story' },
];

const LABELS: Record<string, string> = {
  last_seen_visibility: 'Last seen',
  online_status_visibility: 'Online status',
  active_status_visibility: 'Active status',
  profile_visibility: 'Profile visibility',
  who_can_message: 'Who can send you messages',
  who_can_friend_request: 'Who can send friend requests',
  story_visibility: 'Story visibility',
};

export default function PrivacyScreen() {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const router = useRouter();
  const { refresh } = useAuth();
  const [privacy, setPrivacy] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pickerFor, setPickerFor] = useState<{ key: string; options: any[]; title: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.getPrivacy();
      setPrivacy(res.privacy);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const patch = async (updates: any) => {
    const next = { ...privacy, ...updates };
    setPrivacy(next);
    setSaving(true);
    try {
      const res = await api.updatePrivacy(updates);
      setPrivacy(res.user.privacy);
      await refresh();
    } catch (e: any) {
      Alert.alert('Save failed', e?.message || 'Try again');
      load();
    } finally { setSaving(false); }
  };

  const optionsFor = (key: string) => {
    if (key === 'who_can_friend_request') return FRIEND_OPTIONS;
    if (key === 'story_visibility') return STORY_OPTIONS;
    return VIS_OPTIONS;
  };

  if (loading || !privacy) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.bg }}>
        <ScreenHeader title="Privacy" onBack={() => router.back()} />
        <ActivityIndicator style={{ marginTop: 40 }} color={t.colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.bg }} edges={['top', 'bottom']}>
      <ScreenHeader
        title="Privacy"
        onBack={() => router.back()}
        right={saving ? <ActivityIndicator color={t.colors.primary} /> : undefined}
      />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 18, paddingBottom: 60 }}>
        <Section t={t} title="ACCOUNT">
          <TouchableOpacity
            style={s.row}
            onPress={() => patch({ account_visibility: privacy.account_visibility === 'public' ? 'private' : 'public' })}
            testID="priv-account-toggle"
          >
            <MaterialCommunityIcons name="shield-account" size={20} color={t.colors.text} />
            <View style={{ flex: 1 }}>
              <Text style={s.rowLbl}>Private account</Text>
              <Text style={s.rowSub}>{privacy.account_visibility === 'private' ? 'Only accepted friends can DM. Others must send a friend request.' : 'Anyone can find and message you.'}</Text>
            </View>
            <Switch
              value={privacy.account_visibility === 'private'}
              onValueChange={(v) => patch({ account_visibility: v ? 'private' : 'public' })}
              trackColor={{ true: t.colors.primary, false: '#3A3A44' }}
              thumbColor="#fff"
              testID="priv-account-switch"
            />
          </TouchableOpacity>
          <View style={s.row}>
            <MaterialCommunityIcons name="email-newsletter" size={20} color={t.colors.text} />
            <View style={{ flex: 1 }}>
              <Text style={s.rowLbl}>Message requests</Text>
              <Text style={s.rowSub}>Show messages from non-friends in a separate requests inbox</Text>
            </View>
            <Switch
              value={!!privacy.message_requests}
              onValueChange={(v) => patch({ message_requests: v })}
              trackColor={{ true: t.colors.primary, false: '#3A3A44' }}
              thumbColor="#fff"
              testID="priv-msg-req-switch"
            />
          </View>
        </Section>

        <Section t={t} title="WHO CAN SEE">
          {SECTIONS.filter((sec) => sec.group === 'visibility').map((sec) => (
            <RowPicker
              key={sec.key}
              t={t}
              icon={sec.icon}
              label={LABELS[sec.key]}
              value={privacy[sec.key]}
              options={optionsFor(sec.key)}
              onPress={() => setPickerFor({ key: sec.key, options: optionsFor(sec.key), title: LABELS[sec.key] })}
            />
          ))}
        </Section>

        <Section t={t} title="MESSAGES & FRIENDS">
          {SECTIONS.filter((sec) => sec.group === 'messaging').map((sec) => (
            <RowPicker
              key={sec.key}
              t={t}
              icon={sec.icon}
              label={LABELS[sec.key]}
              value={privacy[sec.key]}
              options={optionsFor(sec.key)}
              onPress={() => setPickerFor({ key: sec.key, options: optionsFor(sec.key), title: LABELS[sec.key] })}
            />
          ))}
        </Section>

        <Section t={t} title="STORIES">
          {SECTIONS.filter((sec) => sec.group === 'story').map((sec) => (
            <RowPicker
              key={sec.key}
              t={t}
              icon={sec.icon}
              label={LABELS[sec.key]}
              value={privacy[sec.key]}
              options={optionsFor(sec.key)}
              onPress={() => setPickerFor({ key: sec.key, options: optionsFor(sec.key), title: LABELS[sec.key] })}
            />
          ))}
        </Section>
      </ScrollView>

      <Modal visible={!!pickerFor} transparent animationType="slide" onRequestClose={() => setPickerFor(null)}>
        <View style={s.sheetWrap}>
          <View style={s.sheet}>
            <View style={s.sheetHead}>
              <Text style={s.sheetTitle}>{pickerFor?.title}</Text>
              <TouchableOpacity onPress={() => setPickerFor(null)}><MaterialCommunityIcons name="close" size={22} color={t.colors.text} /></TouchableOpacity>
            </View>
            {pickerFor?.options.map((opt: any) => (
              <TouchableOpacity
                key={opt.key}
                onPress={() => { patch({ [pickerFor.key]: opt.key }); setPickerFor(null); }}
                style={s.optRow}
                testID={`priv-opt-${pickerFor.key}-${opt.key}`}
              >
                <Text style={s.optTxt}>{opt.label}</Text>
                {privacy[pickerFor.key] === opt.key ? <MaterialCommunityIcons name="check-circle" size={20} color={t.colors.primary} /> : null}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Section({ t, title, children }: any) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: t.colors.textDim, fontSize: 11, fontWeight: '800', letterSpacing: 0.6, paddingHorizontal: 4 }}>{title}</Text>
      <View style={{ backgroundColor: t.colors.surface1, borderRadius: t.radii.lg, borderWidth: 1, borderColor: t.colors.border, overflow: 'hidden' }}>
        {children}
      </View>
    </View>
  );
}

function RowPicker({ t, icon, label, value, options, onPress }: any) {
  const cur = options.find((o: any) => o.key === value)?.label || value;
  const s = makeStyles(t);
  return (
    <TouchableOpacity onPress={onPress} style={s.row} testID={`priv-row-${label}`}>
      <MaterialCommunityIcons name={icon} size={20} color={t.colors.text} />
      <Text style={s.rowLbl}>{label}</Text>
      <Text style={s.rowValue}>{cur}</Text>
      <MaterialCommunityIcons name="chevron-right" size={18} color={t.colors.textDim} />
    </TouchableOpacity>
  );
}

const makeStyles = (t: ReturnType<typeof useTheme>) => StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderBottomWidth: 1, borderBottomColor: t.colors.border,
  },
  rowLbl: { color: t.colors.text, fontSize: 14, fontWeight: '600', flex: 1 },
  rowSub: { color: t.colors.textDim, fontSize: 12, marginTop: 2 },
  rowValue: { color: t.colors.textDim, fontSize: 12 },
  sheetWrap: { flex: 1, backgroundColor: t.colors.overlay, justifyContent: 'flex-end' },
  sheet: { backgroundColor: t.colors.surface1, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 32 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sheetTitle: { color: t.colors.text, fontSize: 18, fontWeight: '800' },
  optRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderBottomWidth: 1, borderBottomColor: t.colors.border },
  optTxt: { color: t.colors.text, fontSize: 15, fontWeight: '600' },
});
