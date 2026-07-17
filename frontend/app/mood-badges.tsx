// Mood Badges — user-toggleable badges displayed on their profile / messages.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useTheme } from '@/src/context/ThemeContext';
import { api } from '@/src/api/client';
import { useAuth } from '@/src/context/AuthContext';
import { ScreenHeader } from '@/src/components/ScreenHeader';

type MoodBadge = { badge_id: string; name: string; emoji: string; color: string };

export default function MoodBadgesScreen() {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const router = useRouter();
  const { refresh } = useAuth();
  const [catalog, setCatalog] = useState<MoodBadge[]>([]);
  const [enabled, setEnabled] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.listMoodBadges();
      setCatalog(res.catalog || []);
      setEnabled(res.enabled || []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = async (badge_id: string) => {
    const isOn = enabled.includes(badge_id);
    setBusy(badge_id);
    try {
      const res = await api.toggleMoodBadge(badge_id, !isOn);
      setEnabled(res.mood_badges || []);
      await refresh();
    } catch (e: any) {
      Alert.alert('Could not update', e?.message || 'Try again');
    } finally { setBusy(null); }
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.bg }}>
        <ScreenHeader title="Mood badges" onBack={() => router.back()} />
        <ActivityIndicator style={{ marginTop: 40 }} color={t.colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.bg }} edges={['top', 'bottom']}>
      <ScreenHeader title="Mood badges" subtitle={`${enabled.length} / 5 enabled`} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={s.grid}>
        <Text style={s.helper}>Tap to enable or disable. You can show up to 5 mood badges on your profile.</Text>
        <View style={s.gridWrap}>
          {catalog.map((b) => {
            const on = enabled.includes(b.badge_id);
            const isBusy = busy === b.badge_id;
            return (
              <TouchableOpacity
                key={b.badge_id}
                onPress={() => toggle(b.badge_id)}
                disabled={isBusy}
                style={[s.tile, on && { borderColor: b.color, backgroundColor: b.color + '22' }]}
                testID={`mood-${b.badge_id}`}
              >
                <Text style={s.emoji}>{b.emoji}</Text>
                <Text style={[s.name, on && { color: b.color }]}>{b.name}</Text>
                {on ? <Text style={[s.onDot, { backgroundColor: b.color }]} /> : null}
                {isBusy ? <ActivityIndicator color={b.color} style={{ position: 'absolute', top: 6, right: 6 }} /> : null}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (t: ReturnType<typeof useTheme>) => StyleSheet.create({
  grid: { padding: 16, gap: 12 },
  helper: { color: t.colors.textDim, fontSize: 12, marginBottom: 6 },
  gridWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: {
    width: '31%', minHeight: 96, borderRadius: t.radii.lg,
    borderWidth: 1, borderColor: t.colors.border, backgroundColor: t.colors.surface1,
    alignItems: 'center', justifyContent: 'center', padding: 10, position: 'relative',
  },
  emoji: { fontSize: 28 },
  name: { color: t.colors.text, fontSize: 12, fontWeight: '700', marginTop: 4, textAlign: 'center' },
  onDot: { position: 'absolute', top: 8, left: 8, width: 8, height: 8, borderRadius: 4 },
});
