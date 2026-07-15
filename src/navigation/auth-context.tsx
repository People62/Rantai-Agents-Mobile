/**
 * Auth context — autentikasi asli ke backend RantAI Agents.
 *
 * Menyimpan JWT + data user di AsyncStorage sehingga sesi bertahan setelah
 * app ditutup. Token dipakai sebagai Bearer untuk endpoint terproteksi.
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

import { mobileLogin, MobileUser } from '@/lib/api';

const TOKEN_KEY = 'auth.token';
const USER_KEY = 'auth.user';

type AuthValue = {
  /** true selama memuat token tersimpan saat startup. */
  loading: boolean;
  signedIn: boolean;
  token: string | null;
  user: MobileUser | null;
  /** Login ke backend; melempar error bila gagal (ditangani UI). */
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<MobileUser | null>(null);

  // Muat sesi tersimpan sekali saat startup.
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
        // abaikan — perlakukan sebagai belum login
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
  if (!ctx) throw new Error('useAuth harus dipakai di dalam AuthProvider');
  return ctx;
}
