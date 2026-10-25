import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  SESSION_STORAGE_KEY,
  confirmPasswordReset,
  currentAccount,
  loginAccount,
  logoutAccount,
  registerAccount,
  requestPasswordReset,
  type AuthUser,
} from '@/lib/auth-api';

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  requestReset: (email: string) => Promise<string | null>;
  resetPassword: (email: string, code: string, password: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function readToken(): string | null {
  try {
    return localStorage.getItem(SESSION_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeToken(token: string | null) {
  try {
    if (token) localStorage.setItem(SESSION_STORAGE_KEY, token);
    else localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    /* ignore private-mode storage failures */
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = readToken();
    if (!token) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    currentAccount(token)
      .then((next) => {
        if (cancelled) return;
        if (!next) writeToken(null);
        setUser(next);
      })
      .catch(() => {
        if (!cancelled) {
          writeToken(null);
          setUser(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const session = await loginAccount(email, password);
    writeToken(session.token);
    setUser(session.user);
  }, []);

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    const session = await registerAccount(name, email, password);
    writeToken(session.token);
    setUser(session.user);
  }, []);

  const signOut = useCallback(async () => {
    const token = readToken();
    writeToken(null);
    setUser(null);
    if (token) {
      try {
        await logoutAccount(token);
      } catch {
        /* local session is already cleared */
      }
    }
  }, []);

  const requestReset = useCallback(async (email: string) => {
    const result = await requestPasswordReset(email);
    return result.code;
  }, []);

  const resetPassword = useCallback(async (email: string, code: string, password: string) => {
    await confirmPasswordReset(email, code, password);
  }, []);

  const value = useMemo(
    () => ({ user, loading, signIn, signUp, signOut, requestReset, resetPassword }),
    [user, loading, signIn, signUp, signOut, requestReset, resetPassword],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider');
  return value;
}

export function useOptionalAuth(): AuthContextValue | null {
  return useContext(AuthContext);
}
