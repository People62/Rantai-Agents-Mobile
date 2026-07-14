/**
 * Auth context UI-only (tanpa backend). Menyimpan status "signed in" di memori
 * untuk berpindah antara Login dan aplikasi utama. Ganti dengan auth asli nanti.
 */
import { createContext, ReactNode, useContext, useMemo, useState } from 'react';

type AuthValue = {
  signedIn: boolean;
  signIn: () => void;
  signOut: () => void;
};

const AuthContext = createContext<AuthValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [signedIn, setSignedIn] = useState(false);
  const value = useMemo<AuthValue>(
    () => ({ signedIn, signIn: () => setSignedIn(true), signOut: () => setSignedIn(false) }),
    [signedIn],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth harus dipakai di dalam AuthProvider');
  return ctx;
}
