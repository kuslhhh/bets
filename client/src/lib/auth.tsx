import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { apiFetch, setAccessToken, getAccessToken } from "./api";

type User = { id: string; name: string; email: string };
type AuthState = {
  user: User | null;
  role: string | null;
  permissions: string[];
  loading: boolean;
  hasPermission: (code: string) => boolean;
  setAuth: (u: User | null, role: string | null, perms: string[], token: string | null) => void;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const setAuth = useCallback((u: User | null, r: string | null, perms: string[], token: string | null) => {
    setUser(u);
    setRole(r);
    setPermissions(perms);
    setAccessToken(token);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const data = (await apiFetch<{ user: User; role: string; permissions: string[]; accessToken: string }>("/auth/me")) as {
        user: User; role: string; permissions: string[]; accessToken: string;
      };
      setAuth(data.user, data.role, data.permissions, data.accessToken);
    } catch {
      setAuth(null, null, [], null);
    } finally {
      setLoading(false);
    }
  }, [setAuth]);

  useEffect(() => {
    // if token in storage, attempt refresh; otherwise still try cookie
    refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } catch {
      // ignore
    }
    setAuth(null, null, [], null);
  }, [setAuth]);

  const hasPermission = useCallback((code: string) => permissions.includes(code), [permissions]);

  // Keep accessToken in memory via storage; api.ts reads sessionStorage each request
  // Initialize from existing token if any (apiFetch will use it until refresh replaces)
  useEffect(() => {
    const t = getAccessToken();
    if (t && !user && loading) {
      // token exists but not yet validated — refresh will replace
    }
  }, [user, loading]);

  return (
    <Ctx.Provider value={{ user, role, permissions, loading, hasPermission, setAuth, logout, refresh }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be inside AuthProvider");
  return v;
}
