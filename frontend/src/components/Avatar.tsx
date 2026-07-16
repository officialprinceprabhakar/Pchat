import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { theme } from '@/src/theme';

type Props = {
  uri?: string | null;
  size?: number;
  name?: string;
  online?: boolean;
  borderColor?: string;
};

export function Avatar({ uri, size = 44, name = '?', online, borderColor }: Props) {
  const initials = (name || '?').trim().slice(0, 2).toUpperCase();
  const border = borderColor ? { borderColor, borderWidth: 2 } : null;
  return (
    <View style={[styles.wrap, { width: size, height: size, borderRadius: size / 2 }, border]}>
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
      ) : (
        <View style={[styles.fallback, { width: size, height: size, borderRadius: size / 2 }]}>
          <Text style={[styles.initials, { fontSize: size * 0.4 }]}>{initials}</Text>
        </View>
      )}
      {online ? (
        <View
          style={[
            styles.dot,
            { width: size * 0.28, height: size * 0.28, borderRadius: size * 0.14, right: -2, bottom: -2 },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  fallback: {
    backgroundColor: theme.colors.surface3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { color: theme.colors.text, fontWeight: '700' },
  dot: {
    position: 'absolute',
    backgroundColor: theme.colors.green,
    borderWidth: 2,
    borderColor: theme.colors.bg,
  },
});
