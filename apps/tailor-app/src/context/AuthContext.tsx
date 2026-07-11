import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { clearSession, getSession, saveSession } from "@/lib/storage";
import { setApiSession } from "@/lib/api";
import * as authService from "@/services/auth";
import type { AuthSession, Company, LoginPayload, User } from "@/types/auth";

type AuthContextValue = {
  bootstrapped: boolean;
  loading: boolean;
  session: AuthSession | null;
  user: User | null;
  company: Company | null;
  signIn: (payload: LoginPayload) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  hasPermission: (module: string, action?: "read" | "write" | "delete") => boolean;
  canRead: (module: string) => boolean;
  canWrite: (module: string) => boolean;
  canDelete: (module: string) => boolean;
  isPlanModule: (module: string) => boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [bootstrapped, setBootstrapped] = useState(false);
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [company, setCompany] = useState<Company | null>(null);

  const applySession = async (nextSession: AuthSession | null) => {
    setSession(nextSession);
    setApiSession(nextSession);
    if (nextSession) await saveSession(nextSession);
    else await clearSession();
  };

  const refreshProfile = async () => {
    const r = await authService.me();
    setUser(r.data.user);
    setCompany(r.data.company);
  };

  const signIn = async (payload: LoginPayload) => {
    setLoading(true);
    try {
      console.log("[AUTH] signIn → POST", process.env.EXPO_PUBLIC_API_BASE_URL + "/auth/login")
      const r = await authService.login(payload);
      const next: AuthSession = {
        token: r.data.token,
        companyId: r.data.companyId,
        companyName: r.data.companyName,
        userRole: r.data.userRole,
        userEmail: r.data.userEmail,
      };
      await applySession(next);
      await refreshProfile();
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try { await authService.logout(); } catch {}
    await applySession(null);
    setUser(null);
    setCompany(null);
  };

  useEffect(() => {
    getSession().then(async (stored) => {
      if (stored) {
        await applySession(stored);
        try { await refreshProfile(); } catch { await applySession(null); }
      }
      setBootstrapped(true);
    });
  }, []);

  const isPlanModule = (module: string): boolean => {
    const modules = company?.planModules;
    if (!modules || modules.length === 0) return true;
    return modules.includes(module);
  };

  const hasPermission = (module: string, action: "read" | "write" | "delete" = "read") => {
    if (!user) return false;
    if (user.role === "owner") return true;
    if (!isPlanModule(module)) return false;
    if (user.role === "admin") return true;
    if (user.permissions === null) return true;
    return user.permissions?.[module]?.[action] ?? false;
  };

  const value = useMemo<AuthContextValue>(() => ({
    bootstrapped, loading, session, user, company,
    signIn, signOut, refreshProfile,
    hasPermission,
    canRead: (m) => hasPermission(m, "read"),
    canWrite: (m) => hasPermission(m, "write"),
    canDelete: (m) => hasPermission(m, "delete"),
    isPlanModule,
  }), [bootstrapped, loading, session, user, company]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
