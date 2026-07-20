"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { api, unwrap } from "@/lib/api";
import type { Me } from "@/lib/models";

export const FORUM_CONTEXT = "forum";

export interface AuthState {
  session: boolean;
  me: Me | null;
  loading: boolean;
  can: { administer: boolean; moderate: boolean; pin: boolean };
  login: (username: string, password: string) => Promise<void>;
  register: (
    username: string,
    password: string,
    displayName: string,
    email: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

async function resolveCapabilities(user: string) {
  const caps = ["administer", "moderate", "pin"] as const;
  const results = await Promise.all(
    caps.map((capability) =>
      api.roles.can({ user, context: FORUM_CONTEXT, capability }),
    ),
  );
  const [administer, moderate, pin] = results.map(unwrap);
  return {
    administer: administer.allowed,
    moderate: moderate.allowed,
    pin: pin.allowed,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [can, setCan] = useState({
    administer: false,
    moderate: false,
    pin: false,
  });

  const hydrate = useCallback(async () => {
    const result = await api.auth.me();
    if ("error" in result) {
      setSession(false);
      setMe(null);
      setCan({ administer: false, moderate: false, pin: false });
      return;
    }
    setSession(true);
    setMe(result);
    setCan(await resolveCapabilities(String(result.user)));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- auth hydration must run once on mount
    hydrate().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(
    async (username: string, password: string) => {
      unwrap(await api.auth.login({ username, password }));
      setSession(true);
      await hydrate();
    },
    [hydrate],
  );

  const register = useCallback(
    async (
      username: string,
      password: string,
      displayName: string,
      email: string,
    ) => {
      unwrap(
        await api.auth.register({ username, password, displayName, email }),
      );
      unwrap(await api.auth.login({ username, password }));
      setSession(true);
      await hydrate();
    },
    [hydrate],
  );

  const logout = useCallback(async () => {
    if (session) unwrap(await api.auth.logout());
    setSession(false);
    setMe(null);
    setCan({ administer: false, moderate: false, pin: false });
  }, [session]);

  const refresh = useCallback(async () => {
    await hydrate();
  }, [hydrate]);

  const value = useMemo<AuthState>(
    () => ({ session, me, loading, can, login, register, logout, refresh }),
    [session, me, loading, can, login, register, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
