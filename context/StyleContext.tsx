import { createContext, useContext } from 'react';
import type { CustomStyle } from '../types';

// ── Style context — custom styles CRUD ──

export interface StyleContextValue {
  customStyles: CustomStyle[];
  addCustomStyle: (style: CustomStyle) => void;
  updateCustomStyle: (id: string, updates: Partial<CustomStyle>) => void;
  deleteCustomStyle: (id: string) => void;
  replaceCustomStyles: (styles: CustomStyle[]) => void;
}

export const StyleContext = createContext<StyleContextValue | null>(null);

export function useStyleContext(): StyleContextValue {
  const ctx = useContext(StyleContext);
  if (!ctx) throw new Error('useStyleContext must be used inside <AppProvider>');
  return ctx;
}
