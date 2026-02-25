import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import ZoomOverlay from './components/ZoomOverlay';
import AssetsPanel from './components/AssetsPanel';
import {
  StylingOptions,
  ReferenceImage,
  Nugget,
} from './types';
import {
  DEFAULT_STYLING,
  registerCustomStyles,
  uploadToFilesAPI,
  deleteFromFilesAPI,
} from './utils/ai';
import ProjectsPanel from './components/ProjectsPanel';
import { LandingPage } from './components/LandingPage';
import SourcesPanel from './components/SourcesPanel';
import ChatPanel from './components/ChatPanel';
import AutoDeckPanel from './components/AutoDeckPanel';
import CardsPanel, { PanelEditorHandle } from './components/CardsPanel';
import ErrorBoundary from './components/ErrorBoundary';

import { UnsavedChangesDialog } from './components/Dialogs';
import { NuggetCreationModal } from './components/NuggetCreationModal';
import { ProjectCreationModal } from './components/ProjectCreationModal';
import { useAppContext } from './context/AppContext';
import { useNuggetContext } from './context/NuggetContext';
import { useProjectContext } from './context/ProjectContext';
import { useSelectionContext } from './context/SelectionContext';
import { useStyleContext } from './context/StyleContext';
import { useThemeContext } from './context/ThemeContext';
import { useCardGeneration } from './hooks/useCardGeneration';
import { useCardOperations } from './hooks/useCardOperations';
import { useImageOperations } from './hooks/useImageOperations';
import { useProjectOperations } from './hooks/useProjectOperations';
import { useDocumentOperations } from './hooks/useDocumentOperations';
import { useInsightsLab } from './hooks/useInsightsLab';
import { useAutoDeck } from './hooks/useAutoDeck';
import { useTokenUsage, formatTokens, formatCost, TokenUsageTotals } from './hooks/useTokenUsage';
import { storage } from './components/StorageProvider';
import {
  extractHeadingsWithGemini,
  base64ToBlob,
} from './utils/fileProcessing';
import { flattenBookmarks, headingsToBookmarks } from './utils/pdfBookmarks';
import { useToast } from './components/ToastNotification';
import PdfUploadChoiceDialog from './components/PdfUploadChoiceDialog';
import PanelRequirements from './components/PanelRequirements';
import StyleStudioModal from './components/StyleStudioModal';
import { SubjectEditModal } from './components/SubjectEditModal';

