import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal,
  Image, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import { theme } from '@/src/theme';
import { useAuth } from '@/src/context/AuthContext';
import { api } from '@/src/api/client';
import { Avatar } from '@/src/components/Avatar';
import { BadgePill } from '@/src/components/BadgePill';
import { PButton } from '@/src/components/PButton';

export default function ProfileScreen() {
  const { user, refresh, logout } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [avatar, setAvatar] = useState<string | null>(user?.avatar || null);
  const [saving, setSaving] = useState(false);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  React.useEffect(() => {
    if (user) {
      setDisplayName(user.display_name || '');
      setBio(user.bio || '');
      setAvatar(user.avatar || null);
    }
  }, [user]);

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
      base64: true,
    });
    if (!res.canceled && res.assets[0]) {
      const b64 = res.assets[0].base64 || '';
      setAvatar(`data:image/jpeg;base64,${b64}`);
    }
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      await api.updateMe({ display_name: displayName, bio, avatar: avatar || undefined });
      await refresh();
      setEditing(false);
    } finally { setSaving(false); }
  };

  if (!user) return null;

  const isDev = !!user.is_developer;

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: theme.colors.bg }}>
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {isDev ? (
              <TouchableOpacity onPress={() => router.push('/dev')} style={styles.iconBtnGold} testID="profile-dev-btn">
                <MaterialCommunityIcons name="crown" size={18} color="#FF9F0A" />
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity onPress={() => router.push('/settings')} style={styles.iconBtn} testID="profile-settings-btn">
              <MaterialCommunityIcons name="cog" size={18} color={theme.colors.text} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setEditing(true)} style={styles.iconBtn} testID="profile-edit-btn">
              <MaterialCommunityIcons name="pencil" size={18} color={theme.colors.text} />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={{ paddingBottom: 120 + insets.bottom }} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={['#3A0F0F', theme.colors.bg]}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
          style={styles.cover}
        >
          <View style={styles.coverInner}>
            <Avatar uri={avatar} name={user.display_name || user.username} size={100} borderColor={theme.colors.bg} />
          </View>
        </LinearGradient>

        <View style={styles.info}>
          <Text style={styles.name} testID="profile-display-name">{user.display_name || user.username}</Text>
          <Text style={styles.uname}>@{user.username}</Text>
          {user.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}

          {user.badges && user.badges.length > 0 ? (
            <View style={styles.badgeRow}>
              {user.badges.map((b) => <BadgePill key={b} badge={b} />)}
            </View>
          ) : null}
        </View>

        <View style={styles.stats}>
          <Stat label="Friends" value={user.friends_count || 0} />
          <StatDivider />
          <Stat label="Posts" value={user.posts_count || 0} />
          <StatDivider />
          <Stat label="Rooms" value={user.rooms_created || 0} />
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionRow} onPress={() => router.push('/settings')} testID="profile-settings">
            <MaterialCommunityIcons name="cog" size={22} color={theme.colors.text} />
            <Text style={styles.actionTxt}>Settings & Appearance</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color={theme.colors.textDim} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionRow} onPress={() => router.push('/(tabs)/friends')} testID="profile-friends">
            <MaterialCommunityIcons name="account-multiple" size={22} color={theme.colors.text} />
            <Text style={styles.actionTxt}>Friends & requests</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color={theme.colors.textDim} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionRow} onPress={() => router.push('/notifications')} testID="profile-notifications">
            <MaterialCommunityIcons name="bell" size={22} color={theme.colors.text} />
            <Text style={styles.actionTxt}>Notifications</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color={theme.colors.textDim} />
          </TouchableOpacity>
          {isDev ? (
            <TouchableOpacity style={styles.actionRow} onPress={() => router.push('/dev')} testID="profile-dev">
              <MaterialCommunityIcons name="shield-crown" size={22} color="#FF9F0A" />
              <Text style={[styles.actionTxt, { color: '#FF9F0A' }]}>Developer Dashboard</Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color={theme.colors.textDim} />
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={styles.actionRow} onPress={logout} testID="profile-logout">
            <MaterialCommunityIcons name="logout" size={22} color={theme.colors.primary} />
            <Text style={[styles.actionTxt, { color: theme.colors.primary }]}>Sign out</Text>
            <View style={{ width: 20 }} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal visible={editing} animationType="slide" transparent onRequestClose={() => setEditing(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>Edit profile</Text>
              <TouchableOpacity onPress={() => setEditing(false)} testID="profile-edit-close">
                <MaterialCommunityIcons name="close" size={22} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={pickImage} style={styles.avatarPicker} testID="profile-avatar-picker">
              <Avatar uri={avatar} name={displayName || user.username} size={80} />
              <View style={styles.avatarPickBadge}>
                <MaterialCommunityIcons name="camera" size={16} color={theme.colors.onPrimary} />
              </View>
            </TouchableOpacity>
            <TextInput
              style={styles.input}
              placeholder="Display name"
              placeholderTextColor={theme.colors.textMuted}
              value={displayName}
              onChangeText={setDisplayName}
              testID="profile-name-input"
            />
            <TextInput
              style={[styles.input, { height: 90, textAlignVertical: 'top' }]}
              placeholder="Bio"
              placeholderTextColor={theme.colors.textMuted}
              value={bio}
              onChangeText={setBio}
              multiline
              testID="profile-bio-input"
            />
            <PButton
              title="Save changes"
              onPress={saveProfile}
              loading={saving}
              fullWidth
              testID="profile-save"
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statCol}>
      <Text style={styles.statVal}>{value}</Text>
      <Text style={styles.statLbl}>{label}</Text>
    </View>
  );
}
function StatDivider() { return <View style={styles.statDiv} />; }

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
  },
  title: { color: theme.colors.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.surface2,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.border,
  },
  iconBtnGold: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,159,10,0.15)',
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#FF9F0A',
  },
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
  actions: {
    marginTop: 20, marginHorizontal: 16,
    backgroundColor: theme.colors.surface1, borderRadius: theme.radii.lg,
    borderWidth: 1, borderColor: theme.colors.border, overflow: 'hidden',
  },
  actionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  actionTxt: { flex: 1, color: theme.colors.text, fontSize: 15, fontWeight: '600' },
  modalWrap: { flex: 1, backgroundColor: theme.colors.overlay, justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: theme.colors.surface1, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 40, gap: 12,
  },
  modalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  modalTitle: { color: theme.colors.text, fontSize: 20, fontWeight: '800' },
  avatarPicker: { alignSelf: 'center', marginBottom: 8, position: 'relative' },
  avatarPickBadge: {
    position: 'absolute', right: 0, bottom: 0, width: 30, height: 30, borderRadius: 15,
    backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: theme.colors.surface1,
  },
  input: {
    backgroundColor: theme.colors.surface2, color: theme.colors.text,
    borderRadius: theme.radii.md, padding: 14, fontSize: 14,
    borderWidth: 1, borderColor: theme.colors.border,
  },
});
