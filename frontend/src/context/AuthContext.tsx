import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { storage } from '@/src/utils/storage';
import { api, TOKEN_STORAGE_KEY } from '@/src/api/client';

export type PChatUser = {
  user_id: string;
  username: string;
  display_name?: string;
  email?: string;
  avatar?: string | null;
  bio?: string;
  provider?: string;
  is_developer?: boolean;
  friends_count?: number;
  posts_count?: number;
  rooms_created?: number;
  badges?: string[];
};

type Ctx = {
  user: PChatUser | null;
  loading: boolean;
  setSession: (token: string, user: PChatUser) => Promise<void>;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthCtx = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PChatUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const token = await storage.secureGet(TOKEN_STORAGE_KEY, null);
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const res = await api.me();
      setUser(res.user);
    } catch {
      await storage.secureRemove(TOKEN_STORAGE_KEY);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const setSession = useCallback(async (token: string, u: PChatUser) => {
    await storage.secureSet(TOKEN_STORAGE_KEY, token);
    setUser(u);
  }, []);

  const logout = useCallback(async () => {
    try { await api.logout(); } catch {}
    await storage.secureRemove(TOKEN_STORAGE_KEY);
    setUser(null);
  }, []);

  return (
    <AuthCtx.Provider value={{ user, loading, setSession, refresh, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
