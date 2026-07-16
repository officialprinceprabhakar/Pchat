// PChat design tokens - dark + light themes with runtime switching.
export type ThemeMode = 'dark' | 'light';

export type PChatTheme = {
  mode: ThemeMode;
  colors: {
    bg: string;
    surface1: string;
    surface2: string;
    surface3: string;
    border: string;
    text: string;
    textDim: string;
    textMuted: string;
    primary: string;
    primaryGlow: string;
    onPrimary: string;
    blue: string;
    green: string;
    yellow: string;
    cyan: string;
    orange: string;
    purple: string;
    red: string;
    glass: string;
    overlay: string;
    tabBg: string;
    tabBorder: string;
  };
  radii: { sm: number; md: number; lg: number; xl: number; full: number };
  space: { xs: number; sm: number; md: number; lg: number; xl: number; xxl: number };
};

const darkColors: PChatTheme['colors'] = {
  bg: '#0A0A0C',
  surface1: '#141418',
  surface2: '#1E1E24',
  surface3: '#2A2A32',
  border: '#2C2C30',
  text: '#F2F2F2',
  textDim: '#A1A1A8',
  textMuted: '#52525A',
  primary: '#FF3B30',
  primaryGlow: 'rgba(255,59,48,0.25)',
  onPrimary: '#FFFFFF',
  blue: '#0A84FF',
  green: '#30D158',
  yellow: '#FFD60A',
  cyan: '#32ADE6',
  orange: '#FF9F0A',
  purple: '#BF5AF2',
  red: '#FF453A',
  glass: 'rgba(20, 20, 24, 0.75)',
  overlay: 'rgba(0, 0, 0, 0.6)',
  tabBg: 'rgba(20,20,24,0.85)',
  tabBorder: 'rgba(255,255,255,0.08)',
};

const lightColors: PChatTheme['colors'] = {
  bg: '#F7F7F9',
  surface1: '#FFFFFF',
  surface2: '#F0F0F4',
  surface3: '#E4E4EA',
  border: '#E1E1E6',
  text: '#0E0E10',
  textDim: '#5A5A63',
  textMuted: '#9F9FA6',
  primary: '#E11D2E',
  primaryGlow: 'rgba(225,29,46,0.15)',
  onPrimary: '#FFFFFF',
  blue: '#0A6DDB',
  green: '#1BA045',
  yellow: '#B08800',
  cyan: '#1E8FBF',
  orange: '#D67F00',
  purple: '#8B4FC6',
  red: '#E11D2E',
  glass: 'rgba(255,255,255,0.85)',
  overlay: 'rgba(0,0,0,0.35)',
  tabBg: 'rgba(255,255,255,0.94)',
  tabBorder: 'rgba(0,0,0,0.06)',
};

const shared = {
  radii: { sm: 8, md: 12, lg: 20, xl: 28, full: 9999 },
  space: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 },
};

export const darkTheme: PChatTheme = { mode: 'dark', colors: darkColors, ...shared };
export const lightTheme: PChatTheme = { mode: 'light', colors: lightColors, ...shared };

// Backwards-compat static export (defaults to dark). Do NOT use in new code — use useTheme() instead.
export const theme = darkTheme;

export const badgeMeta: Record<string, { color: string; icon: string; label: string }> = {
  developer: { color: '#FF9F0A', icon: 'crown', label: 'Developer' },
  verified: { color: '#30D158', icon: 'check-decagram', label: 'Verified' },
  guest: { color: '#8E8E93', icon: 'account', label: 'Guest' },
  moderator: { color: '#0A84FF', icon: 'shield-star', label: 'Moderator' },
  vip: { color: '#FFD60A', icon: 'star', label: 'VIP' },
  owner: { color: '#FF453A', icon: 'crown-outline', label: 'Owner' },
  elite: { color: '#BF5AF2', icon: 'trophy', label: 'Elite' },
  ai: { color: '#32ADE6', icon: 'robot', label: 'AI' },
};
