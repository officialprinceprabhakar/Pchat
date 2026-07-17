// Enforced password change screen (developer accounts on first login must reset).
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { api } from '@/src/api/client';

export default function ChangePasswordScreen() {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const { user, refresh } = useAuth();
  const router = useRouter();
  const forced = !!user?.must_change_password;
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    if (next.length < 6) { setErr('Password must be 6+ characters'); return; }
    if (next !== confirm) { setErr('Passwords do not match'); return; }
    setBusy(true);
    try {
      await api.changePassword(forced ? undefined : current, next);
      await refresh();
      router.replace('/(tabs)/home');
    } catch (e: any) {
      setErr(e.message || 'Failed');
    } finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.bg }} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={s.wrap}>
          <View style={s.icon}>
            <MaterialCommunityIcons name="shield-lock" size={32} color={t.colors.onPrimary} />
          </View>
          <Text style={s.title}>{forced ? 'Set a new password' : 'Change password'}</Text>
          <Text style={s.sub}>
            {forced
              ? 'For security, please choose a new password before continuing.'
              : 'Enter your current password and choose a new one.'}
          </Text>

          {!forced ? (
            <TextInput value={current} onChangeText={setCurrent} placeholder="Current password" placeholderTextColor={t.colors.textMuted} secureTextEntry style={s.input} testID="cp-current" />
          ) : null}
          <TextInput value={next} onChangeText={setNext} placeholder="New password" placeholderTextColor={t.colors.textMuted} secureTextEntry style={s.input} testID="cp-new" />
          <TextInput value={confirm} onChangeText={setConfirm} placeholder="Confirm new password" placeholderTextColor={t.colors.textMuted} secureTextEntry style={s.input} testID="cp-confirm" />

          {err ? <Text style={s.err}>{err}</Text> : null}

          <TouchableOpacity onPress={submit} disabled={busy} style={s.btn} testID="cp-submit">
            <Text style={s.btnTxt}>{busy ? 'Saving...' : 'Save password'}</Text>
          </TouchableOpacity>

          {!forced ? (
            <TouchableOpacity onPress={() => router.back()} style={s.cancel}>
              <Text style={s.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (t: ReturnType<typeof useTheme>) => StyleSheet.create({
  wrap: { flex: 1, padding: 24, gap: 12, justifyContent: 'center' },
  icon: { alignSelf: 'center', width: 66, height: 66, borderRadius: 22, backgroundColor: t.colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  title: { color: t.colors.text, fontSize: 22, fontWeight: '800', textAlign: 'center' },
  sub: { color: t.colors.textDim, fontSize: 13, textAlign: 'center', marginBottom: 12 },
  input: { backgroundColor: t.colors.surface1, color: t.colors.text, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14, fontSize: 15, borderWidth: 1, borderColor: t.colors.border },
  err: { color: t.colors.primary, fontSize: 13 },
  btn: { marginTop: 6, backgroundColor: t.colors.primary, borderRadius: 100, paddingVertical: 14, alignItems: 'center' },
  btnTxt: { color: t.colors.onPrimary, fontWeight: '800', fontSize: 15 },
  cancel: { alignItems: 'center', padding: 12 },
  cancelTxt: { color: t.colors.textDim, fontSize: 13 },
});
