import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";
import { Platform } from "react-native";

// ──────────── Web-safe storage wrapper ────────────
const storage = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === "web") return localStorage.getItem(key);
    return SecureStore.getItemAsync(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === "web") { localStorage.setItem(key, value); return; }
    return SecureStore.setItemAsync(key, value);
  },
  deleteItem: async (key: string): Promise<void> => {
    if (Platform.OS === "web") { localStorage.removeItem(key); return; }
    return SecureStore.deleteItemAsync(key);
  },
};
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

// ──────────── API base URL (same logic as useBackend) ────────────

const PROD_BASE =
  "https://trackeverythingte-904503171.catalystserverless.com/server/track_everything_te_function";
const DEV_BASE =
  "https://trackeverythingte-904503171.development.catalystserverless.com/server/track_everything_te_function";

const LOCAL_PORT = process.env.EXPO_PUBLIC_LOCAL_PORT ?? "3000";

function getLocalBase(): string {
  // On web, always use localhost — the backend binds only to localhost
  if (Platform.OS === "web") {
    return `http://localhost:${LOCAL_PORT}/server/track_everything_te_function`;
  }
  const debuggerHost =
    Constants.expoConfig?.hostUri ??
    Constants.manifest2?.extra?.expoGo?.debuggerHost ??
    // @ts-ignore – older SDKs
    Constants.manifest?.debuggerHost;

  if (debuggerHost) {
    const host = debuggerHost.split(":")[0];
    return `http://${host}:${LOCAL_PORT}/server/track_everything_te_function`;
  }
  return `http://localhost:${LOCAL_PORT}/server/track_everything_te_function`;
}

// Web dev → local catalyst serve (http://localhost:3000)
// Mobile dev → Development Catalyst environment
// Production build → Production Catalyst environment
const API_BASE = __DEV__
  ? (Platform.OS === "web" ? getLocalBase() : DEV_BASE)
  : PROD_BASE;

// ──────────── Types ────────────

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

interface AuthContextType {
  /** Whether the initial token check has completed */
  isLoading: boolean;
  /** The logged-in user, or null if not authenticated */
  user: AuthUser | null;
  /** The session token, or null */
  token: string | null;
  /** Sign up a new user – returns error string on failure, null on success */
  signup: (
    email: string,
    password: string,
    firstName: string,
    lastName?: string
  ) => Promise<string | null>;
  /** Log in an existing user – returns error string on failure, null on success */
  login: (email: string, password: string) => Promise<string | null>;
  /** Log out and clear stored credentials */
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  isLoading: true,
  user: null,
  token: null,
  signup: async () => "AuthContext not initialized",
  login: async () => "AuthContext not initialized",
  logout: async () => {},
});

const TOKEN_KEY = "te_session_token";
const USER_KEY  = "te_cached_user";

// On web, read token + cached user synchronously from localStorage so the
// very first render already has auth state — zero spinner, zero network wait.
// typeof window guard ensures this is skipped during static export (SSR),
// which prevents React hydration mismatch error #418.
function getInitialState(): { token: string | null; user: AuthUser | null; loading: boolean } {
  if (Platform.OS === "web" && typeof window !== "undefined" && typeof localStorage !== "undefined") {
    const token = localStorage.getItem(TOKEN_KEY);
    const userRaw = localStorage.getItem(USER_KEY);
    let user: AuthUser | null = null;
    try { if (userRaw) user = JSON.parse(userRaw); } catch {}
    return { token, user, loading: false };
  }
  return { token: null, user: null, loading: true }; // native or SSR: async check
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const initial = getInitialState();
  const [isLoading, setIsLoading] = useState(initial.loading);
  const [user, setUser]   = useState<AuthUser | null>(initial.user);
  const [token, setToken] = useState<string | null>(initial.token);

  // ── On mount: silently validate stored token in background ──
  // Does NOT block rendering — app is already shown using cached state.
  useEffect(() => {
    (async () => {
      try {
        const storedToken = await storage.getItem(TOKEN_KEY);
        if (!storedToken) {
          setUser(null);
          setToken(null);
          setIsLoading(false);
          return;
        }
        // Native: set token optimistically so app renders while we validate
        if (Platform.OS !== "web") {
          setToken(storedToken);
        }
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        try {
          const res = await fetch(`${API_BASE}/auth/me`, {
            headers: { "X-TE-Token": storedToken },
            signal: controller.signal,
          });
          if (res.ok) {
            const data = await res.json();
            setUser(data.user);
            setToken(storedToken);
            // Keep cache fresh
            if (Platform.OS === "web") localStorage.setItem(USER_KEY, JSON.stringify(data.user));
          } else {
            // Token rejected by server — force re-login
            await storage.deleteItem(TOKEN_KEY);
            if (Platform.OS === "web") localStorage.removeItem(USER_KEY);
            setUser(null);
            setToken(null);
          }
        } finally {
          clearTimeout(timeout);
        }
      } catch (err) {
        // Network error / timeout — keep cached state, don't log out
        console.warn("[auth] Background token validation failed:", err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // ── Signup ──
  const signup = useCallback(
    async (
      email: string,
      password: string,
      firstName: string,
      lastName?: string
    ): Promise<string | null> => {
      try {
        const res = await fetch(`${API_BASE}/auth/signup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, firstName, lastName: lastName ?? "" }),
        });
        const data = await res.json();
        if (!res.ok) {
          return data.error || "Signup failed";
        }
        await storage.setItem(TOKEN_KEY, data.token);
        if (Platform.OS === "web") localStorage.setItem(USER_KEY, JSON.stringify(data.user));
        setToken(data.token);
        setUser(data.user);
        return null;
      } catch (err: any) {
        console.error("[auth] Signup error:", err);
        return err.message || "Network error";
      }
    },
    []
  );

  // ── Login ──
  const login = useCallback(
    async (email: string, password: string): Promise<string | null> => {
      try {
        const res = await fetch(`${API_BASE}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (!res.ok) {
          return data.error || "Login failed";
        }
        await storage.setItem(TOKEN_KEY, data.token);
        if (Platform.OS === "web") localStorage.setItem(USER_KEY, JSON.stringify(data.user));
        setToken(data.token);
        setUser(data.user);
        return null;
      } catch (err: any) {
        console.error("[auth] Login error:", err);
        return err.message || "Network error";
      }
    },
    []
  );

  // ── Logout ──
  const logout = useCallback(async () => {
    try {
      if (token) {
        // Best-effort server-side logout
        fetch(`${API_BASE}/auth/logout`, {
          method: "POST",
          headers: { "X-TE-Token": token },
        }).catch(() => {});
      }
      await storage.deleteItem(TOKEN_KEY);
      if (Platform.OS === "web") localStorage.removeItem(USER_KEY);
    } catch (err) {
      console.warn("[auth] Logout error:", err);
    } finally {
      setToken(null);
      setUser(null);
    }
  }, [token]);

  return (
    <AuthContext.Provider
      value={{ isLoading, user, token, signup, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
