import { createContext, useContext } from 'react';

// ── Theme context — dark mode toggle ──

export interface ThemeContextValue {
  darkMode: boolean;
  toggleDarkMode: () => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useThemeContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useThemeContext must be used inside <AppProvider>');
  return ctx;
}
