
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Heading, DetailLevel } from '../types';
import { DEFAULT_STYLING } from '../utils/ai';

interface InsightsHeadingListProps {
  headings: Heading[];
  activeHeadingId: string | null;
  onHeadingClick: (id: string) => void;
  onHeadingDoubleClick?: (id: string) => void;
  onToggleSelection: (id: string) => void;
  onDeleteHeading: (id: string) => void;
  onRenameHeading: (id: string, newName: string) => void;
  onEditHeading: (id: string) => void;
}

function formatTimestamp(ts?: number): string {
  if (!ts) return '—';
  const date = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatTimestampFull(ts?: number): string {
  if (!ts) return '';
  return new Date(ts).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

// ── Inline info content used inside the hover submenu ──

interface InfoContentProps {
  heading: Heading;
  level: DetailLevel;
  hasCard: boolean;
  hasSynthesis: boolean;
}

const InfoContent: React.FC<InfoContentProps> = ({ heading, level, hasCard, hasSynthesis }) => (
  <>
    {/* Header */}
    <div className="px-3 py-2 border-b border-zinc-100">
      <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Card Info</p>
    </div>

    {/* Info rows */}
    <div className="px-3 py-2.5 space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] text-zinc-400">Detail</span>
        <span className="text-[10px] font-medium text-zinc-700">{level}</span>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[10px] text-zinc-400">Status</span>
        <div className="flex items-center gap-1.5">
          {hasCard ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              <span className="text-[10px] text-green-600 font-medium">Card generated</span>
            </>
          ) : hasSynthesis ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span className="text-[10px] text-amber-600 font-medium">Content ready</span>
            </>
          ) : (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-300" />
              <span className="text-[10px] text-zinc-500">Pending</span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-baseline justify-between">
        <span className="text-[10px] text-zinc-400">Created</span>
        <span className="text-[10px] text-zinc-600" title={formatTimestampFull(heading.createdAt)}>
          {formatTimestamp(heading.createdAt)}
        </span>
      </div>

      {heading.lastEditedAt && heading.lastEditedAt !== heading.createdAt && (
        <div className="flex items-baseline justify-between">
          <span className="text-[10px] text-zinc-400">Edited</span>
          <span className="text-[10px] text-zinc-600" title={formatTimestampFull(heading.lastEditedAt)}>
            {formatTimestamp(heading.lastEditedAt)}
          </span>
        </div>
      )}

      {heading.sourceDocuments && heading.sourceDocuments.length > 0 && (
        <>
          <div className="border-t border-zinc-100 pt-2">
            <span className="text-[10px] text-zinc-400">Sources</span>
          </div>
          <div className="space-y-1">
            {heading.sourceDocuments.map((name, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 text-[10px] text-zinc-600"
                title={name}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-zinc-400">
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                <span className="truncate">{name}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  </>
);

// ── Main component ──

const InsightsHeadingList: React.FC<InsightsHeadingListProps> = ({
  headings,
  activeHeadingId,
  onHeadingClick,
  onHeadingDoubleClick,
  onToggleSelection,
  onDeleteHeading,
  onRenameHeading,
  onEditHeading,
}) => {
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [menuMode, setMenuMode] = useState<'hover' | 'locked'>('hover');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [showInfoSubmenu, setShowInfoSubmenu] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const kebabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  // Close menu on outside click (only when locked)
  useEffect(() => {
    if (!menuOpenId || menuMode !== 'locked') return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null);
        setShowInfoSubmenu(false);
      }
    };
    window.addEventListener('mousedown', handleClick);
    return () => window.removeEventListener('mousedown', handleClick);
  }, [menuOpenId, menuMode]);

  // Reset info submenu when menu closes
  useEffect(() => {
    if (!menuOpenId) setShowInfoSubmenu(false);
  }, [menuOpenId]);

  // Focus rename input when it appears
  useEffect(() => {
    if (renamingId) renameInputRef.current?.focus();
  }, [renamingId]);

  const commitRename = (id: string) => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== headings.find(h => h.id === id)?.text) {
      onRenameHeading(id, trimmed);
    }
    setRenamingId(null);
  };

  if (headings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="w-8 h-8 bg-zinc-100 rounded-full flex items-center justify-center mb-3">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a1a1aa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
          </svg>
        </div>
        <p className="text-xs text-zinc-400 font-light">
          A nugget cards content will be placed here for card image generation.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1 py-2">
      {headings.map((heading) => {
        const isActive = heading.id === activeHeadingId;
        const level = (heading.settings || DEFAULT_STYLING).levelOfDetail;
        const hasCard = !!heading.cardUrlMap?.[level];
        const hasSynthesis = !!heading.synthesisMap?.[level];

        return (
          <div
            key={heading.id}
            data-heading-id={heading.id}
            className={`group flex items-center gap-2 px-2.5 py-1.5 rounded-lg border cursor-pointer transition-all duration-150 ${
              isActive
                ? 'bg-zinc-50 border-zinc-300'
                : 'bg-white border-zinc-200 hover:border-zinc-300'
            }`}
            onMouseEnter={() => {
              if (menuOpenId && menuMode === 'locked') return; // Don't override locked menu
              const kebabBtn = kebabRefs.current.get(heading.id);
              if (kebabBtn) {
                const rect = kebabBtn.getBoundingClientRect();
                setMenuPos({ x: rect.left, y: rect.bottom + 4 });
              }
              setMenuMode('hover');
              setMenuOpenId(heading.id);
            }}
            onMouseLeave={(e) => {
              if (menuMode === 'locked') return;
              // Check if moving to the portal menu
              const related = e.relatedTarget as Node | null;
              if (menuRef.current && related && menuRef.current.contains(related)) return;
              setMenuOpenId(null);
            }}
          >
            {/* Checkbox */}
            <button
              onClick={(e) => { e.stopPropagation(); onToggleSelection(heading.id); }}
              className={`shrink-0 w-4 h-4 rounded flex items-center justify-center transition-colors ${
                heading.selected
                  ? 'bg-zinc-900 border border-zinc-900'
                  : 'bg-white border border-zinc-300 hover:border-zinc-400'
              }`}
            >
              {heading.selected && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>

            {/* Heading text or rename input */}
            <div
              onClick={() => onHeadingClick(heading.id)}
              onDoubleClick={() => onHeadingDoubleClick?.(heading.id)}
              className="flex-1 min-w-0"
            >
              {renamingId === heading.id ? (
                <input
                  ref={renameInputRef}
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename(heading.id);
                    if (e.key === 'Escape') setRenamingId(null);
                  }}
                  onBlur={() => commitRename(heading.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full text-xs font-medium text-zinc-800 bg-white border border-zinc-300 rounded px-1.5 py-0.5 outline-none focus:border-zinc-400"
                />
              ) : (
                <>
                  <p className="text-xs font-medium text-zinc-800 truncate">
                    {heading.text}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[9px] text-zinc-400 uppercase tracking-wider">
                      {level}
                    </span>
                    {hasSynthesis && (
                      <span title="Content ready">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/>
                        </svg>
                      </span>
                    )}
                    {hasCard && (
                      <span title="Card generated">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                        </svg>
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Kebab menu trigger */}
            <button
              ref={(el) => { if (el) kebabRefs.current.set(heading.id, el); else kebabRefs.current.delete(heading.id); }}
              className="shrink-0 w-5 h-5 rounded flex items-center justify-center text-zinc-300 hover:text-zinc-500 transition-all"
              onClick={(e) => {
                e.stopPropagation();
                if (menuOpenId === heading.id && menuMode === 'locked') {
                  setMenuOpenId(null);
                } else {
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  setMenuPos({ x: rect.left, y: rect.bottom + 4 });
                  setMenuMode('locked');
                  setMenuOpenId(heading.id);
                }
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="5" r="2" />
                <circle cx="12" cy="12" r="2" />
                <circle cx="12" cy="19" r="2" />
              </svg>
            </button>
          </div>
        );
      })}

      {/* Kebab dropdown — rendered as portal to escape overflow clipping */}
      {menuOpenId && (() => {
        const heading = headings.find(h => h.id === menuOpenId);
        if (!heading) return null;
        const level = (heading.settings || DEFAULT_STYLING).levelOfDetail;
        const hasCard = !!heading.cardUrlMap?.[level];
        const hasSynthesis = !!heading.synthesisMap?.[level];
        return createPortal(
          <div
            ref={menuRef}
            className="fixed z-[130] min-w-[140px] bg-white rounded-lg border border-zinc-200 py-1"
            style={{ top: menuPos.y, left: menuPos.x, transform: 'translateX(-100%)', boxShadow: '0 8px 30px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)' }}
            onMouseLeave={(e) => {
              if (menuMode === 'locked') return;
              // Check if moving back to the row item
              const related = e.relatedTarget as Node | null;
              const rowEl = heading ? document.querySelector(`[data-heading-id="${heading.id}"]`) : null;
              if (rowEl && related && rowEl.contains(related)) return;
              setMenuOpenId(null);
            }}
          >
            {/* Info — hover submenu */}
            <div
              className="relative"
              onMouseEnter={() => setShowInfoSubmenu(true)}
              onMouseLeave={() => setShowInfoSubmenu(false)}
            >
              <button
                className="w-full px-3 py-1.5 text-left text-[11px] text-zinc-600 hover:bg-zinc-50 transition-colors flex items-center justify-between"
              >
                <span className="flex items-center gap-2">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400">
                    <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
                  </svg>
                  Card Info
                </span>
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-300">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>

              {showInfoSubmenu && (
                <div
                  className="absolute left-full top-0 mt-4 ml-1 w-56 bg-white border border-zinc-200 rounded-lg z-[140]"
                  style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)' }}
                >
                  <InfoContent
                    heading={heading}
                    level={level}
                    hasCard={hasCard}
                    hasSynthesis={hasSynthesis}
                  />
                </div>
              )}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setRenameValue(heading.text);
                setRenamingId(heading.id);
                setMenuOpenId(null);
              }}
              className="w-full px-3 py-1.5 text-left text-[11px] text-zinc-600 hover:bg-zinc-50 transition-colors flex items-center gap-2"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400">
                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
              </svg>
              Rename Card
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEditHeading(heading.id);
                setMenuOpenId(null);
              }}
              className="w-full px-3 py-1.5 text-left text-[11px] text-zinc-600 hover:bg-zinc-50 transition-colors flex items-center gap-2"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400">
                <path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
              </svg>
              Edit Card Content
            </button>
            <div className="border-t border-zinc-100" />
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpenId(null);
                setConfirmDeleteId(heading.id);
              }}
              className="w-full px-3 py-1.5 text-left text-[11px] text-red-500 hover:bg-red-50 transition-colors flex items-center gap-2"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
              </svg>
              Remove Card
            </button>
          </div>,
          document.body
        );
      })()}

      {/* Delete confirmation modal */}
      {confirmDeleteId && (() => {
        const heading = headings.find(h => h.id === confirmDeleteId);
        if (!heading) return null;
        return createPortal(
          <div
            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50"
            onClick={() => setConfirmDeleteId(null)}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl mx-4 overflow-hidden"
              style={{ minWidth: 260, maxWidth: 'calc(100vw - 32px)', width: 'fit-content' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 pt-6 pb-3 text-center">
                <div className="w-9 h-9 rounded-full bg-zinc-100 flex items-center justify-center mx-auto mb-3">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#71717a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                  </svg>
                </div>
                <h3 className="text-sm font-semibold text-zinc-900 tracking-tight mb-1">Remove Card Heading</h3>
                <p className="text-sm font-medium text-zinc-700 whitespace-nowrap">{heading.text}</p>
                <p className="text-[13px] text-zinc-400 mt-2">This cannot be undone.</p>
              </div>
              <div className="px-6 pb-5 pt-1 flex items-center justify-center gap-2">
                <button
                  onClick={() => setConfirmDeleteId(null)}
                  className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => { setConfirmDeleteId(null); onDeleteHeading(heading.id); }}
                  className="px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-lg hover:bg-zinc-800 transition-colors"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>,
          document.body
        );
      })()}
    </div>
  );
};

export default InsightsHeadingList;
