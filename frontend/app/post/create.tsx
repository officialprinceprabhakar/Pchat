import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, Image, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import { theme } from '@/src/theme';
import { api } from '@/src/api/client';
import { PButton } from '@/src/components/PButton';
import { ScreenHeader } from '@/src/components/ScreenHeader';

export default function CreatePostScreen() {
  const router = useRouter();
  const [image, setImage] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'friends'>('public');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const pick = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { setErr('Photos permission denied'); return; }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, quality: 0.5, base64: true,
    });
    if (res.canceled || !res.assets[0]?.base64) return;
    setImage(`data:image/jpeg;base64,${res.assets[0].base64}`);
  };

  const submit = async () => {
    setErr(null);
    if (!image) { setErr('Please add a photo'); return; }
    setBusy(true);
    try {
      await api.createPost({ image, caption, visibility });
      router.replace('/(tabs)/discover');
    } catch (e: any) {
      setErr(e.message || 'Failed to post');
    } finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={['top', 'bottom']}>
      <ScreenHeader title="New post" subtitle="Max 2 posts per week" onBack={() => router.back()} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} keyboardShouldPersistTaps="handled">
          <TouchableOpacity onPress={pick} style={styles.imgPicker} testID="post-image-picker">
            {image ? (
              <Image source={{ uri: image }} style={styles.img} />
            ) : (
              <View style={styles.imgEmpty}>
                <MaterialCommunityIcons name="image-plus" size={44} color={theme.colors.textDim} />
                <Text style={styles.imgTxt}>Tap to select a photo</Text>
              </View>
            )}
          </TouchableOpacity>
          <TextInput
            value={caption}
            onChangeText={setCaption}
            placeholder="Write a caption..."
            placeholderTextColor={theme.colors.textMuted}
            style={styles.input}
            multiline
            testID="post-caption-input"
          />
          <View style={styles.visRow}>
            {(['public', 'friends'] as const).map((v) => (
              <TouchableOpacity
                key={v}
                onPress={() => setVisibility(v)}
                style={[styles.visChip, visibility === v && styles.visChipActive]}
                testID={`post-vis-${v}`}
              >
                <MaterialCommunityIcons
                  name={v === 'public' ? 'earth' : 'account-multiple'}
                  size={16}
                  color={visibility === v ? theme.colors.onPrimary : theme.colors.text}
                />
                <Text style={[styles.visTxt, visibility === v && { color: theme.colors.onPrimary }]}>
                  {v === 'public' ? 'Public' : 'Friends only'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {err ? <Text style={styles.err} testID="post-error">{err}</Text> : null}
          <PButton title="Publish Post" onPress={submit} loading={busy} fullWidth testID="post-submit" />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  imgPicker: {
    aspectRatio: 1, backgroundColor: theme.colors.surface1, borderRadius: theme.radii.lg,
    overflow: 'hidden', borderWidth: 1, borderColor: theme.colors.border, borderStyle: 'dashed',
  },
  img: { width: '100%', height: '100%' },
  imgEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  imgTxt: { color: theme.colors.textDim, fontSize: 13 },
  input: {
    backgroundColor: theme.colors.surface1, color: theme.colors.text,
    borderRadius: theme.radii.md, padding: 14, minHeight: 100, textAlignVertical: 'top',
    borderWidth: 1, borderColor: theme.colors.border, fontSize: 15,
  },
  visRow: { flexDirection: 'row', gap: 10 },
  visChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12, borderRadius: theme.radii.md,
    backgroundColor: theme.colors.surface1, borderWidth: 1, borderColor: theme.colors.border,
  },
  visChipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  visTxt: { color: theme.colors.text, fontWeight: '700', fontSize: 13 },
  err: { color: theme.colors.primary, fontSize: 13 },
});