const App: React.FC = () => {
  // ── Focused context hooks ──
  const {
    nuggets, selectedNuggetId, selectedNugget,
    selectedDocumentId, setSelectedDocumentId,
    deleteNugget, updateNugget,
    updateNuggetDocument, removeNuggetDocument, renameNuggetDocument, toggleNuggetDocument,
  } = useNuggetContext();
  const { projects, deleteProject, updateProject } = useProjectContext();
  const { activeCardId, setActiveCardId, activeCard, selectedProjectId, selectionLevel, selectEntity } = useSelectionContext();
  const { customStyles, addCustomStyle: _addCustomStyle, updateCustomStyle: _updateCustomStyle, deleteCustomStyle: _deleteCustomStyle, replaceCustomStyles } = useStyleContext();
  const { darkMode, toggleDarkMode } = useThemeContext();
  const { initialTokenUsageTotals, isProjectsPanelOpen, setIsProjectsPanelOpen } = useAppContext();

  // ── Token / cost tracking (persisted to IndexedDB) ──
  const {
    totals: usageTotals,
    recordUsage,
    resetUsage,
  } = useTokenUsage(storage, initialTokenUsageTotals as unknown as TokenUsageTotals | undefined);

  const { addToast } = useToast();

  const [menuDraftOptions, setMenuDraftOptions] = useState<StylingOptions>(
    () => selectedNugget?.stylingOptions || DEFAULT_STYLING,
  );
  const skipStylingWritebackRef = useRef(false);

  // ── Reference image style anchoring (shared between useCardGeneration and useImageOperations) ──
  const [referenceImage, setReferenceImage] = useState<ReferenceImage | null>(null);
  const [useReferenceImage, setUseReferenceImage] = useState(false);

  const {
    genStatus,
    activeLogicTab,
    setActiveLogicTab,
    manifestCards,
    setManifestCards,
    currentSynthesisContent: _currentSynthesisContent,
    contentDirty: _contentDirty,
    selectedCount: _selectedCount,
    generateCard,
    handleGenerateAll: _handleGenerateAll,
    executeBatchCardGeneration,
    handleImageModified: _handleImageModified,
  } = useCardGeneration(menuDraftOptions, referenceImage, useReferenceImage, recordUsage);

  // ── Insights workflow hooks ──
  const {
    messages: insightsMessages,
    isLoading: insightsLabLoading,
    sendMessage: sendInsightsMessage,
    stopResponse: stopInsightsResponse,
    clearMessages: clearInsightsMessages,
    pendingDocChanges,
    hasConversation: insightsHasConversation,
    handleDocChangeContinue,
    handleDocChangeStartFresh,
  } = useInsightsLab(recordUsage);

  // ── Auto-Deck workflow hook ──
  const {
    session: autoDeckSession,
    startPlanning: autoDeckStartPlanning,
    revisePlan: autoDeckRevisePlan,
    approvePlan: autoDeckApprovePlan,
    abort: autoDeckAbort,
    reset: autoDeckReset,
    retryFromReview: autoDeckRetryFromReview,
    toggleCardIncluded: autoDeckToggleCardIncluded,
    setQuestionAnswer: autoDeckSetQuestionAnswer,
    setAllRecommended: autoDeckSetAllRecommended,
    setGeneralComment: autoDeckSetGeneralComment,
  } = useAutoDeck(recordUsage);

  // ── Card operations (selection, manipulation, creation, cross-nugget) ──
  const {
    toggleInsightsCardSelection,
    toggleSelectAllInsightsCards,
    selectInsightsCardExclusive,
    selectInsightsCardRange,
    deselectAllInsightsCards,
    insightsSelectedCount,
    reorderInsightsCards,
    deleteInsightsCard,
    deleteSelectedInsightsCards,
    renameInsightsCard,
    handleSaveCardContent,
    handleCreateCustomCard,
    handleSaveAsCard,
    handleCopyMoveCard,
    handleCreateNuggetForCard,
  } = useCardOperations();

  // ── Project & nugget operations (creation, duplication, copy/move, subject) ──
  const {
    showNuggetCreation,
    setShowNuggetCreation,
    nuggetCreationProjectId,
    setNuggetCreationProjectId,
    showProjectCreation,
    setShowProjectCreation,
    projectCreationChainToNugget,
    setProjectCreationChainToNugget,
    subjectEditNuggetId,
    setSubjectEditNuggetId,
    isRegeneratingSubject,
    handleCreateNugget,
    handleCreateProject,
    handleCopyNuggetToProject,
    handleDuplicateProject,
    handleMoveNuggetToProject,
    handleCreateProjectForNugget,
    handleSaveSubject,
    handleRegenerateSubject,
    setSubjectGenPending,
  } = useProjectOperations({ recordUsage });

  // ── Document operations (save, TOC, copy/move, upload, content generation) ──
  const {
    pdfChoiceDialog,
    pdfChoiceResolverRef,
    setPdfChoiceDialog,
    generatingSourceIds,
    tocLockActive,
    setTocLockActive,
    handleGenerateCardContent,
    handleSaveDocument,
    handleSaveToc,
    handleCopyMoveDocument,
    handleCreateNuggetWithDoc,
    handleUploadDocuments,
  } = useDocumentOperations({ recordUsage, onSubjectGenPending: setSubjectGenPending });

  // ── Style Studio modal state ──
  const [showStyleStudio, setShowStyleStudio] = useState(false);

  // ── Register custom styles into runtime maps on mount and after changes ──
  useEffect(() => {
    registerCustomStyles(customStyles);
  }, [customStyles]);

  // ── Panel accordion state (only one of Projects/Sources/Chat/Auto-Deck can be open at a time) ──
  // null = all collapsed
  const [expandedPanel, setExpandedPanel] = useState<'projects' | 'sources' | 'chat' | 'auto-deck' | null>(null);
  // selectedDocumentId is now in AppContext (with guard effect for auto-selection)

  // ── Unsaved-changes gating for panel/nugget switching ──
  const cardsPanelRef = useRef<PanelEditorHandle>(null);
  const sourcesPanelRef = useRef<PanelEditorHandle>(null);
  const [appPendingAction, setAppPendingAction] = useState<(() => void) | null>(null);
  const [appPendingDirtyPanel, setAppPendingDirtyPanel] = useState<'cards' | 'sources' | null>(null);

  const appGatedAction = useCallback((action: () => void) => {
    if (cardsPanelRef.current?.isDirty) {
      setAppPendingDirtyPanel('cards');
      setAppPendingAction(() => action);
      return;
    }
    if (sourcesPanelRef.current?.isDirty) {
      setAppPendingDirtyPanel('sources');
      setAppPendingAction(() => action);
      return;
    }
    action();
  }, []);

  // ── Breadcrumb navigation handlers ──
  const handleBreadcrumbProjectSelect = useCallback(
    (projectId: string) => {
      appGatedAction(() => {
        setReferenceImage(null);
        setUseReferenceImage(false);
        selectEntity({ projectId });
      });
      setBreadcrumbDropdown(null);
    },
    [appGatedAction, selectEntity],
  );

  const handleBreadcrumbNuggetSelect = useCallback(
    (nuggetId: string) => {
      appGatedAction(() => {
        setReferenceImage(null);
        setUseReferenceImage(false);
        selectEntity({ nuggetId });
      });
      setBreadcrumbDropdown(null);
    },
    [appGatedAction, selectEntity],
  );

  const handleBreadcrumbDocSelect = useCallback(
    (docId: string) => {
      selectEntity({ documentId: docId });
      appGatedAction(() => setExpandedPanel('sources'));
      setBreadcrumbDropdown(null);
    },
    [appGatedAction, selectEntity],
  );

  const handleAppDialogSave = useCallback(() => {
    const panel = appPendingDirtyPanel;
    if (panel === 'cards') cardsPanelRef.current?.save();
    else if (panel === 'sources') sourcesPanelRef.current?.save();
    // After saving, re-check: is the OTHER panel dirty?
    const otherRef = panel === 'cards' ? sourcesPanelRef : cardsPanelRef;
    const otherLabel = panel === 'cards' ? 'sources' : 'cards';
    if (otherRef.current?.isDirty) {
      setAppPendingDirtyPanel(otherLabel as 'cards' | 'sources');
      return;
    }
    const action = appPendingAction;
    setAppPendingAction(null);
    setAppPendingDirtyPanel(null);
    action?.();
  }, [appPendingAction, appPendingDirtyPanel]);

  const handleAppDialogDiscard = useCallback(() => {
    const panel = appPendingDirtyPanel;
    if (panel === 'cards') cardsPanelRef.current?.discard();
    else if (panel === 'sources') sourcesPanelRef.current?.discard();
    const otherRef = panel === 'cards' ? sourcesPanelRef : cardsPanelRef;
    const otherLabel = panel === 'cards' ? 'sources' : 'cards';
    if (otherRef.current?.isDirty) {
      setAppPendingDirtyPanel(otherLabel as 'cards' | 'sources');
      return;
    }
    const action = appPendingAction;
    setAppPendingAction(null);
    setAppPendingDirtyPanel(null);
    action?.();
  }, [appPendingAction, appPendingDirtyPanel]);

  const handleAppDialogCancel = useCallback(() => {
    setAppPendingAction(null);
    setAppPendingDirtyPanel(null);
  }, []);

  // ── Nugget's owned documents (per-nugget, no shared library) ──
  const nuggetDocs = useMemo(() => {
    if (!selectedNugget) return [];
    return selectedNugget.documents;
  }, [selectedNugget]);

  // ── Breadcrumb derived data ──
  const activeDocForBreadcrumb = useMemo(() => {
    if (!nuggetDocs.length) return null;
    if (selectedDocumentId) {
      const found = nuggetDocs.find((d) => d.id === selectedDocumentId);
      if (found) return found;
    }
    return nuggetDocs[0];
  }, [nuggetDocs, selectedDocumentId]);

  const nuggetDropdownItems = useMemo(() => {
    const parent = selectedNugget ? projects.find((p) => p.nuggetIds.includes(selectedNugget.id)) : null;
    const inProject = parent
      ? parent.nuggetIds.map((nid) => nuggets.find((n) => n.id === nid)).filter((n): n is Nugget => !!n)
      : [];
    const allProjectIds = new Set(projects.flatMap((p) => p.nuggetIds));
    const ungrouped = nuggets.filter((n) => !allProjectIds.has(n.id));
    return { inProject, ungrouped, parent };
  }, [nuggets, projects, selectedNugget]);


  const [showLanding, setShowLanding] = useState(true);
  const handleLaunch = useCallback(() => setShowLanding(false), []);
  const [_copied, _setCopied] = useState(false);
  const [emptyDragging, setEmptyDragging] = useState(false);
  const [showUsageDropdown, setShowUsageDropdown] = useState(false);
  const usageDropdownRef = useRef<HTMLDivElement>(null);
  const [breadcrumbDropdown, setBreadcrumbDropdown] = useState<'project' | 'nugget' | 'document' | null>(null);
  const breadcrumbRef = useRef<HTMLDivElement>(null);

  const committedSettings = useMemo(() => {
    return selectedNugget?.stylingOptions || DEFAULT_STYLING;
  }, [selectedNugget?.stylingOptions]);

  // ── Image operations (zoom, reference image, card images, downloads, generation wrappers) ──
  const {
    zoomState,
    setZoomState,
    openZoom,
    closeZoom,
    handleStampReference,
    handleReferenceImageModified,
    handleDeleteReference,
    handleInsightsImageModified,
    handleDeleteCardImage,
    handleDeleteCardVersions,
    handleDeleteAllCardImages,
    handleDownloadImage,
    handleDownloadAllImages,
    wrappedGenerateCard,
    wrappedExecuteBatch,
    mismatchDialog,
    setMismatchDialog,
  } = useImageOperations({
    activeCard,
    activeLogicTab,
    committedSettings,
    menuDraftOptions,
    referenceImage,
    setReferenceImage,
    useReferenceImage,
    setUseReferenceImage,
    generateCard,
    executeBatchCardGeneration,
  });

  // Auto-select first card when cards exist but none is active
  const nuggetCards = useMemo(() => selectedNugget?.cards ?? [], [selectedNugget?.cards]);
  useEffect(() => {
    if (nuggetCards.length > 0 && (!activeCardId || !nuggetCards.find((c) => c.id === activeCardId))) {
      setActiveCardId(nuggetCards[0].id);
    }
  }, [nuggetCards, activeCardId, setActiveCardId]);

  // Sync logic tab with card's structural detail level whenever card changes
  useEffect(() => {
    if (activeCard?.detailLevel) {
      setActiveLogicTab(activeCard.detailLevel);
    }
  }, [activeCardId, activeCard?.detailLevel, setActiveLogicTab]);

  // Keep menuDraftOptions.levelOfDetail in sync with activeLogicTab
  useEffect(() => {
    setMenuDraftOptions((prev) =>
      prev.levelOfDetail !== activeLogicTab ? { ...prev, levelOfDetail: activeLogicTab } : prev,
    );
  }, [activeLogicTab]);

  // ── Nugget ↔ toolbar styling sync ──
  // Read: sync toolbar FROM nugget on nugget selection change
  useEffect(() => {
    const nugget = nuggets.find((n) => n.id === selectedNuggetId);
    skipStylingWritebackRef.current = true;
    setMenuDraftOptions(nugget?.stylingOptions || DEFAULT_STYLING);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally sync only on selection change; including nuggets would re-trigger on every card generation
  }, [selectedNuggetId]);

  // Write: persist toolbar changes TO nugget (no lastModifiedAt bump — styling is a preference)
  useEffect(() => {
    if (skipStylingWritebackRef.current) {
      skipStylingWritebackRef.current = false;
      return;
    }
    if (!selectedNuggetId) return;
    updateNugget(selectedNuggetId, (n) => ({
      ...n,
      stylingOptions: menuDraftOptions,
    }));
  }, [menuDraftOptions, selectedNuggetId, updateNugget]);

  // ── Global keyboard shortcuts ──
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setZoomState({ imageUrl: null, cardId: null, cardText: null });
        setManifestCards(null);
        setExpandedPanel(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [setZoomState, setManifestCards, setExpandedPanel]);

  // ── Click-outside to close overlay panels ──
  useEffect(() => {
    if (!expandedPanel) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-panel-overlay]')) return;
      if (target.closest('[data-panel-strip]')) return;
      if (target.closest('[data-breadcrumb-dropdown]')) return;
      // Don't close when clicking portal-rendered menus, modals, dialogs (z-index ≥ 100)
      const fixed = target.closest('.fixed');
      if (fixed && fixed.parentElement === document.body) return;
      appGatedAction(() => setExpandedPanel(null));
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [expandedPanel, appGatedAction]);

  // Close usage dropdown on outside click
  useEffect(() => {
    if (!showUsageDropdown) return;
    const handler = (e: MouseEvent) => {
      if (usageDropdownRef.current && !usageDropdownRef.current.contains(e.target as Node)) {
        setShowUsageDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showUsageDropdown]);

  // Close breadcrumb dropdown on outside click or Escape
  useEffect(() => {
    if (!breadcrumbDropdown) return;
    const onClick = (e: MouseEvent) => {
      if (breadcrumbRef.current && !breadcrumbRef.current.contains(e.target as Node)) setBreadcrumbDropdown(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setBreadcrumbDropdown(null);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [breadcrumbDropdown]);

  // Auto-close breadcrumb dropdown on nugget change
  useEffect(() => {
    setBreadcrumbDropdown(null);
  }, [selectedNuggetId]);

  // ── Shared nugget list props (used by both SourcesPanel and CardsPanel) ──
  const otherNuggetsList = useMemo(
    () => nuggets.filter((n) => n.id !== selectedNugget?.id).map((n) => ({ id: n.id, name: n.name })),
    [nuggets, selectedNugget?.id],
  );

  const projectNuggetsList = useMemo(
    () =>
      projects.map((p) => ({
        projectId: p.id,
        projectName: p.name,
        nuggets: p.nuggetIds
          .filter((nid) => nid !== selectedNugget?.id)
          .map((nid) => nuggets.find((n) => n.id === nid))
          .filter((n): n is Nugget => !!n)
          .map((n) => ({ id: n.id, name: n.name })),
      })),
    [projects, nuggets, selectedNugget?.id],
  );

  return (
    <div className="min-h-screen bg-white">
      {showLanding ? (
        <LandingPage onLaunch={handleLaunch} />
      ) : (
        <>
          {/* Nugget modals */}
          {showNuggetCreation && (
            <NuggetCreationModal
              onCreateNugget={handleCreateNugget}
              onClose={() => setShowNuggetCreation(false)}
            />
          )}

          {showProjectCreation && (
            <ProjectCreationModal
              projects={projects}
              onCreateProject={(name, desc) => {
                const projectId = handleCreateProject(name, desc);
                if (projectCreationChainToNugget) {
                  setNuggetCreationProjectId(projectId);
                  setShowProjectCreation(false);
                  setShowNuggetCreation(true);
                  setProjectCreationChainToNugget(false);
                }
              }}
              onClose={() => {
                setShowProjectCreation(false);
                setProjectCreationChainToNugget(false);
              }}
            />
          )}

          {/* PDF upload choice dialog */}
          {pdfChoiceDialog && (
            <PdfUploadChoiceDialog
              fileName={pdfChoiceDialog.fileName}
              pdfCount={pdfChoiceDialog.pdfCount}
              onConvertToMarkdown={() => {
                pdfChoiceResolverRef.current?.('markdown');
                pdfChoiceResolverRef.current = null;
                setPdfChoiceDialog(null);
              }}
              onKeepAsPdf={() => {
                pdfChoiceResolverRef.current?.('native-pdf');
                pdfChoiceResolverRef.current = null;
                setPdfChoiceDialog(null);
              }}
              onCancel={() => {
                pdfChoiceResolverRef.current?.('cancel');
                pdfChoiceResolverRef.current = null;
                setPdfChoiceDialog(null);
              }}
            />
          )}

          {/* Style Studio modal */}
          {showStyleStudio && (
            <StyleStudioModal
              onClose={() => setShowStyleStudio(false)}
            />
          )}

          {/* Subject edit modal */}
          {subjectEditNuggetId &&
            (() => {
              const nugget = nuggets.find((n) => n.id === subjectEditNuggetId);
              if (!nugget) return null;
              return (
                <SubjectEditModal
                  nuggetId={nugget.id}
                  nuggetName={nugget.name}
                  currentSubject={nugget.subject || ''}
                  isRegenerating={isRegeneratingSubject}
                  onSave={handleSaveSubject}
                  onRegenerate={handleRegenerateSubject}
                  onClose={() => setSubjectEditNuggetId(null)}
                />
              );
            })()}

          {/* App-level unsaved changes dialog (for nugget/panel switching) */}
          {appPendingAction && appPendingDirtyPanel && (
            <UnsavedChangesDialog
              title={`Unsaved changes in ${appPendingDirtyPanel === 'cards' ? 'Cards' : 'Sources'} editor`}
              description="You have unsaved edits. Save or discard them to continue."
              onSave={handleAppDialogSave}
              onDiscard={handleAppDialogDiscard}
              onCancel={handleAppDialogCancel}
            />
          )}

          {/* Zoom Overlay */}
          {zoomState.imageUrl && <ZoomOverlay zoomState={zoomState} onClose={closeZoom} />}

          <div
            className="flex flex-col h-screen overflow-hidden"
            style={{
              background: darkMode ? '#18181b' : 'linear-gradient(180deg, #f0f4f8 0%, #e8edf2 40%, #f5f7fa 100%)',
            }}
          >
            {/* Header bar — always visible */}
            {(() => {
              const parentProject = selectedNugget
                ? projects.find((p) => p.nuggetIds.includes(selectedNugget.id))
                : null;
              return (
                <header className="shrink-0 h-9 flex items-center justify-between px-5 border-b border-zinc-100 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-[0_1px_3px_rgba(0,0,0,0.04)] dark:shadow-none relative z-[110]">
                  {/* Left spacer — matches right-side width for centering */}
                  <div className="w-48 shrink-0" />

                  {/* Center: interactive breadcrumb navigation */}
                  {selectedNugget ? (
                    <nav
                      ref={breadcrumbRef}
                      aria-label="Breadcrumb"
                      data-breadcrumb-dropdown
                      className="flex items-center gap-0 min-w-0 text-[15px] text-zinc-900 dark:text-zinc-100"
                    >
                      {/* ── Project segment ── */}
                      {parentProject && (
                        <>
                          <span className="font-light italic text-[13px] text-zinc-400 select-none">project</span>
                          <span className="mx-2.5" />
                          <div className="relative">
                            <button
                              onClick={() => setBreadcrumbDropdown((prev) => (prev === 'project' ? null : 'project'))}
                              className="font-semibold not-italic truncate max-w-[200px] px-2.5 py-1 -my-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors inline-flex items-center gap-1.5"
                              title={parentProject.name}
                              aria-expanded={breadcrumbDropdown === 'project'}
                            >
                              {parentProject.name}
                              <svg
                                width="10"
                                height="10"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="ml-0.5 opacity-40 shrink-0"
                              >
                                <polyline points="6 9 12 15 18 9" />
                              </svg>
                            </button>
                            {breadcrumbDropdown === 'project' && (
                              <div className="absolute top-full left-0 mt-1 min-w-[180px] max-h-64 overflow-y-auto bg-white dark:bg-zinc-900 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-700 z-[120] py-1 text-[12px]">
                                {projects.map((proj) => (
                                  <button
                                    key={proj.id}
                                    onClick={() => handleBreadcrumbProjectSelect(proj.id)}
                                    disabled={proj.nuggetIds.length === 0}
                                    className={`w-full text-left px-3 py-1.5 truncate transition-colors ${proj.id === parentProject.id ? 'bg-zinc-200 dark:bg-zinc-700 font-medium text-zinc-800 dark:text-zinc-200' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-800 dark:hover:text-zinc-200'} ${proj.nuggetIds.length === 0 ? 'opacity-40 cursor-default' : ''}`}
                                  >
                                    {proj.name}
                                    {proj.nuggetIds.length === 0 && (
                                      <span className="text-zinc-400 text-[10px] ml-1">(empty)</span>
                                    )}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          <span className="mx-5 text-zinc-200 dark:text-zinc-600 font-light select-none">|</span>
                        </>
                      )}

                      {/* ── Nugget segment ── */}
                      <span className="font-light italic text-[13px] text-zinc-400 select-none">nugget</span>
                      <span className="mx-2.5" />
                      <div className="relative">
                        <button
                          onClick={() => setBreadcrumbDropdown((prev) => (prev === 'nugget' ? null : 'nugget'))}
                          className="font-semibold not-italic truncate max-w-[200px] px-2.5 py-1 -my-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors inline-flex items-center gap-1.5"
                          title={selectedNugget.name}
                          aria-expanded={breadcrumbDropdown === 'nugget'}
                        >
                          {selectedNugget.name}
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="ml-0.5 opacity-40 shrink-0"
                          >
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </button>
                        {breadcrumbDropdown === 'nugget' && (
                          <div className="absolute top-full left-0 mt-1 min-w-[180px] max-h-64 overflow-y-auto bg-white dark:bg-zinc-900 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-700 z-[120] py-1 text-[12px]">
                            {/* Nuggets in current project */}
                            {nuggetDropdownItems.parent && nuggetDropdownItems.inProject.length > 0 && (
                              <>
                                <div className="px-3 py-1 text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider font-medium">
                                  {nuggetDropdownItems.parent.name}
                                </div>
                                {nuggetDropdownItems.inProject.map((n) => (
                                  <button
                                    key={n.id}
                                    onClick={() => handleBreadcrumbNuggetSelect(n.id)}
                                    className={`w-full text-left px-3 py-1.5 truncate transition-colors ${n.id === selectedNuggetId ? 'bg-zinc-200 dark:bg-zinc-700 font-medium text-zinc-800 dark:text-zinc-200' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-800 dark:hover:text-zinc-200'}`}
                                  >
                                    {n.name}
                                  </button>
                                ))}
                              </>
                            )}
                            {/* Ungrouped nuggets */}
                            {nuggetDropdownItems.ungrouped.length > 0 && (
                              <>
                                {nuggetDropdownItems.parent && nuggetDropdownItems.inProject.length > 0 && (
                                  <div className="border-t border-zinc-100 dark:border-zinc-700 my-1" />
                                )}
                                <div className="px-3 py-1 text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider font-medium">
                                  Ungrouped
                                </div>
                                {nuggetDropdownItems.ungrouped.map((n) => (
                                  <button
                                    key={n.id}
                                    onClick={() => handleBreadcrumbNuggetSelect(n.id)}
                                    className={`w-full text-left px-3 py-1.5 truncate transition-colors ${n.id === selectedNuggetId ? 'bg-zinc-200 dark:bg-zinc-700 font-medium text-zinc-800 dark:text-zinc-200' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-800 dark:hover:text-zinc-200'}`}
                                  >
                                    {n.name}
                                  </button>
                                ))}
                              </>
                            )}
                            {/* Other projects' nuggets */}
                            {projects
                              .filter((p) => p.id !== nuggetDropdownItems.parent?.id && p.nuggetIds.length > 0)
                              .map((proj) => (
                                <React.Fragment key={proj.id}>
                                  <div className="border-t border-zinc-100 dark:border-zinc-700 my-1" />
                                  <div className="px-3 py-1 text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider font-medium">
                                    {proj.name}
                                  </div>
                                  {proj.nuggetIds.map((nid) => {
                                    const n = nuggets.find((ng) => ng.id === nid);
                                    if (!n) return null;
                                    return (
                                      <button
                                        key={n.id}
                                        onClick={() => handleBreadcrumbNuggetSelect(n.id)}
                                        className={`w-full text-left px-3 py-1.5 truncate transition-colors ${n.id === selectedNuggetId ? 'bg-zinc-200 dark:bg-zinc-700 font-medium text-zinc-800 dark:text-zinc-200' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-800 dark:hover:text-zinc-200'}`}
                                      >
                                        {n.name}
                                      </button>
                                    );
                                  })}
                                </React.Fragment>
                              ))}
                          </div>
                        )}
                      </div>

                      {/* ── Document segment ── */}
                      {activeDocForBreadcrumb && (
                        <>
                          <span className="mx-5 text-zinc-200 dark:text-zinc-600 font-light select-none">|</span>
                          <span className="font-light italic text-[13px] text-zinc-400 select-none">doc</span>
                          <span className="mx-2.5" />
                          <div className="relative">
                            <button
                              onClick={() => setBreadcrumbDropdown((prev) => (prev === 'document' ? null : 'document'))}
                              className="font-semibold not-italic truncate max-w-[200px] px-2.5 py-1 -my-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors inline-flex items-center gap-1.5"
                              title={activeDocForBreadcrumb.name}
                              aria-expanded={breadcrumbDropdown === 'document'}
                            >
                              {activeDocForBreadcrumb.name}
                              <svg
                                width="10"
                                height="10"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="ml-0.5 opacity-40 shrink-0"
                              >
                                <polyline points="6 9 12 15 18 9" />
                              </svg>
                            </button>
                            {breadcrumbDropdown === 'document' && (
                              <div className="absolute top-full left-0 mt-1 min-w-[180px] max-h-64 overflow-y-auto bg-white dark:bg-zinc-900 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-700 z-[120] py-1 text-[12px]">
                                {nuggetDocs.map((doc) => (
                                  <button
                                    key={doc.id}
                                    onClick={() => handleBreadcrumbDocSelect(doc.id)}
                                    className={`w-full text-left px-3 py-1.5 truncate transition-colors flex items-center gap-2 ${doc.id === activeDocForBreadcrumb.id ? 'bg-zinc-200 dark:bg-zinc-700 font-medium text-zinc-800 dark:text-zinc-200' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-800 dark:hover:text-zinc-200'}`}
                                  >
                                    <span className="truncate">{doc.name}</span>
                                    <span className="text-[10px] text-zinc-400 dark:text-zinc-500 shrink-0 uppercase">
                                      {doc.sourceType === 'native-pdf' ? 'pdf' : 'md'}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </nav>
                  ) : (
                    <div className="text-[15px] tracking-tight text-zinc-900 dark:text-zinc-100">
                      <span className="font-light italic">info</span>
                      <span className="font-semibold not-italic">nugget</span>
                    </div>
                  )}

                  {/* Right: dark mode toggle + token/cost counter */}
                  <div className="w-48 shrink-0 flex items-center justify-end gap-1 relative" ref={usageDropdownRef}>
                    <button
                      onClick={toggleDarkMode}
                      className="w-6 h-6 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                      title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                    >
                      {darkMode ? (
                        <svg
                          width="13"
                          height="13"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <circle cx="12" cy="12" r="5" />
                          <line x1="12" y1="1" x2="12" y2="3" />
                          <line x1="12" y1="21" x2="12" y2="23" />
                          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                          <line x1="1" y1="12" x2="3" y2="12" />
                          <line x1="21" y1="12" x2="23" y2="12" />
                          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                        </svg>
                      ) : (
                        <svg
                          width="13"
                          height="13"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                        </svg>
                      )}
                    </button>
                    <button
                      onClick={() => setShowUsageDropdown((prev) => !prev)}
                      className={`text-[10px] transition-colors font-mono tracking-tight px-2 py-0.5 rounded hover:bg-zinc-50 dark:hover:bg-zinc-700 ${usageTotals.callCount > 0 ? 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300' : 'text-zinc-300 dark:text-zinc-600 hover:text-zinc-400 dark:hover:text-zinc-500'}`}
                      aria-expanded={showUsageDropdown}
                    >
                      {formatCost(usageTotals.totalCost)} ·{' '}
                      {formatTokens(usageTotals.totalInputTokens + usageTotals.totalOutputTokens)} tokens
                    </button>

                    {showUsageDropdown && (
                      <div className="absolute top-full right-0 mt-1 w-64 bg-white dark:bg-zinc-900 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-700 z-50 py-2 px-3 text-[11px] text-zinc-600 dark:text-zinc-300">
                        {/* Claude row */}
                        <div className="flex justify-between items-center py-1 border-b border-zinc-50 dark:border-zinc-700">
                          <span className="font-medium text-zinc-700 dark:text-zinc-300">Claude</span>
                          <span className="font-mono">{formatCost(usageTotals.claudeCost)}</span>
                        </div>
                        <div className="flex justify-between items-center py-0.5 text-[10px] text-zinc-400 dark:text-zinc-500 pl-2">
                          <span>
                            In: {formatTokens(usageTotals.claudeInputTokens)} · Out:{' '}
                            {formatTokens(usageTotals.claudeOutputTokens)}
                          </span>
                        </div>

                        {/* Gemini row */}
                        <div className="flex justify-between items-center py-1 border-b border-zinc-50 dark:border-zinc-700 mt-1">
                          <span className="font-medium text-zinc-700 dark:text-zinc-300">Gemini</span>
                          <span className="font-mono">{formatCost(usageTotals.geminiCost)}</span>
                        </div>
                        <div className="flex justify-between items-center py-0.5 text-[10px] text-zinc-400 dark:text-zinc-500 pl-2">
                          <span>
                            In: {formatTokens(usageTotals.geminiInputTokens)} · Out:{' '}
                            {formatTokens(usageTotals.geminiOutputTokens)}
                          </span>
                        </div>

                        {/* Cache savings */}
                        {usageTotals.totalCacheReadTokens > 0 && (
                          <div className="flex justify-between items-center py-0.5 text-[10px] text-zinc-400 dark:text-zinc-500 mt-1 border-t border-zinc-100 dark:border-zinc-700 pt-1">
                            <span>Cache reads</span>
                            <span className="font-mono">{formatTokens(usageTotals.totalCacheReadTokens)}</span>
                          </div>
                        )}

                        {/* Total */}
                        <div className="flex justify-between items-center py-1 mt-1 border-t border-zinc-100 dark:border-zinc-700 font-medium text-zinc-700 dark:text-zinc-300">
                          <span>Total ({usageTotals.callCount} calls)</span>
                          <span className="font-mono">{formatCost(usageTotals.totalCost)}</span>
                        </div>

                        {/* Reset button */}
                        <button
                          onClick={() => {
                            resetUsage();
                            setShowUsageDropdown(false);
                          }}
                          className="w-full mt-1.5 text-[10px] text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 rounded py-1 transition-colors"
                        >
                          Reset counters
                        </button>
                      </div>
                    )}
                  </div>
                </header>
              );
            })()}

            {/* 6-panel row: Projects | Sources | Chat | Auto-Deck | Cards | Assets */}
            <main className="flex flex-1 overflow-hidden gap-[4px] p-[4px]">
              {/* Panel 1: Projects */}
              <ErrorBoundary name="Projects">
                <ProjectsPanel
                  isOpen={expandedPanel === 'projects'}
                  onToggle={() =>
                    appGatedAction(() => setExpandedPanel((prev) => (prev === 'projects' ? null : 'projects')))
                  }
                  onSelectProject={(projectId) =>
                    appGatedAction(() => {
                      setReferenceImage(null);
                      setUseReferenceImage(false);
                      selectEntity({ projectId });
                    })
                  }
                  onSelectNugget={(id) =>
                    appGatedAction(() => {
                      setReferenceImage(null);
                      setUseReferenceImage(false);
                      selectEntity({ nuggetId: id });
                    })
                  }
                  onCreateProject={() => {
                    setProjectCreationChainToNugget(true);
                    setShowProjectCreation(true);
                  }}
                  onRenameProject={(id, newName) => {
                    updateProject(id, (p) => ({ ...p, name: newName, lastModifiedAt: Date.now() }));
                  }}
                  onToggleProjectCollapse={(id) => {
                    updateProject(id, (p) => ({ ...p, isCollapsed: !p.isCollapsed }));
                  }}
                  onCreateNuggetInProject={(projectId) => {
                    setNuggetCreationProjectId(projectId);
                    setShowNuggetCreation(true);
                  }}
                  onRenameNugget={(id, newName) => {
                    updateNugget(id, (n) => ({ ...n, name: newName, lastModifiedAt: Date.now() }));
                  }}
                  onCopyNuggetToProject={handleCopyNuggetToProject}
                  onMoveNuggetToProject={handleMoveNuggetToProject}
                  onCreateProjectForNugget={handleCreateProjectForNugget}
                  onDuplicateProject={handleDuplicateProject}
                  onRenameDocument={async (docId, newName) => {
                    // Re-upload to Files API with the new filename
                    const doc = selectedNugget?.documents.find((d) => d.id === docId);
                    if (doc?.fileId) {
                      try {
                        deleteFromFilesAPI(doc.fileId);
                        // Native PDFs: re-upload binary; Markdown docs: re-upload text content
                        const newFileId =
                          doc.sourceType === 'native-pdf' && doc.pdfBase64
                            ? await uploadToFilesAPI(
                                base64ToBlob(doc.pdfBase64, 'application/pdf'),
                                newName,
                                'application/pdf',
                              )
                            : doc.content
                              ? await uploadToFilesAPI(doc.content, newName, 'text/plain')
                              : undefined;
                        if (newFileId)
                          updateNuggetDocument(docId, {
                            ...doc,
                            name: newName,
                            fileId: newFileId,
                            lastRenamedAt: Date.now(),
                            version: (doc.version ?? 1) + 1,
                          });
                      } catch (err) {
                        console.warn('[App] Files API re-upload on rename failed:', err);
                      }
                    }
                    renameNuggetDocument(docId, newName);
                  }}
                  onRemoveDocument={(docId) => {
                    const doc = selectedNugget?.documents.find((d) => d.id === docId);
                    if (doc?.fileId) deleteFromFilesAPI(doc.fileId);
                    removeNuggetDocument(docId);
                  }}
                  onCopyMoveDocument={handleCopyMoveDocument}
                  onCreateNuggetWithDoc={handleCreateNuggetWithDoc}
                  onUploadDocuments={handleUploadDocuments}
                  onEditSubject={(nuggetId) => setSubjectEditNuggetId(nuggetId)}
                  onOpenCardsPanel={() => appGatedAction(() => setExpandedPanel(null))}
                  onOpenSourcesPanel={() => appGatedAction(() => setExpandedPanel('sources'))}
                  otherNuggets={otherNuggetsList}
                  projectNuggets={projectNuggetsList}
                />
              </ErrorBoundary>

              {selectedNugget ? (
                <>
                  {/* Hard lock overlay — blocks all UI while TOC has unsaved changes (SourcesPanel at z-[107] stays above) */}
                  {tocLockActive && expandedPanel === 'sources' && (
                    <div className="fixed inset-0 z-[106] bg-black/20 cursor-not-allowed" />
                  )}

                  {/* Panel 2: Sources */}
                  <ErrorBoundary name="Sources">
                    <SourcesPanel
                      ref={sourcesPanelRef}
                      isOpen={expandedPanel === 'sources'}
                      onToggle={() =>
                        appGatedAction(() => setExpandedPanel((prev) => (prev === 'sources' ? null : 'sources')))
                      }
                      documents={nuggetDocs}
                      onSaveDocument={handleSaveDocument}
                      onGenerateCardContent={handleGenerateCardContent}
                      generatingSourceIds={generatingSourceIds}
                      onUpdateDocumentStructure={(docId, newStructure) => {
                        const doc = nuggetDocs.find((d) => d.id === docId);
                        if (doc) updateNuggetDocument(docId, { ...doc, structure: newStructure });
                      }}
                      onSaveToc={handleSaveToc}
                      onSaveBookmarks={(docId, newBookmarks) => {
                        if (!selectedNugget) return;
                        const doc = selectedNugget.documents.find((d) => d.id === docId);
                        if (!doc) return;
                        const newStructure = flattenBookmarks(newBookmarks);
                        handleSaveToc(docId, newStructure);
                        // Also update bookmarks directly on the document
                        updateNuggetDocument(docId, {
                          ...doc,
                          bookmarks: newBookmarks,
                          structure: newStructure,
                          bookmarkSource: 'manual',
                        });
                      }}
                      onRegenerateBookmarks={async (docId) => {
                        if (!selectedNugget) return;
                        const doc = selectedNugget.documents.find((d) => d.id === docId);
                        if (!doc || !doc.pdfBase64) return;
                        // Re-extract via Gemini from the PDF file
                        const blob = base64ToBlob(doc.pdfBase64, 'application/pdf');
                        const file = new File([blob], doc.name, { type: 'application/pdf' });
                        const headings = await extractHeadingsWithGemini(file);
                        if (headings.length > 0) {
                          const bookmarks = headingsToBookmarks(headings);
                          updateNuggetDocument(docId, {
                            ...doc,
                            bookmarks,
                            bookmarkSource: 'ai_generated',
                            structure: headings,
                          });
                          addToast({
                            type: 'info',
                            message: `Regenerated ${headings.length} bookmarks via AI`,
                            duration: 5000,
                          });
                        } else {
                          addToast({ type: 'warning', message: 'AI extraction returned no bookmarks', duration: 5000 });
                        }
                      }}
                      onDirtyChange={setTocLockActive}
                    />
                  </ErrorBoundary>

                  {/* Panel 3: Chat */}
                  <ErrorBoundary name="Chat">
                    <ChatPanel
                      isOpen={expandedPanel === 'chat'}
                      onToggle={() =>
                        appGatedAction(() => setExpandedPanel((prev) => (prev === 'chat' ? null : 'chat')))
                      }
                      messages={insightsMessages}
                      isLoading={insightsLabLoading}
                      onSendMessage={sendInsightsMessage}
                      onSaveAsCard={handleSaveAsCard}
                      onClearChat={() => {
                        clearInsightsMessages();
                      }}
                      onStop={stopInsightsResponse}
                      documents={nuggetDocs}
                      pendingDocChanges={pendingDocChanges}
                      hasConversation={insightsHasConversation}
                      onDocChangeContinue={handleDocChangeContinue}
                      onDocChangeStartFresh={handleDocChangeStartFresh}
                    />
                  </ErrorBoundary>

                  {/* Panel 4: Auto-Deck */}
                  <ErrorBoundary name="Auto-Deck">
                    <AutoDeckPanel
                      isOpen={expandedPanel === 'auto-deck'}
                      onToggle={() =>
                        appGatedAction(() => setExpandedPanel((prev) => (prev === 'auto-deck' ? null : 'auto-deck')))
                      }
                      documents={nuggetDocs}
                      session={autoDeckSession}
                      onStartPlanning={autoDeckStartPlanning}
                      onRevisePlan={autoDeckRevisePlan}
                      onApprovePlan={autoDeckApprovePlan}
                      onAbort={autoDeckAbort}
                      onReset={autoDeckReset}
                      onToggleCardIncluded={autoDeckToggleCardIncluded}
                      onSetQuestionAnswer={autoDeckSetQuestionAnswer}
                      onSetAllRecommended={autoDeckSetAllRecommended}
                      onSetGeneralComment={autoDeckSetGeneralComment}
                      onRetryFromReview={autoDeckRetryFromReview}
                    />
                  </ErrorBoundary>

                  {/* Panel 5: Cards */}
                  <ErrorBoundary name="Cards">
                    <CardsPanel
                      ref={cardsPanelRef}
                      cards={nuggetCards}
                      hasSelectedNugget={!!selectedNugget}
                      onToggleSelection={toggleInsightsCardSelection}
                      onSelectExclusive={selectInsightsCardExclusive}
                      onSelectRange={selectInsightsCardRange}
                      onSelectAll={toggleSelectAllInsightsCards}
                      onDeselectAll={deselectAllInsightsCards}
                      onDeleteCard={deleteInsightsCard}
                      onDeleteSelectedCards={deleteSelectedInsightsCards}
                      onRenameCard={renameInsightsCard}
                      onCopyMoveCard={handleCopyMoveCard}
                      otherNuggets={otherNuggetsList}
                      projectNuggets={projectNuggetsList}
                      onCreateNuggetForCard={handleCreateNuggetForCard}
                      onCreateCustomCard={handleCreateCustomCard}
                      onSaveCardContent={handleSaveCardContent}
                      detailLevel={activeLogicTab}
                      onGenerateCardImage={wrappedGenerateCard}
                      onReorderCards={reorderInsightsCards}
                    />
                  </ErrorBoundary>

                  {/* Panel 5: Assets */}
                  <ErrorBoundary name="Assets">
                    <AssetsPanel
                      committedSettings={committedSettings}
                      menuDraftOptions={menuDraftOptions}
                      setMenuDraftOptions={setMenuDraftOptions}
                      activeLogicTab={activeLogicTab}
                      setActiveLogicTab={setActiveLogicTab}
                      genStatus={genStatus}
                      onGenerateCard={wrappedGenerateCard}
                      onGenerateAll={() => {
                        const cards = selectedNugget?.cards || [];
                        const selected = cards.filter((c) => c.selected);
                        if (selected.length === 0) {
                          alert('Please select cards first.');
                          return;
                        }
                        setManifestCards(selected);
                      }}
                      selectedCount={insightsSelectedCount}
                      onZoomImage={openZoom}
                      onImageModified={handleInsightsImageModified}
                      contentDirty={false}
                      currentContent={activeCard?.synthesisMap?.[activeCard?.detailLevel || activeLogicTab] || ''}
                      onDownloadImage={handleDownloadImage}
                      onDownloadAllImages={handleDownloadAllImages}
                      referenceImage={referenceImage}
                      onStampReference={handleStampReference}
                      useReferenceImage={useReferenceImage}
                      onToggleUseReference={() => setUseReferenceImage((prev) => !prev)}
                      onReferenceImageModified={handleReferenceImageModified}
                      onDeleteReference={handleDeleteReference}
                      mismatchDialog={mismatchDialog}
                      onDismissMismatch={() => setMismatchDialog(null)}
                      manifestCards={manifestCards}
                      onExecuteBatch={wrappedExecuteBatch}
                      onCloseManifest={() => setManifestCards(null)}
                      onDeleteCardImage={handleDeleteCardImage}
                      onDeleteCardVersions={handleDeleteCardVersions}
                      onDeleteAllCardImages={handleDeleteAllCardImages}
                      onUsage={recordUsage}
                      onOpenStyleStudio={() => setShowStyleStudio(true)}
                    />
                  </ErrorBoundary>
                </>
              ) : (
                <div
                  className="flex-1 flex flex-col items-center justify-center text-center px-8 transition-colors duration-200"
                  onDragOver={(e) => {
                    e.preventDefault();
                    setEmptyDragging(true);
                  }}
                  onDragLeave={() => setEmptyDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setEmptyDragging(false);
                  }}
                  style={emptyDragging ? { backgroundColor: 'rgba(42, 159, 212, 0.04)' } : undefined}
                >
                  <div
                    className={`w-12 h-12 bg-accent-blue rounded-full flex items-center justify-center shadow-lg shadow-[rgba(42,159,212,0.2)] mb-5 transition-transform duration-300 ${emptyDragging ? 'scale-110' : ''}`}
                  >
                    <div className="w-4 h-4 bg-white rounded-sm rotate-45" />
                  </div>
                  <h2 className="text-xl tracking-tight mb-1">
                    <span className="font-light italic">info</span>
                    <span className="font-semibold not-italic">nugget</span>
                  </h2>
                  {emptyDragging ? (
                    <p className="text-zinc-400 text-sm font-light mb-6 max-w-xs">Drop to upload</p>
                  ) : (
                    <>
                      <div className="mb-4">
                        <PanelRequirements level="sources" />
                      </div>
                      {nuggets.length === 0 ? (
                        <button
                          onClick={() => {
                            setProjectCreationChainToNugget(true);
                            setShowProjectCreation(true);
                          }}
                          className="px-5 py-2.5 rounded-xl bg-black text-white text-sm font-medium hover:shadow-lg hover:scale-105 active:scale-95 transition-all duration-200"
                        >
                          Create Project
                        </button>
                      ) : (
                        <button
                          onClick={() => setShowNuggetCreation(true)}
                          className="px-5 py-2.5 rounded-xl bg-black text-white text-sm font-medium hover:shadow-lg hover:scale-105 active:scale-95 transition-all duration-200"
                        >
                          Create New Nugget
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </main>

            {/* Footer */}
            <footer className="shrink-0 flex items-center justify-center py-1.5 border-t border-zinc-100 dark:border-zinc-700 bg-white dark:bg-zinc-900 relative z-[102]">
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500 tracking-wide">
                <span className="font-light italic tracking-tight">info</span>
                <span className="font-semibold not-italic tracking-tight">nugget</span>
                <span className="ml-1">
                  is AI powered and can make mistakes. Please double-check generated content and cards.
                </span>
              </p>
            </footer>
          </div>
        </>
      )}
    </div>
  );
};

export default App;
