import React, { useRef, useCallback, useState, useMemo, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Card, DetailLevel, UploadedFile } from '../types';
import InsightsCardList from './InsightsCardList';
import DocumentEditorModal, { DocumentEditorHandle } from './DocumentEditorModal';
import { UnsavedChangesDialog } from './Dialogs';
import { useSelectionContext } from '../context/SelectionContext';

const DEFAULT_SIDEBAR_WIDTH = 220;
const MIN_SIDEBAR_WIDTH = 140;
const MAX_SIDEBAR_WIDTH = 480;

interface CardsPanelProps {
  cards: Card[];
  hasSelectedNugget: boolean;
  onToggleSelection: (id: string) => void;
  onSelectExclusive: (id: string) => void;
  onSelectRange: (fromId: string, toId: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onDeleteCard: (id: string) => void;
  onDeleteSelectedCards: () => void;
  onRenameCard: (id: string, newName: string) => void;
  onCopyMoveCard?: (cardId: string, targetNuggetId: string, mode: 'copy' | 'move') => void;
  otherNuggets?: { id: string; name: string }[];
  projectNuggets?: { projectId: string; projectName: string; nuggets: { id: string; name: string }[] }[];
  onCreateNuggetForCard?: (nuggetName: string, cardId: string | null) => void;
  onCreateCustomCard: (name: string) => void;
  onSaveCardContent: (cardId: string, level: DetailLevel, newContent: string) => void;
  detailLevel: DetailLevel;
  onGenerateCardImage?: (card: Card) => void;
  onReorderCards?: (fromIndex: number, toIndex: number) => void;
}

/** Ensure markdown content starts with an H1 heading matching cardTitle.
 *  - If no H1 exists, prepend one using cardTitle.
 *  - If an H1 exists but differs from cardTitle, replace it. */
function ensureH1(content: string, cardTitle: string): string {
  const trimmed = content.trimStart();
  const h1Match = trimmed.match(/^#\s+(.+)$/m);
  if (h1Match) {
    const existingTitle = h1Match[1].trim();
    if (existingTitle === cardTitle) return content; // already synced
    // Replace first H1 with current card title
    return content.replace(/^#\s+.+$/m, `# ${cardTitle}`);
  }
  return `# ${cardTitle}\n\n${content}`;
}

/** Extract the first H1 text from markdown content. */
function extractH1(markdown: string): string | null {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

export interface PanelEditorHandle {
  isDirty: boolean;
  save: () => void;
  discard: () => void;
}

const CardsPanel = forwardRef<PanelEditorHandle, CardsPanelProps>(
  (
    {
      cards,
      hasSelectedNugget,
      onToggleSelection,
      onSelectExclusive,
      onSelectRange,
      onSelectAll,
      onDeselectAll,
      onDeleteCard,
      onDeleteSelectedCards,
      onRenameCard,
      onCopyMoveCard,
      otherNuggets,
      projectNuggets,
      onCreateNuggetForCard,
      onCreateCustomCard,
      onSaveCardContent,
      detailLevel,
      onGenerateCardImage,
      onReorderCards,
    },
    ref,
  ) => {
    const { activeCardId, setActiveCardId } = useSelectionContext();
    const editorHandleRef = useRef<DocumentEditorHandle>(null);

    useImperativeHandle(
      ref,
      () => ({
        get isDirty() {
          return editorHandleRef.current?.isDirty ?? false;
        },
        save: () => editorHandleRef.current?.save(),
        discard: () => editorHandleRef.current?.discard(),
      }),
      [],
    );
    const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

    // ── Sidebar resize state ──
    const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
    const isDragging = useRef(false);
    const startX = useRef(0);
    const startWidth = useRef(0);

    // ── Divider drag handlers ──
    const handleDividerPointerDown = useCallback(
      (e: React.PointerEvent) => {
        e.preventDefault();
        isDragging.current = true;
        startX.current = e.clientX;
        startWidth.current = sidebarWidth;
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      },
      [sidebarWidth],
    );

    const handleDividerPointerMove = useCallback((e: React.PointerEvent) => {
      if (!isDragging.current) return;
      const delta = e.clientX - startX.current;
      const newWidth = Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, startWidth.current + delta));
      setSidebarWidth(newWidth);
    }, []);

    const handleDividerPointerUp = useCallback((e: React.PointerEvent) => {
      if (!isDragging.current) return;
      isDragging.current = false;
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    }, []);

    const activeCard = activeCardId ? cards.find((c) => c.id === activeCardId) : null;

    // Prepare content with guaranteed H1
    const editorContent = useMemo(() => {
      if (!activeCard) return '';
      const raw = activeCard.synthesisMap?.[detailLevel] || '';
      return ensureH1(raw, activeCard.text);
    }, [activeCard, detailLevel]);

    // Unsaved-changes gating: if editor is dirty, show dialog before running action
    const gatedAction = useCallback((action: () => void) => {
      if (editorHandleRef.current?.isDirty) {
        setPendingAction(() => action);
      } else {
        action();
      }
    }, []);

    const handleCardClick = useCallback(
      (id: string) => {
        if (id === activeCardId) return;
        gatedAction(() => setActiveCardId(id));
      },
      [activeCardId, gatedAction, setActiveCardId],
    );

    // On save: extract H1 → sync card title, then save content
    const handleSave = useCallback(
      (newContent: string) => {
        if (!activeCard) return;
        // Extract H1 from saved markdown and sync to card title
        const h1Text = extractH1(newContent);
        if (h1Text && h1Text !== activeCard.text) {
          onRenameCard(activeCard.id, h1Text);
        }
        onSaveCardContent(activeCard.id, detailLevel, newContent);
      },
      [activeCard, detailLevel, onSaveCardContent, onRenameCard],
    );

    // Wrap onRenameCard: when the active card is renamed from the list, also update the live editor H1
    const handleRenameCard = useCallback(
      (id: string, newName: string) => {
        onRenameCard(id, newName);
        // If renaming the currently open card, update the live editor's H1
        if (id === activeCardId) {
          editorHandleRef.current?.updateH1(newName);
        }
      },
      [onRenameCard, activeCardId],
    );

    // ── Gated wrappers for destructive/unmounting actions ──
    const handleDeleteCard = useCallback(
      (id: string) => {
        gatedAction(() => onDeleteCard(id));
      },
      [gatedAction, onDeleteCard],
    );

    const handleDeleteSelectedCards = useCallback(() => {
      gatedAction(() => onDeleteSelectedCards());
    }, [gatedAction, onDeleteSelectedCards]);

    const handleReorderCards = useCallback(
      (fromIndex: number, toIndex: number) => {
        gatedAction(() => onReorderCards?.(fromIndex, toIndex));
      },
      [gatedAction, onReorderCards],
    );

    // ── New custom card dialog state ──
    const [showNewCardDialog, setShowNewCardDialog] = useState(false);
    const [newCardName, setNewCardName] = useState('');
    const newCardInputRef = useRef<HTMLInputElement>(null);
    useEffect(() => {
      if (showNewCardDialog) {
        setNewCardName('');
        setTimeout(() => newCardInputRef.current?.focus(), 50);
      }
    }, [showNewCardDialog]);

    const handleCreateCustomCard = useCallback(() => {
      gatedAction(() => setShowNewCardDialog(true));
    }, [gatedAction]);

    const commitNewCard = useCallback(() => {
      const trimmed = newCardName.trim();
      if (!trimmed) return;
      onCreateCustomCard(trimmed);
      setShowNewCardDialog(false);
    }, [newCardName, onCreateCustomCard]);

    // Card list rendered inside the editor's sidebar slot
    const cardListSidebar = (
      <div className="px-2 pb-4">
        <InsightsCardList
          cards={cards}
          activeCardId={activeCardId}
          onCardClick={handleCardClick}
          onCardDoubleClick={setActiveCardId}
          onToggleSelection={onToggleSelection}
          onSelectExclusive={(id) => {
            if (id === activeCardId) {
              onSelectExclusive(id);
            } else {
              gatedAction(() => {
                onSelectExclusive(id);
                setActiveCardId(id);
              });
            }
          }}
          onSelectRange={onSelectRange}
          onSelectAll={onSelectAll}
          onDeselectAll={onDeselectAll}
          onDeleteCard={handleDeleteCard}
          onDeleteSelectedCards={handleDeleteSelectedCards}
          onRenameCard={handleRenameCard}
          onCopyMoveCard={onCopyMoveCard}
          otherNuggets={otherNuggets}
          projectNuggets={projectNuggets}
          onCreateNuggetForCard={onCreateNuggetForCard}
          activeDetailLevel={detailLevel}
          onGenerateCardImage={onGenerateCardImage}
          onReorderCards={handleReorderCards}
        />
      </div>
    );

    // Reusable divider element
    const divider = (
      <div
        className="shrink-0 w-1 cursor-col-resize group relative select-none"
        onPointerDown={handleDividerPointerDown}
        onPointerMove={handleDividerPointerMove}
        onPointerUp={handleDividerPointerUp}
      >
        {/* Visible line */}
        <div className="absolute inset-y-0 left-0 w-px bg-zinc-100 dark:bg-zinc-700 group-hover:bg-zinc-300 dark:group-hover:bg-zinc-600 transition-colors" />
        {/* Wider hit target */}
        <div className="absolute inset-y-0 -left-1 w-3" />
      </div>
    );

    return (
      <div className="-ml-[4px] border border-zinc-200 dark:border-zinc-700 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_4px_12px_rgba(0,0,0,0.04)] relative z-[103] flex flex-col bg-white dark:bg-zinc-900 overflow-hidden flex-1 min-w-0">
        {/* Header */}
        <div className="shrink-0 flex flex-row items-center pt-2 pb-1 select-none">
          <div className="w-8 shrink-0 flex items-center justify-center">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0 text-zinc-500 dark:text-zinc-400"
            >
              <rect width="16" height="16" x="3" y="3" rx="2" ry="2" />
              <path d="M3 9h18" />
              <path d="M9 21V9" />
            </svg>
          </div>
          <span className="text-[13px] font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">Cards</span>
        </div>

        {/* Custom Card bar — whole row is clickable */}
        <div className="shrink-0 border-y border-zinc-100 dark:border-zinc-700">
          <button
            onClick={handleCreateCustomCard}
            className="w-full flex items-center gap-1.5 px-3 py-1.5 cursor-pointer transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            <span
              className="text-[11px] font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 flex-1 min-w-0 text-left"
              style={{ textShadow: '0 1px 2px rgba(0,0,0,0.15)' }}
            >
              + Add Custom Card
            </span>
            <span className="text-[9px] text-zinc-500 dark:text-zinc-400 font-light">{cards.length}</span>
            <span className="shrink-0 w-5 h-5 rounded flex items-center justify-center text-zinc-600 dark:text-zinc-400">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </span>
          </button>
        </div>

        {/* Content area: always show editor with sidebar */}
        {hasSelectedNugget ? (
          activeCard ? (
            <DocumentEditorModal
              ref={editorHandleRef}
              key={`${activeCardId}-${detailLevel}`}
              document={{ id: activeCard.id, name: activeCard.text, content: editorContent } as UploadedFile}
              mode="inline"
              sidebarContent={cardListSidebar}
              sidebarWidth={sidebarWidth}
              sidebarDivider={divider}
              onSave={handleSave}
              onClose={() => {}}
            />
          ) : (
            <div className="flex-1 flex overflow-hidden">
              {/* Show card list even when no card is selected */}
              <aside
                className="shrink-0 border-r border-zinc-100 dark:border-zinc-700 overflow-y-auto bg-white dark:bg-zinc-900"
                style={{ width: sidebarWidth }}
              >
                {cardListSidebar}
              </aside>
              {divider}
              <div className="flex-1 flex items-center justify-center">
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-light">Select a card to edit</p>
              </div>
            </div>
          )
        ) : (
          <div className="flex-1" />
        )}

        {/* Unsaved changes dialog */}
        {pendingAction && (
          <UnsavedChangesDialog
            onSave={() => {
              editorHandleRef.current?.save();
              const action = pendingAction;
              setPendingAction(null);
              action();
            }}
            onDiscard={() => {
              editorHandleRef.current?.discard();
              const action = pendingAction;
              setPendingAction(null);
              action();
            }}
            onCancel={() => setPendingAction(null)}
          />
        )}

        {/* New custom card name dialog */}
        {showNewCardDialog && (
          <div
            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 dark:bg-black/60 animate-in fade-in duration-300"
            onClick={() => setShowNewCardDialog(false)}
          >
            <div
              className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-[40px] p-10 shadow-2xl dark:shadow-black/30 border border-zinc-100 dark:border-zinc-700 animate-in zoom-in-95 duration-300"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="space-y-6 text-center">
                <div className="w-16 h-16 flex items-center justify-center mx-auto">
                  <svg
                    width="36"
                    height="36"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-black"
                  >
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <line x1="12" y1="8" x2="12" y2="16" />
                    <line x1="8" y1="12" x2="16" y2="12" />
                  </svg>
                </div>
                <div className="space-y-2">
                  <h3 className="text-[15px] font-black tracking-tight text-zinc-800 dark:text-zinc-200">
                    New Custom Card
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 font-light leading-relaxed">
                    Enter a name for the new card.
                  </p>
                </div>
                <div className="text-left space-y-1.5">
                  <label
                    htmlFor="new-card-name"
                    className="text-[9px] font-black uppercase tracking-[0.15em] text-zinc-500 dark:text-zinc-400"
                  >
                    Card Name
                  </label>
                  <input
                    id="new-card-name"
                    ref={newCardInputRef}
                    value={newCardName}
                    onChange={(e) => setNewCardName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitNewCard();
                      if (e.key === 'Escape') setShowNewCardDialog(false);
                    }}
                    placeholder="Enter a name for this card"
                    className="w-full px-4 py-3 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-400/50 dark:focus:ring-zinc-500/50 focus:border-black transition-colors placeholder:text-zinc-500"
                  />
                </div>
                <div className="flex flex-col space-y-3 pt-4">
                  <button
                    onClick={commitNewCard}
                    disabled={!newCardName.trim()}
                    className="w-full py-4 rounded-full bg-black text-white text-[10px] font-black uppercase tracking-widest hover:scale-[1.02] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Create Card
                  </button>
                  <button
                    onClick={() => setShowNewCardDialog(false)}
                    className="w-full py-2 text-zinc-600 dark:text-zinc-400 text-[10px] font-bold uppercase tracking-widest hover:text-zinc-800 dark:hover:text-zinc-200 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  },
);

export default React.memo(CardsPanel);
