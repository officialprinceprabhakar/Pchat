import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme, badgeMeta } from '@/src/theme';

type Badge = {
  badge_id: string;
  name?: string;
  color?: string;
  icon?: string;
};

export function BadgePill({ badge, mini }: { badge: Badge | string; mini?: boolean }) {
  const meta =
    typeof badge === 'string'
      ? badgeMeta[badge] || { color: theme.colors.blue, icon: 'shield', label: badge }
      : { color: badge.color || theme.colors.blue, icon: badge.icon || 'shield', label: badge.name || badge.badge_id };
  const size = mini ? 10 : 12;
  return (
    <View style={[styles.pill, { borderColor: meta.color, backgroundColor: meta.color + '22' }, mini && styles.pillMini]}>
      <MaterialCommunityIcons name={meta.icon as any} size={size + 2} color={meta.color} />
      {!mini ? <Text style={[styles.label, { color: meta.color, fontSize: size }]}>{meta.label}</Text> : null}
    </View>
  );
}

export function BadgeRow({ badges }: { badges?: string[] }) {
  if (!badges || badges.length === 0) return null;
  return (
    <View style={styles.row}>
      {badges.map((b) => (
        <BadgePill key={b} badge={b} mini />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
    borderWidth: 1,
  },
  pillMini: { paddingHorizontal: 4, paddingVertical: 3 },
  label: { fontWeight: '700', letterSpacing: 0.2 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
});
