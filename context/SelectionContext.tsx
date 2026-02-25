import { createContext, useContext } from 'react';
import type { Card } from '../types';

// ── Selection context — active selection IDs, derived activeCard, selectEntity orchestrator ──

export interface SelectionContextValue {
  activeCardId: string | null;
  setActiveCardId: React.Dispatch<React.SetStateAction<string | null>>;
  activeCard: Card | null;

  selectedProjectId: string | null;

  selectionLevel: 'project' | 'nugget' | 'document' | null;
  setSelectionLevel: React.Dispatch<React.SetStateAction<'project' | 'nugget' | 'document' | null>>;

  selectEntity: (opts: { projectId?: string; nuggetId?: string; documentId?: string }) => void;
}

export const SelectionContext = createContext<SelectionContextValue | null>(null);

export function useSelectionContext(): SelectionContextValue {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error('useSelectionContext must be used inside <AppProvider>');
  return ctx;
}
