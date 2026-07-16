import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { theme } from '@/src/theme';
import { api } from '@/src/api/client';
import { ScreenHeader } from '@/src/components/ScreenHeader';

const ICONS: Record<string, string> = {
  friend_request: 'account-plus',
  friend_accept: 'account-check',
  message: 'chat',
  like: 'heart',
  comment: 'comment',
  mention: 'at',
  announcement: 'bullhorn',
  room_invite: 'account-group',
  reply: 'reply',
};

export default function NotificationsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await api.notifications();
      setItems(res.notifications || []);
      await api.markAllRead();
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={['top', 'bottom']}>
      <ScreenHeader title="Notifications" onBack={() => router.back()} />
      {loading ? (
        <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(n) => n.notif_id}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialCommunityIcons name="bell-off-outline" size={44} color={theme.colors.textMuted} />
              <Text style={styles.emptyTxt}>You&apos;re all caught up</Text>
            </View>
          }
          renderItem={({ item }) => {
            const icon = ICONS[item.type] || 'bell';
            return (
              <TouchableOpacity
                onPress={() => {
                  if (item.data?.user_id) router.push(`/user/${item.data.user_id}`);
                  else if (item.data?.from_id) router.push(`/chat/${item.data.from_id}`);
                }}
                style={styles.row}
                testID={`notif-${item.notif_id}`}
              >
                <View style={styles.iconWrap}>
                  <MaterialCommunityIcons name={icon as any} size={20} color={theme.colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.txt}>{item.text}</Text>
                  <Text style={styles.time}>{new Date(item.created_at).toLocaleString()}</Text>
                </View>
                {!item.read ? <View style={styles.dot} /> : null}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12,
    backgroundColor: theme.colors.surface1, borderRadius: theme.radii.lg,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  iconWrap: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: theme.colors.primaryGlow, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: theme.colors.primary,
  },
  txt: { color: theme.colors.text, fontSize: 14 },
  time: { color: theme.colors.textDim, fontSize: 11, marginTop: 3 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.primary },
  empty: { alignItems: 'center', padding: 40, gap: 8 },
  emptyTxt: { color: theme.colors.textDim, fontSize: 14, marginTop: 8 },
});
