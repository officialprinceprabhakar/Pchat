import React, { ReactNode, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useTheme } from '@/src/context/ThemeContext';
import { ScreenHeader } from '@/src/components/ScreenHeader';

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const router = useRouter();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.bg }} edges={['top', 'bottom']}>
      <ScreenHeader title={title} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={s.wrap}>
        <Text style={s.updated}>Last updated: {updated}</Text>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function H2({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text style={{ color: t.colors.text, fontSize: 17, fontWeight: '800', marginTop: 20, marginBottom: 8 }}>{children}</Text>;
}
export function H3({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text style={{ color: t.colors.text, fontSize: 14, fontWeight: '700', marginTop: 12, marginBottom: 4 }}>{children}</Text>;
}
export function P({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text style={{ color: t.colors.textDim, fontSize: 13, lineHeight: 20 }}>{children}</Text>;
}
export function Li({ children }: { children: ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', paddingLeft: 4, marginTop: 4 }}>
      <Text style={{ color: t.colors.primary, marginRight: 8 }}>•</Text>
      <Text style={{ color: t.colors.textDim, fontSize: 13, lineHeight: 20, flex: 1 }}>{children}</Text>
    </View>
  );
}

const makeStyles = (t: ReturnType<typeof useTheme>) => StyleSheet.create({
  wrap: { padding: 20, paddingBottom: 60 },
  updated: { color: t.colors.textMuted, fontSize: 11, letterSpacing: 0.5, marginBottom: 4 },
});
