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

    if (nextSession) {
      await saveSession(nextSession);
    } else {
      await clearSession();
    }
  };

  const refreshProfile = async () => {
    const response = await authService.me();
    setUser(response.data.user);
    setCompany(response.data.company);
  };

  const signIn = async (payload: LoginPayload) => {
    setLoading(true);
    try {
      const response = await authService.login(payload);
      const nextSession: AuthSession = {
        token: response.data.token,
        companyId: response.data.companyId,
        companyName: response.data.companyName,
        userRole: response.data.userRole,
        userEmail: response.data.userEmail,
      };

      await applySession(nextSession);
      await refreshProfile();
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      try {
        await authService.logout();
      } catch {
        // ignore logout transport failures and still clear local state
      }

      await applySession(null);
      setUser(null);
      setCompany(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const saved = await getSession();
        if (!saved) return;

        await applySession(saved);
        await refreshProfile();
      } catch {
        await applySession(null);
        setUser(null);
        setCompany(null);
      } finally {
        setBootstrapped(true);
      }
    };

    void bootstrap();
  }, []);

  const hasPermission = (module: string, action: "read" | "write" | "delete" = "read"): boolean => {
    if (!user) return false;
    if (user.role === "owner" || user.role === "admin") return true;
    if (user.permissions === null) return true;
    return user.permissions?.[module]?.[action] ?? false;
  };

  const canRead   = (module: string) => hasPermission(module, "read");
  const canWrite  = (module: string) => hasPermission(module, "write");
  const canDelete = (module: string) => hasPermission(module, "delete");

  const value = useMemo<AuthContextValue>(() => ({
    bootstrapped,
    loading,
    session,
    user,
    company,
    signIn,
    signOut,
    refreshProfile,
    hasPermission,
    canRead,
    canWrite,
    canDelete,
  }), [bootstrapped, loading, session, user, company]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
