import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { theme } from '@/src/theme';
import { api } from '@/src/api/client';
import { PButton } from '@/src/components/PButton';
import { ScreenHeader } from '@/src/components/ScreenHeader';

export default function CreateRoomScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [rules, setRules] = useState('');
  const [welcome, setWelcome] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [password, setPassword] = useState('');
  const [slowMode, setSlowMode] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    if (!name.trim()) { setErr('Room name required'); return; }
    setBusy(true);
    try {
      const res = await api.createRoom({
        name: name.trim(),
        description,
        rules,
        welcome_message: welcome,
        is_private: isPrivate,
        password: password.trim() || undefined,
        slow_mode_seconds: slowMode,
      });
      router.replace(`/room/${res.room.room_id}`);
    } catch (e: any) {
      setErr(e.message || 'Failed to create');
    } finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={['top', 'bottom']}>
      <ScreenHeader title="Create Room" onBack={() => router.back()} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }} keyboardShouldPersistTaps="handled">
          <Field label="Room name" value={name} onChangeText={setName} placeholder="My awesome room" testID="create-room-name" />
          <Field label="Description" value={description} onChangeText={setDescription} placeholder="What's this room about?" multiline testID="create-room-desc" />
          <Field label="Rules" value={rules} onChangeText={setRules} placeholder="Be kind. No spam." multiline testID="create-room-rules" />
          <Field label="Welcome message" value={welcome} onChangeText={setWelcome} placeholder="Welcome to the room!" multiline testID="create-room-welcome" />

          <TouchableOpacity
            onPress={() => setIsPrivate(!isPrivate)}
            style={styles.toggle}
            testID="create-room-private-toggle"
          >
            <View>
              <Text style={styles.toggleLabel}>Private room</Text>
              <Text style={styles.toggleSub}>Only invited members can join</Text>
            </View>
            <View style={[styles.switch, isPrivate && styles.switchOn]}>
              <View style={[styles.switchThumb, isPrivate && styles.switchThumbOn]} />
            </View>
          </TouchableOpacity>

          <View>
            <Text style={styles.label}>Password (optional)</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Leave empty for no password"
              placeholderTextColor={theme.colors.textMuted}
              secureTextEntry
              style={styles.input}
              testID="create-room-password"
            />
          </View>

          <View>
            <Text style={styles.label}>Slow mode (seconds between messages)</Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {[0, 5, 10, 30, 60].map((s) => (
                <TouchableOpacity
                  key={s}
                  onPress={() => setSlowMode(s)}
                  style={[styles.slowChip, slowMode === s && styles.slowChipActive]}
                  testID={`create-slow-${s}`}
                >
                  <Text style={[styles.slowTxt, slowMode === s && styles.slowTxtActive]}>{s === 0 ? 'Off' : s + 's'}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {err ? <Text style={styles.err} testID="create-room-error">{err}</Text> : null}
          <View style={{ height: 10 }} />
          <PButton title="Create Room" onPress={submit} loading={busy} fullWidth testID="create-room-submit" />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, testID, multiline, ...rest }: any) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...rest}
        multiline={multiline}
        placeholderTextColor={theme.colors.textMuted}
        style={[styles.input, multiline && { height: 90, textAlignVertical: 'top' }]}
        testID={testID}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  label: { color: theme.colors.textDim, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginBottom: 6, textTransform: 'uppercase' },
  input: {
    backgroundColor: theme.colors.surface1, color: theme.colors.text,
    borderRadius: theme.radii.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  toggle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, backgroundColor: theme.colors.surface1, borderRadius: theme.radii.lg,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  toggleLabel: { color: theme.colors.text, fontWeight: '700', fontSize: 15 },
  toggleSub: { color: theme.colors.textDim, fontSize: 12, marginTop: 2 },
  switch: {
    width: 46, height: 26, borderRadius: 13, backgroundColor: theme.colors.surface3,
    padding: 3, justifyContent: 'center',
  },
  switchOn: { backgroundColor: theme.colors.primary },
  switchThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
  switchThumbOn: { alignSelf: 'flex-end' },
  err: { color: theme.colors.primary, fontSize: 13 },
  slowChip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 100,
    backgroundColor: theme.colors.surface1, borderWidth: 1, borderColor: theme.colors.border,
  },
  slowChipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  slowTxt: { color: theme.colors.textDim, fontSize: 12, fontWeight: '700' },
  slowTxtActive: { color: theme.colors.onPrimary },
});
