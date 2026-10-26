"use client";

import * as React from "react";

import type { ProfileResponse } from "@personalos/api-contract/account";

import { ApiError, accountApi, authApi, isNetworkFailure } from "@/lib/api";
import { getOS } from "@/store/os";
import { endAccountSession, startAccountSync } from "@/lib/account-sync";
import { applyAccountProfile } from "@/lib/apply-profile";

export type AuthStatus = "loading" | "anonymous" | "authenticated" | "offline";

export interface AuthContextValue {
  status: AuthStatus;
  profile: ProfileResponse | null;
  refresh: () => Promise<void>;
  login: (identifier: string, password: string) => Promise<void>;
  register: (input: {
    handle: string;
    displayName: string;
    password: string;
    email?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = React.useState<AuthStatus>("loading");
  const [profile, setProfile] = React.useState<ProfileResponse | null>(null);

  const refresh = React.useCallback(async () => {
    try {
      const next = await accountApi.profile();
      setProfile(next);
      setStatus("authenticated");
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        setProfile(null);
        setStatus("anonymous");
        return;
      }
      if (isNetworkFailure(error)) {
        setStatus("offline");
        return;
      }
      setProfile(null);
      setStatus("anonymous");
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  React.useEffect(() => {
    if (status !== "offline") return;
    const retry = window.setInterval(() => {
      void refresh();
    }, 4000);
    const online = () => void refresh();
    window.addEventListener("online", online);
    return () => {
      window.clearInterval(retry);
      window.removeEventListener("online", online);
    };
  }, [status, refresh]);

  React.useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    const apply = () => {
      if (!cancelled) applyAccountProfile(profile);
    };
    apply();
    // Re-apply after the account's saved data loads so server-side profile settings win.
    void startAccountSync(profile.id, profile.displayName).catch(() => undefined).finally(apply);
    return () => {
      cancelled = true;
    };
  }, [profile]);

  const login = React.useCallback(
    async (identifier: string, password: string) => {
      await authApi.login({ identifier, password });
      await refresh();
    },
    [refresh],
  );

  const register = React.useCallback(
    async (input: { handle: string; displayName: string; password: string; email?: string }) => {
      await authApi.register(input);
      await refresh();
    },
    [refresh],
  );

  const logout = React.useCallback(async () => {
    try {
      await endAccountSession();
      await authApi.logout();
    } finally {
      setProfile(null);
      setStatus("anonymous");
    }
  }, []);

  const value = React.useMemo<AuthContextValue>(
    () => ({ status, profile, refresh, login, register, logout }),
    [status, profile, refresh, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
