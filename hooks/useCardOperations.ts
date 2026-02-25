import { useCallback, useMemo } from 'react';
import { useNuggetContext } from '../context/NuggetContext';
import { useProjectContext } from '../context/ProjectContext';
import { useSelectionContext } from '../context/SelectionContext';
import { Card, DetailLevel, ChatMessage, Nugget } from '../types';
import { getUniqueName } from '../utils/naming';

/**
 * Card operations — selection, manipulation, creation, and cross-nugget copy/move.
 * Extracted from App.tsx for domain separation (item 4.2).
 */
export function useCardOperations() {
  const { selectedNugget, updateNugget, updateNuggetCard, nuggets, addNugget } = useNuggetContext();
  const { projects, addNuggetToProject } = useProjectContext();
  const { activeCardId, setActiveCardId } = useSelectionContext();

  // ── Selection ──

  const toggleInsightsCardSelection = useCallback(
    (cardId: string) => {
      if (!selectedNugget) return;
      updateNugget(selectedNugget.id, (n) => ({
        ...n,
        cards: n.cards.map((c) => (c.id === cardId ? { ...c, selected: !c.selected } : c)),
        lastModifiedAt: Date.now(),
      }));
    },
    [selectedNugget, updateNugget],
  );

  const toggleSelectAllInsightsCards = useCallback(() => {
    if (!selectedNugget) return;
    const cards = selectedNugget.cards || [];
    const allSelected = cards.length > 0 && cards.every((c) => c.selected);
    const newSelected = !allSelected;
    updateNugget(selectedNugget.id, (n) => ({
      ...n,
      cards: n.cards.map((c) => ({ ...c, selected: newSelected })),
      lastModifiedAt: Date.now(),
    }));
  }, [selectedNugget, updateNugget]);

  const selectInsightsCardExclusive = useCallback(
    (cardId: string) => {
      if (!selectedNugget) return;
      updateNugget(selectedNugget.id, (n) => ({
        ...n,
        cards: n.cards.map((c) => ({ ...c, selected: c.id === cardId })),
        lastModifiedAt: Date.now(),
      }));
    },
    [selectedNugget, updateNugget],
  );

  const selectInsightsCardRange = useCallback(
    (fromId: string, toId: string) => {
      if (!selectedNugget) return;
      const cards = selectedNugget.cards || [];
      const fromIdx = cards.findIndex((c) => c.id === fromId);
      const toIdx = cards.findIndex((c) => c.id === toId);
      if (fromIdx === -1 || toIdx === -1) return;
      const minIdx = Math.min(fromIdx, toIdx);
      const maxIdx = Math.max(fromIdx, toIdx);
      updateNugget(selectedNugget.id, (n) => ({
        ...n,
        cards: n.cards.map((c, i) => ({ ...c, selected: i >= minIdx && i <= maxIdx })),
        lastModifiedAt: Date.now(),
      }));
    },
    [selectedNugget, updateNugget],
  );

  const deselectAllInsightsCards = useCallback(() => {
    if (!selectedNugget) return;
    updateNugget(selectedNugget.id, (n) => ({
      ...n,
      cards: n.cards.map((c) => ({ ...c, selected: false })),
      lastModifiedAt: Date.now(),
    }));
  }, [selectedNugget, updateNugget]);

  const insightsSelectedCount = useMemo(() => {
    return (selectedNugget?.cards ?? []).filter((c) => c.selected).length;
  }, [selectedNugget]);

  // ── Manipulation ──

  const reorderInsightsCards = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (!selectedNugget || fromIndex === toIndex) return;
      const reorder = (cards: Card[]) => {
        const next = [...cards];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        return next;
      };
      updateNugget(selectedNugget.id, (n) => ({
        ...n,
        cards: reorder(n.cards),
        lastModifiedAt: Date.now(),
      }));
    },
    [selectedNugget, updateNugget],
  );

  const deleteInsightsCard = useCallback(
    (cardId: string) => {
      if (!selectedNugget) return;
      const remaining = selectedNugget.cards.filter((c) => c.id !== cardId);
      updateNugget(selectedNugget.id, (n) => ({
        ...n,
        cards: n.cards.filter((c) => c.id !== cardId),
        lastModifiedAt: Date.now(),
      }));
      // Fall back to first remaining card (or null)
      setActiveCardId(remaining.length > 0 ? remaining[0].id : null);
    },
    [selectedNugget, updateNugget, setActiveCardId],
  );

  const deleteSelectedInsightsCards = useCallback(() => {
    if (!selectedNugget) return;
    const selectedIds = new Set(selectedNugget.cards.filter((c) => c.selected).map((c) => c.id));
    if (selectedIds.size === 0) return;
    const remaining = selectedNugget.cards.filter((c) => !selectedIds.has(c.id));
    updateNugget(selectedNugget.id, (n) => ({
      ...n,
      cards: n.cards.filter((c) => !selectedIds.has(c.id)),
      lastModifiedAt: Date.now(),
    }));
    // Fall back to first remaining card (or null)
    setActiveCardId(remaining.length > 0 ? remaining[0].id : null);
  }, [selectedNugget, updateNugget, setActiveCardId]);

  // ── Editing ──

  const renameInsightsCard = useCallback(
    (cardId: string, newName: string) => {
      updateNuggetCard(cardId, (c) => {
        const updated: Card = { ...c, text: newName, lastEditedAt: Date.now() };
        // Sync H1 heading across all detail levels that have content
        if (c.synthesisMap) {
          const newMap = { ...c.synthesisMap };
          for (const level of Object.keys(newMap) as DetailLevel[]) {
            const content = newMap[level];
            if (!content) continue;
            // Replace existing H1 or prepend one
            const h1Match = content.match(/^(#\s+)(.+)$/m);
            if (h1Match) {
              newMap[level] = content.replace(/^#\s+.+$/m, `# ${newName}`);
            }
            // If no H1 exists, don't add one — ensureH1 in CardsPanel handles that
          }
          updated.synthesisMap = newMap;
        }
        return updated;
      });
    },
    [updateNuggetCard],
  );

  const handleSaveCardContent = useCallback(
    (cardId: string, level: DetailLevel, newContent: string) => {
      updateNuggetCard(cardId, (c) => ({
        ...c,
        synthesisMap: { ...(c.synthesisMap || {}), [level]: newContent },
        lastEditedAt: Date.now(),
      }));
    },
    [updateNuggetCard],
  );

  // ── Creation ──

  const handleCreateCustomCard = useCallback(
    (name: string) => {
      if (!selectedNugget) return;
      const newId = crypto.randomUUID();
      const existingNames = selectedNugget.cards.map((c) => c.text);
      const newCard: Card = {
        id: newId,
        level: 1,
        text: getUniqueName(name, existingNames),
        synthesisMap: { Standard: '' },
        createdAt: Date.now(),
        lastEditedAt: Date.now(),
      };
      // Add card to nugget
      updateNugget(selectedNugget.id, (n) => ({
        ...n,
        cards: [...n.cards, newCard],
        lastModifiedAt: Date.now(),
      }));
      setActiveCardId(newId);
    },
    [selectedNugget, updateNugget, setActiveCardId],
  );

  const handleSaveAsCard = useCallback(
    (message: ChatMessage, editedContent: string) => {
      if (!selectedNugget || selectedNugget.type !== 'insights') return;
      const content = editedContent || message.content;

      // Extract title from first # heading line, auto-increment if duplicate
      const titleMatch = content.match(/^#\s+(.+)$/m);
      const rawTitle = titleMatch ? titleMatch[1].trim() : 'Untitled Card';
      const existingCardNames = selectedNugget.cards.map((c) => c.text);
      const title = getUniqueName(rawTitle, existingCardNames);

      // Remove the title line from content body
      const bodyContent = content.replace(/^#\s+.+\n*/, '').trim();

      const cardId = `card-${Math.random().toString(36).substr(2, 9)}`;
      const level = message.detailLevel || 'Standard';

      const activeDocNames = selectedNugget.documents
        .filter((d) => d.enabled !== false && d.content)
        .map((d) => d.name);

      const newCard: Card = {
        id: cardId,
        text: title,
        level: 1,
        selected: false,
        synthesisMap: { [level]: `# ${title}\n\n${bodyContent}` },
        isSynthesizingMap: {},
        detailLevel: level,
        createdAt: Date.now(),
        sourceDocuments: activeDocNames,
      };

      // Add card to nugget + mark message as saved
      updateNugget(selectedNugget.id, (n) => ({
        ...n,
        cards: [...n.cards, newCard],
        messages: (n.messages || []).map((m) => (m.id === message.id ? { ...m, savedAsCardId: cardId } : m)),
        lastModifiedAt: Date.now(),
      }));

      // Select the new card
      setActiveCardId(cardId);
    },
    [selectedNugget, updateNugget, setActiveCardId],
  );

  // ── Cross-nugget copy/move ──

  const handleCopyMoveCard = useCallback(
    (cardId: string, targetNuggetId: string, mode: 'copy' | 'move') => {
      if (!selectedNugget) return;
      const card = selectedNugget.cards.find((c) => c.id === cardId);
      if (!card) return;
      const targetNugget = nuggets.find((n) => n.id === targetNuggetId);
      const targetCardNames = targetNugget ? targetNugget.cards.map((c) => c.text) : [];
      const uniqueName = getUniqueName(card.text, targetCardNames);
      const now = Date.now();
      const newCardId = `card-${Math.random().toString(36).substr(2, 9)}`;
      const copiedCard: Card = {
        ...card,
        id: newCardId,
        text: uniqueName,
        selected: false,
        createdAt: now,
        lastEditedAt: now,
      };
      // Add to target nugget
      updateNugget(targetNuggetId, (n) => ({
        ...n,
        cards: [...n.cards, copiedCard],
        lastModifiedAt: now,
      }));
      // If move, also remove from source nugget
      if (mode === 'move') {
        const remaining = selectedNugget.cards.filter((c) => c.id !== cardId);
        updateNugget(selectedNugget.id, (n) => ({
          ...n,
          cards: n.cards.filter((c) => c.id !== cardId),
          lastModifiedAt: now,
        }));
        // Fall back to first remaining card
        if (activeCardId === cardId) {
          setActiveCardId(remaining.length > 0 ? remaining[0].id : null);
        }
      }
    },
    [selectedNugget, nuggets, updateNugget, activeCardId, setActiveCardId],
  );

  const handleCreateNuggetForCard = useCallback(
    (nuggetName: string, cardId: string | null) => {
      if (!selectedNugget || !cardId) return;
      const card = selectedNugget.cards.find((c) => c.id === cardId);
      if (!card) return;
      const sourceProject = projects.find((p) => p.nuggetIds.includes(selectedNugget.id));
      const projectNuggetNames = sourceProject
        ? sourceProject.nuggetIds.map((nid) => nuggets.find((n) => n.id === nid)?.name || '').filter(Boolean)
        : nuggets.map((n) => n.name);
      const uniqueNuggetName = getUniqueName(nuggetName, projectNuggetNames);
      const now = Date.now();
      const newCardId = `card-${Math.random().toString(36).substr(2, 9)}`;
      const copiedCard: Card = {
        ...card,
        id: newCardId,
        selected: false,
        createdAt: now,
        lastEditedAt: now,
      };
      const newNugget: Nugget = {
        id: `nugget-${Math.random().toString(36).substr(2, 9)}`,
        name: uniqueNuggetName,
        type: 'insights',
        documents: [],
        cards: [copiedCard],
        messages: [],
        createdAt: now,
        lastModifiedAt: now,
      };
      addNugget(newNugget);
      if (sourceProject) {
        addNuggetToProject(sourceProject.id, newNugget.id);
      }
    },
    [selectedNugget, projects, nuggets, addNugget, addNuggetToProject],
  );

  return {
    // Selection
    toggleInsightsCardSelection,
    toggleSelectAllInsightsCards,
    selectInsightsCardExclusive,
    selectInsightsCardRange,
    deselectAllInsightsCards,
    insightsSelectedCount,
    // Manipulation
    reorderInsightsCards,
    deleteInsightsCard,
    deleteSelectedInsightsCards,
    // Editing
    renameInsightsCard,
    handleSaveCardContent,
    // Creation
    handleCreateCustomCard,
    handleSaveAsCard,
    // Cross-nugget
    handleCopyMoveCard,
    handleCreateNuggetForCard,
  };
}
