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

const DEPLOYED_BASE =
  "https://trackeverythingte-904503171.catalystserverless.com/server/track_everything_te_function";

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

const USE_LOCAL = __DEV__;
const API_BASE = USE_LOCAL ? getLocalBase() : DEPLOYED_BASE;

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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // ── On mount: check for a stored token and validate it ──
  useEffect(() => {
    (async () => {
      try {
        const storedToken = await storage.getItem(TOKEN_KEY);
        if (storedToken) {
          const res = await fetch(`${API_BASE}/auth/me`, {
            headers: { "X-TE-Token": storedToken },
          });
          if (res.ok) {
            const data = await res.json();
            setUser(data.user);
            setToken(storedToken);
          } else {
            // Token expired or invalid – clear it
            await storage.deleteItem(TOKEN_KEY);
          }
        }
      } catch (err) {
        console.warn("[auth] Token validation error:", err);
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
