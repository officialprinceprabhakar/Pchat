import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet, Platform, TouchableOpacity, Text } from 'react-native';
import { Tabs } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { api } from '@/src/api/client';
import { useRouter } from 'expo-router';

async function registerPush(user_id: string) {
  if (Platform.OS === 'web') return;
  if (!Device.isDevice) return;
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (existing !== 'granted') {
      const { status: newStatus } = await Notifications.requestPermissionsAsync();
      status = newStatus;
    }
    if (status !== 'granted') return;
    const tokenResp = await Notifications.getDevicePushTokenAsync();
    await api.registerPush(user_id, Platform.OS, tokenResp.data as string);
  } catch (e) {
    console.warn('push register failed', e);
  }
}

const TAB_ICONS: Record<string, string> = {
  home: 'home-variant',
  rooms: 'pound-box',
  friends: 'account-multiple',
  messages: 'chat-processing',
  notifications: 'bell',
  profile: 'account-circle',
};

const TAB_LABELS: Record<string, string> = {
  home: 'Home',
  rooms: 'Rooms',
  friends: 'Friends',
  messages: 'Chats',
  notifications: 'Alerts',
  profile: 'Me',
};

// enforce tab order
const TAB_ORDER = ['home', 'rooms', 'friends', 'messages', 'notifications', 'profile'];

export default function TabsLayout() {
  const t = useTheme();
  const { user, loading } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!loading && !user) router.replace('/');
  }, [loading, user, router]);

  useEffect(() => {
    if (user) registerPush(user.user_id);
  }, [user]);

  const styles = useMemo(() => makeStyles(t), [t]);

  // slightly denser tab row for 6 items
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: { display: 'none' },
      }}
      tabBar={(props) => {
        // sort routes according to TAB_ORDER
        const ordered = [...props.state.routes]
          .filter((r: any) => TAB_ORDER.includes(r.name))
          .sort((a: any, b: any) => TAB_ORDER.indexOf(a.name) - TAB_ORDER.indexOf(b.name));
        return (
          <View pointerEvents="box-none" style={[styles.barWrap, { paddingBottom: Math.max(insets.bottom, 8) }]}>
            <BlurView intensity={40} tint={t.mode === 'dark' ? 'dark' : 'light'} style={styles.bar}>
              {ordered.map((route: any) => {
                const routeIdx = props.state.routes.findIndex((r: any) => r.key === route.key);
                const focused = props.state.index === routeIdx;
                const iconName = TAB_ICONS[route.name] || 'circle';
                const label = TAB_LABELS[route.name] || route.name;
                return (
                  <TouchableOpacity
                    key={route.key}
                    onPress={() => {
                      const event = props.navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                      if (!event.defaultPrevented) props.navigation.navigate(route.name);
                    }}
                    activeOpacity={0.8}
                    testID={`tab-${route.name}`}
                    style={[styles.tab, focused && styles.tabActive]}
                  >
                    <MaterialCommunityIcons
                      name={iconName as any}
                      size={22}
                      color={focused ? t.colors.primary : t.colors.textDim}
                    />
                    {focused ? <Text style={styles.tabLabel}>{label}</Text> : null}
                  </TouchableOpacity>
                );
              })}
            </BlurView>
          </View>
        );
      }}
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="rooms" />
      <Tabs.Screen name="friends" />
      <Tabs.Screen name="messages" />
      <Tabs.Screen name="notifications" />
      <Tabs.Screen name="profile" />
      <Tabs.Screen name="discover" options={{ href: null }} />
    </Tabs>
  );
}

const makeStyles = (t: ReturnType<typeof useTheme>) => StyleSheet.create({
  barWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 0,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 100,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: t.colors.tabBorder,
    backgroundColor: t.colors.tabBg,
  },
  tab: {
    flex: 1,
    height: 44,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  tabActive: {
    backgroundColor: t.colors.primaryGlow,
    borderWidth: 1,
    borderColor: t.colors.primary + '55',
  },
  tabLabel: {
    color: t.colors.primary,
    fontSize: 11,
    fontWeight: '700',
  },
});
