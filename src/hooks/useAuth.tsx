import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { appwriteAccount } from '../lib/appwrite';
import { type Models, OAuthProvider } from 'appwrite';

interface AuthValue {
  user: Models.User<Models.Preferences> | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<string | null>;
  signup: (email: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Models.User<Models.Preferences> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const u = await appwriteAccount.get();
        setUser(u);
      } catch {
        setUser(null);
      }
      setLoading(false);
    })();
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<string | null> => {
    try {
      await appwriteAccount.createEmailPasswordSession(email, password);
      const u = await appwriteAccount.get();
      setUser(u);
      return null;
    } catch (err: any) {
      return err.message || 'Login failed';
    }
  }, []);

  const signup = useCallback(async (email: string, password: string): Promise<string | null> => {
    try {
      await appwriteAccount.create('unique()', email, password);
      return await login(email, password);
    } catch (err: any) {
      return err.message || 'Signup failed';
    }
  }, [login]);

  const logout = useCallback(async () => {
    try { await appwriteAccount.deleteSession('current'); } catch {}
    setUser(null);
  }, []);

  const signInWithGoogle = useCallback(async () => {
    appwriteAccount.createOAuth2Session(OAuthProvider.Google, `${window.location.origin}/auth/callback`);
  }, []);

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    try {
      const session = await appwriteAccount.getSession('current');
      return (session as any).secret || null;
    } catch {
      return null;
    }
  }, []);

  return (
    <AuthContext.Provider value={{
      user, loading,
      login, signup, logout, signInWithGoogle, getAccessToken,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
