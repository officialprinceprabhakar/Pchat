import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useTheme, useThemeMode } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { ScreenHeader } from '@/src/components/ScreenHeader';

export default function SettingsScreen() {
  const t = useTheme();
  const { mode, setMode } = useThemeMode();
  const { logout } = useAuth();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(t), [t]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.bg }} edges={['top', 'bottom']}>
      <ScreenHeader title="Settings" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 20 }}>
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>APPEARANCE</Text>
          <View style={styles.card}>
            <View style={styles.rowLabel}>
              <MaterialCommunityIcons name="theme-light-dark" size={20} color={t.colors.text} />
              <Text style={styles.rowTxt}>Theme</Text>
            </View>
            <View style={styles.segment}>
              {(['dark', 'light'] as const).map((m) => (
                <TouchableOpacity
                  key={m}
                  onPress={() => setMode(m)}
                  style={[styles.segBtn, mode === m && styles.segBtnActive]}
                  testID={`settings-theme-${m}`}
                >
                  <MaterialCommunityIcons
                    name={m === 'dark' ? 'weather-night' : 'white-balance-sunny'}
                    size={16}
                    color={mode === m ? t.colors.onPrimary : t.colors.text}
                  />
                  <Text style={[styles.segTxt, mode === m && styles.segTxtActive]}>
                    {m === 'dark' ? 'Dark' : 'Light'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ACCOUNT</Text>
          <TouchableOpacity onPress={logout} style={[styles.card, styles.rowBtn]} testID="settings-logout">
            <MaterialCommunityIcons name="logout" size={20} color={t.colors.primary} />
            <Text style={[styles.rowTxt, { color: t.colors.primary }]}>Sign out</Text>
            <View style={{ flex: 1 }} />
            <MaterialCommunityIcons name="chevron-right" size={20} color={t.colors.textDim} />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ABOUT</Text>
          <View style={styles.card}>
            <View style={styles.rowLabel}>
              <MaterialCommunityIcons name="information" size={20} color={t.colors.text} />
              <Text style={styles.rowTxt}>PChat v1.0</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (t: ReturnType<typeof useTheme>) => StyleSheet.create({
  section: { gap: 8 },
  sectionLabel: { color: t.colors.textDim, fontSize: 11, fontWeight: '800', letterSpacing: 0.6, paddingHorizontal: 4 },
  card: {
    backgroundColor: t.colors.surface1, borderRadius: t.radii.lg,
    borderWidth: 1, borderColor: t.colors.border, padding: 14, gap: 12,
  },
  rowLabel: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowTxt: { color: t.colors.text, fontSize: 15, fontWeight: '600' },
  rowBtn: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  segment: {
    flexDirection: 'row', backgroundColor: t.colors.surface2, borderRadius: 100,
    padding: 4, gap: 4,
  },
  segBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: 100,
  },
  segBtnActive: { backgroundColor: t.colors.primary },
  segTxt: { color: t.colors.text, fontWeight: '700', fontSize: 13 },
  segTxtActive: { color: t.colors.onPrimary },
});
