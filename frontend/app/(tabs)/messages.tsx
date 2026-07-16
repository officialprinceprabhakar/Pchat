import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { theme } from '@/src/theme';
import { api } from '@/src/api/client';
import { Avatar } from '@/src/components/Avatar';

export default function MessagesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [chats, setChats] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [c, f] = await Promise.all([
        api.listChats().catch(() => ({ chats: [] })),
        api.friends().catch(() => ({ friends: [] })),
      ]);
      setChats(c.chats || []);
      setFriends(f.friends || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: theme.colors.bg }}>
        <View style={styles.header}>
          <Text style={styles.title}>Messages</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/friends')} style={styles.newBtn} testID="messages-new">
            <MaterialCommunityIcons name="pencil-plus" size={20} color={theme.colors.onPrimary} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {friends.length > 0 ? (
        <View style={styles.strip}>
          <FlatList
            horizontal
            data={friends}
            keyExtractor={(u) => u.user_id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => router.push(`/chat/${item.user_id}`)}
                style={styles.stripItem}
                testID={`msg-friend-${item.username}`}
              >
                <Avatar uri={item.avatar} name={item.display_name || item.username} size={54} online />
                <Text style={styles.stripName} numberOfLines={1}>{item.display_name || item.username}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      ) : null}

      {loading ? (
        <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={chats}
          keyExtractor={(c) => c.user.user_id}
          contentContainerStyle={{ paddingBottom: 120 + insets.bottom, paddingTop: 8 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialCommunityIcons name="chat-outline" size={44} color={theme.colors.textMuted} />
              <Text style={styles.emptyTitle}>No conversations yet</Text>
              <Text style={styles.emptySub}>Start chatting with a friend from above.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const last = item.last_message || {};
            const preview = last.has_image ? '📷 Photo' : (last.text || '');
            return (
              <TouchableOpacity
                onPress={() => router.push(`/chat/${item.user.user_id}`)}
                style={styles.chatRow}
                testID={`chat-${item.user.username}`}
              >
                <Avatar uri={item.user.avatar} name={item.user.display_name || item.user.username} size={52} />
                <View style={{ flex: 1 }}>
                  <View style={styles.chatTop}>
                    <Text style={styles.chatName} numberOfLines={1}>{item.user.display_name || item.user.username}</Text>
                  </View>
                  <Text style={styles.chatPreview} numberOfLines={1}>{preview}</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={18} color={theme.colors.textDim} />
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
  },
  title: { color: theme.colors.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  newBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  strip: {
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  stripItem: { alignItems: 'center', width: 74 },
  stripName: { color: theme.colors.text, fontSize: 12, marginTop: 6, textAlign: 'center' },
  chatRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  chatTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chatName: { color: theme.colors.text, fontWeight: '700', fontSize: 15 },
  chatPreview: { color: theme.colors.textDim, fontSize: 13, marginTop: 4 },
  empty: { alignItems: 'center', padding: 40, gap: 8 },
  emptyTitle: { color: theme.colors.text, fontWeight: '700', fontSize: 16, marginTop: 8 },
  emptySub: { color: theme.colors.textDim, fontSize: 13, textAlign: 'center' },
});
