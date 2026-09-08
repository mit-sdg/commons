"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { api, unwrap } from "@/lib/api";
import type { Capability, Me } from "@/lib/models";

export const COMMONS_CONTEXT = "commons";

/**
 * Everything the signed-in caller may do, as the server computes it.
 *
 * `administer` is a wildcard, and the server has already expanded it, so a
 * `can(...)` check here always agrees with the endpoint that enforces it.
 */
export interface Permissions {
  capabilities: Capability[];
  can: (capability: Capability) => boolean;
  isStaff: boolean;
}

const NO_PERMISSIONS: Permissions = {
  capabilities: [],
  can: () => false,
  isStaff: false,
};

const STAFF_CAPABILITIES: Capability[] = [
  "course:manage",
  "grade",
  "live:host",
  "student-records",
];

function permissionsOf(capabilities: Capability[]): Permissions {
  const held = new Set<Capability>(capabilities);
  return {
    capabilities,
    can: (capability) => held.has(capability),
    isStaff: STAFF_CAPABILITIES.some((capability) => held.has(capability)),
  };
}

export interface AuthState {
  session: boolean;
  me: Me | null;
  loading: boolean;
  permissions: Permissions;
  login: (username: string, password: string) => Promise<void>;
  register: (
    invitation: string,
    temporaryPassword: string,
    username: string,
    displayName: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [identity, setIdentity] = useState<{
    session: boolean;
    me: Me | null;
    permissions: Permissions;
  }>({ session: false, me: null, permissions: NO_PERMISSIONS });
  const { session, me, permissions } = identity;
  const [loading, setLoading] = useState(true);
  const hydration = useRef(0);

  const clearIdentity = useCallback(() => {
    hydration.current += 1;
    setIdentity({ session: false, me: null, permissions: NO_PERMISSIONS });
    return hydration.current;
  }, []);

  const hydrate = useCallback(async () => {
    const attempt = ++hydration.current;
    try {
      const result = await api.auth.me();
      if (attempt !== hydration.current) return;
      if ("error" in result) {
        setIdentity({ session: false, me: null, permissions: NO_PERMISSIONS });
        return;
      }
      const granted = await api.auth.permissions({});
      if (attempt !== hydration.current) return;
      setIdentity({
        session: true,
        me: result,
        permissions:
          "error" in granted
            ? NO_PERMISSIONS
            : permissionsOf(granted.capabilities as Capability[]),
      });
    } catch (error) {
      if (attempt === hydration.current)
        setIdentity({ session: false, me: null, permissions: NO_PERMISSIONS });
      throw error;
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- auth hydration must run once on mount
    hydrate()
      .catch(() => undefined)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(
    async (username: string, password: string) => {
      const attempt = clearIdentity();
      unwrap(await api.auth.login({ username, password }));
      if (attempt === hydration.current) await hydrate();
    },
    [hydrate, clearIdentity],
  );

  const register = useCallback(
    async (
      invitation: string,
      temporaryPassword: string,
      username: string,
      displayName: string,
    ) => {
      const attempt = clearIdentity();
      unwrap(
        await api.auth["accept-invitation"]({
          invitation,
          temporaryPassword,
          username,
          password: temporaryPassword,
          displayName,
        }),
      );
      if (attempt !== hydration.current) return;
      unwrap(await api.auth.login({ username, password: temporaryPassword }));
      if (attempt === hydration.current) await hydrate();
    },
    [hydrate, clearIdentity],
  );

  const logout = useCallback(async () => {
    clearIdentity();
    if (session) unwrap(await api.auth.logout());
  }, [session, clearIdentity]);

  const refresh = useCallback(async () => {
    await hydrate();
  }, [hydrate]);

  const value = useMemo<AuthState>(
    () => ({
      session,
      me,
      loading,
      permissions,
      login,
      register,
      logout,
      refresh,
    }),
    [session, me, loading, permissions, login, register, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
