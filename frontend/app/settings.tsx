import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useTheme, useThemeMode } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { api } from '@/src/api/client';
import { Avatar } from '@/src/components/Avatar';
import { ScreenHeader } from '@/src/components/ScreenHeader';

export default function SettingsScreen() {
  const t = useTheme();
  const { mode, setMode } = useThemeMode();
  const { user, logout } = useAuth();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(t), [t]);

  const [prefs, setPrefs] = useState<any>(null);
  const [blocked, setBlocked] = useState<any[]>([]);
  const [showBlocks, setShowBlocks] = useState(false);
  const [showLang, setShowLang] = useState(false);
  const [language, setLanguage] = useState('en');
  const [showUsername, setShowUsername] = useState(false);
  const [newUname, setNewUname] = useState('');
  const [unameErr, setUnameErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDelete, setShowDelete] = useState(false);
  const [deletePwd, setDeletePwd] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [p, b] = await Promise.all([
          api.getNotifPrefs().catch(() => null),
          api.listBlocks().catch(() => ({ blocked: [] })),
        ]);
        setPrefs(p);
        setBlocked(b.blocked || []);
      } finally { setLoading(false); }
    })();
  }, []);

  const togglePref = async (key: string) => {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    try { await api.setNotifPrefs({ [key]: next[key] }); } catch {}
  };

  const unblock = async (uid: string) => {
    await api.unblock(uid);
    setBlocked((b) => b.filter((x) => x.user_id !== uid));
  };

  const changeUname = async () => {
    setUnameErr(null);
    try {
      await api.changeUsername(newUname.trim());
      setShowUsername(false);
      setNewUname('');
    } catch (e: any) { setUnameErr(e.message || 'Failed'); }
  };

  const deactivate = () => {
    Alert.alert(
      'Deactivate account?',
      'You will be signed out. You can reactivate anytime by logging in again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deactivate',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deactivateAccount();
              await logout();
            } catch (e: any) {
              Alert.alert('Failed', e?.message || 'Could not deactivate');
            }
          },
        },
      ],
    );
  };

  const confirmDelete = async () => {
    setDeleteErr(null);
    if (user?.provider === 'guest' && deletePwd.length < 1) {
      setDeleteErr('Enter your password to confirm');
      return;
    }
    setDeleteBusy(true);
    try {
      await api.deleteMyAccount(user?.provider === 'guest' ? deletePwd : undefined);
      await logout();
    } catch (e: any) {
      setDeleteErr(e?.message || 'Could not delete');
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.bg }} edges={['top', 'bottom']}>
      <ScreenHeader title="Settings" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 20, paddingBottom: 40 }}>
        {/* Appearance */}
        <Section t={t} title="APPEARANCE">
          <View style={styles.card}>
            <Row t={t} icon="theme-light-dark" label="Theme" />
            <View style={styles.segment}>
              {(['dark', 'light'] as const).map((m) => (
                <TouchableOpacity
                  key={m}
                  onPress={() => setMode(m)}
                  style={[styles.segBtn, mode === m && styles.segBtnActive]}
                  testID={`settings-theme-${m}`}
                >
                  <MaterialCommunityIcons name={m === 'dark' ? 'weather-night' : 'white-balance-sunny'} size={16} color={mode === m ? t.colors.onPrimary : t.colors.text} />
                  <Text style={[styles.segTxt, mode === m && styles.segTxtActive]}>{m === 'dark' ? 'Dark' : 'Light'}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Section>

        {/* Notifications */}
        <Section t={t} title="NOTIFICATIONS">
          {loading || !prefs ? (
            <ActivityIndicator color={t.colors.primary} />
          ) : (
            <View style={styles.card}>
              {([
                ['mentions', 'Mentions', 'at'],
                ['messages', 'Direct messages', 'chat'],
                ['friend_requests', 'Friend requests', 'account-plus'],
                ['room_events', 'Room events', 'account-group'],
                ['announcements', 'Announcements', 'bullhorn'],
              ] as [string, string, string][]).map(([key, label, icon]) => (
                <TouchableOpacity
                  key={key}
                  onPress={() => togglePref(key)}
                  style={styles.prefRow}
                  testID={`settings-pref-${key}`}
                >
                  <MaterialCommunityIcons name={icon as any} size={18} color={t.colors.text} />
                  <Text style={styles.prefLbl}>{label}</Text>
                  <View style={[styles.switch, prefs[key] && styles.switchOn]}>
                    <View style={[styles.switchThumb, prefs[key] && styles.switchThumbOn]} />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </Section>

        {/* Privacy */}
        <Section t={t} title="PRIVACY & SAFETY">
          <TouchableOpacity onPress={() => router.push('/privacy')} style={styles.card} testID="settings-privacy">
            <View style={styles.rowLine}>
              <MaterialCommunityIcons name="shield-lock" size={18} color={t.colors.text} />
              <Text style={styles.rowLbl}>Privacy settings</Text>
              <View style={{ flex: 1 }} />
              <MaterialCommunityIcons name="chevron-right" size={18} color={t.colors.textDim} />
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowBlocks(true)} style={styles.card} testID="settings-blocked">
            <View style={styles.rowLine}>
              <MaterialCommunityIcons name="block-helper" size={18} color={t.colors.text} />
              <Text style={styles.rowLbl}>Blocked users</Text>
              <View style={styles.countPill}><Text style={styles.countTxt}>{blocked.length}</Text></View>
              <MaterialCommunityIcons name="chevron-right" size={18} color={t.colors.textDim} />
            </View>
          </TouchableOpacity>
        </Section>

        {/* Personalization */}
        <Section t={t} title="PERSONALIZATION">
          <TouchableOpacity onPress={() => router.push('/mood-badges')} style={styles.card} testID="settings-mood-badges">
            <View style={styles.rowLine}>
              <MaterialCommunityIcons name="emoticon-cool" size={18} color={t.colors.text} />
              <Text style={styles.rowLbl}>Mood badges</Text>
              <View style={{ flex: 1 }} />
              <MaterialCommunityIcons name="chevron-right" size={18} color={t.colors.textDim} />
            </View>
          </TouchableOpacity>
        </Section>

        {/* Account */}
        <Section t={t} title="ACCOUNT">
          <TouchableOpacity onPress={() => { setNewUname(user?.username || ''); setShowUsername(true); }} style={styles.card} testID="settings-username">
            <View style={styles.rowLine}>
              <MaterialCommunityIcons name="account-edit" size={18} color={t.colors.text} />
              <Text style={styles.rowLbl}>Username</Text>
              <Text style={styles.rowValue}>@{user?.username}</Text>
              <MaterialCommunityIcons name="chevron-right" size={18} color={t.colors.textDim} />
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowLang(true)} style={styles.card} testID="settings-language">
            <View style={styles.rowLine}>
              <MaterialCommunityIcons name="translate" size={18} color={t.colors.text} />
              <Text style={styles.rowLbl}>Language</Text>
              <Text style={styles.rowValue}>{language.toUpperCase()}</Text>
              <MaterialCommunityIcons name="chevron-right" size={18} color={t.colors.textDim} />
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={logout} style={[styles.card, styles.rowLine]} testID="settings-logout">
            <MaterialCommunityIcons name="logout" size={18} color={t.colors.primary} />
            <Text style={[styles.rowLbl, { color: t.colors.primary }]}>Sign out</Text>
            <View style={{ flex: 1 }} />
            <MaterialCommunityIcons name="chevron-right" size={18} color={t.colors.textDim} />
          </TouchableOpacity>
        </Section>

        {/* Danger zone */}
        <Section t={t} title="DANGER ZONE">
          <TouchableOpacity onPress={deactivate} style={styles.card} testID="settings-deactivate">
            <View style={styles.rowLine}>
              <MaterialCommunityIcons name="power-sleep" size={18} color={t.colors.orange} />
              <Text style={[styles.rowLbl, { color: t.colors.orange }]}>Deactivate account</Text>
              <View style={{ flex: 1 }} />
              <MaterialCommunityIcons name="chevron-right" size={18} color={t.colors.textDim} />
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowDelete(true)} style={styles.card} testID="settings-delete-account">
            <View style={styles.rowLine}>
              <MaterialCommunityIcons name="delete-forever" size={18} color={t.colors.primary} />
              <Text style={[styles.rowLbl, { color: t.colors.primary }]}>Permanently delete account</Text>
              <View style={{ flex: 1 }} />
              <MaterialCommunityIcons name="chevron-right" size={18} color={t.colors.textDim} />
            </View>
          </TouchableOpacity>
        </Section>

        {/* About */}
        <Section t={t} title="ABOUT">
          <View style={styles.card}>
            <View style={styles.rowLine}>
              <MaterialCommunityIcons name="information" size={18} color={t.colors.text} />
              <Text style={styles.rowLbl}>PChat v1.0</Text>
            </View>
          </View>
        </Section>
      </ScrollView>

      {/* Blocked users modal */}
      <Modal visible={showBlocks} animationType="slide" transparent onRequestClose={() => setShowBlocks(false)}>
        <View style={styles.sheetWrap}>
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>Blocked users</Text>
              <TouchableOpacity onPress={() => setShowBlocks(false)}><MaterialCommunityIcons name="close" size={22} color={t.colors.text} /></TouchableOpacity>
            </View>
            {blocked.length === 0 ? (
              <Text style={{ color: t.colors.textDim, padding: 20, textAlign: 'center' }}>No one is blocked.</Text>
            ) : (
              blocked.map((u) => (
                <View key={u.user_id} style={styles.blockRow}>
                  <Avatar uri={u.avatar} name={u.display_name || u.username} size={40} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: t.colors.text, fontWeight: '700' }}>@{u.username}</Text>
                    <Text style={{ color: t.colors.textDim, fontSize: 12 }}>{u.display_name || u.username}</Text>
                  </View>
                  <TouchableOpacity onPress={() => unblock(u.user_id)} style={styles.unblockBtn} testID={`unblock-${u.username}`}>
                    <Text style={styles.unblockTxt}>Unblock</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        </View>
      </Modal>

      {/* Language modal */}
      <Modal visible={showLang} animationType="slide" transparent onRequestClose={() => setShowLang(false)}>
        <View style={styles.sheetWrap}>
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>Language</Text>
              <TouchableOpacity onPress={() => setShowLang(false)}><MaterialCommunityIcons name="close" size={22} color={t.colors.text} /></TouchableOpacity>
            </View>
            {[
              ['en', 'English'],
              ['hi', 'हिंदी'],
              ['es', 'Español'],
              ['fr', 'Français'],
              ['de', 'Deutsch'],
              ['pt', 'Português'],
            ].map(([code, label]) => (
              <TouchableOpacity
                key={code}
                onPress={() => { setLanguage(code as string); setShowLang(false); }}
                style={styles.langRow}
                testID={`lang-${code}`}
              >
                <Text style={styles.langTxt}>{label}</Text>
                {language === code ? <MaterialCommunityIcons name="check" size={20} color={t.colors.primary} /> : null}
              </TouchableOpacity>
            ))}
            <Text style={{ color: t.colors.textDim, fontSize: 11, padding: 12, textAlign: 'center' }}>Full localization coming soon</Text>
          </View>
        </View>
      </Modal>

      {/* Username modal */}
      <Modal visible={showUsername} animationType="slide" transparent onRequestClose={() => setShowUsername(false)}>
        <View style={styles.sheetWrap}>
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>Change username</Text>
              <TouchableOpacity onPress={() => setShowUsername(false)}><MaterialCommunityIcons name="close" size={22} color={t.colors.text} /></TouchableOpacity>
            </View>
            <TextInput
              value={newUname}
              onChangeText={setNewUname}
              placeholder="New username"
              placeholderTextColor={t.colors.textMuted}
              style={styles.input}
              autoCapitalize="none"
              testID="settings-username-input"
            />
            {unameErr ? <Text style={{ color: t.colors.primary, fontSize: 12, marginTop: 4 }}>{unameErr}</Text> : null}
            <TouchableOpacity onPress={changeUname} style={styles.saveBtn} testID="settings-username-save">
              <Text style={styles.saveBtnTxt}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      {/* Delete account modal */}
      <Modal visible={showDelete} animationType="slide" transparent onRequestClose={() => setShowDelete(false)}>
        <View style={styles.sheetWrap}>
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>Permanently delete account</Text>
              <TouchableOpacity onPress={() => setShowDelete(false)}><MaterialCommunityIcons name="close" size={22} color={t.colors.text} /></TouchableOpacity>
            </View>
            <Text style={{ color: t.colors.textDim, fontSize: 13, marginBottom: 12 }}>
              This action is irreversible. Your profile, friends, and posts will be permanently removed. Your messages will remain visible but marked as sent by "Deleted user".
            </Text>
            {user?.provider === 'guest' ? (
              <TextInput
                value={deletePwd}
                onChangeText={setDeletePwd}
                placeholder="Enter your password to confirm"
                placeholderTextColor={t.colors.textMuted}
                secureTextEntry
                style={styles.input}
                testID="settings-delete-password"
              />
            ) : null}
            {deleteErr ? <Text style={{ color: t.colors.primary, fontSize: 12, marginTop: 4 }}>{deleteErr}</Text> : null}
            <TouchableOpacity
              onPress={confirmDelete}
              disabled={deleteBusy}
              style={[styles.saveBtn, { backgroundColor: t.colors.primary }]}
              testID="settings-delete-confirm"
            >
              <Text style={styles.saveBtnTxt}>{deleteBusy ? 'Deleting…' : 'Delete permanently'}</Text>
            </TouchableOpacity>
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
      {children}
    </View>
  );
}

function Row({ t, icon, label }: any) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <MaterialCommunityIcons name={icon} size={18} color={t.colors.text} />
      <Text style={{ color: t.colors.text, fontSize: 15, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

const makeStyles = (t: ReturnType<typeof useTheme>) => StyleSheet.create({
  card: {
    backgroundColor: t.colors.surface1, borderRadius: t.radii.lg,
    borderWidth: 1, borderColor: t.colors.border, padding: 14, gap: 12,
  },
  rowLine: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowLbl: { color: t.colors.text, fontSize: 15, fontWeight: '600' },
  rowValue: { flex: 1, color: t.colors.textDim, textAlign: 'right', fontSize: 13 },
  countPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100, backgroundColor: t.colors.surface2 },
  countTxt: { color: t.colors.textDim, fontSize: 11, fontWeight: '700' },
  prefRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  prefLbl: { flex: 1, color: t.colors.text, fontSize: 14, fontWeight: '600' },
  switch: { width: 42, height: 24, borderRadius: 12, backgroundColor: t.colors.surface3, padding: 3, justifyContent: 'center' },
  switchOn: { backgroundColor: t.colors.primary },
  switchThumb: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff' },
  switchThumbOn: { alignSelf: 'flex-end' },
  segment: { flexDirection: 'row', backgroundColor: t.colors.surface2, borderRadius: 100, padding: 4, gap: 4 },
  segBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 100 },
  segBtnActive: { backgroundColor: t.colors.primary },
  segTxt: { color: t.colors.text, fontWeight: '700', fontSize: 13 },
  segTxtActive: { color: t.colors.onPrimary },
  sheetWrap: { flex: 1, backgroundColor: t.colors.overlay, justifyContent: 'flex-end' },
  sheet: { backgroundColor: t.colors.surface1, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 32, maxHeight: '80%' },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sheetTitle: { color: t.colors.text, fontSize: 18, fontWeight: '800' },
  blockRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8 },
  unblockBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: t.colors.primary, borderRadius: 100 },
  unblockTxt: { color: t.colors.onPrimary, fontSize: 12, fontWeight: '700' },
  langRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderBottomWidth: 1, borderBottomColor: t.colors.border },
  langTxt: { color: t.colors.text, fontSize: 14 },
  input: { backgroundColor: t.colors.surface2, color: t.colors.text, borderRadius: 12, padding: 14, fontSize: 15, borderWidth: 1, borderColor: t.colors.border },
  saveBtn: { marginTop: 12, backgroundColor: t.colors.primary, borderRadius: 100, paddingVertical: 12, alignItems: 'center' },
  saveBtnTxt: { color: t.colors.onPrimary, fontWeight: '800' },
});
