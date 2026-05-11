/**
 * ThemeContext — light / dark theme with AsyncStorage persistence.
 *
 * Exposes a colour palette consumed by every screen and component.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_KEY = 'app_theme';

export type ThemeName = 'light' | 'dark';

export interface ThemeColors {
  bg: string;
  card: string;
  text: string;
  textMuted: string;
  accent: string;
  accentMuted: string;
  border: string;
  error: string;
  success: string;
  warning: string;
  overlay: string;
}

const lightColors: ThemeColors = {
  bg: '#F8FAFC',
  card: '#FFFFFF',
  text: '#1E293B',
  textMuted: '#64748B',
  accent: '#6366F1',
  accentMuted: '#E0E7FF',
  border: '#E2E8F0',
  error: '#EF4444',
  success: '#22C55E',
  warning: '#F59E0B',
  overlay: 'rgba(15, 23, 42, 0.45)',
};

const darkColors: ThemeColors = {
  bg: '#0F172A',
  card: '#1E293B',
  text: '#F8FAFC',
  textMuted: '#94A3B8',
  accent: '#818CF8',
  accentMuted: '#312E81',
  border: '#334155',
  error: '#EF4444',
  success: '#22C55E',
  warning: '#F59E0B',
  overlay: 'rgba(2, 6, 23, 0.75)',
};

interface ThemeContextValue {
  theme: ThemeName;
  colors: ThemeColors;
  toggleTheme: () => Promise<void>;
  setTheme: (next: ThemeName) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [theme, setThemeState] = useState<ThemeName>('light');

  // Load persisted preference
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(THEME_KEY);
        if (!cancelled && (stored === 'light' || stored === 'dark')) {
          setThemeState(stored);
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setTheme = useCallback(async (next: ThemeName) => {
    setThemeState(next);
    try {
      await AsyncStorage.setItem(THEME_KEY, next);
    } catch {
      // ignore persistence errors
    }
  }, []);

  const toggleTheme = useCallback(async () => {
    const next: ThemeName = theme === 'light' ? 'dark' : 'light';
    await setTheme(next);
  }, [theme, setTheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      colors: theme === 'light' ? lightColors : darkColors,
      toggleTheme,
      setTheme,
    }),
    [theme, toggleTheme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
