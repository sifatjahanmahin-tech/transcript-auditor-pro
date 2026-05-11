/**
 * AuthContext — manages the JWT, current user, and auth lifecycle.
 *
 * On mount it reads the SecureStore token; if present it fetches the
 * profile and marks the session authenticated.  `signIn` saves the
 * token and refreshes the user; `signOut` clears everything.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  UserInfo,
  clearToken,
  fetchMe,
  getToken,
  registerLogoutCallback,
  saveToken,
} from '@/lib/api';

interface AuthContextValue {
  user: UserInfo | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (token: string, user?: UserInfo) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const signOut = useCallback(async () => {
    await clearToken();
    setToken(null);
    setUser(null);
  }, []);

  const signIn = useCallback(
    async (newToken: string, prefetchedUser?: UserInfo) => {
      await saveToken(newToken);
      setToken(newToken);
      if (prefetchedUser) {
        setUser(prefetchedUser);
      } else {
        try {
          const me = await fetchMe();
          setUser(me);
        } catch {
          // If profile fetch fails, drop the token entirely so we don't
          // leave the app in a half-authenticated state.
          await signOut();
          throw new Error('Could not load profile after sign-in');
        }
      }
    },
    [signOut],
  );

  const refreshUser = useCallback(async () => {
    if (!token) return;
    try {
      const me = await fetchMe();
      setUser(me);
    } catch {
      // network error — keep cached user
    }
  }, [token]);

  // Bootstrap: check stored token on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await getToken();
        if (cancelled) return;
        if (stored) {
          setToken(stored);
          try {
            const me = await fetchMe();
            if (!cancelled) setUser(me);
          } catch {
            // Token invalid or server unreachable — clear it
            if (!cancelled) {
              await clearToken();
              setToken(null);
            }
          }
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // When the API client receives 401 it calls this to force logout
  useEffect(() => {
    registerLogoutCallback(() => {
      void signOut();
    });
  }, [signOut]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isLoading,
      isAuthenticated: token !== null && user !== null,
      signIn,
      signOut,
      refreshUser,
    }),
    [user, token, isLoading, signIn, signOut, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
