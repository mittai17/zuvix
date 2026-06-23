import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { supabase } from '../utils/supabase';
import type { User } from '@supabase/supabase-js';

interface AuthValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<string | null>;
  signup: (email: string, password: string, username?: string) => Promise<string | null>;
  logout: () => Promise<void>;
  signInWithGithub: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
  checkUsername: (username: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<string | null> => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return error.message;
      return null;
    } catch (err: any) {
      return err.message || 'Login failed';
    }
  }, []);

  const signup = useCallback(async (email: string, password: string, username?: string): Promise<string | null> => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            username: username || email.split('@')[0],
          }
        }
      });
      if (error) return error.message;
      return null;
    } catch (err: any) {
      return err.message || 'Signup failed';
    }
  }, []);

  const checkUsername = useCallback(async (username: string): Promise<boolean> => {
    if (!username || username.length < 3) return false;
    try {
      // Assuming there is a profiles table or an edge function. 
      // If no Row Level Security allows this query, it might fail in production, 
      // but we will gracefully handle it by allowing the signup attempt anyway.
      const { data } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', username.toLowerCase())
        .maybeSingle();
      
      if (data) return false; // taken
      return true; // available
    } catch (err) {
      return true; // fail open
    }
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const signInWithGithub = useCallback(async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: `${window.location.origin}/auth/callback` }
    });
  }, []);

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  }, []);

  return (
    <AuthContext.Provider value={{
      user, loading,
      login, signup, logout, signInWithGithub, getAccessToken, checkUsername
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
