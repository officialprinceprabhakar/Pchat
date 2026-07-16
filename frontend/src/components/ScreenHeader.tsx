import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '@/src/theme';

type Props = {
  title?: string;
  onBack?: () => void;
  right?: React.ReactNode;
  subtitle?: string;
  style?: StyleProp<ViewStyle>;
};

export function ScreenHeader({ title, onBack, right, subtitle, style }: Props) {
  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.left}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} style={styles.iconBtn} testID="header-back">
            <MaterialCommunityIcons name="chevron-left" size={26} color={theme.colors.text} />
          </TouchableOpacity>
        ) : null}
        <View>
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      <View style={styles.right}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  title: { color: theme.colors.text, fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
  subtitle: { color: theme.colors.textDim, fontSize: 12, marginTop: 2 },
});
