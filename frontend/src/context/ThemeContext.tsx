import React, { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { storage } from '@/src/utils/storage';
import { darkTheme, lightTheme, PChatTheme, ThemeMode } from '@/src/theme';

type Ctx = {
  theme: PChatTheme;
  mode: ThemeMode;
  setMode: (m: ThemeMode) => Promise<void>;
  toggle: () => Promise<void>;
};

const THEME_KEY = 'pchat_theme_mode';
const ThemeCtx = createContext<Ctx | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('dark');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const stored = await storage.getItem(THEME_KEY, 'dark');
      if (stored === 'light' || stored === 'dark') setModeState(stored);
      setReady(true);
    })();
  }, []);

  const setMode = useCallback(async (m: ThemeMode) => {
    setModeState(m);
    await storage.setItem(THEME_KEY, m);
  }, []);

  const toggle = useCallback(async () => {
    const next: ThemeMode = mode === 'dark' ? 'light' : 'dark';
    await setMode(next);
  }, [mode, setMode]);

  const theme = mode === 'dark' ? darkTheme : lightTheme;

  if (!ready) return null;
  return <ThemeCtx.Provider value={{ theme, mode, setMode, toggle }}>{children}</ThemeCtx.Provider>;
}

export function useTheme(): PChatTheme {
  const ctx = useContext(ThemeCtx);
  return ctx?.theme || darkTheme;
}

export function useThemeMode() {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error('useThemeMode must be inside ThemeProvider');
  return ctx;
}
