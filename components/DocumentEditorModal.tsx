
import React, { useRef, useCallback, useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { createPortal } from 'react-dom';
import { UploadedFile, DetailLevel } from '../types';
import { FormatToolbar } from './FormatToolbar';
import { FindReplaceBar } from './FindReplaceBar';
import { useDocumentEditing, EditorHeading } from '../hooks/useDocumentEditing';
import { useDocumentFindReplace } from '../hooks/useDocumentFindReplace';
import { UnsavedChangesDialog } from './Dialogs';

interface DocumentEditorModalProps {
  document: UploadedFile;
  onSave: (newContent: string) => void;
  onClose: () => void;
  /** When 'inline', renders without portal/backdrop/header — embeds directly in parent layout */
  mode?: 'modal' | 'inline';
  /** Called when user clicks "Generate Card Content" with a detail level from the heading context menu */
  onGenerateCard?: (headingId: string, detailLevel: DetailLevel, headingText: string) => void;
  /** When true, closing always shows a confirmation dialog (used for new custom cards) */
  isCustomCard?: boolean;
  /** Called when user discards a custom card — removes the heading entirely */
  onDiscardCustomCard?: () => void;
  /** Called when user saves a custom card with a chosen name — renames the heading */
  onSaveCustomCard?: (name: string) => void;
  /** Existing heading names for duplicate validation */
  existingCardNames?: string[];
}

/** Imperative handle exposed to parent for unsaved-changes gating */
export interface DocumentEditorHandle {
  isDirty: boolean;
  save: () => void;
  discard: () => void;
}

// ── Context Menu State ──
interface ContextMenuState {
  x: number;
  y: number;
  headingId: string;
}

const DocumentEditorModal = forwardRef<DocumentEditorHandle, DocumentEditorModalProps>(({ document: doc, onSave, onClose, mode = 'modal', onGenerateCard, isCustomCard, onDiscardCustomCard, onSaveCustomCard, existingCardNames }, handleRef) => {
  const isInline = mode === 'inline';
  const editorRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const editorObserverRef = useRef<MutationObserver | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // ── Sidebar state ──
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [levelSubmenuOpen, setLevelSubmenuOpen] = useState(false);
  const [generateContentSubmenuOpen, setGenerateContentSubmenuOpen] = useState(false);
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(null);
  const [generatingHeadingId, setGeneratingHeadingId] = useState<string | null>(null);

  // Find/replace hook (shares editorObserverRef with editing hook)
  const findReplace = useDocumentFindReplace(editorRef, scrollContainerRef, editorObserverRef);

  // Editing hook (populates editorObserverRef, uses find/replace callbacks)
  const editing = useDocumentEditing({
    editorRef,
    editorObserverRef,
    initialContent: doc.content || '',
    onSave,
    closeFindBar: findReplace.closeFindBar,
    clearFindHighlights: findReplace.clearFindHighlights,
  });

  const { headings } = editing;

  // ── Expose imperative handle for parent unsaved-changes gating ──
  useImperativeHandle(handleRef, () => ({
    get isDirty() { return editing.isDirty; },
    save: () => editing.saveEdits(),
    discard: () => editing.discardEdits(),
  }), [editing.isDirty, editing.saveEdits, editing.discardEdits]);

  // ── Close context menu on click outside or Escape ──
  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
        setLevelSubmenuOpen(false);
        setGenerateContentSubmenuOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setContextMenu(null);
        setLevelSubmenuOpen(false);
        setGenerateContentSubmenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [contextMenu]);

  // ── Sidebar helpers ──
  const closeMenu = useCallback(() => {
    setContextMenu(null);
    setLevelSubmenuOpen(false);
    setGenerateContentSubmenuOpen(false);
  }, []);

  const toggleCollapse = useCallback((id: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const hasChildren = (index: number): boolean => {
    if (index >= headings.length - 1) return false;
    return headings[index + 1].level > headings[index].level;
  };

  const isHidden = (index: number): boolean => {
    const heading = headings[index];
    for (let i = index - 1; i >= 0; i--) {
      if (headings[i].level < heading.level) {
        if (collapsed.has(headings[i].id)) return true;
      }
    }
    return false;
  };

  const expandAll = () => { setCollapsed(new Set()); closeMenu(); };
  const collapseAll = () => {
    const all = new Set<string>();
    headings.forEach((h, i) => { if (hasChildren(i)) all.add(h.id); });
    setCollapsed(all);
    closeMenu();
  };

  const handleHeadingClick = (id: string) => {
    setActiveHeadingId(id);
    editing.scrollToHeading(id);
  };

  const handleContextMenu = (e: React.MouseEvent, headingId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setLevelSubmenuOpen(false);
    setGenerateContentSubmenuOpen(false);
    setContextMenu({ x: e.clientX, y: e.clientY, headingId });
  };

  // ── Context heading info ──
  const getContextHeading = (): EditorHeading | null => {
    if (!contextMenu) return null;
    return headings.find(h => h.id === contextMenu.headingId) ?? null;
  };
  const contextHeading = getContextHeading();

  // ── Select Heading and Content ──
  const handleSelectHeadingAndContent = () => {
    if (contextMenu) editing.selectHeadingContent(contextMenu.headingId);
    closeMenu();
  };

  // ── Select by Level ──
  const handleSelectLevel = (level: number) => {
    editing.selectByLevel(level);
    closeMenu();
  };

  // ── Multi-select-aware Promote / Demote ──
  // When right-clicked heading is selected and multiple are selected, act on all selected
  const getPromoteDemoteIds = (): string[] => {
    if (!contextMenu) return [];
    const clickedHeading = headings.find(h => h.id === contextMenu.headingId);
    if (clickedHeading?.selected) {
      const selectedIds = headings.filter(h => h.selected).map(h => h.id);
      if (selectedIds.length > 1) return selectedIds;
    }
    return [contextMenu.headingId];
  };

  const getAffectedLevels = (): { min: number; max: number } => {
    if (!contextMenu) return { min: 1, max: 6 };
    const ids = getPromoteDemoteIds();
    let min = 6, max = 1;
    for (const id of ids) {
      const idx = headings.findIndex(h => h.id === id);
      if (idx === -1) continue;
      const parentLevel = headings[idx].level;
      min = Math.min(min, parentLevel);
      max = Math.max(max, parentLevel);
      // Include descendants
      for (let i = idx + 1; i < headings.length; i++) {
        if (headings[i].level <= parentLevel) break;
        min = Math.min(min, headings[i].level);
        max = Math.max(max, headings[i].level);
      }
    }
    return { min, max };
  };
  const affectedLevels = contextMenu ? getAffectedLevels() : { min: 1, max: 6 };
  const canPromote = affectedLevels.min > 1;
  const canDemote = affectedLevels.max < 6;

  const handlePromote = () => {
    if (!contextMenu) return;
    const ids = getPromoteDemoteIds();
    // For each id, promote it + its children
    for (const id of ids) {
      const idx = headings.findIndex(h => h.id === id);
      if (idx === -1) continue;
      editing.changeHeadingLevel(id, 'promote');
      const parentLevel = headings[idx].level;
      for (let i = idx + 1; i < headings.length; i++) {
        if (headings[i].level <= parentLevel) break;
        // Only promote children if they aren't already in the ids list (avoid double-promote)
        if (!ids.includes(headings[i].id)) {
          editing.changeHeadingLevel(headings[i].id, 'promote');
        }
      }
    }
    closeMenu();
  };

  const handleDemote = () => {
    if (!contextMenu) return;
    const ids = getPromoteDemoteIds();
    for (const id of ids) {
      const idx = headings.findIndex(h => h.id === id);
      if (idx === -1) continue;
      editing.changeHeadingLevel(id, 'demote');
      const parentLevel = headings[idx].level;
      for (let i = idx + 1; i < headings.length; i++) {
        if (headings[i].level <= parentLevel) break;
        if (!ids.includes(headings[i].id)) {
          editing.changeHeadingLevel(headings[i].id, 'demote');
        }
      }
    }
    closeMenu();
  };

  // ── Save & close / Discard & close ──
  // The only way to exit the editor is via the toolbar Save or Discard buttons.
  // No X button or Escape key — forces an explicit save-or-discard decision.
  const handleSaveAndClose = useCallback(() => {
    editing.saveEdits();
    onClose();
  }, [editing.saveEdits, onClose]);

  // Discard: if dirty, show in-app confirmation dialog; if clean, close immediately
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);

  const handleDiscardAndClose = useCallback(() => {
    if (isCustomCard || editing.isDirty) {
      setShowUnsavedDialog(true);
      return;
    }
    onClose();
  }, [editing.isDirty, onClose, isCustomCard]);

  const confirmDiscard = useCallback(() => {
    setShowUnsavedDialog(false);
    editing.discardEdits();
    if (isCustomCard && onDiscardCustomCard) {
      onDiscardCustomCard();
    }
    onClose();
  }, [editing.discardEdits, onClose, isCustomCard, onDiscardCustomCard]);

  const confirmSave = useCallback(() => {
    setShowUnsavedDialog(false);
    editing.saveEdits();
    onClose();
  }, [editing.saveEdits, onClose]);

  // Wrap keydown to intercept Ctrl+S so it triggers save
  const handleEditorKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      editing.saveEdits();
      return;
    }
    editing.handleKeyDown(e);
  }, [editing.handleKeyDown, editing.saveEdits]);

  // ── Heading styling (matches StructureView) ──
  const indentClasses = ['ml-0', 'ml-4', 'ml-8', 'ml-12', 'ml-16', 'ml-20'];
  const textStyles = [
    'text-[13px] font-bold text-zinc-900',
    'text-[12px] font-semibold text-zinc-700',
    'text-[11px] font-medium text-zinc-500',
    'text-[11px] font-normal text-zinc-400',
    'text-[10px] font-normal text-zinc-400',
    'text-[10px] font-normal text-zinc-400',
  ];

  // ── Shared editor body (used in both modal and inline modes) ──
  const editorBody = (
    <>
      {/* Format Toolbar */}
      <div className="shrink-0 flex items-center justify-center py-1.5 border-b border-zinc-50">
        <FormatToolbar
          activeFormats={editing.activeFormats}
          executeCommand={editing.executeCommand}
          insertTable={editing.insertTable}
          showFind={findReplace.showFind}
          setShowFind={findReplace.setShowFind}
          findInputRef={findReplace.findInputRef}
          isDirty={editing.isDirty}
          onSave={() => editing.saveEdits()}
          hasContent={true}
        />
      </div>

      {/* Find/Replace Bar */}
      {findReplace.showFind && (
        <div className="shrink-0 border-b border-zinc-100">
          <FindReplaceBar
            findInputRef={findReplace.findInputRef}
            findQuery={findReplace.findQuery}
            setFindQuery={findReplace.setFindQuery}
            replaceQuery={findReplace.replaceQuery}
            setReplaceQuery={findReplace.setReplaceQuery}
            findMatchCount={findReplace.findMatchCount}
            findActiveIndex={findReplace.findActiveIndex}
            setFindActiveIndex={findReplace.setFindActiveIndex}
            findMatchCase={findReplace.findMatchCase}
            setFindMatchCase={findReplace.setFindMatchCase}
            findNext={findReplace.findNext}
            findPrev={findReplace.findPrev}
            closeFindBar={findReplace.closeFindBar}
            handleReplace={findReplace.handleReplace}
            handleReplaceAll={findReplace.handleReplaceAll}
          />
        </div>
      )}

      {/* Main content: Sidebar + Editor */}
      <div className="flex-1 flex overflow-hidden">
        {/* Heading Sidebar */}
        <aside className={`${sidebarOpen ? 'w-[220px]' : 'w-[40px]'} shrink-0 border-r border-zinc-100 overflow-y-auto bg-[#fafafa] transition-all duration-200`}>
          <button
            onClick={() => setSidebarOpen(prev => !prev)}
            className="px-3 pt-3 pb-1 text-zinc-400 hover:text-zinc-600 transition-colors cursor-pointer"
            title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
            </svg>
          </button>
          {sidebarOpen && <div className="px-2 pb-20">
            {headings.map((heading, index) => {
              if (isHidden(index)) return null;
              const level = Math.min(heading.level, 6);
              const isActive = activeHeadingId === heading.id;
              const isSelected = heading.selected;
              const isCollapsible = hasChildren(index);
              const isCollapsed = collapsed.has(heading.id);
              const indent = indentClasses[level - 1] || 'ml-0';
              const textStyle = textStyles[level - 1] || textStyles[5];

              return (
                <div key={heading.id}>
                  {level === 1 && index > 0 && (
                    <div className="h-px bg-zinc-200 mb-1 mt-2 ml-1" />
                  )}
                  <div
                    onClick={() => handleHeadingClick(heading.id)}
                    onContextMenu={(e) => handleContextMenu(e, heading.id)}
                    className={`
                      ${indent} group relative flex items-center space-x-1 py-1 px-1 transition-all duration-300 cursor-pointer rounded-lg
                      ${isActive ? 'sidebar-node-active' : 'hover:translate-x-1'}
                      ${isSelected ? 'bg-[rgba(204,255,0,0.15)]' : ''}
                    `}
                  >
                    {isCollapsible ? (
                      <div
                        onClick={(e) => { e.stopPropagation(); toggleCollapse(heading.id); }}
                        className="flex-shrink-0 w-4 h-4 flex items-center justify-center text-zinc-300 hover:text-zinc-500 transition-all duration-200 cursor-pointer"
                      >
                        <svg
                          width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                          className={`transition-transform duration-200 ${isCollapsed ? '' : 'rotate-90'}`}
                        >
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </div>
                    ) : (
                      <div className="flex-shrink-0 w-4 h-4" />
                    )}

                    {generatingHeadingId === heading.id ? (
                      <div className="flex-shrink-0 w-3.5 h-3.5 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" />
                    ) : isSelected ? (
                      <div className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-acid-lime shadow-[0_0_6px_rgba(204,255,0,0.6)]" />
                    ) : null}

                    <span
                      className={`${textStyle} transition-all select-none truncate pr-2 ml-0.5`}
                      style={{ opacity: isActive || isSelected || generatingHeadingId === heading.id ? 1 : 0.7 }}
                    >
                      {heading.text}
                    </span>
                  </div>
                </div>
              );
            })}
            {headings.length === 0 && (
              <p className="text-[10px] text-zinc-300 px-2 py-4 text-center">No headings</p>
            )}
          </div>}
        </aside>

        {/* Scrollable Editor Area */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-4 py-6">
            <div
              ref={editorRef}
              contentEditable
              onKeyDown={handleEditorKeyDown}
              onInput={editing.updateActiveFormatStates}
              className="document-prose chat-prose min-h-[70vh] pb-40 outline-none"
            />
          </div>
        </div>
      </div>
    </>
  );

  // ── Context Menu (rendered as portal in both modes for correct positioning) ──
  const contextMenuEl = contextMenu && contextHeading ? createPortal(
    <div
      ref={menuRef}
      className="fixed z-[130] min-w-[180px] bg-white rounded-[6px] border border-black py-1 animate-in fade-in zoom-in-95 duration-150"
      style={{
        top: contextMenu.y,
        left: contextMenu.x,
      }}
    >
      {onGenerateCard && (
        <>
          <div className="relative">
            <button
              onClick={() => setGenerateContentSubmenuOpen(prev => !prev)}
              onMouseEnter={() => setGenerateContentSubmenuOpen(true)}
              className="w-full text-left px-3 py-2 text-[11px] font-bold text-black hover:bg-zinc-50 transition-colors flex items-center justify-between"
            >
              <span className="flex items-center gap-2">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400">
                  <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M12 8v8" /><path d="M8 12h8" />
                </svg>
                Generate Card Content
              </span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-300">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>

            {generateContentSubmenuOpen && (
              <div
                className="absolute left-full top-0 ml-1 min-w-[120px] bg-white rounded-[6px] border border-black py-1 animate-in fade-in zoom-in-95 duration-100"
              >
                {(['Executive', 'Standard', 'Detailed'] as DetailLevel[]).map(level => (
                  <button
                    key={level}
                    onClick={async () => {
                      const hId = contextMenu.headingId;
                      const hText = contextHeading?.text || '';
                      closeMenu();
                      setGeneratingHeadingId(hId);
                      try {
                        await onGenerateCard(hId, level, hText);
                      } finally {
                        setGeneratingHeadingId(null);
                      }
                    }}
                    className="w-full text-left px-3 py-2 text-[11px] text-black hover:bg-zinc-50 transition-colors flex items-center gap-2"
                  >
                    <span className="w-10 h-4 rounded bg-zinc-100 text-[9px] font-bold text-zinc-500 flex items-center justify-center">
                      {level === 'Executive' ? 'Exec' : level === 'Standard' ? 'Std' : 'Detail'}
                    </span>
                    {level}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="h-px bg-zinc-100 my-1" />
        </>
      )}

      <button
        onClick={handleSelectHeadingAndContent}
        className="w-full text-left px-3 py-2 text-[11px] text-black hover:bg-zinc-50 transition-colors flex items-center gap-2"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400">
          <path d="M5 3a2 2 0 0 0-2 2"/><path d="M19 3a2 2 0 0 1 2 2"/><path d="M21 19a2 2 0 0 1-2 2"/><path d="M5 21a2 2 0 0 1-2-2"/><path d="M9 3h1"/><path d="M9 21h1"/><path d="M14 3h1"/><path d="M14 21h1"/><path d="M3 9v1"/><path d="M21 9v1"/><path d="M3 14v1"/><path d="M21 14v1"/>
        </svg>
        Select Heading and Content
      </button>

      <div className="h-px bg-zinc-100 my-1" />

      <button
        onClick={handlePromote}
        disabled={!canPromote}
        className={`w-full text-left px-3 py-2 text-[11px] hover:bg-zinc-50 transition-colors flex items-center gap-2 ${canPromote ? 'text-black' : 'text-zinc-300 pointer-events-none'}`}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={canPromote ? 'text-zinc-400' : 'text-zinc-200'}>
          <path d="m15 18-6-6 6-6"/>
        </svg>
        Promote
        <span className={`ml-auto text-[9px] ${canPromote ? 'text-zinc-400' : 'text-zinc-200'}`}>H{contextHeading.level}→H{Math.max(1, contextHeading.level - 1)}</span>
      </button>

      <button
        onClick={handleDemote}
        disabled={!canDemote}
        className={`w-full text-left px-3 py-2 text-[11px] hover:bg-zinc-50 transition-colors flex items-center gap-2 ${canDemote ? 'text-black' : 'text-zinc-300 pointer-events-none'}`}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={canDemote ? 'text-zinc-400' : 'text-zinc-200'}>
          <path d="m9 18 6-6-6-6"/>
        </svg>
        Demote
        <span className={`ml-auto text-[9px] ${canDemote ? 'text-zinc-400' : 'text-zinc-200'}`}>H{contextHeading.level}→H{Math.min(6, contextHeading.level + 1)}</span>
      </button>

      <div className="h-px bg-zinc-100 my-1" />

      <button
        onClick={expandAll}
        className="w-full text-left px-3 py-2 text-[11px] text-black hover:bg-zinc-50 transition-colors flex items-center gap-2"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400">
          <polyline points="6 9 12 15 18 9" />
        </svg>
        Expand All
      </button>

      <button
        onClick={collapseAll}
        className="w-full text-left px-3 py-2 text-[11px] text-black hover:bg-zinc-50 transition-colors flex items-center gap-2"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400">
          <polyline points="18 15 12 9 6 15" />
        </svg>
        Collapse All
      </button>

      <div className="h-px bg-zinc-100 my-1" />

      <div className="relative">
        <button
          onClick={() => setLevelSubmenuOpen(prev => !prev)}
          onMouseEnter={() => setLevelSubmenuOpen(true)}
          className="w-full text-left px-3 py-2 text-[11px] text-black hover:bg-zinc-50 transition-colors flex items-center justify-between"
        >
          <span className="flex items-center gap-2">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400">
              <line x1="21" y1="10" x2="7" y2="10" /><line x1="21" y1="6" x2="3" y2="6" /><line x1="21" y1="14" x2="3" y2="14" /><line x1="21" y1="18" x2="7" y2="18" />
            </svg>
            Select Heading Levels
          </span>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-300">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>

        {levelSubmenuOpen && (
          <div
            className="absolute left-full top-0 ml-1 min-w-[100px] bg-white rounded-[6px] border border-black py-1 animate-in fade-in zoom-in-95 duration-100"
          >
            {[1, 2, 3].map(lvl => (
              <button
                key={lvl}
                onClick={() => handleSelectLevel(lvl)}
                className="w-full text-left px-3 py-2 text-[11px] text-black hover:bg-zinc-50 transition-colors flex items-center gap-2"
              >
                <span className="w-5 h-4 rounded bg-zinc-100 text-[9px] font-bold text-zinc-500 flex items-center justify-center">
                  H{lvl}
                </span>
                Level {lvl}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body,
  ) : null;

  // ── Inline mode: render directly without portal ──
  if (isInline) {
    return (
      <div className="flex flex-col flex-1 overflow-hidden">
        {editorBody}
        {contextMenuEl}
        {showUnsavedDialog && (
          <UnsavedChangesDialog
            onSave={confirmSave}
            onDiscard={confirmDiscard}
            onCancel={() => setShowUnsavedDialog(false)}
          />
        )}
      </div>
    );
  }

  // ── Modal mode: render in portal with backdrop ──
  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="flex flex-col w-full h-full max-w-6xl max-h-[94vh] my-[3vh] mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="shrink-0 h-[44px] flex items-center justify-between px-5 border-b border-zinc-100">
          <div className="flex items-center gap-2.5 min-w-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a1a1aa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <span className="text-sm text-zinc-700 truncate font-medium" title={doc.name}>{doc.name}</span>
            {editing.isDirty && (
              <span className="text-[9px] text-amber-500 font-medium uppercase tracking-wider">Unsaved</span>
            )}
          </div>
          <button
            onClick={handleDiscardAndClose}
            title="Close"
            className="shrink-0 p-1 rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" /><path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        {editorBody}
      </div>

      {contextMenuEl}

      {showUnsavedDialog && (
        <UnsavedChangesDialog
          onSave={confirmSave}
          onDiscard={confirmDiscard}
          onCancel={() => setShowUnsavedDialog(false)}
          {...(isCustomCard ? {
            title: 'Custom card',
            description: 'Name your card and save it to the cards list, or discard it.',
            saveLabel: 'Save and Add to Cards',
            discardLabel: 'Discard Changes',
            nameInput: {
              defaultName: doc.name,
              existingNames: existingCardNames || [],
              onSaveWithName: (name: string) => {
                setShowUnsavedDialog(false);
                editing.saveEdits();
                onSaveCustomCard?.(name);
                onClose();
              },
            },
          } : {})}
        />
      )}
    </div>,
    document.body,
  );
});

export default DocumentEditorModal;
