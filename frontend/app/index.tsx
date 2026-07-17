import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView,
  Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { theme } from '@/src/theme';
import { useAuth } from '@/src/context/AuthContext';
import { api } from '@/src/api/client';
import { PButton } from '@/src/components/PButton';

type Mode = 'landing' | 'login' | 'register';

export default function AuthScreen() {
  const router = useRouter();
  const { user, loading, setSession } = useAuth();
  const [mode, setMode] = useState<Mode>('landing');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      if (user.must_change_password) router.replace('/change-password');
      else router.replace('/(tabs)/home');
    }
  }, [loading, user, router]);

  const handleGuest = useCallback(async () => {
    setErr(null);
    if (!username.trim() || !password) {
      setErr('Username and password required');
      return;
    }
    setBusy(true);
    try {
      const res = mode === 'register'
        ? await api.guestRegister(username.trim(), password, displayName.trim() || undefined)
        : await api.guestLogin(username.trim(), password);
      await setSession(res.session_token, res.user);
      router.replace('/(tabs)/home');
    } catch (e: any) {
      setErr(e.message || 'Auth failed');
    } finally {
      setBusy(false);
    }
  }, [mode, username, password, displayName, setSession, router]);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={theme.colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#1A0A0F', '#0A0A0C', '#0A0A0C']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.8 }}
      />
      <View style={styles.glow} />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.logoWrap}>
              <View style={styles.logo}>
                <MaterialCommunityIcons name="message-flash" size={38} color={theme.colors.onPrimary} />
              </View>
              <Text style={styles.brand}>PChat</Text>
              <Text style={styles.tagline}>Premium chat. Real conversations.</Text>
            </View>

            {mode === 'landing' ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Welcome to PChat</Text>
                <Text style={styles.cardSub}>Sign in with your PChat account or create a new one.</Text>

                <PButton
                  title="Login"
                  fullWidth
                  onPress={() => setMode('login')}
                  icon={<MaterialCommunityIcons name="login" size={18} color={theme.colors.onPrimary} />}
                  testID="auth-guest-login-btn"
                />
                <View style={{ height: 12 }} />
                <PButton
                  title="New User"
                  variant="outline"
                  fullWidth
                  onPress={() => setMode('register')}
                  icon={<MaterialCommunityIcons name="account-plus-outline" size={18} color={theme.colors.text} />}
                  testID="auth-guest-register-btn"
                />
              </View>
            ) : (
              <View style={styles.card}>
                <TouchableOpacity onPress={() => { setMode('landing'); setErr(null); }} style={styles.backLink} testID="auth-back">
                  <MaterialCommunityIcons name="chevron-left" size={20} color={theme.colors.textDim} />
                  <Text style={styles.backTxt}>Back</Text>
                </TouchableOpacity>
                <Text style={styles.cardTitle}>{mode === 'register' ? 'Create account' : 'Login'}</Text>
                <Text style={styles.cardSub}>
                  {mode === 'register' ? 'Pick a username and password to get started.' : 'Enter your PChat credentials.'}
                </Text>

                {mode === 'register' ? (
                  <TextInput
                    style={styles.input}
                    placeholder="Display name (optional)"
                    placeholderTextColor={theme.colors.textMuted}
                    value={displayName}
                    onChangeText={setDisplayName}
                    testID="auth-display-name"
                  />
                ) : null}

                <TextInput
                  style={styles.input}
                  placeholder="Username"
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholderTextColor={theme.colors.textMuted}
                  value={username}
                  onChangeText={setUsername}
                  testID="auth-username"
                />
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  secureTextEntry
                  placeholderTextColor={theme.colors.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  testID="auth-password"
                />

                <PButton
                  title={mode === 'register' ? 'Create account' : 'Login'}
                  onPress={handleGuest}
                  loading={busy}
                  fullWidth
                  testID="auth-submit"
                />
              </View>
            )}

            {err ? (
              <View style={styles.errBox}>
                <MaterialCommunityIcons name="alert-circle-outline" size={16} color={theme.colors.primary} />
                <Text style={styles.errText} testID="auth-error">{err}</Text>
              </View>
            ) : null}

            <View style={styles.footer}>
              <Text style={styles.footerTxt}>By continuing, you agree to PChat community guidelines.</Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  loading: { flex: 1, backgroundColor: theme.colors.bg, alignItems: 'center', justifyContent: 'center' },
  glow: {
    position: 'absolute', top: -120, left: -80, width: 320, height: 320, borderRadius: 160,
    backgroundColor: theme.colors.primaryGlow, opacity: 0.6,
  },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 32, justifyContent: 'center' },
  logoWrap: { alignItems: 'center', marginBottom: 32, marginTop: 24 },
  logo: {
    width: 74, height: 74, borderRadius: 22,
    backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center',
    shadowColor: theme.colors.primary, shadowOpacity: 0.5, shadowRadius: 24, shadowOffset: { width: 0, height: 8 },
    marginBottom: 16,
  },
  brand: { fontSize: 44, fontWeight: '900', color: theme.colors.text, letterSpacing: -1.2 },
  tagline: { color: theme.colors.textDim, fontSize: 14, marginTop: 6, letterSpacing: 0.2 },
  card: {
    backgroundColor: theme.colors.surface1, borderRadius: theme.radii.xl,
    padding: 24, borderWidth: 1, borderColor: theme.colors.border,
  },
  cardTitle: { color: theme.colors.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  cardSub: { color: theme.colors.textDim, fontSize: 13, marginTop: 6, marginBottom: 20 },
  input: {
    backgroundColor: theme.colors.surface2, color: theme.colors.text,
    borderRadius: theme.radii.md, paddingHorizontal: 16, paddingVertical: 14,
    marginBottom: 12, fontSize: 15, borderWidth: 1, borderColor: theme.colors.border,
  },
  backLink: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, alignSelf: 'flex-start' },
  backTxt: { color: theme.colors.textDim, fontSize: 13 },
  errBox: {
    marginTop: 16, backgroundColor: theme.colors.primaryGlow, padding: 12,
    borderRadius: theme.radii.md, flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: theme.colors.primary,
  },
  errText: { color: theme.colors.text, fontSize: 13, flex: 1 },
  footer: { marginTop: 24, alignItems: 'center' },
  footerTxt: { color: theme.colors.textMuted, fontSize: 11, textAlign: 'center' },
});
