/**
 * Auth context — real authentication against the RantAI Agents backend.
 *
 * Stores the JWT + user data in AsyncStorage so the session persists after the
 * app is closed. The token is used as a Bearer for protected endpoints.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { mobileGoogleLogin, mobileLogin, mobileRegister, MobileUser } from '@/lib/api';

const TOKEN_KEY = 'auth.token';
const USER_KEY = 'auth.user';

type AuthValue = {
  /** true while loading the saved token at startup. */
  loading: boolean;
  signedIn: boolean;
  token: string | null;
  user: MobileUser | null;
  /** Log in to the backend; throws an error on failure (handled by the UI). */
  signIn: (email: string, password: string) => Promise<void>;
  /** Register then log in; throws an error on failure (handled by the UI). */
  signUp: (name: string, email: string, password: string) => Promise<void>;
  /** Exchange a Google ID token for a session; throws on failure (UI-handled). */
  signInWithGoogle: (idToken: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<MobileUser | null>(null);

  // Load the saved session once at startup.
  useEffect(() => {
    (async () => {
      try {
        const [savedToken, savedUser] = await Promise.all([
          AsyncStorage.getItem(TOKEN_KEY),
          AsyncStorage.getItem(USER_KEY),
        ]);
        if (savedToken) {
          setToken(savedToken);
          setUser(savedUser ? JSON.parse(savedUser) : null);
        }
      } catch {
        // ignore — treat as not logged in
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      loading,
      signedIn: !!token,
      token,
      user,
      async signIn(email, password) {
        const { token: newToken, user: newUser } = await mobileLogin(email, password);
        await AsyncStorage.setItem(TOKEN_KEY, newToken);
        await AsyncStorage.setItem(USER_KEY, JSON.stringify(newUser));
        setToken(newToken);
        setUser(newUser);
      },
      async signUp(name, email, password) {
        // /api/auth/register creates the account (201) but returns no JWT, so
        // log in right after to obtain the mobile token.
        await mobileRegister(name, email, password);
        const { token: newToken, user: newUser } = await mobileLogin(email, password);
        await AsyncStorage.setItem(TOKEN_KEY, newToken);
        await AsyncStorage.setItem(USER_KEY, JSON.stringify(newUser));
        setToken(newToken);
        setUser(newUser);
      },
      async signInWithGoogle(idToken) {
        const { token: newToken, user: newUser } = await mobileGoogleLogin(idToken);
        await AsyncStorage.setItem(TOKEN_KEY, newToken);
        await AsyncStorage.setItem(USER_KEY, JSON.stringify(newUser));
        setToken(newToken);
        setUser(newUser);
      },
      async signOut() {
        await AsyncStorage.removeItem(TOKEN_KEY);
        await AsyncStorage.removeItem(USER_KEY);
        setToken(null);
        setUser(null);
      },
    }),
    [loading, token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
