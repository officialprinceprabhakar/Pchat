import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { theme } from '@/src/theme';

type Props = {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'ghost' | 'outline';
  loading?: boolean;
  icon?: React.ReactNode;
  disabled?: boolean;
  testID?: string;
  fullWidth?: boolean;
  size?: 'sm' | 'md' | 'lg';
};

export function PButton({ title, onPress, variant = 'primary', loading, icon, disabled, testID, fullWidth, size = 'md' }: Props) {
  const bg =
    variant === 'primary' ? theme.colors.primary : variant === 'outline' ? 'transparent' : theme.colors.surface2;
  const border = variant === 'outline' ? theme.colors.border : 'transparent';
  const color = variant === 'primary' ? theme.colors.onPrimary : theme.colors.text;
  const pv = size === 'sm' ? 8 : size === 'lg' ? 16 : 12;
  const ph = size === 'sm' ? 12 : size === 'lg' ? 24 : 18;
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
      style={[
        styles.btn,
        { backgroundColor: bg, borderColor: border, borderWidth: variant === 'outline' ? 1 : 0, paddingVertical: pv, paddingHorizontal: ph },
        fullWidth && { alignSelf: 'stretch' },
        (disabled || loading) && { opacity: 0.55 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={color} />
      ) : (
        <View style={styles.inner}>
          {icon}
          <Text style={[styles.text, { color, fontSize: size === 'sm' ? 13 : 15 }]}>{title}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: theme.radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  text: { fontWeight: '700', letterSpacing: 0.2 },
});
