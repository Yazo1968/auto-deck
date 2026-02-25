import React, { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { createPortal } from 'react-dom';
import { BookmarkNode, DetailLevel, Heading, UploadedFile } from '../types';
import DocumentEditorModal, { DocumentEditorHandle } from './DocumentEditorModal';
import PdfBookmarkEditor from './PdfBookmarkEditor';
import PanelRequirements from './PanelRequirements';
import { UnsavedChangesDialog } from './Dialogs';
import { PanelEditorHandle } from './CardsPanel';
import PdfViewer, { PdfViewerHandle } from './PdfViewer';
import { useThemeContext } from '../context/ThemeContext';
import { useNuggetContext } from '../context/NuggetContext';
import { flattenBookmarks, headingsToBookmarks } from '../utils/pdfBookmarks';
import { usePanelOverlay } from '../hooks/usePanelOverlay';

interface SourcesPanelProps {
  isOpen: boolean;
  onToggle: () => void;
  documents: UploadedFile[];
  onSaveDocument: (docId: string, newContent: string) => void;
  onGenerateCardContent?: (cardId: string, detailLevel: DetailLevel, cardText: string, sourceDocName?: string) => void;
  /** IDs of headings / '__whole_document__' currently generating content (lifted from App.tsx to survive panel collapse). */
  generatingSourceIds?: Set<string>;
  /** Update the heading/bookmark structure for a native PDF document. */
  onUpdateDocumentStructure?: (docId: string, newStructure: Heading[]) => void;
  /** Save TOC / bookmark changes. */
  onSaveToc?: (docId: string, newStructure: Heading[]) => Promise<void>;
  /** Save bookmarks directly (for PdfBookmarkEditor). */
  onSaveBookmarks?: (docId: string, bookmarks: BookmarkNode[]) => void;
  /** Regenerate bookmarks with AI (Gemini heading extraction). */
  onRegenerateBookmarks?: (docId: string) => Promise<void>;
  /** Notify parent when TOC draft state changes (for hard lock overlay). */
  onDirtyChange?: (isDirty: boolean) => void;
}

const SourcesPanel = forwardRef<PanelEditorHandle, SourcesPanelProps>(
  (
    {
      isOpen,
      onToggle,
      documents,
      onSaveDocument,
      onGenerateCardContent,
      generatingSourceIds,
      onUpdateDocumentStructure: _onUpdateDocumentStructure,
      onSaveToc,
      onSaveBookmarks,
      onRegenerateBookmarks,
      onDirtyChange,
    },
    ref,
  ) => {
    const { darkMode } = useThemeContext();
    const { selectedDocumentId, setSelectedDocumentId } = useNuggetContext();
    const { stripRef, shouldRender, handleResizeStart, overlayStyle } = usePanelOverlay({
      isOpen,
      defaultWidth: Math.min(window.innerWidth * 0.6, 1000),
      minWidth: 300,
    });
    const [activeDocTab, setActiveDocTab] = useState<string | null>(null);
    const editorHandleRef = useRef<DocumentEditorHandle>(null);

    // ── TOC draft mode (transactional save/discard) — declared early for useImperativeHandle ──
    const [tocDraft, setTocDraft] = useState<Heading[] | null>(null);
    const [tocDirtyDocId, setTocDirtyDocId] = useState<string | null>(null);

    useImperativeHandle(
      ref,
      () => ({
        get isDirty() {
          return (editorHandleRef.current?.isDirty ?? false) || tocDraft !== null;
        },
        save: () => {
          editorHandleRef.current?.save();
          if (tocDraft && tocDirtyDocId) {
            onSaveToc?.(tocDirtyDocId, tocDraft);
            setTocDraft(null);
            setTocDirtyDocId(null);
          }
        },
        discard: () => {
          editorHandleRef.current?.discard();
          setTocDraft(null);
          setTocDirtyDocId(null);
        },
      }),
      [tocDraft, tocDirtyDocId, onSaveToc],
    );

    // ── Native PDF TOC state ──
    const [tocWidth, setTocWidth] = useState(220);
    const isDraggingToc = useRef(false);
    const handleTocResizeStart = useCallback(
      (e: React.MouseEvent) => {
        e.preventDefault();
        isDraggingToc.current = true;
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'ew-resize';
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;cursor:ew-resize;';
        document.body.appendChild(overlay);
        const startX = e.clientX;
        const startW = tocWidth;
        const onMove = (ev: MouseEvent) => {
          if (!isDraggingToc.current) return;
          setTocWidth(Math.max(140, Math.min(480, startW + ev.clientX - startX)));
        };
        const onUp = () => {
          isDraggingToc.current = false;
          document.body.style.userSelect = '';
          document.body.style.cursor = '';
          overlay.remove();
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      },
      [tocWidth],
    );
    const [pdfCollapsed, setPdfCollapsed] = useState<Set<string>>(new Set());
    const [pdfContextMenu, setPdfContextMenu] = useState<{ x: number; y: number; headingId: string } | null>(null);
    const [pdfDocContextMenu, setPdfDocContextMenu] = useState<{ x: number; y: number } | null>(null);
    const [pdfGenerateSubmenuOpen, setPdfGenerateSubmenuOpen] = useState(false);
    const [pdfDocGenerateSubmenuOpen, setPdfDocGenerateSubmenuOpen] = useState(false);
    // Spinner state derived from lifted App.tsx state (survives panel collapse)
    const pdfGeneratingIds = generatingSourceIds ?? new Set<string>();
    const pdfGeneratingDoc = generatingSourceIds?.has('__whole_document__') ?? false;
    const pdfMenuRef = useRef<HTMLDivElement>(null);
    // PDF viewer controls
    const [pdfScale, setPdfScale] = useState(1.0);
    const [pdfRotation, setPdfRotation] = useState(0);
    const [pdfPageInfo, setPdfPageInfo] = useState({ current: 1, total: 0 });
    const [pdfFitMode, setPdfFitMode] = useState<'height' | 'width' | null>('height');
    const [activePdfHeadingId, setActivePdfHeadingId] = useState<string | null>(null);
    const pdfViewerRef = useRef<PdfViewerHandle>(null);

    // ── Bookmark creation state ──
    const [selectedPdfText, setSelectedPdfText] = useState<{ text: string; page: number } | null>(null);
    const [bookmarkLevel, setBookmarkLevel] = useState(1);
    const [bookmarkLevelDropdownOpen, setBookmarkLevelDropdownOpen] = useState(false);
    // ── Multi-selection state (Tier 2) ──
    const [pdfSelectedIds, setPdfSelectedIds] = useState<Set<string>>(new Set());
    // ── Inline rename state ──
    const [renamingHeadingId, setRenamingHeadingId] = useState<string | null>(null);
    // ── Level selection submenu ──
    const [pdfLevelSubmenuOpen, setPdfLevelSubmenuOpen] = useState(false);
    // ── Bookmark editor state ──
    const [bookmarkEditorOpen, setBookmarkEditorOpen] = useState(false);
    const [isRegeneratingBookmarks, setIsRegeneratingBookmarks] = useState(false);
    // Notify parent of TOC dirty state for hard lock overlay
    useEffect(() => {
      onDirtyChange?.(tocDraft !== null);
    }, [tocDraft, onDirtyChange]);

    // Reset draft when switching documents
    useEffect(() => {
      setTocDraft(null);
      setTocDirtyDocId(null);
    }, [activeDocTab]);

    // Apply fit mode whenever page info changes (initial load / page switch)
    const applyFitMode = useCallback((mode: 'height' | 'width' | null) => {
      if (!mode || !pdfViewerRef.current) return;
      const dims = pdfViewerRef.current.getFitDims();
      if (!dims) return;
      const padding = 16; // 8px padding on each side
      if (mode === 'width') {
        setPdfScale(+((dims.containerWidth - padding) / dims.pageWidth).toFixed(4));
      } else {
        setPdfScale(+((dims.containerHeight - padding) / dims.pageHeight).toFixed(4));
      }
    }, []);

    // ── Document list popup state (hover + locked, like kebab menus) ──
    const [docListOpen, setDocListOpen] = useState(false);
    const [docListMode, setDocListMode] = useState<'hover' | 'locked'>('hover');
    const docToggleRef = useRef<HTMLDivElement>(null);
    const docListRef = useRef<HTMLDivElement>(null);

    // Close doc list popup on outside click (only when locked)
    useEffect(() => {
      if (!docListOpen || docListMode !== 'locked') return;
      const handleClick = (e: MouseEvent) => {
        const target = e.target as Node;
        if (docToggleRef.current && docToggleRef.current.contains(target)) return;
        if (docListRef.current && docListRef.current.contains(target)) return;
        setDocListOpen(false);
      };
      window.addEventListener('mousedown', handleClick);
      return () => window.removeEventListener('mousedown', handleClick);
    }, [docListOpen, docListMode]);

    // ── Unsaved-changes gating ──
    const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

    const gatedAction = useCallback(
      (action: () => void) => {
        if (editorHandleRef.current?.isDirty || tocDraft !== null) {
          setPendingAction(() => action);
          return;
        }
        action();
      },
      [tocDraft],
    );

    // ── Gated wrapper for panel toggle ──
    const handleToggle = useCallback(() => {
      gatedAction(() => onToggle());
    }, [gatedAction, onToggle]);

    // Auto-select first document tab when documents change
    useEffect(() => {
      if (documents.length > 0 && (!activeDocTab || !documents.some((d) => d.id === activeDocTab))) {
        const firstDocId = documents[0].id;
        setActiveDocTab(firstDocId);
        setSelectedDocumentId(firstDocId);
      }
    }, [documents, activeDocTab, setSelectedDocumentId]);

    // Switch to requested document (from Projects panel "Open" action)
    useEffect(() => {
      if (selectedDocumentId && documents.some((d) => d.id === selectedDocumentId)) {
        setActiveDocTab(selectedDocumentId);
      }
    }, [selectedDocumentId, documents]);

    // ── Native PDF TOC context menu — close on outside click ──
    useEffect(() => {
      if (!pdfContextMenu && !pdfDocContextMenu) return;
      const handler = () => {
        setPdfContextMenu(null);
        setPdfDocContextMenu(null);
        setPdfGenerateSubmenuOpen(false);
        setPdfDocGenerateSubmenuOpen(false);
      };
      const timer = setTimeout(() => document.addEventListener('mousedown', handler), 0);
      return () => {
        clearTimeout(timer);
        document.removeEventListener('mousedown', handler);
      };
    }, [pdfContextMenu, pdfDocContextMenu]);

    // Reposition menu if it overflows the viewport
    useEffect(() => {
      if ((!pdfContextMenu && !pdfDocContextMenu) || !pdfMenuRef.current) return;
      const rect = pdfMenuRef.current.getBoundingClientRect();
      const pos = pdfContextMenu || pdfDocContextMenu!;
      let { x, y } = pos;
      if (y + rect.height > window.innerHeight - 8) y = window.innerHeight - rect.height - 8;
      if (x + rect.width > window.innerWidth - 8) x = window.innerWidth - rect.width - 8;
      if (y !== pos.y || x !== pos.x) {
        if (pdfContextMenu) setPdfContextMenu({ ...pdfContextMenu, x, y });
        else setPdfDocContextMenu({ x, y });
      }
    }, [pdfContextMenu, pdfDocContextMenu]);

    const closePdfMenu = useCallback(() => {
      setPdfContextMenu(null);
      setPdfDocContextMenu(null);
      setPdfGenerateSubmenuOpen(false);
      setPdfDocGenerateSubmenuOpen(false);
      setPdfLevelSubmenuOpen(false);
    }, []);

    // Close bookmark level dropdown on outside click
    useEffect(() => {
      if (!bookmarkLevelDropdownOpen) return;
      const handler = () => setBookmarkLevelDropdownOpen(false);
      const timer = setTimeout(() => document.addEventListener('mousedown', handler), 0);
      return () => {
        clearTimeout(timer);
        document.removeEventListener('mousedown', handler);
      };
    }, [bookmarkLevelDropdownOpen]);

    // ── PDF Bookmark CRUD helpers ──

    const getPdfTier2Ids = useCallback((): string[] => {
      const ids = Array.from(pdfSelectedIds);
      if (ids.length > 0) return ids;
      if (pdfContextMenu) return [pdfContextMenu.headingId];
      return [];
    }, [pdfSelectedIds, pdfContextMenu]);

    const getPdfAffectedLevels = useCallback(
      (headings: Heading[]): { min: number; max: number } => {
        if (!pdfContextMenu) return { min: 1, max: 6 };
        const ids = getPdfTier2Ids();
        let min = 6,
          max = 1;
        for (const id of ids) {
          const idx = headings.findIndex((h) => h.id === id);
          if (idx === -1) continue;
          const parentLevel = headings[idx].level;
          min = Math.min(min, parentLevel);
          max = Math.max(max, parentLevel);
          for (let i = idx + 1; i < headings.length; i++) {
            if (headings[i].level <= parentLevel) break;
            min = Math.min(min, headings[i].level);
            max = Math.max(max, headings[i].level);
          }
        }
        return { min, max };
      },
      [pdfContextMenu, getPdfTier2Ids],
    );

    const _handlePdfPromote = useCallback(
      (activeDoc: UploadedFile) => {
        const headings = tocDraft ?? activeDoc.structure ?? [];
        const ids = getPdfTier2Ids();
        const newHeadings = headings.map((h) => ({ ...h }));
        for (const id of ids) {
          const idx = newHeadings.findIndex((h) => h.id === id);
          if (idx === -1) continue;
          const parentLevel = newHeadings[idx].level;
          newHeadings[idx].level = Math.max(1, parentLevel - 1);
          for (let i = idx + 1; i < newHeadings.length; i++) {
            if (newHeadings[i].level <= parentLevel) break;
            if (!ids.includes(newHeadings[i].id)) {
              newHeadings[i].level = Math.max(1, newHeadings[i].level - 1);
            }
          }
        }
        setTocDraft(newHeadings);
        if (!tocDirtyDocId) setTocDirtyDocId(activeDoc.id);
        closePdfMenu();
      },
      [getPdfTier2Ids, tocDraft, tocDirtyDocId, closePdfMenu],
    );

    const _handlePdfDemote = useCallback(
      (activeDoc: UploadedFile) => {
        const headings = tocDraft ?? activeDoc.structure ?? [];
        const ids = getPdfTier2Ids();
        const newHeadings = headings.map((h) => ({ ...h }));
        for (const id of ids) {
          const idx = newHeadings.findIndex((h) => h.id === id);
          if (idx === -1) continue;
          const parentLevel = newHeadings[idx].level;
          newHeadings[idx].level = Math.min(6, parentLevel + 1);
          for (let i = idx + 1; i < newHeadings.length; i++) {
            if (newHeadings[i].level <= parentLevel) break;
            if (!ids.includes(newHeadings[i].id)) {
              newHeadings[i].level = Math.min(6, newHeadings[i].level + 1);
            }
          }
        }
        setTocDraft(newHeadings);
        if (!tocDirtyDocId) setTocDirtyDocId(activeDoc.id);
        closePdfMenu();
      },
      [getPdfTier2Ids, tocDraft, tocDirtyDocId, closePdfMenu],
    );

    const _handlePdfDelete = useCallback(
      (activeDoc: UploadedFile) => {
        const headings = tocDraft ?? activeDoc.structure ?? [];
        const idsToDelete = new Set(getPdfTier2Ids());
        const newHeadings = headings.filter((h) => !idsToDelete.has(h.id));
        setTocDraft(newHeadings);
        if (!tocDirtyDocId) setTocDirtyDocId(activeDoc.id);
        setPdfSelectedIds(new Set());
        closePdfMenu();
      },
      [getPdfTier2Ids, tocDraft, tocDirtyDocId, closePdfMenu],
    );

    const handlePdfRename = useCallback(
      (activeDoc: UploadedFile, headingId: string, newText: string) => {
        const headings = tocDraft ?? activeDoc.structure ?? [];
        const newHeadings = headings.map((h) => (h.id === headingId ? { ...h, text: newText.trim() || h.text } : h));
        setTocDraft(newHeadings);
        if (!tocDirtyDocId) setTocDirtyDocId(activeDoc.id);
        setRenamingHeadingId(null);
      },
      [tocDraft, tocDirtyDocId],
    );

    const handlePdfSelectLevel = useCallback(
      (headings: Heading[], levels: number[]) => {
        const levelSet = new Set(levels);
        const currentlySelected = headings.filter((h) => pdfSelectedIds.has(h.id));
        const allAtTheseLevels = currentlySelected.length > 0 && currentlySelected.every((h) => levelSet.has(h.level));
        const targeted = headings.filter((h) => levelSet.has(h.level));
        const allTargetedSelected = targeted.length > 0 && targeted.every((h) => pdfSelectedIds.has(h.id));
        if (allAtTheseLevels && allTargetedSelected) {
          setPdfSelectedIds(new Set());
        } else {
          setPdfSelectedIds(new Set(targeted.map((h) => h.id)));
        }
        closePdfMenu();
      },
      [pdfSelectedIds, closePdfMenu],
    );

    const handleCreateBookmark = useCallback(
      (activeDoc: UploadedFile) => {
        if (!selectedPdfText) return;
        const headings = tocDraft ?? activeDoc.structure ?? [];
        const newHeading: Heading = {
          id: `h-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          level: bookmarkLevel,
          text: selectedPdfText.text.substring(0, 200),
          page: selectedPdfText.page,
          selected: false,
        };
        // Insert sorted by page number
        const newHeadings = [...headings, newHeading].sort((a, b) => (a.page ?? 0) - (b.page ?? 0));
        setTocDraft(newHeadings);
        if (!tocDirtyDocId) setTocDirtyDocId(activeDoc.id);
        setSelectedPdfText(null);
        // Clear browser selection
        window.getSelection()?.removeAllRanges();
      },
      [selectedPdfText, bookmarkLevel, tocDraft, tocDirtyDocId],
    );

    // Helper: check if a heading is visible (not hidden by a collapsed ancestor)
    const isPdfHeadingVisible = useCallback(
      (headings: Heading[], index: number): boolean => {
        const heading = headings[index];
        // Walk backwards to find any ancestor that is collapsed
        for (let i = index - 1; i >= 0; i--) {
          if (headings[i].level < heading.level) {
            // This is a potential ancestor
            if (pdfCollapsed.has(headings[i].id)) return false;
            // Check if this ancestor itself is visible
            if (!isPdfHeadingVisible(headings, i)) return false;
            // Only the nearest ancestor of each level matters
            if (headings[i].level === heading.level - 1) break;
          }
        }
        return true;
      },
      [pdfCollapsed],
    );

    // Helper: check if a heading has children
    const pdfHeadingHasChildren = useCallback((headings: Heading[], index: number): boolean => {
      if (index + 1 >= headings.length) return false;
      return headings[index + 1].level > headings[index].level;
    }, []);

    return (
      <>
        <button
          ref={stripRef}
          data-panel-strip
          onClick={handleToggle}
          className="flex flex-col items-center pt-2 pb-1 overflow-hidden rounded-l-lg shadow-[5px_0_10px_rgba(0,0,0,0.35)] shrink-0 w-10 cursor-pointer -ml-2.5 z-[3] relative"
          style={{ backgroundColor: darkMode ? 'rgb(45,65,85)' : 'rgb(140,180,205)' }}
        >
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
              className="shrink-0 text-white"
            >
              <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
              <path d="M14 2v4a2 2 0 0 0 2 2h4" />
              <path d="M10 9H8" />
              <path d="M16 13H8" />
              <path d="M16 17H8" />
            </svg>
          </div>
          <span
            className="text-[13px] font-bold uppercase tracking-wider text-white mt-2"
            style={{ writingMode: 'vertical-lr', transform: 'rotate(180deg)' } as React.CSSProperties}
          >
            Create Cards from Sources
          </span>
        </button>

        {shouldRender &&
          createPortal(
            <div
              data-panel-overlay
              className="fixed z-[107] flex flex-col bg-white dark:bg-zinc-900 border-4 rounded-r-lg shadow-[5px_0_6px_rgba(0,0,0,0.35)] overflow-hidden"
              style={{
                borderColor: darkMode ? 'rgb(45,65,85)' : 'rgb(140,180,205)',
                ...overlayStyle,
              }}
            >
              {/* Resize handle */}
              <div
                onMouseDown={handleResizeStart}
                className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize z-10 hover:bg-black/10 transition-colors"
              />
              <>
                {/* Document list bar — hover opens, click locks */}
                <div className="shrink-0 border-y border-zinc-100 dark:border-zinc-700">
                  <div
                    ref={docToggleRef}
                    className="flex items-center gap-1.5 px-3 py-1.5 cursor-pointer"
                    onMouseEnter={() => {
                      if (docListOpen && docListMode === 'locked') return;
                      setDocListMode('hover');
                      setDocListOpen(true);
                    }}
                    onMouseLeave={(e) => {
                      if (docListMode === 'locked') return;
                      const related = e.relatedTarget as Node | null;
                      if (docListRef.current && related && docListRef.current.contains(related)) return;
                      setDocListOpen(false);
                    }}
                    onClick={() => {
                      if (docListOpen && docListMode === 'locked') {
                        setDocListOpen(false);
                      } else {
                        setDocListMode('locked');
                        setDocListOpen(true);
                      }
                    }}
                  >
                    <span
                      className="text-[11px] font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400"
                      style={{ textShadow: '0 1px 2px rgba(0,0,0,0.15)' }}
                    >
                      Select Source
                    </span>
                    <span className="text-[9px] text-zinc-500 dark:text-zinc-400 font-light">{documents.length}</span>
                    {/* Chevron icon */}
                    <div className="shrink-0 w-5 h-5 rounded flex items-center justify-center transition-all text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200">
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points={docListOpen ? '18 15 12 9 6 15' : '6 9 12 15 18 9'} />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Document list popup — portaled to body */}
                {docListOpen &&
                  createPortal(
                    <div
                      ref={docListRef}
                      className="fixed z-[120]"
                      style={{
                        ...(docToggleRef.current
                          ? (() => {
                              const r = docToggleRef.current.getBoundingClientRect();
                              return { top: r.bottom, left: r.left };
                            })()
                          : {}),
                      }}
                      onMouseLeave={(e) => {
                        if (docListMode === 'locked') return;
                        const related = e.relatedTarget as Node | null;
                        if (docToggleRef.current && related && docToggleRef.current.contains(related)) return;
                        setDocListOpen(false);
                      }}
                    >
                      {/* Invisible bridge padding on top + left/right, visible content inside */}
                      <div
                        className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-700 py-2 px-1 max-h-[50vh] overflow-y-auto mt-1"
                        style={{ scrollbarWidth: 'thin' as const }}
                      >
                        {documents.length === 0 && (
                          <div className="px-3 py-2">
                            <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-light italic">
                              No documents yet
                            </span>
                          </div>
                        )}

                        {documents.map((doc) => {
                          const isActive = activeDocTab === doc.id;

                          return (
                            <div
                              key={doc.id}
                              className={`relative flex items-center gap-1.5 px-3 py-1.5 cursor-pointer select-none transition-colors rounded-lg ${
                                isActive
                                  ? 'bg-zinc-200 dark:bg-zinc-700 font-medium text-zinc-800 dark:text-zinc-200'
                                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-800 dark:hover:text-zinc-200'
                              }`}
                              onClick={() => {
                                gatedAction(() => {
                                  setActiveDocTab(doc.id);
                                  setSelectedDocumentId(doc.id);
                                });
                              }}
                            >
                              {(doc.status === 'processing' || doc.status === 'uploading') && (
                                <div className="shrink-0 w-3 h-3 border-[1.5px] border-zinc-300 dark:border-zinc-600 border-t-zinc-600 dark:border-t-zinc-400 rounded-full animate-spin" />
                              )}
                              <span className="flex-1 min-w-0 text-[11px] truncate">{doc.name}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>,
                    document.body,
                  )}

                {/* Sources content area */}
                {documents.length > 0 ? (
                  <>
                    {(() => {
                      const activeDoc = documents.find((d) => d.id === activeDocTab);

                      // Debug: log document state for native PDF troubleshooting
                      if (activeDoc) {
                        console.debug(
                          '[SourcesPanel] activeDoc:',
                          activeDoc.name,
                          'sourceType:',
                          activeDoc.sourceType,
                          'hasPdfBase64:',
                          !!activeDoc.pdfBase64,
                          'hasContent:',
                          !!activeDoc.content,
                          'status:',
                          activeDoc.status,
                          'fileId:',
                          activeDoc.fileId,
                        );
                      }

                      // Native PDF: iframe viewer + TOC sidebar with context menus
                      if (activeDoc?.sourceType === 'native-pdf' && activeDoc.pdfBase64) {
                        const headings = tocDraft ?? activeDoc.structure ?? [];
                        return (
                          <div className="flex-1 flex flex-col min-h-0">
                            {/* PDF Toolbar — matches FormatToolbar visual style */}
                            <div className="shrink-0 flex justify-center py-[3px] px-6 lg:px-8 bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-700">
                              <div className="flex items-center gap-0.5 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl rounded-full px-2 py-1">
                                {/* Zoom out */}
                                <button
                                  onClick={() => {
                                    setPdfFitMode(null);
                                    setPdfScale((s) => Math.max(0.5, +(s - 0.25).toFixed(2)));
                                  }}
                                  className="w-7 h-7 rounded-full flex items-center justify-center transition-all hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-800 dark:hover:text-zinc-200 text-zinc-600 dark:text-zinc-400"
                                  title="Zoom out"
                                  aria-label="Zoom out"
                                >
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
                                    <line x1="5" y1="12" x2="19" y2="12" />
                                  </svg>
                                </button>
                                {/* Zoom level */}
                                <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 w-10 text-center tabular-nums">
                                  {Math.round(pdfScale * 100)}%
                                </span>
                                {/* Zoom in */}
                                <button
                                  onClick={() => {
                                    setPdfFitMode(null);
                                    setPdfScale((s) => Math.min(3, +(s + 0.25).toFixed(2)));
                                  }}
                                  className="w-7 h-7 rounded-full flex items-center justify-center transition-all hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-800 dark:hover:text-zinc-200 text-zinc-600 dark:text-zinc-400"
                                  title="Zoom in"
                                  aria-label="Zoom in"
                                >
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
                                </button>
                                <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-700 mx-1" />
                                {/* Fit to page width */}
                                <button
                                  onClick={() => {
                                    setPdfFitMode('width');
                                    applyFitMode('width');
                                  }}
                                  className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${pdfFitMode === 'width' ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200' : 'hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-800 dark:hover:text-zinc-200 text-zinc-600 dark:text-zinc-400'}`}
                                  title="Fit to page width"
                                  aria-label="Fit to page width"
                                >
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
                                    <path d="M21 3H3v18h18V3z" />
                                    <path d="M4 12h16" />
                                    <path d="M7 9l-3 3 3 3" />
                                    <path d="M17 9l3 3-3 3" />
                                  </svg>
                                </button>
                                {/* Fit to page height */}
                                <button
                                  onClick={() => {
                                    setPdfFitMode('height');
                                    applyFitMode('height');
                                  }}
                                  className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${pdfFitMode === 'height' ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200' : 'hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-800 dark:hover:text-zinc-200 text-zinc-600 dark:text-zinc-400'}`}
                                  title="Fit to page height"
                                  aria-label="Fit to page height"
                                >
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
                                    <path d="M21 3H3v18h18V3z" />
                                    <path d="M12 4v16" />
                                    <path d="M9 7l3-3 3 3" />
                                    <path d="M9 17l3 3 3-3" />
                                  </svg>
                                </button>
                                {/* Rotate */}
                                <button
                                  onClick={() => setPdfRotation((r) => (r + 90) % 360)}
                                  className="w-7 h-7 rounded-full flex items-center justify-center transition-all hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-800 dark:hover:text-zinc-200 text-zinc-600 dark:text-zinc-400"
                                  title="Rotate clockwise"
                                  aria-label="Rotate clockwise"
                                >
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
                                    <polyline points="23 4 23 10 17 10" />
                                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                                  </svg>
                                </button>
                                <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-700 mx-1" />
                                {/* Page indicator */}
                                <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 px-1 tabular-nums">
                                  {pdfPageInfo.total > 0 ? `${pdfPageInfo.current} / ${pdfPageInfo.total}` : '–'}
                                </span>
                                <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-700 mx-1" />
                                {/* Bookmark level picker */}
                                <div className="relative">
                                  <button
                                    onClick={() => setBookmarkLevelDropdownOpen((prev) => !prev)}
                                    className="h-7 px-1.5 rounded-full flex items-center gap-0.5 transition-all hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400"
                                    title="Bookmark heading level"
                                  >
                                    <span className="text-[10px] font-bold tabular-nums">H{bookmarkLevel}</span>
                                    <svg
                                      width="8"
                                      height="8"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="3"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    >
                                      <polyline points="6 9 12 15 18 9" />
                                    </svg>
                                  </button>
                                  {bookmarkLevelDropdownOpen && (
                                    <div
                                      className="absolute top-full mt-1 left-0 z-[140] bg-white dark:bg-zinc-900 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-700 py-1 animate-in fade-in zoom-in-95 duration-100"
                                      onMouseDown={(e) => e.stopPropagation()}
                                    >
                                      {[1, 2, 3, 4].map((level) => (
                                        <button
                                          key={level}
                                          onClick={() => {
                                            setBookmarkLevel(level);
                                            setBookmarkLevelDropdownOpen(false);
                                          }}
                                          className={`w-full text-left px-3 py-1.5 text-[11px] hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors flex items-center gap-2 whitespace-nowrap ${bookmarkLevel === level ? 'text-blue-600 font-bold' : 'text-zinc-600 dark:text-zinc-400'}`}
                                        >
                                          <span className="w-5 h-4 rounded bg-zinc-100 dark:bg-zinc-800/50 text-[9px] font-bold flex items-center justify-center">
                                            H{level}
                                          </span>
                                          Heading {level}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                {/* Create Bookmark button */}
                                <button
                                  onClick={() => activeDoc && handleCreateBookmark(activeDoc)}
                                  disabled={!selectedPdfText}
                                  className={`h-7 px-2 rounded-full flex items-center gap-1 transition-all text-[10px] font-semibold ${
                                    selectedPdfText
                                      ? 'bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900 cursor-pointer'
                                      : 'text-zinc-400 dark:text-zinc-500 cursor-not-allowed'
                                  }`}
                                  title={
                                    selectedPdfText
                                      ? `Create bookmark from "${selectedPdfText.text.substring(0, 40)}..."`
                                      : 'Select text in the PDF to create a bookmark'
                                  }
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
                                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                                  </svg>
                                  Bookmark
                                </button>
                                <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-700 mx-1" />
                                {/* Edit Bookmarks button */}
                                <button
                                  onClick={() => setBookmarkEditorOpen((prev) => !prev)}
                                  className={`h-7 px-2 rounded-full flex items-center gap-1 transition-all text-[10px] font-semibold ${
                                    bookmarkEditorOpen
                                      ? 'bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400'
                                      : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-700 dark:hover:text-zinc-300'
                                  }`}
                                  title="Edit PDF bookmarks"
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
                                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                                  </svg>
                                  Edit Bookmarks
                                </button>
                                <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-700 mx-1" />
                                {/* PDF label */}
                                <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-400 px-2">
                                  PDF
                                </span>
                              </div>
                            </div>
                            {/* TOC + PDF content */}
                            <div className="flex-1 flex min-h-0">
                              {/* TOC Sidebar */}
                              <aside
                                className="shrink-0 overflow-y-auto bg-[#fafafa] dark:bg-zinc-900 relative"
                                style={{ width: tocWidth }}
                              >
                                <div className="sticky top-0 z-10 bg-[#d9e8f1] dark:bg-zinc-800">
                                  <div className="px-3 pt-3 pb-1">
                                    <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                                      Table of Contents
                                    </span>
                                  </div>
                                  <div className="px-2">
                                    {/* Document name — with kebab for whole-document card generation */}
                                    <div className="group px-2 py-1.5 mb-1 border-b border-zinc-300/40 dark:border-zinc-700/40 cursor-default">
                                      <div className="flex items-center gap-1.5">
                                        <p
                                          className="flex-1 min-w-0 text-[11px] font-medium truncate text-[rgb(50,90,130)] dark:text-blue-300"
                                          title={activeDoc.name}
                                        >
                                          {activeDoc.name}
                                        </p>
                                        {pdfGeneratingDoc && (
                                          <div className="shrink-0 w-3 h-3 border-[1.5px] border-zinc-300 border-t-blue-500 rounded-full animate-spin" />
                                        )}
                                        {onGenerateCardContent && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setPdfDocContextMenu({ x: e.clientX, y: e.clientY });
                                              setPdfDocGenerateSubmenuOpen(false);
                                            }}
                                            className="shrink-0 w-4 h-4 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity text-zinc-400 dark:text-zinc-400"
                                            aria-label="Document menu"
                                          >
                                            <svg
                                              width="14"
                                              height="14"
                                              viewBox="0 0 24 24"
                                              fill="none"
                                              stroke="currentColor"
                                              strokeWidth="2.5"
                                              strokeLinecap="round"
                                              strokeLinejoin="round"
                                            >
                                              <circle cx="12" cy="5" r="1" />
                                              <circle cx="12" cy="12" r="1" />
                                              <circle cx="12" cy="19" r="1" />
                                            </svg>
                                          </button>
                                        )}
                                      </div>
                                      {activeDoc.tocSource && (
                                        <span className="text-[9px] text-zinc-500 dark:text-zinc-400 font-normal italic mt-0.5 block">
                                          {activeDoc.tocSource === 'toc_page'
                                            ? 'from TOC page'
                                            : 'AI-detected headings'}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="px-2 pb-4" role="tree" aria-label="PDF table of contents">
                                  {headings.length > 0 ? (
                                    headings.map((heading, hIdx) => {
                                      if (!isPdfHeadingVisible(headings, hIdx)) return null;
                                      const pdfIndentClasses = ['ml-0', 'ml-4', 'ml-8', 'ml-12', 'ml-16', 'ml-20'];
                                      const pdfTextStyles = [
                                        'text-[12px] font-bold text-zinc-800 dark:text-zinc-200',
                                        'text-[11px] font-semibold text-zinc-600 dark:text-zinc-400',
                                        'text-[11px] font-medium text-zinc-500 dark:text-zinc-400',
                                        'text-[10px] font-normal text-zinc-500 dark:text-zinc-400',
                                        'text-[10px] font-normal text-zinc-500 dark:text-zinc-400',
                                        'text-[10px] font-normal text-zinc-500 dark:text-zinc-400',
                                      ];
                                      const level = Math.min(heading.level, 6);
                                      const indent = pdfIndentClasses[level - 1] || 'ml-0';
                                      const textStyle = pdfTextStyles[level - 1] || pdfTextStyles[5];
                                      const hasChildren = pdfHeadingHasChildren(headings, hIdx);
                                      const isCollapsed = pdfCollapsed.has(heading.id);
                                      const isGenerating = pdfGeneratingIds.has(heading.id);
                                      const isSelected = pdfSelectedIds.has(heading.id);
                                      const isRenaming = renamingHeadingId === heading.id;
                                      return (
                                        <div
                                          key={heading.id}
                                          role="treeitem"
                                          aria-expanded={hasChildren ? !isCollapsed : undefined}
                                          className={`${indent} group relative flex items-center space-x-1 py-1 px-1 transition-all duration-300 cursor-pointer border border-transparent ${
                                            activePdfHeadingId === heading.id
                                              ? 'sidebar-node-active'
                                              : isSelected
                                                ? 'bg-[rgba(160,200,220,0.2)]'
                                                : 'hover:border-blue-300'
                                          }`}
                                          onClick={() => {
                                            // Tier 1: left-click — set active heading, scroll, clear tier 2
                                            setPdfSelectedIds(new Set());
                                            if (pdfViewerRef.current) {
                                              pdfViewerRef.current.scrollToHeading(
                                                heading.text,
                                                heading.page ?? undefined,
                                              );
                                              setActivePdfHeadingId(heading.id);
                                            }
                                          }}
                                          onContextMenu={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            // Tier 2: right-click selects for batch operations
                                            // If right-clicked heading isn't already tier 2 selected, clear and select just this one
                                            if (!pdfSelectedIds.has(heading.id)) {
                                              setPdfSelectedIds(new Set([heading.id]));
                                            }
                                            setPdfLevelSubmenuOpen(false);
                                            setPdfGenerateSubmenuOpen(false);
                                            setPdfContextMenu({ x: e.clientX, y: e.clientY, headingId: heading.id });
                                          }}
                                        >
                                          {level === 1 && hIdx > 0 && (
                                            <div className="h-px bg-zinc-200 dark:bg-zinc-700 mb-1 mt-2 ml-1" />
                                          )}
                                          {/* Collapse/expand toggle */}
                                          {hasChildren ? (
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setPdfCollapsed((prev) => {
                                                  const next = new Set(prev);
                                                  if (next.has(heading.id)) next.delete(heading.id);
                                                  else next.add(heading.id);
                                                  return next;
                                                });
                                              }}
                                              className="flex-shrink-0 w-4 h-4 flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-all duration-200 cursor-pointer"
                                              aria-label={isCollapsed ? 'Expand section' : 'Collapse section'}
                                            >
                                              <svg
                                                width="12"
                                                height="12"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2.5"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                className={`transition-transform duration-200 ${isCollapsed ? '' : 'rotate-90'}`}
                                              >
                                                <polyline points="9 18 15 12 9 6" />
                                              </svg>
                                            </button>
                                          ) : (
                                            <div className="flex-shrink-0 w-4 h-4" />
                                          )}
                                          {isRenaming ? (
                                            <input
                                              autoFocus
                                              defaultValue={heading.text}
                                              className={`${textStyle} flex-1 min-w-0 bg-white dark:bg-zinc-800 border border-blue-400 rounded px-1 py-0.5 outline-none`}
                                              onBlur={(e) =>
                                                activeDoc && handlePdfRename(activeDoc, heading.id, e.target.value)
                                              }
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter')
                                                  activeDoc &&
                                                    handlePdfRename(
                                                      activeDoc,
                                                      heading.id,
                                                      (e.target as HTMLInputElement).value,
                                                    );
                                                if (e.key === 'Escape') setRenamingHeadingId(null);
                                              }}
                                              onClick={(e) => e.stopPropagation()}
                                            />
                                          ) : (
                                            <span
                                              className={`${textStyle} transition-all select-none truncate pr-2 ml-0.5 flex-1 min-w-0`}
                                              style={{
                                                opacity:
                                                  activePdfHeadingId === heading.id || isSelected || isGenerating
                                                    ? 1
                                                    : 0.7,
                                              }}
                                            >
                                              {heading.text}
                                            </span>
                                          )}
                                          {heading.page != null && (
                                            <span className="shrink-0 text-[8px] text-zinc-400 dark:text-zinc-400 font-light tabular-nums">
                                              {heading.page}
                                            </span>
                                          )}
                                          {isGenerating ? (
                                            <div className="shrink-0 w-3 h-3 border-[1.5px] border-zinc-300 border-t-blue-500 rounded-full animate-spin" />
                                          ) : (
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                if (!pdfSelectedIds.has(heading.id)) {
                                                  setPdfSelectedIds(new Set([heading.id]));
                                                }
                                                setPdfLevelSubmenuOpen(false);
                                                setPdfGenerateSubmenuOpen(false);
                                                setPdfContextMenu({
                                                  x: e.clientX,
                                                  y: e.clientY,
                                                  headingId: heading.id,
                                                });
                                              }}
                                              className={`shrink-0 opacity-0 group-hover:opacity-100 w-4 h-4 rounded flex items-center justify-center transition-opacity ${
                                                activePdfHeadingId === heading.id
                                                  ? 'text-sky-400/60 dark:text-sky-400/50'
                                                  : 'text-zinc-400/40 dark:text-zinc-400/40'
                                              }`}
                                              title="Heading menu"
                                              aria-label="Heading menu"
                                            >
                                              <svg
                                                width="14"
                                                height="14"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2.5"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                              >
                                                <circle cx="12" cy="5" r="1" />
                                                <circle cx="12" cy="12" r="1" />
                                                <circle cx="12" cy="19" r="1" />
                                              </svg>
                                            </button>
                                          )}
                                        </div>
                                      );
                                    })
                                  ) : (
                                    <p className="px-2 py-2 text-[10px] text-zinc-400 dark:text-zinc-400 font-light italic">
                                      Select text in the PDF and click Bookmark to add headings
                                    </p>
                                  )}
                                </div>
                                {/* TOC Save/Discard bar */}
                                {tocDraft && (
                                  <div className="sticky bottom-0 bg-amber-50 dark:bg-amber-950/50 border-t border-amber-200 dark:border-amber-800 px-3 py-2 flex items-center justify-between gap-2">
                                    <span className="text-[10px] font-medium text-amber-700 dark:text-amber-300">
                                      Unsaved TOC changes
                                    </span>
                                    <div className="flex gap-1.5">
                                      <button
                                        onClick={() => {
                                          setTocDraft(null);
                                          setTocDirtyDocId(null);
                                        }}
                                        className="px-2 py-1 text-[10px] font-medium rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
                                      >
                                        Discard
                                      </button>
                                      <button
                                        onClick={async () => {
                                          if (tocDraft && tocDirtyDocId) {
                                            await onSaveToc?.(tocDirtyDocId, tocDraft);
                                            setTocDraft(null);
                                            setTocDirtyDocId(null);
                                          }
                                        }}
                                        className="px-2 py-1 text-[10px] font-medium rounded bg-amber-500 text-white hover:bg-amber-600 transition-colors"
                                      >
                                        Save
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </aside>

                              {/* TOC/PDF Divider */}
                              <div
                                onMouseDown={handleTocResizeStart}
                                className="shrink-0 w-1.5 cursor-ew-resize hover:bg-black/10 transition-colors bg-zinc-100 dark:bg-zinc-700"
                              />

                              {/* PDF Viewer */}
                              <div className="flex-1 min-w-0 flex">
                                <div className="flex-1 min-w-0">
                                  <PdfViewer
                                    ref={pdfViewerRef}
                                    pdfBase64={activeDoc.pdfBase64}
                                    scale={pdfScale}
                                    rotation={pdfRotation}
                                    onPageChange={(current, total) => {
                                      const isInitial = pdfPageInfo.total === 0 && total > 0;
                                      setPdfPageInfo({ current, total });
                                      if (isInitial) setTimeout(() => applyFitMode(pdfFitMode), 50);
                                    }}
                                    onTextSelected={(text, page) => setSelectedPdfText({ text, page })}
                                  />
                                </div>
                                {/* Bookmark Editor Panel */}
                                {bookmarkEditorOpen && activeDoc && (
                                  <div className="shrink-0 w-[280px] min-h-0">
                                    <PdfBookmarkEditor
                                      bookmarks={
                                        activeDoc.bookmarks ??
                                        (activeDoc.structure ? headingsToBookmarks(activeDoc.structure) : [])
                                      }
                                      onSave={(newBookmarks) => {
                                        if (onSaveBookmarks) {
                                          onSaveBookmarks(activeDoc.id, newBookmarks);
                                        } else if (onSaveToc) {
                                          // Fallback: convert bookmarks to flat headings and use existing save path
                                          onSaveToc(activeDoc.id, flattenBookmarks(newBookmarks));
                                        }
                                        setBookmarkEditorOpen(false);
                                      }}
                                      onDiscard={() => setBookmarkEditorOpen(false)}
                                      onRegenerateWithAI={
                                        onRegenerateBookmarks
                                          ? async () => {
                                              setIsRegeneratingBookmarks(true);
                                              try {
                                                await onRegenerateBookmarks(activeDoc.id);
                                              } finally {
                                                setIsRegeneratingBookmarks(false);
                                              }
                                            }
                                          : undefined
                                      }
                                      isRegenerating={isRegeneratingBookmarks}
                                    />
                                  </div>
                                )}
                              </div>

                              {/* ── Native PDF heading context menu (unified with MD TOC menu) ── */}
                              {pdfContextMenu &&
                                (() => {
                                  const ctxHeading = headings.find((h) => h.id === pdfContextMenu.headingId);
                                  if (!ctxHeading) return null;
                                  const affectedIds = getPdfTier2Ids();
                                  const isMultiSelect = affectedIds.length > 1;
                                  const affectedLevels = getPdfAffectedLevels(headings);
                                  const _canPromote = affectedLevels.min > 1;
                                  const _canDemote = affectedLevels.max < 6;
                                  return createPortal(
                                    <div
                                      ref={pdfMenuRef}
                                      className="fixed z-[130] min-w-[180px] bg-white dark:bg-zinc-900 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-700 py-1 animate-in fade-in zoom-in-95 duration-150"
                                      style={{ top: pdfContextMenu.y, left: pdfContextMenu.x }}
                                      onMouseDown={(e) => e.stopPropagation()}
                                      onContextMenu={(e) => e.preventDefault()}
                                    >
                                      {/* Generate Card Content submenu */}
                                      {onGenerateCardContent && (
                                        <>
                                          <div className="relative">
                                            <button
                                              onClick={() => setPdfGenerateSubmenuOpen((prev) => !prev)}
                                              onMouseEnter={() => {
                                                setPdfGenerateSubmenuOpen(true);
                                                setPdfLevelSubmenuOpen(false);
                                              }}
                                              className="w-full text-left px-3 py-2 text-[11px] font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors flex items-center justify-between"
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
                                                  <rect x="3" y="3" width="16" height="16" rx="2" />
                                                  <path d="M12 8v8" />
                                                  <path d="M8 12h8" />
                                                </svg>
                                                Generate Card Content{isMultiSelect ? ' for Highlighted Items' : ''}
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
                                                className="text-zinc-500 dark:text-zinc-400"
                                              >
                                                <polyline points="9 18 15 12 9 6" />
                                              </svg>
                                            </button>

                                            {pdfGenerateSubmenuOpen && (
                                              <div className="absolute left-full top-0 ml-1 min-w-[160px] bg-white dark:bg-zinc-900 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-700 py-1 animate-in fade-in zoom-in-95 duration-100">
                                                {[
                                                  {
                                                    level: 'Executive' as DetailLevel,
                                                    label: 'Executive',
                                                    desc: '70-100 words',
                                                  },
                                                  {
                                                    level: 'Standard' as DetailLevel,
                                                    label: 'Standard',
                                                    desc: '200-250 words',
                                                  },
                                                  {
                                                    level: 'Detailed' as DetailLevel,
                                                    label: 'Detailed',
                                                    desc: '450-500 words',
                                                  },
                                                ].map((opt) => (
                                                  <button
                                                    key={opt.level}
                                                    onClick={async () => {
                                                      const ids = getPdfTier2Ids();
                                                      const targets = ids
                                                        .map((id) => ({
                                                          id,
                                                          text: headings.find((hh) => hh.id === id)?.text || '',
                                                        }))
                                                        .filter((t) => t.text);
                                                      closePdfMenu();
                                                      await Promise.all(
                                                        targets.map((t) =>
                                                          onGenerateCardContent(
                                                            t.id,
                                                            opt.level,
                                                            t.text,
                                                            activeDoc.name,
                                                          ),
                                                        ),
                                                      );
                                                    }}
                                                    className="w-full text-left px-3 py-2 text-[11px] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors flex items-center justify-between gap-3"
                                                  >
                                                    <span className="font-medium">{opt.label}</span>
                                                    <span className="text-[9px] text-zinc-500 dark:text-zinc-400">
                                                      {opt.desc}
                                                    </span>
                                                  </button>
                                                ))}
                                                <div className="h-px bg-zinc-100 dark:bg-zinc-700 my-1" />
                                                {[
                                                  {
                                                    level: 'TitleCard' as DetailLevel,
                                                    label: 'Title Card',
                                                    desc: 'Title + Subtitle',
                                                  },
                                                  {
                                                    level: 'TakeawayCard' as DetailLevel,
                                                    label: 'Takeaway Card',
                                                    desc: 'Title + Key Takeaways',
                                                  },
                                                ].map((opt) => (
                                                  <button
                                                    key={opt.level}
                                                    onClick={async () => {
                                                      const ids = getPdfTier2Ids();
                                                      const targets = ids
                                                        .map((id) => ({
                                                          id,
                                                          text: headings.find((hh) => hh.id === id)?.text || '',
                                                        }))
                                                        .filter((t) => t.text);
                                                      closePdfMenu();
                                                      await Promise.all(
                                                        targets.map((t) =>
                                                          onGenerateCardContent(
                                                            t.id,
                                                            opt.level,
                                                            t.text,
                                                            activeDoc.name,
                                                          ),
                                                        ),
                                                      );
                                                    }}
                                                    className="w-full text-left px-3 py-2 text-[11px] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors flex items-center justify-between gap-3"
                                                  >
                                                    <span className="font-medium text-violet-600">{opt.label}</span>
                                                    <span className="text-[9px] text-zinc-500 dark:text-zinc-400">
                                                      {opt.desc}
                                                    </span>
                                                  </button>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                          <div className="h-px bg-zinc-100 dark:bg-zinc-700 my-1" />
                                        </>
                                      )}

                                      {/* Expand All */}
                                      <button
                                        onClick={() => {
                                          setPdfCollapsed(new Set());
                                          closePdfMenu();
                                        }}
                                        onMouseEnter={() => {
                                          setPdfGenerateSubmenuOpen(false);
                                          setPdfLevelSubmenuOpen(false);
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
                                          className="text-zinc-500 dark:text-zinc-400"
                                        >
                                          <polyline points="6 9 12 15 18 9" />
                                        </svg>
                                        Expand All
                                      </button>

                                      {/* Collapse All */}
                                      <button
                                        onClick={() => {
                                          const allParents = new Set<string>();
                                          headings.forEach((h, i) => {
                                            if (pdfHeadingHasChildren(headings, i)) allParents.add(h.id);
                                          });
                                          setPdfCollapsed(allParents);
                                          closePdfMenu();
                                        }}
                                        onMouseEnter={() => {
                                          setPdfGenerateSubmenuOpen(false);
                                          setPdfLevelSubmenuOpen(false);
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
                                          className="text-zinc-500 dark:text-zinc-400"
                                        >
                                          <polyline points="18 15 12 9 6 15" />
                                        </svg>
                                        Collapse All
                                      </button>

                                      <div className="h-px bg-zinc-100 dark:bg-zinc-700 my-1" />

                                      {/* Select Heading Levels submenu */}
                                      <div className="relative">
                                        <button
                                          onClick={() => setPdfLevelSubmenuOpen((prev) => !prev)}
                                          onMouseEnter={() => {
                                            setPdfLevelSubmenuOpen(true);
                                            setPdfGenerateSubmenuOpen(false);
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
                                              className="text-zinc-500 dark:text-zinc-400"
                                            >
                                              <line x1="21" y1="10" x2="7" y2="10" />
                                              <line x1="21" y1="6" x2="3" y2="6" />
                                              <line x1="21" y1="14" x2="3" y2="14" />
                                              <line x1="21" y1="18" x2="7" y2="18" />
                                            </svg>
                                            Select Heading Levels
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
                                            className="text-zinc-500 dark:text-zinc-400"
                                          >
                                            <polyline points="9 18 15 12 9 6" />
                                          </svg>
                                        </button>

                                        {pdfLevelSubmenuOpen && (
                                          <div className="absolute left-full top-0 ml-1 min-w-[140px] bg-white dark:bg-zinc-900 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-700 py-1 animate-in fade-in zoom-in-95 duration-100 whitespace-nowrap">
                                            {(
                                              [
                                                { label: 'H1 Only', tag: 'H1', levels: [1] },
                                                { label: 'H2 Only', tag: 'H2', levels: [2] },
                                                { label: 'H3 Only', tag: 'H3', levels: [3] },
                                                { label: 'H1 + H2', tag: 'H1–2', levels: [1, 2] },
                                                { label: 'H2 + H3', tag: 'H2–3', levels: [2, 3] },
                                                { label: 'All Levels', tag: 'All', levels: [1, 2, 3, 4] },
                                              ] as { label: string; tag: string; levels: number[] }[]
                                            ).map((opt) => (
                                              <button
                                                key={opt.label}
                                                onClick={() => handlePdfSelectLevel(headings, opt.levels)}
                                                className="w-full text-left px-3 py-2 text-[11px] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors flex items-center gap-2"
                                              >
                                                <span className="w-7 h-4 rounded bg-zinc-100 dark:bg-zinc-800/50 text-[9px] font-bold text-zinc-500 dark:text-zinc-400 flex items-center justify-center">
                                                  {opt.tag}
                                                </span>
                                                {opt.label}
                                              </button>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    </div>,
                                    document.body,
                                  );
                                })()}

                              {/* ── Native PDF document-title context menu ── */}
                              {pdfDocContextMenu &&
                                onGenerateCardContent &&
                                createPortal(
                                  <div
                                    ref={pdfMenuRef}
                                    className="fixed z-[130] min-w-[180px] bg-white dark:bg-zinc-900 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-700 py-1 animate-in fade-in zoom-in-95 duration-150"
                                    style={{ top: pdfDocContextMenu.y, left: pdfDocContextMenu.x }}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onContextMenu={(e) => e.preventDefault()}
                                  >
                                    <div className="relative">
                                      <button
                                        onClick={() => setPdfDocGenerateSubmenuOpen((prev) => !prev)}
                                        onMouseEnter={() => setPdfDocGenerateSubmenuOpen(true)}
                                        className="w-full text-left px-3 py-2 text-[11px] font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors flex items-center justify-between"
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
                                            <rect x="3" y="3" width="16" height="16" rx="2" />
                                            <path d="M12 8v8" />
                                            <path d="M8 12h8" />
                                          </svg>
                                          Generate Card for Whole Document
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

                                      {pdfDocGenerateSubmenuOpen && (
                                        <div className="absolute left-full top-0 ml-1 min-w-[160px] bg-white dark:bg-zinc-900 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-700 py-1 animate-in fade-in zoom-in-95 duration-100">
                                          {[
                                            {
                                              level: 'Executive' as DetailLevel,
                                              label: 'Executive',
                                              desc: '70-100 words',
                                            },
                                            {
                                              level: 'Standard' as DetailLevel,
                                              label: 'Standard',
                                              desc: '200-250 words',
                                            },
                                            {
                                              level: 'Detailed' as DetailLevel,
                                              label: 'Detailed',
                                              desc: '450-500 words',
                                            },
                                          ].map((opt) => (
                                            <button
                                              key={opt.level}
                                              onClick={async () => {
                                                closePdfMenu();
                                                await onGenerateCardContent(
                                                  '__whole_document__',
                                                  opt.level,
                                                  activeDoc.name,
                                                  activeDoc.name,
                                                );
                                              }}
                                              className="w-full text-left px-3 py-2 text-[11px] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors flex items-center justify-between gap-3"
                                            >
                                              <span className="font-medium">{opt.label}</span>
                                              <span className="text-[9px] text-zinc-500 dark:text-zinc-400">
                                                {opt.desc}
                                              </span>
                                            </button>
                                          ))}
                                          <div className="h-px bg-zinc-100 dark:bg-zinc-700 my-1" />
                                          {[
                                            {
                                              level: 'TitleCard' as DetailLevel,
                                              label: 'Title Card',
                                              desc: 'Title + Subtitle',
                                            },
                                            {
                                              level: 'TakeawayCard' as DetailLevel,
                                              label: 'Takeaway Card',
                                              desc: 'Title + Key Takeaways',
                                            },
                                          ].map((opt) => (
                                            <button
                                              key={opt.level}
                                              onClick={async () => {
                                                closePdfMenu();
                                                await onGenerateCardContent(
                                                  '__whole_document__',
                                                  opt.level,
                                                  activeDoc.name,
                                                  activeDoc.name,
                                                );
                                              }}
                                              className="w-full text-left px-3 py-2 text-[11px] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors flex items-center justify-between gap-3"
                                            >
                                              <span className="font-medium text-violet-600">{opt.label}</span>
                                              <span className="text-[9px] text-zinc-500 dark:text-zinc-400">
                                                {opt.desc}
                                              </span>
                                            </button>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>,
                                  document.body,
                                )}
                            </div>
                          </div>
                        );
                      }

                      // Markdown: existing editor
                      if (!activeDoc?.content) {
                        const isProcessing = activeDoc?.status === 'processing' || activeDoc?.status === 'uploading';
                        const isLostNativePdf =
                          !isProcessing &&
                          activeDoc &&
                          !activeDoc.content &&
                          !activeDoc.sourceType &&
                          (activeDoc.type === 'application/pdf' || activeDoc.name?.toLowerCase().endsWith('.pdf'));
                        return (
                          <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
                            {isProcessing && (
                              <div className="w-8 h-8 border-2 border-zinc-200 dark:border-zinc-700 border-t-zinc-500 dark:border-t-zinc-400 rounded-full animate-spin mb-3" />
                            )}
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-light max-w-xs">
                              {isProcessing
                                ? 'Processing document…'
                                : isLostNativePdf
                                  ? 'This PDF needs to be re-uploaded. Remove it and upload again to restore the viewer.'
                                  : 'This document has no editable content.'}
                            </p>
                          </div>
                        );
                      }
                      return (
                        <DocumentEditorModal
                          ref={editorHandleRef}
                          key={activeDoc.id}
                          document={activeDoc}
                          mode="inline"
                          onSave={(newContent) => onSaveDocument(activeDoc.id, newContent)}
                          onClose={() => {}}
                          onGenerateCard={onGenerateCardContent}
                          generatingSourceIds={generatingSourceIds}
                        />
                      );
                    })()}
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
                    <PanelRequirements level="sources" />
                  </div>
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
              </>
            </div>,
            document.body,
          )}
      </>
    );
  },
);

export default React.memo(SourcesPanel);
