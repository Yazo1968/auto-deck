import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Card, DetailLevel, isCoverLevel } from '../types';
import { isNameTaken } from '../utils/naming';
import { formatTimestampFull } from '../utils/formatTime';
import PanelRequirements from './PanelRequirements';

interface InsightsCardListProps {
  cards: Card[];
  activeCardId: string | null;
  onCardClick: (id: string) => void;
  onCardDoubleClick?: (id: string) => void;
  onToggleSelection: (id: string) => void;
  onSelectExclusive: (id: string) => void;
  onSelectRange: (fromId: string, toId: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onDeleteCard: (id: string) => void;
  onDeleteSelectedCards: () => void;
  onRenameCard: (id: string, newName: string) => void;
  // Copy/Move
  onCopyMoveCard?: (cardId: string, targetNuggetId: string, mode: 'copy' | 'move') => void;
  otherNuggets?: { id: string; name: string }[];
  projectNuggets?: { projectId: string; projectName: string; nuggets: { id: string; name: string }[] }[];
  onCreateNuggetForCard?: (nuggetName: string, cardId: string | null) => void;
  /** The active detail level from the parent — used to look up synthesisMap/cardUrlMap for Card Info */
  activeDetailLevel?: DetailLevel;
  onGenerateCardImage?: (card: Card) => void;
  onReorderCards?: (fromIndex: number, toIndex: number) => void;
}

// -- Inline info content used inside the hover submenu --

interface InfoContentProps {
  card: Card;
  level: DetailLevel;
}

const InfoContent: React.FC<InfoContentProps> = ({ card, level }) => {
  // Image version count and last image timestamp
  const versions = card.imageHistoryMap?.[level];
  const versionCount = versions ? versions.length : 0;
  const lastImageTs = versions && versions.length > 0 ? versions[versions.length - 1].timestamp : undefined;

  // Image staleness: red if content was modified after the last image generation
  const lastModifiedTs = card.lastEditedAt && card.lastEditedAt !== card.createdAt ? card.lastEditedAt : undefined;
  const imageStale = !!(lastImageTs && lastModifiedTs && lastModifiedTs > lastImageTs);

  return (
    <>
      {/* Header */}
      <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-600 flex items-center justify-between">
        <p className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Card Info</p>
        {(() => {
          const cardLevel = card.detailLevel || 'Standard';
          const isCover = isCoverLevel(cardLevel);
          const isDirect = cardLevel === 'DirectContent';
          const label =
            cardLevel === 'TitleCard'
              ? 'Title Card'
              : cardLevel === 'TakeawayCard'
                ? 'Takeaway Card'
                : cardLevel === 'DirectContent'
                  ? 'Direct'
                  : cardLevel;
          return (
            <span
              className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-[2px] rounded ${
                isCover
                  ? 'text-violet-600 bg-violet-50'
                  : isDirect
                    ? 'text-emerald-600 bg-emerald-50'
                    : 'text-zinc-500 bg-zinc-100'
              }`}
            >
              {label}
            </span>
          );
        })()}
      </div>

      {/* Info rows */}
      <div className="px-3 py-2.5 space-y-2">
        {/* Content generated */}
        <div className="flex items-baseline justify-between">
          <span className="text-[10px] text-zinc-500 dark:text-zinc-400">Content generated</span>
          <span className="text-[10px] text-zinc-600 dark:text-zinc-400">
            {card.createdAt ? formatTimestampFull(card.createdAt) : '—'}
          </span>
        </div>

        {/* Content last modified */}
        <div className="flex items-baseline justify-between">
          <span className="text-[10px] text-zinc-500 dark:text-zinc-400">Content last modified</span>
          <span className="text-[10px] text-zinc-600 dark:text-zinc-400">
            {card.lastEditedAt && card.lastEditedAt !== card.createdAt ? formatTimestampFull(card.lastEditedAt) : '—'}
          </span>
        </div>

        {/* Divider */}
        <div className="border-t border-zinc-100 dark:border-zinc-600" />

        {/* Image versions */}
        <div className="flex items-baseline justify-between">
          <span className="text-[10px] text-zinc-500 dark:text-zinc-400">Image versions</span>
          <span className="text-[10px] text-zinc-600 dark:text-zinc-400">{versionCount > 0 ? versionCount : '—'}</span>
        </div>

        {/* Last image generated — red if stale, green if fresh */}
        <div className="flex items-baseline justify-between">
          <span className="text-[10px] text-zinc-500 dark:text-zinc-400">Last image generated</span>
          <span
            className={`text-[10px] font-medium ${lastImageTs ? (imageStale ? 'text-red-500' : 'text-green-600') : 'text-zinc-600'}`}
          >
            {lastImageTs ? formatTimestampFull(lastImageTs) : '—'}
          </span>
        </div>

        {/* Divider */}
        <div className="border-t border-zinc-100 dark:border-zinc-600" />

        {/* Source documents */}
        {card.sourceDocuments && card.sourceDocuments.length > 0 ? (
          <>
            <div>
              <span className="text-[10px] text-zinc-500 dark:text-zinc-400">Sources</span>
            </div>
            <div className="space-y-1">
              {card.sourceDocuments.map((name, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1.5 text-[10px] text-zinc-600 dark:text-zinc-400"
                  title={name}
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="shrink-0 text-zinc-500 dark:text-zinc-400"
                  >
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  <span className="truncate">{name}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex items-baseline justify-between">
            <span className="text-[10px] text-zinc-500 dark:text-zinc-400">Sources</span>
            <span className="text-[10px] text-zinc-600 dark:text-zinc-400">—</span>
          </div>
        )}
      </div>
    </>
  );
};

// -- Main component --

const InsightsCardList: React.FC<InsightsCardListProps> = ({
  cards,
  activeCardId,
  onCardClick,
  onCardDoubleClick,
  onToggleSelection,
  onSelectExclusive: _onSelectExclusive,
  onSelectRange: _onSelectRange,
  onSelectAll,
  onDeselectAll,
  onDeleteCard,
  onDeleteSelectedCards,
  onRenameCard,
  onCopyMoveCard,
  otherNuggets,
  projectNuggets,
  onCreateNuggetForCard,
  activeDetailLevel,
  onGenerateCardImage,
  onReorderCards,
}) => {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; cardId: string } | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState('');
  const [showInfoSubmenu, setShowInfoSubmenu] = useState(false);
  const [showCopyMoveSubmenu, setShowCopyMoveSubmenu] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteSelected, setConfirmDeleteSelected] = useState(false);
  const [noNuggetsCardId, setNoNuggetsCardId] = useState<string | null>(null);
  const [newNuggetName, setNewNuggetName] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const selectedCount = useMemo(() => cards.filter((c) => c.selected).length, [cards]);

  // Pointer-based drag-and-drop reordering
  const listRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{
    active: boolean;
    sourceIdx: number;
    currentIdx: number;
    startY: number;
    offsetY: number;
    cardHeight: number;
    cardRects: { top: number; height: number }[];
  } | null>(null);
  const [dragSourceIdx, setDragSourceIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [dragGhostStyle, setDragGhostStyle] = useState<React.CSSProperties | null>(null);
  const dragGhostRef = useRef<HTMLDivElement>(null);
  const dragGhostText = useRef('');

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, idx: number, text: string) => {
      // Only left button, skip if renaming, no reorder handler, or modifier keys
      if (e.button !== 0 || !onReorderCards || renamingId !== null) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;

      const el = e.currentTarget as HTMLElement;
      const rect = el.getBoundingClientRect();

      // Snapshot all card rects for hit-testing during drag
      const cardEls = listRef.current?.querySelectorAll('[data-card-idx]');
      const cardRects: { top: number; height: number }[] = [];
      cardEls?.forEach((cel) => {
        const r = (cel as HTMLElement).getBoundingClientRect();
        cardRects.push({ top: r.top, height: r.height });
      });

      dragState.current = {
        active: false,
        sourceIdx: idx,
        currentIdx: idx,
        startY: e.clientY,
        offsetY: e.clientY - rect.top,
        cardHeight: rect.height,
        cardRects,
      };
      dragGhostText.current = text;

      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [onReorderCards, renamingId],
  );

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const ds = dragState.current;
    if (!ds) return;

    const dy = Math.abs(e.clientY - ds.startY);

    // Activate drag after 4px movement
    if (!ds.active) {
      if (dy < 4) return;
      ds.active = true;
      setDragSourceIdx(ds.sourceIdx);
      setDragOverIdx(ds.sourceIdx);
    }

    // Update ghost position
    const listRect = listRef.current?.getBoundingClientRect();
    if (listRect) {
      setDragGhostStyle({
        position: 'absolute',
        left: 0,
        right: 0,
        top: e.clientY - listRect.top - ds.offsetY,
        height: ds.cardHeight,
        zIndex: 50,
        pointerEvents: 'none',
        opacity: 0.9,
      });
    }

    // Determine which slot we're over using the card midpoints
    const rects = ds.cardRects;
    let target = ds.sourceIdx;
    for (let i = 0; i < rects.length; i++) {
      if (i === ds.sourceIdx) continue;
      const mid = rects[i].top + rects[i].height / 2;
      if (ds.sourceIdx < i) {
        // Dragging down: pass midpoint to go below
        if (e.clientY > mid) target = i;
      } else {
        // Dragging up: pass midpoint to go above
        if (e.clientY < mid) {
          target = i;
          break;
        }
      }
    }

    if (target !== ds.currentIdx) {
      ds.currentIdx = target;
      setDragOverIdx(target);
    }
  }, []);

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      const ds = dragState.current;
      if (!ds) return;

      (e.target as HTMLElement).releasePointerCapture(e.pointerId);

      if (ds.active && ds.sourceIdx !== ds.currentIdx) {
        onReorderCards?.(ds.sourceIdx, ds.currentIdx);
      }

      dragState.current = null;
      setDragSourceIdx(null);
      setDragOverIdx(null);
      setDragGhostStyle(null);
    },
    [onReorderCards],
  );

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
        setShowInfoSubmenu(false);
        setShowCopyMoveSubmenu(false);
      }
    };
    window.addEventListener('mousedown', handleClick);
    return () => window.removeEventListener('mousedown', handleClick);
  }, [contextMenu]);

  // Adjust context menu position to stay within viewport
  useEffect(() => {
    if (!contextMenu || !menuRef.current) return;
    const menu = menuRef.current;
    const rect = menu.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let { x, y } = contextMenu;
    if (rect.bottom > vh) y = Math.max(4, vh - rect.height - 4);
    if (rect.right > vw) x = Math.max(4, vw - rect.width - 4);
    if (y !== contextMenu.y || x !== contextMenu.x) {
      menu.style.top = `${y}px`;
      menu.style.left = `${x}px`;
    }
  }, [contextMenu]);

  // Reset submenus when menu closes
  useEffect(() => {
    if (!contextMenu) {
      setShowInfoSubmenu(false);
      setShowCopyMoveSubmenu(false);
    }
  }, [contextMenu]);

  // Focus rename input when it appears
  useEffect(() => {
    if (renamingId) renameInputRef.current?.focus();
  }, [renamingId]);

  // Keyboard shortcuts: Cmd/Ctrl+A to select all
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'a' && (e.metaKey || e.ctrlKey) && cards.length > 0) {
        // Only handle if no input/textarea is focused
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        onSelectAll();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cards.length, onSelectAll]);

  const commitRename = (id: string) => {
    const trimmed = renameValue.trim();
    if (!trimmed) {
      setRenamingId(null);
      setRenameError('');
      return;
    }
    const currentCard = cards.find((h) => h.id === id);
    if (trimmed !== currentCard?.text) {
      // Check uniqueness within sibling cards
      const siblingNames = cards.map((h) => h.text);
      if (isNameTaken(trimmed, siblingNames, currentCard?.text)) {
        setRenameError('A card with this name already exists');
        return;
      }
      onRenameCard(id, trimmed);
    }
    setRenamingId(null);
    setRenameError('');
  };

  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <PanelRequirements level="cards" />
      </div>
    );
  }

  // Compute gap style for smooth card displacement during drag
  const getGapStyle = (idx: number): React.CSSProperties => {
    if (dragSourceIdx === null || dragOverIdx === null || dragSourceIdx === dragOverIdx) return {};
    const gap = dragState.current?.cardHeight || 28;
    if (dragSourceIdx < dragOverIdx) {
      // Dragging down: cards between source+1..target shift up
      if (idx > dragSourceIdx && idx <= dragOverIdx) {
        return { transform: `translateY(-${gap}px)`, transition: 'transform 150ms ease' };
      }
    } else {
      // Dragging up: cards between target..source-1 shift down
      if (idx >= dragOverIdx && idx < dragSourceIdx) {
        return { transform: `translateY(${gap}px)`, transition: 'transform 150ms ease' };
      }
    }
    return { transition: 'transform 150ms ease' };
  };

  return (
    <div className="space-y-0 py-2 relative" ref={listRef}>
      {/* Select all / deselect all */}
      {cards.length > 0 &&
        (() => {
          const allSelected = selectedCount === cards.length;
          const someSelected = selectedCount > 0 && !allSelected;
          return (
            <div
              className="flex items-center gap-1 px-1.5 py-1 cursor-pointer select-none border-b border-zinc-100 dark:border-zinc-600 mb-1"
              onClick={() => {
                if (allSelected) onDeselectAll();
                else onSelectAll();
              }}
            >
              <div className="shrink-0 w-3.5 h-3.5 rounded-[3px] border border-zinc-300 dark:border-zinc-600 flex items-center justify-center bg-white dark:bg-zinc-900">
                {allSelected && (
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="rgb(42,159,212)"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
                {someSelected && (
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="rgb(42,159,212)"
                    strokeWidth="3"
                    strokeLinecap="round"
                  >
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                )}
              </div>
              <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">All cards</span>
            </div>
          );
        })()}
      {cards.map((card, idx) => {
        const isActive = card.id === activeCardId;
        const isSelected = !!card.selected;
        const isGenerating = !!(activeDetailLevel && card.isGeneratingMap?.[activeDetailLevel]);
        const isDragging = dragSourceIdx === idx;

        // Auto-Deck group separator — show when entering an auto-deck group
        const prevCard = idx > 0 ? cards[idx - 1] : null;
        const isAutoDeck = !!card.autoDeckSessionId;
        const prevIsAutoDeck = !!prevCard?.autoDeckSessionId;
        const isNewGroup = isAutoDeck && (!prevIsAutoDeck || prevCard?.autoDeckSessionId !== card.autoDeckSessionId);
        const isLeavingGroup = !isAutoDeck && prevIsAutoDeck;

        return (
          <React.Fragment key={card.id}>
            {/* Auto-Deck separator */}
            {(isNewGroup || isLeavingGroup) && (
              <div
                className="flex items-center gap-2 px-2 py-1.5 mt-1 mb-0.5 select-none"
                style={{ pointerEvents: 'none' }}
              >
                <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
                <span className="text-[9px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 whitespace-nowrap">
                  {isNewGroup ? 'Auto-Deck' : 'Manual Cards'}
                </span>
                <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
              </div>
            )}
            <div
              role="button"
              tabIndex={0}
              data-card-id={card.id}
              data-card-idx={idx}
              onPointerDown={(e) => handlePointerDown(e, idx, card.text)}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              style={{
                ...getGapStyle(idx),
                ...(isDragging ? { opacity: 0, pointerEvents: 'none' } : {}),
              }}
              className={`group relative flex items-center gap-1 px-1.5 py-1 cursor-pointer select-none transition-all duration-150 ${
                isActive ? 'sidebar-node-active' : 'border border-transparent hover:border-blue-300'
              }`}
              onClick={(e) => {
                // Suppress click if we just finished a drag
                if (dragState.current?.active) return;
                e.stopPropagation();
                onCardClick(card.id);
                setShowInfoSubmenu(false);
                setShowCopyMoveSubmenu(false);
                setContextMenu({ x: e.clientX, y: e.clientY, cardId: card.id });
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onCardClick(card.id);
                }
              }}
              onDoubleClick={() => onCardDoubleClick?.(card.id)}
            >
              {/* Selection checkbox */}
              <div
                role="checkbox"
                aria-checked={isSelected}
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSelection(card.id);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    onToggleSelection(card.id);
                  }
                }}
                className="shrink-0 w-3.5 h-3.5 rounded-[3px] border border-zinc-300 dark:border-zinc-600 flex items-center justify-center cursor-pointer bg-white dark:bg-zinc-900"
              >
                {isSelected && (
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="rgb(42,159,212)"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>

              {/* Spinning arc indicator when generating */}
              {isGenerating && (
                <div
                  className="shrink-0 w-3.5 h-3.5 rounded-full border-[1.5px] border-zinc-200 dark:border-zinc-600 border-t-zinc-500 dark:border-t-zinc-400 animate-spin"
                  title="Generating image…"
                />
              )}

              {/* Card type badge — icon + type-specific tag */}
              {isCoverLevel(card.detailLevel || 'Standard') &&
                (() => {
                  const isTitleCard = card.detailLevel === 'TitleCard';
                  return (
                    <div
                      className="flex items-center gap-0.5 shrink-0"
                      title={isTitleCard ? 'Title Card' : 'Takeaway Card'}
                    >
                      {isTitleCard ? (
                        /* Presentation/slide icon for Title Card */
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="text-violet-500"
                        >
                          <rect x="2" y="3" width="20" height="14" rx="2" />
                          <path d="M8 21h8" />
                          <path d="M12 17v4" />
                        </svg>
                      ) : (
                        /* Lightbulb/insight icon for Takeaway Card */
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="text-amber-500"
                        >
                          <path d="M9 18h6" />
                          <path d="M10 22h4" />
                          <path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" />
                        </svg>
                      )}
                      <span
                        className={`text-[7px] font-bold uppercase tracking-wider px-1 py-[1px] rounded ${isTitleCard ? 'text-violet-600 bg-violet-50' : 'text-amber-600 bg-amber-50'}`}
                      >
                        {isTitleCard ? 'Title' : 'Takeaway'}
                      </span>
                    </div>
                  );
                })()}

              {/* Card title or rename input */}
              <div className="flex-1 min-w-0">
                {renamingId === card.id ? (
                  <div>
                    <input
                      ref={renameInputRef}
                      value={renameValue}
                      onChange={(e) => {
                        setRenameValue(e.target.value);
                        setRenameError('');
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitRename(card.id);
                        if (e.key === 'Escape') {
                          setRenamingId(null);
                          setRenameError('');
                        }
                      }}
                      onBlur={() => commitRename(card.id)}
                      onClick={(e) => e.stopPropagation()}
                      className={`w-full text-[11px] font-medium text-zinc-800 dark:text-zinc-200 bg-white dark:bg-zinc-900 border rounded px-1.5 py-0.5 outline-none ${renameError ? 'border-red-400 focus:border-red-400' : 'border-zinc-300 dark:border-zinc-600 focus:border-zinc-400'}`}
                      aria-invalid={!!renameError || undefined}
                      aria-describedby={renameError ? 'card-rename-error' : undefined}
                    />
                    {renameError && (
                      <p id="card-rename-error" className="text-[9px] text-red-500 mt-0.5">
                        {renameError}
                      </p>
                    )}
                  </div>
                ) : (
                  <p
                    className={`text-[11px] truncate ${isActive ? 'font-semibold text-zinc-800 dark:text-zinc-200' : 'font-medium text-zinc-600 dark:text-zinc-400'}`}
                    title={card.text}
                  >
                    {card.text}
                  </p>
                )}
              </div>
            </div>
          </React.Fragment>
        );
      })}

      {/* Floating drag ghost */}
      {dragGhostStyle && (
        <div
          ref={dragGhostRef}
          className="flex items-center gap-1 px-1.5 py-1 rounded bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-600 shadow-lg dark:shadow-black/30"
          style={dragGhostStyle}
        >
          <p className="text-[11px] font-semibold text-zinc-800 dark:text-zinc-200 truncate">{dragGhostText.current}</p>
        </div>
      )}

      {/* Context menu — rendered as portal at right-click coordinates */}
      {contextMenu &&
        (() => {
          const card = cards.find((h) => h.id === contextMenu.cardId);
          if (!card) return null;
          const level = activeDetailLevel || card.detailLevel || 'Standard';
          const _hasCard = !!card.cardUrlMap?.[level];
          const _hasSynthesis = !!card.synthesisMap?.[level];
          return createPortal(
            <div
              ref={menuRef}
              className="fixed z-[130] min-w-[180px] bg-white dark:bg-zinc-900 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-600 py-1 animate-in fade-in zoom-in-95 duration-150"
              style={{ top: contextMenu.y, left: contextMenu.x }}
            >
              {/* ── Active card actions (always shown) ── */}
              {/* Info — hover submenu */}
              <div
                className="relative"
                onMouseEnter={() => setShowInfoSubmenu(true)}
                onMouseLeave={() => setShowInfoSubmenu(false)}
              >
                <button className="w-full text-left px-3 py-2 text-[11px] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-zinc-500"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 16v-4" />
                      <path d="M12 8h.01" />
                    </svg>
                    Card Info
                  </span>
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-zinc-500"
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>

                {showInfoSubmenu && (
                  <div className="absolute left-full top-0 ml-1 w-56 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-600 rounded-lg shadow-lg z-[140] animate-in fade-in zoom-in-95 duration-100">
                    <InfoContent card={card} level={level} />
                  </div>
                )}
              </div>

              {onGenerateCardImage && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setContextMenu(null);
                    onGenerateCardImage(card);
                  }}
                  className="w-full text-left px-3 py-2 text-[11px] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors flex items-center gap-2"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-zinc-500"
                  >
                    <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                    <circle cx="9" cy="9" r="2" />
                    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                  </svg>
                  Generate Card Image
                </button>
              )}

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setRenameValue(card.text);
                  setRenamingId(card.id);
                  setContextMenu(null);
                }}
                className="w-full text-left px-3 py-2 text-[11px] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors flex items-center gap-2"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-zinc-500"
                >
                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                </svg>
                Rename Card
              </button>

              {/* Copy/Move — hover submenu */}
              {onCopyMoveCard && (
                <div
                  className="relative"
                  onMouseEnter={() => setShowCopyMoveSubmenu(true)}
                  onMouseLeave={() => setShowCopyMoveSubmenu(false)}
                >
                  <button
                    onClick={() => {
                      if (!otherNuggets || otherNuggets.length === 0) {
                        setNoNuggetsCardId(contextMenu.cardId);
                        setContextMenu(null);
                      }
                    }}
                    className="w-full text-left px-3 py-2 text-[11px] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors flex items-center justify-between"
                  >
                    <span className="flex items-center gap-2">
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-zinc-500"
                      >
                        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                        <polyline points="10 17 15 12 10 7" />
                        <line x1="15" y1="12" x2="3" y2="12" />
                      </svg>
                      Copy/Move
                    </span>
                    {otherNuggets && otherNuggets.length > 0 && (
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-zinc-500"
                      >
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    )}
                  </button>

                  {/* Nugget list submenu */}
                  {showCopyMoveSubmenu && otherNuggets && otherNuggets.length > 0 && (
                    <div className="absolute left-full top-0 ml-1 w-[220px] bg-white dark:bg-zinc-900 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-600 py-1 z-[140] animate-in fade-in zoom-in-95 duration-100">
                      <div className="px-3 pb-1 border-b border-zinc-100 dark:border-zinc-600 mb-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                          Copy/Move to nugget
                        </span>
                      </div>
                      <div className="max-h-[200px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                        {projectNuggets && projectNuggets.length > 0
                          ? projectNuggets.map((pg) => (
                              <div key={pg.projectId}>
                                <div className="px-3 pt-1.5 pb-0.5 flex items-center gap-1.5">
                                  <svg
                                    width="12"
                                    height="12"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="text-zinc-500 shrink-0"
                                  >
                                    <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
                                  </svg>
                                  <span className="text-[9px] font-semibold text-zinc-500 dark:text-zinc-400 truncate">
                                    {pg.projectName}
                                  </span>
                                </div>
                                {pg.nuggets.length === 0 ? (
                                  <p className="text-zinc-500 dark:text-zinc-400 text-[9px] font-light pl-6 pr-2 py-0.5 italic">
                                    No other nuggets
                                  </p>
                                ) : (
                                  pg.nuggets.map((n) => (
                                    <div
                                      key={n.id}
                                      className="pl-5 pr-2 py-1 flex items-center gap-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg mx-1 group"
                                    >
                                      <div className="w-1.5 h-1.5 rounded-full bg-accent-blue shrink-0" />
                                      <span className="flex-1 text-[11px] text-black truncate" title={n.name}>
                                        {n.name}
                                      </span>
                                      <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                          onClick={() => {
                                            const hId = contextMenu.cardId;
                                            setContextMenu(null);
                                            onCopyMoveCard(hId, n.id, 'copy');
                                          }}
                                          className="px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800/50 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-800 dark:hover:text-zinc-200 rounded transition-colors"
                                        >
                                          Copy
                                        </button>
                                        <button
                                          onClick={() => {
                                            const hId = contextMenu.cardId;
                                            setContextMenu(null);
                                            onCopyMoveCard(hId, n.id, 'move');
                                          }}
                                          className="px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800/50 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-800 dark:hover:text-zinc-200 rounded transition-colors"
                                        >
                                          Move
                                        </button>
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            ))
                          : otherNuggets.map((n) => (
                              <div
                                key={n.id}
                                className="px-2 py-1 flex items-center gap-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg mx-1 group"
                              >
                                <div className="w-1.5 h-1.5 rounded-full bg-accent-blue shrink-0" />
                                <span className="flex-1 text-[11px] text-black truncate" title={n.name}>
                                  {n.name}
                                </span>
                                <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={() => {
                                      const hId = contextMenu.cardId;
                                      setContextMenu(null);
                                      onCopyMoveCard(hId, n.id, 'copy');
                                    }}
                                    className="px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800/50 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-800 dark:hover:text-zinc-200 rounded transition-colors"
                                  >
                                    Copy
                                  </button>
                                  <button
                                    onClick={() => {
                                      const hId = contextMenu.cardId;
                                      setContextMenu(null);
                                      onCopyMoveCard(hId, n.id, 'move');
                                    }}
                                    className="px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800/50 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-800 dark:hover:text-zinc-200 rounded transition-colors"
                                  >
                                    Move
                                  </button>
                                </div>
                              </div>
                            ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="h-px bg-zinc-100 dark:bg-zinc-700 my-1" />

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setContextMenu(null);
                  setConfirmDeleteId(card.id);
                }}
                className="w-full text-left px-3 py-2 text-[11px] text-red-500 hover:bg-red-50 transition-colors flex items-center gap-2"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 6h18" />
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                </svg>
                Remove Card
              </button>

              {/* ── Selected cards actions (only when 2+ cards checked) ── */}
              {selectedCount > 1 && (
                <>
                  <div className="h-px bg-zinc-100 dark:bg-zinc-700 my-1" />
                  <div className="px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.15em] text-zinc-500 dark:text-zinc-400">
                    {selectedCount} Cards Selected
                  </div>
                  <div className="h-px bg-zinc-100 dark:bg-zinc-700 my-1" />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setContextMenu(null);
                      onDeselectAll();
                    }}
                    className="w-full text-left px-3 py-2 text-[11px] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors flex items-center gap-2"
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-zinc-500"
                    >
                      <path d="M18 6 6 18" />
                      <path d="m6 6 12 12" />
                    </svg>
                    Deselect All
                  </button>
                  {onGenerateCardImage && (
                    <>
                      <div className="h-px bg-zinc-100 dark:bg-zinc-700 my-1" />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setContextMenu(null);
                          const selected = cards.filter((c) => c.selected);
                          selected.forEach((c) => onGenerateCardImage(c));
                        }}
                        className="w-full text-left px-3 py-2 text-[11px] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors flex items-center gap-2"
                      >
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="text-zinc-500"
                        >
                          <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                          <circle cx="9" cy="9" r="2" />
                          <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                        </svg>
                        Generate {selectedCount} Card Images
                      </button>
                    </>
                  )}
                  <div className="h-px bg-zinc-100 dark:bg-zinc-700 my-1" />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setContextMenu(null);
                      setConfirmDeleteSelected(true);
                    }}
                    className="w-full text-left px-3 py-2 text-[11px] text-red-500 hover:bg-red-50 transition-colors flex items-center gap-2"
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3 6h18" />
                      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                    </svg>
                    Remove {selectedCount} Cards
                  </button>
                </>
              )}
            </div>,
            document.body,
          );
        })()}

      {/* Delete confirmation modal */}
      {confirmDeleteId &&
        (() => {
          const card = cards.find((h) => h.id === confirmDeleteId);
          if (!card) return null;
          return createPortal(
            <div
              className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 dark:bg-black/60"
              onClick={() => setConfirmDeleteId(null)}
            >
              <div
                className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl dark:shadow-black/30 mx-4 overflow-hidden"
                style={{ minWidth: 260, maxWidth: 'calc(100vw - 32px)', width: 'fit-content' }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-6 pt-6 pb-3 text-center">
                  <div className="w-9 h-9 rounded-full bg-zinc-100 dark:bg-zinc-800/50 flex items-center justify-center mx-auto mb-3">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      className="text-zinc-500"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3 6h18" />
                      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                    </svg>
                  </div>
                  <h3 className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 tracking-tight mb-1">
                    Remove Card
                  </h3>
                  <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 whitespace-nowrap">{card.text}</p>
                  <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mt-2">This cannot be undone.</p>
                </div>
                <div className="px-6 pb-5 pt-1 flex items-center justify-center gap-2">
                  <button
                    onClick={() => setConfirmDeleteId(null)}
                    className="px-4 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setConfirmDeleteId(null);
                      onDeleteCard(card.id);
                    }}
                    className="px-4 py-2 bg-zinc-900 text-white text-xs font-medium rounded-lg hover:bg-zinc-800 transition-colors"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          );
        })()}

      {/* Bulk delete confirmation modal */}
      {confirmDeleteSelected &&
        (() => {
          return createPortal(
            <div
              className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 dark:bg-black/60"
              onClick={() => setConfirmDeleteSelected(false)}
            >
              <div
                className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl dark:shadow-black/30 mx-4 overflow-hidden"
                style={{ minWidth: 260, maxWidth: 'calc(100vw - 32px)', width: 'fit-content' }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-6 pt-6 pb-3 text-center">
                  <div className="w-9 h-9 rounded-full bg-zinc-100 dark:bg-zinc-800/50 flex items-center justify-center mx-auto mb-3">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      className="text-zinc-500"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3 6h18" />
                      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                    </svg>
                  </div>
                  <h3 className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 tracking-tight mb-1">
                    Remove {selectedCount} Cards
                  </h3>
                  <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mt-2">This cannot be undone.</p>
                </div>
                <div className="px-6 pb-5 pt-1 flex items-center justify-center gap-2">
                  <button
                    onClick={() => setConfirmDeleteSelected(false)}
                    className="px-4 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setConfirmDeleteSelected(false);
                      onDeleteSelectedCards();
                    }}
                    className="px-4 py-2 bg-zinc-900 text-white text-xs font-medium rounded-lg hover:bg-zinc-800 transition-colors"
                  >
                    Remove All
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          );
        })()}

      {/* Copy/Move — no other nuggets: create modal */}
      {noNuggetsCardId &&
        onCreateNuggetForCard &&
        createPortal(
          <div
            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 dark:bg-black/60"
            onClick={() => {
              setNoNuggetsCardId(null);
              setNewNuggetName('');
            }}
          >
            <div
              className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl dark:shadow-black/30 mx-4 overflow-hidden"
              style={{ minWidth: 300, maxWidth: 'calc(100vw - 32px)', width: 'fit-content' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 pt-6 pb-3 text-center">
                <div className="w-9 h-9 rounded-full bg-zinc-100 dark:bg-zinc-800/50 flex items-center justify-center mx-auto mb-3">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    className="text-zinc-500"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                    <polyline points="10 17 15 12 10 7" />
                    <line x1="15" y1="12" x2="3" y2="12" />
                  </svg>
                </div>
                <h3 className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 tracking-tight mb-1">
                  No Other Nuggets
                </h3>
                <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mt-1">
                  Create a new nugget to copy this card to.
                </p>
                {(() => {
                  const allNuggetNames = (otherNuggets || []).map((n) => n.name);
                  const nameConflict = isNameTaken(newNuggetName.trim(), allNuggetNames);
                  return (
                    <>
                      <input
                        type="text"
                        value={newNuggetName}
                        onChange={(e) => setNewNuggetName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newNuggetName.trim() && !nameConflict) {
                            const hId = noNuggetsCardId;
                            setNoNuggetsCardId(null);
                            setNewNuggetName('');
                            onCreateNuggetForCard(newNuggetName.trim(), hId);
                          }
                        }}
                        placeholder="Nugget name"
                        autoFocus
                        className={`mt-3 w-full px-3 py-2 text-xs text-zinc-800 dark:text-zinc-200 border rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-300 transition-all placeholder:text-zinc-500 ${nameConflict ? 'border-red-300 focus:border-red-400' : 'border-zinc-200 dark:border-zinc-600 focus:border-zinc-400'}`}
                      />
                      {nameConflict && (
                        <p className="text-[10px] text-red-500 mt-1">A nugget with this name already exists</p>
                      )}
                    </>
                  );
                })()}
              </div>
              <div className="px-6 pb-5 pt-1 flex items-center justify-center gap-2">
                <button
                  onClick={() => {
                    setNoNuggetsCardId(null);
                    setNewNuggetName('');
                  }}
                  className="px-4 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                {(() => {
                  const nameConflict = isNameTaken(
                    newNuggetName.trim(),
                    (otherNuggets || []).map((n) => n.name),
                  );
                  const canCreate = !!newNuggetName.trim() && !nameConflict;
                  return (
                    <button
                      onClick={() => {
                        if (!canCreate) return;
                        const hId = noNuggetsCardId;
                        setNoNuggetsCardId(null);
                        setNewNuggetName('');
                        onCreateNuggetForCard(newNuggetName.trim(), hId);
                      }}
                      disabled={!canCreate}
                      className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors ${
                        canCreate
                          ? 'bg-zinc-900 text-white hover:bg-zinc-800'
                          : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 opacity-40 cursor-not-allowed'
                      }`}
                    >
                      New Nugget
                    </button>
                  );
                })()}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};

export default React.memo(InsightsCardList);
