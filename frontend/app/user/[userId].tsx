import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { theme } from '@/src/theme';
import { useAuth } from '@/src/context/AuthContext';
import { api } from '@/src/api/client';
import { Avatar } from '@/src/components/Avatar';
import { BadgePill } from '@/src/components/BadgePill';
import { PButton } from '@/src/components/PButton';
import { ScreenHeader } from '@/src/components/ScreenHeader';

export default function UserProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { user: me } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await api.getUser(userId);
      setProfile(res.user);
    } finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  if (loading || !profile) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  const isMe = profile.user_id === me?.user_id;
  const isFriend = profile.is_friend;
  const req = profile.friend_request;
  const outgoing = req && req.from_id === me?.user_id;
  const incoming = req && req.to_id === me?.user_id;

  const doAction = async (fn: () => Promise<any>) => { await fn(); await load(); };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={['top', 'bottom']}>
      <ScreenHeader title="Profile" onBack={() => router.back()} />
      <ScrollView>
        <LinearGradient
          colors={['#3A0F0F', theme.colors.bg]}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
          style={styles.cover}
        >
          <View style={styles.coverInner}>
            <Avatar uri={profile.avatar} name={profile.display_name || profile.username} size={100} borderColor={theme.colors.bg} />
          </View>
        </LinearGradient>

        <View style={styles.info}>
          <Text style={styles.name}>{profile.display_name || profile.username}</Text>
          <Text style={styles.uname}>@{profile.username}</Text>
          {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}

          {profile.badges && profile.badges.length > 0 ? (
            <View style={styles.badgeRow}>
              {profile.badges.map((b: string) => <BadgePill key={b} badge={b} />)}
            </View>
          ) : null}
        </View>

        <View style={styles.stats}>
          <StatCol label="Friends" value={profile.friends_count || 0} />
          <StatDiv />
          <StatCol label="Posts" value={profile.posts_count || 0} />
          <StatDiv />
          <StatCol label="Rooms" value={profile.rooms_created || 0} />
        </View>

        {!isMe && (
          <View style={styles.actions}>
            {isFriend ? (
              <>
                <PButton
                  title="Message"
                  onPress={() => router.push(`/chat/${profile.user_id}`)}
                  icon={<MaterialCommunityIcons name="chat" size={16} color={theme.colors.onPrimary} />}
                  testID="user-message-btn"
                  fullWidth
                />
                <PButton
                  title="Remove Friend"
                  variant="outline"
                  onPress={() => doAction(() => api.removeFriend(profile.user_id))}
                  fullWidth
                  testID="user-remove-btn"
                />
              </>
            ) : incoming ? (
              <>
                <PButton title="Accept Request" onPress={() => doAction(() => api.acceptRequest(profile.user_id))} fullWidth testID="user-accept-btn" />
                <PButton title="Reject" variant="ghost" onPress={() => doAction(() => api.rejectRequest(profile.user_id))} fullWidth testID="user-reject-btn" />
              </>
            ) : outgoing ? (
              <PButton
                title="Cancel Request"
                variant="outline"
                onPress={() => doAction(() => api.cancelRequest(profile.user_id))}
                fullWidth
                testID="user-cancel-btn"
              />
            ) : (
              <PButton
                title="Add Friend"
                onPress={() => doAction(() => api.sendRequest(profile.user_id))}
                icon={<MaterialCommunityIcons name="account-plus" size={16} color={theme.colors.onPrimary} />}
                fullWidth
                testID="user-add-btn"
              />
            )}
            <View style={styles.mini}>
              <TouchableOpacity
                onPress={async () => { profile.blocked ? await api.unblock(profile.user_id) : await api.block(profile.user_id); load(); }}
                style={styles.miniBtn}
                testID="user-block-btn"
              >
                <MaterialCommunityIcons name={profile.blocked ? 'account-check' : 'block-helper'} size={16} color={theme.colors.textDim} />
                <Text style={styles.miniTxt}>{profile.blocked ? 'Unblock' : 'Block'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => api.report(profile.user_id, 'user', 'inappropriate')}
                style={styles.miniBtn}
                testID="user-report-btn"
              >
                <MaterialCommunityIcons name="flag-outline" size={16} color={theme.colors.textDim} />
                <Text style={styles.miniTxt}>Report</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCol({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statCol}>
      <Text style={styles.statVal}>{value}</Text>
      <Text style={styles.statLbl}>{label}</Text>
    </View>
  );
}
function StatDiv() { return <View style={styles.statDiv} />; }

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: theme.colors.bg, alignItems: 'center', justifyContent: 'center' },
  cover: { height: 180, alignItems: 'center', justifyContent: 'flex-end' },
  coverInner: { marginBottom: -50 },
  info: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 20 },
  name: { color: theme.colors.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  uname: { color: theme.colors.textDim, fontSize: 14, marginTop: 4 },
  bio: { color: theme.colors.text, fontSize: 14, marginTop: 12, textAlign: 'center', lineHeight: 20 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14, justifyContent: 'center' },
  stats: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
    marginTop: 24, marginHorizontal: 16, paddingVertical: 16,
    backgroundColor: theme.colors.surface1, borderRadius: theme.radii.lg,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  statCol: { alignItems: 'center', flex: 1 },
  statVal: { color: theme.colors.text, fontSize: 22, fontWeight: '800' },
  statLbl: { color: theme.colors.textDim, fontSize: 12, marginTop: 2 },
  statDiv: { width: 1, height: 30, backgroundColor: theme.colors.border },
  actions: { padding: 20, gap: 10 },
  mini: { flexDirection: 'row', gap: 10, marginTop: 6 },
  miniBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: theme.radii.md,
    backgroundColor: theme.colors.surface1, borderWidth: 1, borderColor: theme.colors.border,
  },
  miniTxt: { color: theme.colors.textDim, fontSize: 13, fontWeight: '600' },
});
