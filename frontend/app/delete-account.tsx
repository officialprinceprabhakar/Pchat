// Delete Account — reachable at /delete-account. Wired into Settings and required by Google Play Data Safety.
import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { api } from '@/src/api/client';
import { ScreenHeader } from '@/src/components/ScreenHeader';

export default function DeleteAccountScreen() {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const router = useRouter();
  const { user, logout } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canSubmit = ack && confirm.trim().toLowerCase() === 'delete' && (!user || user.provider !== 'guest' || password.length > 0);

  const submit = useCallback(async () => {
    setErr(null);
    if (!ack) { setErr('You must acknowledge the effects of deletion'); return; }
    if (confirm.trim().toLowerCase() !== 'delete') { setErr('Type DELETE to confirm'); return; }
    setBusy(true);
    try {
      await api.deleteMyAccount(user?.provider === 'guest' ? password : undefined);
      Alert.alert(
        'Account deleted',
        'Your Plexa account and personal data have been permanently deleted.',
        [{ text: 'OK', onPress: () => logout() }],
      );
    } catch (e: any) {
      setErr(e?.message || 'Could not delete account');
    } finally {
      setBusy(false);
    }
  }, [ack, confirm, password, user, logout]);

  const notSignedIn = !user;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.bg }} edges={['top', 'bottom']}>
      <ScreenHeader title="Delete account" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={s.wrap}>
        <View style={s.iconWrap}>
          <MaterialCommunityIcons name="delete-forever" size={48} color={t.colors.primary} />
        </View>

        <Text style={s.title}>Permanently delete your Plexa account</Text>
        <Text style={s.body}>
          Deletion is immediate and cannot be undone. Deleting your account removes the following data from Plexa:
        </Text>

        {[
          'Your profile (username, display name, bio, avatar, email)',
          'Your posts and their images',
          'Your stories and their images',
          'Your uploaded images across the app',
          'Your active sessions and push-notification tokens',
          'Your friend relationships and pending friend requests',
          'Your notifications',
          'All other database records linked to your account',
        ].map((line) => (
          <View key={line} style={s.bullet}>
            <MaterialCommunityIcons name="close-circle" size={14} color={t.colors.primary} />
            <Text style={s.bulletTxt}>{line}</Text>
          </View>
        ))}

        <Text style={s.note}>
          Messages you have sent in public rooms remain visible to other participants but will be attributed to &quot;Deleted user&quot;.
          A moderation record of the deletion is retained for abuse prevention as described in our Privacy Policy.
        </Text>

        {notSignedIn ? (
          <View style={s.card}>
            <Text style={s.cardTitle}>Sign in required</Text>
            <Text style={s.body}>To delete your account, please sign in first. Once signed in, come back here or open Settings → Delete account.</Text>
            <TouchableOpacity onPress={() => router.replace('/')} style={[s.btn, { backgroundColor: t.colors.primary }]}>
              <Text style={s.btnTxt}>Go to login</Text>
            </TouchableOpacity>
            <Text style={s.helperEmail}>
              Cannot sign in? Email officialprinceprabhakar@gmail.com from the address associated with your account and we will process the deletion manually within 30 days.
            </Text>
          </View>
        ) : (
          <View style={s.card}>
            <Text style={s.cardTitle}>Confirm deletion</Text>
            {user?.provider === 'guest' ? (
              <>
                <Text style={s.label}>Your password</Text>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter your password"
                  placeholderTextColor={t.colors.textMuted}
                  secureTextEntry
                  style={s.input}
                  testID="delete-password"
                />
              </>
            ) : null}

            <Text style={s.label}>Type <Text style={{ fontWeight: '800', color: t.colors.text }}>DELETE</Text> to confirm</Text>
            <TextInput
              value={confirm}
              onChangeText={setConfirm}
              placeholder="DELETE"
              placeholderTextColor={t.colors.textMuted}
              autoCapitalize="characters"
              autoCorrect={false}
              style={s.input}
              testID="delete-confirm-text"
            />

            <TouchableOpacity onPress={() => setAck((a) => !a)} style={s.ackRow} testID="delete-ack">
              <MaterialCommunityIcons
                name={ack ? 'checkbox-marked' : 'checkbox-blank-outline'}
                size={22}
                color={ack ? t.colors.primary : t.colors.textDim}
              />
              <Text style={s.ackTxt}>I understand this cannot be undone.</Text>
            </TouchableOpacity>

            {err ? <Text style={s.err}>{err}</Text> : null}

            <TouchableOpacity
              onPress={submit}
              disabled={!canSubmit || busy}
              style={[s.btn, { backgroundColor: canSubmit ? t.colors.primary : t.colors.surface2, opacity: busy ? 0.7 : 1 }]}
              testID="delete-submit"
            >
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>Permanently delete my account</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.back()} style={s.cancelBtn}>
              <Text style={s.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={s.legalNote}>
          Data retention and further details are described in our{'\n'}
          <Text style={{ color: t.colors.primary }} onPress={() => router.push('/privacy')}>Privacy Policy</Text>.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (t: ReturnType<typeof useTheme>) => StyleSheet.create({
  wrap: { padding: 20, paddingBottom: 60, gap: 6 },
  iconWrap: { alignItems: 'center', marginTop: 6, marginBottom: 12 },
  title: { color: t.colors.text, fontSize: 20, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  body: { color: t.colors.textDim, fontSize: 13, lineHeight: 20, marginBottom: 8 },
  bullet: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  bulletTxt: { color: t.colors.text, fontSize: 13, flex: 1 },
  note: { color: t.colors.textDim, fontSize: 12, marginTop: 12, fontStyle: 'italic', lineHeight: 18 },
  card: {
    marginTop: 20, padding: 16, borderRadius: 16,
    backgroundColor: t.colors.surface1, borderWidth: 1, borderColor: t.colors.border, gap: 8,
  },
  cardTitle: { color: t.colors.text, fontSize: 16, fontWeight: '800' },
  label: { color: t.colors.textDim, fontSize: 12, marginTop: 8 },
  input: {
    backgroundColor: t.colors.surface2, color: t.colors.text,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14,
    borderWidth: 1, borderColor: t.colors.border,
  },
  ackRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  ackTxt: { color: t.colors.text, fontSize: 13, flex: 1 },
  err: { color: t.colors.primary, fontSize: 12, marginTop: 6 },
  btn: { marginTop: 14, paddingVertical: 14, borderRadius: 100, alignItems: 'center' },
  btnTxt: { color: '#fff', fontWeight: '800', fontSize: 14 },
  cancelBtn: { paddingVertical: 10, alignItems: 'center' },
  cancelTxt: { color: t.colors.textDim, fontSize: 13, fontWeight: '600' },
  helperEmail: { color: t.colors.textMuted, fontSize: 12, marginTop: 12 },
  legalNote: { color: t.colors.textMuted, fontSize: 11, textAlign: 'center', marginTop: 20 },
});
