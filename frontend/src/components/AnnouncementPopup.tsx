import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Linking } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { api } from '@/src/api/client';
import { theme } from '@/src/theme';

type Announcement = {
  ann_id: string;
  title: string;
  message: string;
  severity?: 'info' | 'warning' | 'critical';
  action_url?: string | null;
};

const SEVERITY_META: Record<string, { color: string; icon: string; label: string }> = {
  info: { color: theme.colors.blue, icon: 'information', label: 'ANNOUNCEMENT' },
  warning: { color: '#FF9F0A', icon: 'alert', label: 'IMPORTANT' },
  critical: { color: '#FF3B30', icon: 'alert-octagon', label: 'URGENT' },
};

export function AnnouncementPopup() {
  const { user } = useAuth();
  const [ann, setAnn] = useState<Announcement | null>(null);

  const fetchActive = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.activeAnnouncement();
      if (res?.announcement) setAnn(res.announcement);
    } catch {}
  }, [user]);

  useEffect(() => {
    fetchActive();
    // Poll every 60s in case a new one is broadcast while app is open
    const t = setInterval(fetchActive, 60_000);
    return () => clearInterval(t);
  }, [fetchActive]);

  const dismiss = useCallback(async () => {
    if (!ann) return;
    const id = ann.ann_id;
    setAnn(null);
    try { await api.dismissAnnouncement(id); } catch {}
  }, [ann]);

  const openAction = useCallback(() => {
    if (!ann?.action_url) return;
    Linking.openURL(ann.action_url).catch(() => {});
  }, [ann]);

  if (!ann) return null;
  const meta = SEVERITY_META[ann.severity || 'info'] || SEVERITY_META.info;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={dismiss}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={[styles.iconWrap, { backgroundColor: meta.color + '22' }]}>
            <MaterialCommunityIcons name={meta.icon as any} size={30} color={meta.color} />
          </View>
          <Text style={[styles.tag, { color: meta.color }]}>{meta.label}</Text>
          <Text style={styles.title}>{ann.title}</Text>
          <Text style={styles.msg}>{ann.message}</Text>
          <View style={{ height: 8 }} />
          {ann.action_url ? (
            <TouchableOpacity onPress={openAction} style={[styles.primaryBtn, { backgroundColor: meta.color }]} testID="ann-action">
              <Text style={styles.primaryTxt}>Learn more</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity onPress={dismiss} style={styles.dismissBtn} testID="ann-dismiss">
            <Text style={styles.dismissTxt}>Got it</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: {
    backgroundColor: theme.colors.surface1, borderRadius: 24, padding: 24,
    borderWidth: 1, borderColor: theme.colors.border, width: '100%', maxWidth: 380,
    alignItems: 'center', gap: 6,
  },
  iconWrap: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  tag: { fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: theme.colors.text, fontSize: 18, fontWeight: '800', textAlign: 'center', marginTop: 2 },
  msg: { color: theme.colors.textDim, fontSize: 14, textAlign: 'center', lineHeight: 20, marginTop: 6 },
  primaryBtn: { paddingHorizontal: 22, paddingVertical: 12, borderRadius: 100, marginTop: 6, alignSelf: 'stretch', alignItems: 'center' },
  primaryTxt: { color: '#fff', fontWeight: '800', fontSize: 14 },
  dismissBtn: { marginTop: 8, paddingVertical: 10, paddingHorizontal: 20 },
  dismissTxt: { color: theme.colors.textDim, fontWeight: '700', fontSize: 13 },
});
