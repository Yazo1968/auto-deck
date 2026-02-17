
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import ZoomOverlay from './components/ZoomOverlay';
import AssetLab from './components/AssetLab';
import { Heading, StylingOptions, DetailLevel, ZoomState, ReferenceImage, ChatMessage, UploadedFile, Nugget, Project } from './types';
import { DEFAULT_STYLING, detectSettingsMismatch } from './utils/ai';
import FileSidebar from './components/FileSidebar';
import { LandingPage } from './components/LandingPage';
import InsightsLabPanel, { InsightsLabPanelHandle } from './components/InsightsLabPanel';
import InsightsHeadingList from './components/InsightsHeadingList';

import { NuggetCreationModal } from './components/NuggetCreationModal';
import DocumentEditorModal from './components/DocumentEditorModal';
import { useAppContext } from './context/AppContext';
import { useCardGeneration } from './hooks/useCardGeneration';
import { useInsightsLab } from './hooks/useInsightsLab';
import { callClaude } from './utils/ai';
import { buildContentPrompt } from './utils/prompts/contentGeneration';
import { createPlaceholderDocument, processFileToDocument } from './utils/fileProcessing';

const App: React.FC = () => {
  const {
    isFileSidebarOpen, setIsFileSidebarOpen,
    activeHeadingId, setActiveHeadingId,
    activeHeading,
    insightsSession, setInsightsSession,
    nuggets,
    selectedNuggetId, setSelectedNuggetId,
    selectedNugget,
    addNugget, deleteNugget, updateNugget,
    updateNuggetHeading,
    addNuggetDocument, updateNuggetDocument, removeNuggetDocument, renameNuggetDocument, toggleNuggetDocument,
    projects, setProjects, addProject, deleteProject, updateProject, addNuggetToProject, removeNuggetFromProject,
  } = useAppContext();

  const [menuDraftOptions, setMenuDraftOptions] = useState<StylingOptions>(DEFAULT_STYLING);
  const [zoomState, setZoomState] = useState<ZoomState>({ imageUrl: null, headingId: null, headingText: null });

  // ── Reference image style anchoring ──
  const [referenceImage, setReferenceImage] = useState<ReferenceImage | null>(null);
  const [useReferenceImage, setUseReferenceImage] = useState(false);
  const [mismatchDialog, setMismatchDialog] = useState<{
    resolve: (decision: 'disable' | 'skip' | 'cancel') => void;
  } | null>(null);

  const {
    genStatus,
    activeLogicTab, setActiveLogicTab,
    manifestHeadings, setManifestHeadings,
    currentSynthesisContent, contentDirty, selectedCount,
    generateCardForHeading,
    handleGenerateAll,
    executeBatchCardGeneration,
    handleImageModified,
  } = useCardGeneration(menuDraftOptions, referenceImage, useReferenceImage);

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
  } = useInsightsLab();

  // ── Nugget modal state ──
  const [showNuggetCreation, setShowNuggetCreation] = useState(false);
  const [nuggetCreationProjectId, setNuggetCreationProjectId] = useState<string | null>(null);
  const [editingCardContent, setEditingCardContent] = useState<{
    headingId: string;
    level: DetailLevel;
  } | null>(null);

  // ── Nugget's owned documents (per-nugget, no shared library) ──
  const nuggetDocs = useMemo(() => {
    if (!selectedNugget) return [];
    return selectedNugget.documents;
  }, [selectedNugget]);

  // Handle nugget creation
  const handleCreateNugget = useCallback((nugget: Nugget) => {
    addNugget(nugget);
    setSelectedNuggetId(nugget.id);
    // Add to target project if specified
    if (nuggetCreationProjectId) {
      addNuggetToProject(nuggetCreationProjectId, nugget.id);
      setNuggetCreationProjectId(null);
    }
  }, [addNugget, setSelectedNuggetId, nuggetCreationProjectId, addNuggetToProject]);

  // Handle project creation
  const handleCreateProject = useCallback(() => {
    const now = Date.now();
    const project: Project = {
      id: `project-${now}-${Math.random().toString(36).substr(2, 9)}`,
      name: 'New Project',
      nuggetIds: [],
      createdAt: now,
      lastModifiedAt: now,
    };
    addProject(project);
  }, [addProject]);

  // Handle copying a nugget to another project (duplicate nugget)
  const handleCopyNuggetToProject = useCallback((nuggetId: string, targetProjectId: string) => {
    const nugget = nuggets.find(n => n.id === nuggetId);
    if (!nugget) return;
    const now = Date.now();
    const newNuggetId = `nugget-${now}-${Math.random().toString(36).substr(2, 9)}`;
    const copiedNugget: Nugget = {
      ...nugget,
      id: newNuggetId,
      name: `${nugget.name} (copy)`,
      documents: nugget.documents.map(d => ({ ...d, id: `doc-${Math.random().toString(36).substr(2, 9)}` })),
      headings: nugget.headings.map(h => ({ ...h, id: `heading-${Math.random().toString(36).substr(2, 9)}` })),
      messages: [...(nugget.messages || [])],
      createdAt: now,
      lastModifiedAt: now,
    };
    addNugget(copiedNugget);
    addNuggetToProject(targetProjectId, newNuggetId);
  }, [nuggets, addNugget, addNuggetToProject]);

  // Handle moving a nugget to another project (re-assign)
  const handleMoveNuggetToProject = useCallback((nuggetId: string, sourceProjectId: string, targetProjectId: string) => {
    removeNuggetFromProject(sourceProjectId, nuggetId);
    addNuggetToProject(targetProjectId, nuggetId);
  }, [removeNuggetFromProject, addNuggetToProject]);

  // Handle creating a new project for a nugget (copy or move)
  // Inlined logic to avoid stale closure issues — creates the project with the nugget already assigned
  const handleCreateProjectForNugget = useCallback((nuggetId: string, projectName: string, mode: 'copy' | 'move', sourceProjectId: string) => {
    const now = Date.now();
    const newProjectId = `project-${now}-${Math.random().toString(36).substr(2, 9)}`;

    if (mode === 'move') {
      // Move: create project with the nuggetId already included, remove from source
      const newProject: Project = {
        id: newProjectId,
        name: projectName,
        nuggetIds: [nuggetId],
        createdAt: now,
        lastModifiedAt: now,
      };
      // Single setProjects call: add new project + remove nugget from source
      setProjects(prev => [
        ...prev.map(p =>
          p.id === sourceProjectId
            ? { ...p, nuggetIds: p.nuggetIds.filter(id => id !== nuggetId), lastModifiedAt: now }
            : p
        ),
        newProject,
      ]);
    } else {
      // Copy: duplicate the nugget, create project with the copy's ID
      const nugget = nuggets.find(n => n.id === nuggetId);
      if (!nugget) return;
      const newNuggetId = `nugget-${now}-${Math.random().toString(36).substr(2, 9)}`;
      const copiedNugget: Nugget = {
        ...nugget,
        id: newNuggetId,
        name: `${nugget.name} (copy)`,
        documents: nugget.documents.map(d => ({ ...d, id: `doc-${Math.random().toString(36).substr(2, 9)}` })),
        headings: nugget.headings.map(h => ({ ...h, id: `heading-${Math.random().toString(36).substr(2, 9)}` })),
        messages: [...(nugget.messages || [])],
        createdAt: now,
        lastModifiedAt: now,
      };
      const newProject: Project = {
        id: newProjectId,
        name: projectName,
        nuggetIds: [newNuggetId],
        createdAt: now,
        lastModifiedAt: now,
      };
      addNugget(copiedNugget);
      setProjects(prev => [...prev, newProject]);
    }
  }, [nuggets, addNugget, setProjects]);

  // Save card content as heading in insights nugget
  const handleSaveAsHeading = useCallback((message: ChatMessage, editedContent: string) => {
    if (!selectedNugget || selectedNugget.type !== 'insights') return;
    const content = editedContent || message.content;

    // Extract title from first # heading line
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : 'Untitled Card';

    // Remove the title line from content body
    const bodyContent = content.replace(/^#\s+.+\n*/, '').trim();

    const headingId = `insight-${Math.random().toString(36).substr(2, 9)}`;
    const level = message.detailLevel || 'Standard';

    const activeDocNames = selectedNugget.documents
      .filter(d => d.enabled !== false && d.content)
      .map(d => d.name);

    const newHeading: Heading = {
      id: headingId,
      text: title,
      level: 1,
      selected: false,
      synthesisMap: { [level]: `# ${title}\n\n${bodyContent}` },
      isSynthesizingMap: {},
      settings: { ...menuDraftOptions, levelOfDetail: level },
      createdAt: Date.now(),
      sourceDocuments: activeDocNames,
    };

    // Add heading to nugget + mark message as saved
    updateNugget(selectedNugget.id, n => ({
      ...n,
      headings: [...n.headings, newHeading],
      messages: (n.messages || []).map(m =>
        m.id === message.id ? { ...m, savedAsHeadingId: headingId } : m
      ),
      lastModifiedAt: Date.now(),
    }));

    // Propagate to old state for backward compat
    setInsightsSession(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        headings: [...prev.headings, newHeading],
        messages: prev.messages.map(m =>
          m.id === message.id ? { ...m, savedAsHeadingId: headingId } : m
        ),
      };
    });

    // Select the new heading
    setActiveHeadingId(headingId);
  }, [selectedNugget, updateNugget, setInsightsSession, setActiveHeadingId, menuDraftOptions]);

  // Toggle selection for insights headings
  const toggleInsightsHeadingSelection = useCallback((headingId: string) => {
    if (!selectedNugget) return;
    updateNugget(selectedNugget.id, n => ({
      ...n,
      headings: n.headings.map(h =>
        h.id === headingId ? { ...h, selected: !h.selected } : h
      ),
      lastModifiedAt: Date.now(),
    }));
    // Propagate to old state
    setInsightsSession(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        headings: prev.headings.map(h =>
          h.id === headingId ? { ...h, selected: !h.selected } : h
        ),
      };
    });
  }, [selectedNugget, updateNugget, setInsightsSession]);

  // Select/deselect all insights headings
  const toggleSelectAllInsightsHeadings = useCallback(() => {
    if (!selectedNugget) return;
    const headings = selectedNugget.headings || [];
    const allSelected = headings.length > 0 && headings.every(h => h.selected);
    const newSelected = !allSelected;
    updateNugget(selectedNugget.id, n => ({
      ...n,
      headings: n.headings.map(h => ({ ...h, selected: newSelected })),
      lastModifiedAt: Date.now(),
    }));
    setInsightsSession(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        headings: prev.headings.map(h => ({ ...h, selected: newSelected })),
      };
    });
  }, [selectedNugget, updateNugget, setInsightsSession]);

  // Delete insights heading
  const deleteInsightsHeading = useCallback((headingId: string) => {
    if (!selectedNugget) return;
    updateNugget(selectedNugget.id, n => ({
      ...n,
      headings: n.headings.filter(h => h.id !== headingId),
      lastModifiedAt: Date.now(),
    }));
    // Propagate to old state
    setInsightsSession(prev => {
      if (!prev) return prev;
      return { ...prev, headings: prev.headings.filter(h => h.id !== headingId) };
    });
  }, [selectedNugget, updateNugget, setInsightsSession]);

  // Rename insights heading
  const renameInsightsHeading = useCallback((headingId: string, newName: string) => {
    updateNuggetHeading(headingId, h => ({ ...h, text: newName, lastEditedAt: Date.now() }));
  }, [updateNuggetHeading]);

  // Edit insights heading content (open card editor for a specific heading)
  const editInsightsHeading = useCallback((headingId: string) => {
    const heading = insightsSession?.headings?.find(h => h.id === headingId);
    if (!heading) return;
    const level = (heading.settings || DEFAULT_STYLING).levelOfDetail;
    setActiveHeadingId(headingId);
    setEditingCardContent({ headingId, level });
  }, [insightsSession]);

  // Handle image modified for insights headings
  const handleInsightsImageModified = useCallback((headingId: string, newImageUrl: string, history: any[]) => {
    if (!selectedNugget) return;
    const heading = selectedNugget.headings.find(h => h.id === headingId);
    const level = (heading?.settings || DEFAULT_STYLING).levelOfDetail;

    updateNugget(selectedNugget.id, n => ({
      ...n,
      headings: n.headings.map(h => {
        if (h.id !== headingId) return h;
        return {
          ...h,
          cardUrlMap: { ...(h.cardUrlMap || {}), [level]: newImageUrl },
          imageHistoryMap: { ...(h.imageHistoryMap || {}), [level]: history },
        };
      }),
      lastModifiedAt: Date.now(),
    }));
    // Propagate to old state
    setInsightsSession(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        headings: prev.headings.map(h => {
          if (h.id !== headingId) return h;
          return {
            ...h,
            cardUrlMap: { ...(h.cardUrlMap || {}), [level]: newImageUrl },
            imageHistoryMap: { ...(h.imageHistoryMap || {}), [level]: history },
          };
        }),
      };
    });
  }, [selectedNugget, updateNugget, setInsightsSession]);

  // Insights selected count
  const insightsSelectedCount = useMemo(() => {
    if (selectedNugget?.type === 'insights') {
      return selectedNugget.headings.filter(h => h.selected).length;
    }
    return insightsSession?.headings?.filter(h => h.selected).length || 0;
  }, [selectedNugget, insightsSession]);

  const [showLanding, setShowLanding] = useState(true);
  const handleLaunch = useCallback(() => setShowLanding(false), []);
  const [copied, setCopied] = useState(false);
  const [emptyDragging, setEmptyDragging] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(230);
  const isDraggingSidebar = useRef(false);
  const [chatPanelPercent, setChatPanelPercent] = useState(40); // % of container width
  const isDraggingChatPanel = useRef(false);
  const chatPanelContainerRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const insightsLabRef = useRef<InsightsLabPanelHandle>(null);
  const [sidebarCanScroll, setSidebarCanScroll] = useState(false);

  const committedSettings = useMemo(() => {
    return activeHeading?.settings || DEFAULT_STYLING;
  }, [activeHeading]);

  // Sync logic tab with current settings whenever heading changes
  useEffect(() => {
    if (committedSettings.levelOfDetail) {
      setActiveLogicTab(committedSettings.levelOfDetail);
    }
  }, [activeHeadingId, committedSettings.levelOfDetail]);

  // Keep menuDraftOptions.levelOfDetail in sync with activeLogicTab
  useEffect(() => {
    setMenuDraftOptions(prev => prev.levelOfDetail !== activeLogicTab ? { ...prev, levelOfDetail: activeLogicTab } : prev);
  }, [activeLogicTab]);

  // ── Global keyboard shortcuts ──
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setZoomState({ imageUrl: null, headingId: null, headingText: null });
        setManifestHeadings(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  // ── Sidebar resize drag ──
  const handleSidebarDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingSidebar.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingSidebar.current) return;
      const newWidth = Math.max(180, Math.min(500, e.clientX));
      setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => {
      isDraggingSidebar.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, []);

  const handleChatPanelDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingChatPanel.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (ev: MouseEvent) => {
      if (!isDraggingChatPanel.current || !chatPanelContainerRef.current) return;
      const containerRect = chatPanelContainerRef.current.getBoundingClientRect();
      const pct = ((ev.clientX - containerRect.left) / containerRect.width) * 100;
      setChatPanelPercent(Math.max(25, Math.min(75, pct)));
    };
    const handleMouseUp = () => {
      isDraggingChatPanel.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, []);

  // ── Sidebar scroll-more indicator detection ──
  const checkSidebarScrollable = useCallback((el: HTMLElement | null) => {
    if (!el) { setSidebarCanScroll(false); return; }
    const hasMore = el.scrollHeight - el.scrollTop - el.clientHeight > 20;
    setSidebarCanScroll(hasMore);
  }, []);

  useEffect(() => {
    const sidebar = sidebarRef.current;
    const onSidebarScroll = () => checkSidebarScrollable(sidebar);
    sidebar?.addEventListener('scroll', onSidebarScroll);
    const ro = new ResizeObserver(() => { onSidebarScroll(); });
    if (sidebar) ro.observe(sidebar);
    onSidebarScroll();
    return () => {
      sidebar?.removeEventListener('scroll', onSidebarScroll);
      ro.disconnect();
    };
  });

  const openZoom = useCallback((imageUrl: string) => {
    const settings = activeHeading?.settings || committedSettings;
    setZoomState({
      imageUrl,
      headingId: activeHeading?.id || null,
      headingText: activeHeading?.text || null,
      palette: settings.palette || null,
      imageHistory: activeHeading?.imageHistoryMap?.[activeLogicTab],
      aspectRatio: settings.aspectRatio,
      resolution: settings.resolution,
    });
  }, [activeHeading, committedSettings, activeLogicTab]);

  const closeZoom = useCallback(() => {
    setZoomState({ imageUrl: null, headingId: null, headingText: null });
  }, []);

  // ── Reference image stamp & mismatch ──
  const handleStampReference = useCallback(() => {
    const cardUrl = activeHeading?.cardUrlMap?.[activeLogicTab];
    if (!cardUrl) return;
    setReferenceImage({ url: cardUrl, settings: { ...menuDraftOptions } });
    setUseReferenceImage(true);
  }, [activeHeading, activeLogicTab, menuDraftOptions]);

  const handleReferenceImageModified = useCallback((newImageUrl: string) => {
    setReferenceImage(prev => prev ? { ...prev, url: newImageUrl } : prev);
  }, []);

  const handleDeleteReference = useCallback(() => {
    setReferenceImage(null);
    setUseReferenceImage(false);
  }, []);

  const showMismatchDialog = useCallback(() => {
    return new Promise<'disable' | 'skip' | 'cancel'>((resolve) => {
      setMismatchDialog({ resolve });
    });
  }, []);

  const wrappedGenerateCard = useCallback(async (heading: Heading) => {
    if (referenceImage && useReferenceImage) {
      if (detectSettingsMismatch(menuDraftOptions, referenceImage.settings)) {
        const decision = await showMismatchDialog();
        if (decision === 'cancel') return;
        if (decision === 'disable') setUseReferenceImage(false);
        if (decision === 'disable' || decision === 'skip') {
          await generateCardForHeading(heading, true);
          return;
        }
      }
    }
    await generateCardForHeading(heading);
  }, [referenceImage, useReferenceImage, menuDraftOptions, generateCardForHeading, showMismatchDialog]);

  const wrappedExecuteBatch = useCallback(async () => {
    if (referenceImage && useReferenceImage) {
      if (detectSettingsMismatch(menuDraftOptions, referenceImage.settings)) {
        const decision = await showMismatchDialog();
        if (decision === 'cancel') return;
        if (decision === 'disable') setUseReferenceImage(false);
      }
    }
    await executeBatchCardGeneration();
  }, [referenceImage, useReferenceImage, menuDraftOptions, executeBatchCardGeneration, showMismatchDialog]);

  const downloadDataUrl = useCallback((dataUrl: string, filename: string) => {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    a.click();
  }, []);

  const handleDownloadImage = useCallback(() => {
    const url = activeHeading?.cardUrlMap?.[activeLogicTab];
    if (!url) return;
    const slug = activeHeading!.text.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 40);
    downloadDataUrl(url, `${slug}-${activeLogicTab.toLowerCase()}.png`);
  }, [activeHeading, activeLogicTab, downloadDataUrl]);

  const handleDownloadAllImages = useCallback(() => {
    if (!selectedNugget) return;
    for (const heading of selectedNugget.headings) {
      const url = heading.cardUrlMap?.[activeLogicTab];
      if (!url) continue;
      const slug = heading.text.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 40);
      downloadDataUrl(url, `${slug}-${activeLogicTab.toLowerCase()}.png`);
    }
  }, [selectedNugget, activeLogicTab, downloadDataUrl]);

  // ── Card content editing (opens universal editor) ──
  const handleEditCardContent = useCallback(() => {
    if (!activeHeadingId) return;
    setEditingCardContent({
      headingId: activeHeadingId,
      level: activeLogicTab,
    });
  }, [activeHeadingId, activeLogicTab]);

  return (
    <div className="min-h-screen bg-white">
      {showLanding ? (
        <LandingPage onLaunch={handleLaunch} />
      ) : (
      <>
      {/* Nugget modals */}
      {showNuggetCreation && (
        <NuggetCreationModal
          nuggets={nuggets}
          onCreateNugget={handleCreateNugget}
          onClose={() => setShowNuggetCreation(false)}
        />
      )}
      {editingCardContent && (() => {
        const heading = insightsSession?.headings?.find(h => h.id === editingCardContent.headingId)
          || selectedNugget?.headings?.find(h => h.id === editingCardContent.headingId);
        const content = heading?.synthesisMap?.[editingCardContent.level] || '';
        if (!content || !heading) return null;
        return (
          <DocumentEditorModal
            document={{ id: editingCardContent.headingId, name: heading.text, content } as UploadedFile}
            onSave={(newContent) => {
              updateNuggetHeading(editingCardContent.headingId, h => ({
                ...h,
                synthesisMap: { ...(h.synthesisMap || {}), [editingCardContent.level]: newContent },
                lastEditedAt: Date.now(),
              }));
              setEditingCardContent(null);
            }}
            onClose={() => setEditingCardContent(null)}
          />
        );
      })()}

      {/* Zoom Overlay */}
      {zoomState.imageUrl && <ZoomOverlay zoomState={zoomState} onClose={closeZoom} />}

      <div className="flex flex-col h-screen overflow-hidden">

        <div className="flex flex-1 overflow-hidden">
          {/* File Sidebar */}
          <FileSidebar
            isOpen={isFileSidebarOpen}
            onToggle={() => setIsFileSidebarOpen(prev => !prev)}
            nuggets={nuggets}
            projects={projects}
            selectedNuggetId={selectedNuggetId}
            onSelectNugget={(id) => {
              setReferenceImage(null);
              setUseReferenceImage(false);
              setSelectedNuggetId(id);
            }}
            onCreateProject={handleCreateProject}
            onRenameProject={(id, newName) => {
              updateProject(id, p => ({ ...p, name: newName, lastModifiedAt: Date.now() }));
            }}
            onDeleteProject={(id) => deleteProject(id)}
            onToggleProjectCollapse={(id) => {
              updateProject(id, p => ({ ...p, isCollapsed: !p.isCollapsed }));
            }}
            onCreateNuggetInProject={(projectId) => {
              setNuggetCreationProjectId(projectId);
              setShowNuggetCreation(true);
            }}
            onRenameNugget={(id, newName) => {
              updateNugget(id, n => ({ ...n, name: newName, lastModifiedAt: Date.now() }));
            }}
            onDeleteNugget={(id) => deleteNugget(id)}
            onCopyNuggetToProject={handleCopyNuggetToProject}
            onMoveNuggetToProject={handleMoveNuggetToProject}
            onCreateProjectForNugget={handleCreateProjectForNugget}
          />

          {/* Main content area (everything except FileSidebar) */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Active nugget header */}
            {selectedNugget && (() => {
              const parentProject = projects.find(p => p.nuggetIds.includes(selectedNugget.id));
              return (
                <div className="shrink-0 h-9 flex items-center justify-center px-5 border-b border-zinc-200 bg-white relative">
                  <div className="flex items-baseline gap-0 min-w-0 text-[16px] tracking-tight text-black">
                    {parentProject && (
                      <>
                        <span className="font-light italic text-[14px]">project</span>
                        <span className="mx-1.5" />
                        <span className="font-semibold not-italic truncate">{parentProject.name}</span>
                        <span className="mx-2 text-zinc-300 font-light">|</span>
                      </>
                    )}
                    <span className="font-light italic text-[14px]">nugget</span>
                    <span className="mx-1.5" />
                    <span className="font-semibold not-italic truncate">{selectedNugget.name}</span>
                  </div>
                </div>
              );
            })()}

            <div className="flex flex-1 overflow-hidden">
          {/* Nuggetcards Sidebar */}
          <aside
            style={{ width: sidebarWidth }}
            className="border-r border-zinc-200 shrink-0 relative flex flex-col bg-[#fafafa]"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => e.preventDefault()}
          >
            <div className="px-5 h-[36px] flex items-center justify-center gap-2.5 shrink-0">
              <span className="text-[20px] tracking-tight text-black"><span className="font-light italic">cards</span><span className="font-semibold not-italic">content</span></span>
            </div>
            {selectedNugget && (selectedNugget.headings?.length ?? 0) > 0 && (() => {
              const headings = selectedNugget.headings || [];
              const allSelected = headings.every(h => h.selected);
              const someSelected = headings.some(h => h.selected) && !allSelected;
              return (
                <button
                  onClick={toggleSelectAllInsightsHeadings}
                  className="shrink-0 flex items-center gap-2 px-5 pb-1.5 group"
                >
                  <span className={`w-4 h-4 rounded flex items-center justify-center transition-colors ${
                    allSelected
                      ? 'bg-zinc-900 border border-zinc-900'
                      : someSelected
                        ? 'bg-zinc-400 border border-zinc-400'
                        : 'bg-white border border-zinc-300 group-hover:border-zinc-400'
                  }`}>
                    {allSelected && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                    {someSelected && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                    )}
                  </span>
                  <span className="text-[11px] text-zinc-400 group-hover:text-zinc-600 transition-colors">Select all cards</span>
                </button>
              );
            })()}

            {selectedNugget ? (
              <>
                {/* Heading list */}
                <div ref={sidebarRef} className="flex-1 overflow-y-auto px-2 pb-4">
                  <InsightsHeadingList
                    headings={insightsSession?.headings || []}
                    activeHeadingId={activeHeadingId}
                    onHeadingClick={setActiveHeadingId}
                    onHeadingDoubleClick={(id) => {
                      setActiveHeadingId(id);
                      insightsLabRef.current?.switchToCardView();
                    }}
                    onToggleSelection={toggleInsightsHeadingSelection}
                    onDeleteHeading={deleteInsightsHeading}
                    onRenameHeading={renameInsightsHeading}
                    onEditHeading={editInsightsHeading}
                  />
                </div>
              </>
            ) : (
              <div ref={sidebarRef} className="flex-1 overflow-y-auto px-4 pb-4" />
            )}

            {sidebarCanScroll && (
              <div className="absolute bottom-0 left-0 right-0 flex justify-center pb-3 pt-8 pointer-events-none bg-gradient-to-t from-[#fafafa] via-[#fafafa]/80 to-transparent">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-zinc-300"><circle cx="12" cy="12" r="10"/><path d="M8 12l4 4 4-4" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
            )}
          </aside>

          {/* Drag handle */}
          <div onMouseDown={handleSidebarDragStart} className="w-1 shrink-0 cursor-col-resize hover:bg-acid-lime/40 active:bg-acid-lime/60 transition-colors duration-150 z-10 -ml-px" />

          <div ref={chatPanelContainerRef} className="flex-1 flex overflow-hidden">
            {selectedNugget && insightsSession ? (
              <>
                {/* Insights Lab Panel */}
                <InsightsLabPanel
                  ref={insightsLabRef}
                  messages={insightsMessages}
                  isLoading={insightsLabLoading}
                  onSendMessage={sendInsightsMessage}
                  onSaveAsHeading={handleSaveAsHeading}
                  onClearChat={() => {
                    clearInsightsMessages();
                    // Also propagate to old state for backward compat
                    setInsightsSession(prev => prev ? { ...prev, messages: [] } : prev);
                  }}
                  onStop={stopInsightsResponse}
                  widthPercent={chatPanelPercent}
                  activeHeading={activeHeading || null}
                  activeLogicTab={activeLogicTab}
                  onEditCardContent={handleEditCardContent}
                  documents={nuggetDocs}
                  onGenerateCardContent={async (_editorHeadingId, detailLevel, headingText) => {
                    if (!selectedNugget || !headingText) return;

                    // Gather document content from all enabled nugget documents
                    const enabledDocs = selectedNugget.documents.filter(d => d.enabled !== false && d.content);
                    const fullDocument = enabledDocs.map(d => d.content).join('\n\n---\n\n');
                    if (!fullDocument) return;

                    // Find the section text for this heading
                    const escapedText = headingText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const headingRegex = new RegExp(`^(#{1,6})\\s+${escapedText}\\s*$`, 'gm');
                    const match = headingRegex.exec(fullDocument);
                    const startOffset = match ? match.index : 0;
                    // Find the next same-or-higher-level heading to delimit the section
                    const headingLevel = match ? match[1].length : 1;
                    const nextHeadingRegex = new RegExp(`^#{1,${headingLevel}}\\s+`, 'gm');
                    nextHeadingRegex.lastIndex = startOffset + (match ? match[0].length : 0);
                    const nextMatch = nextHeadingRegex.exec(fullDocument);
                    const sectionText = fullDocument.substring(startOffset, nextMatch ? nextMatch.index : fullDocument.length);

                    // Build prompt and call Claude
                    const synthesisPrompt = buildContentPrompt(headingText, detailLevel, fullDocument, sectionText, true);

                    try {
                      let synthesizedText = await callClaude(synthesisPrompt, {
                        systemBlocks: [
                          { text: 'You are an expert content synthesizer. You extract, restructure, and condense document content into infographic-ready text. Follow the formatting and word count requirements precisely.', cache: false },
                          { text: `FULL DOCUMENT CONTEXT:\n${fullDocument}`, cache: true },
                        ],
                        maxTokens: 4096,
                      });
                      // Strip any leading H1 that Claude may have included, then re-add with the correct title
                      synthesizedText = synthesizedText.replace(/^\s*#\s+[^\n]*\n*/, '');
                      synthesizedText = `# ${headingText}\n\n${synthesizedText.trimStart()}`;

                      // Create a new card heading with the synthesized content
                      const newHeadingId = `insight-${Math.random().toString(36).substr(2, 9)}`;
                      const activeDocNames = enabledDocs.map(d => d.name);

                      const newHeading: Heading = {
                        id: newHeadingId,
                        text: headingText,
                        level: 1,
                        selected: false,
                        synthesisMap: { [detailLevel]: synthesizedText },
                        isSynthesizingMap: {},
                        settings: { ...menuDraftOptions, levelOfDetail: detailLevel },
                        createdAt: Date.now(),
                        sourceDocuments: activeDocNames,
                      };

                      // Add heading to nugget
                      updateNugget(selectedNugget.id, n => ({
                        ...n,
                        headings: [...n.headings, newHeading],
                        lastModifiedAt: Date.now(),
                      }));

                      // Propagate to old state for backward compat
                      setInsightsSession(prev => {
                        if (!prev) return prev;
                        return { ...prev, headings: [...prev.headings, newHeading] };
                      });

                      // Select the new heading
                      setActiveHeadingId(newHeadingId);
                    } catch (err) {
                      console.error('Generate card content failed:', err);
                    }
                  }}
                  onSaveDocument={(docId, newContent) => {
                    if (!selectedNugget) return;
                    const doc = selectedNugget.documents.find(d => d.id === docId);
                    if (doc) updateNuggetDocument(docId, { ...doc, content: newContent });
                  }}
                  onToggleDocument={(docId) => toggleNuggetDocument(docId)}
                  onRenameDocument={(docId, newName) => renameNuggetDocument(docId, newName)}
                  onRemoveDocument={(docId) => removeNuggetDocument(docId)}
                  onCopyMoveDocument={(docId, targetNuggetId, mode) => {
                    if (!selectedNugget) return;
                    const doc = selectedNugget.documents.find(d => d.id === docId);
                    if (!doc) return;
                    // Copy the document to the target nugget with a new ID
                    const newDocId = `doc-${Math.random().toString(36).substr(2, 9)}`;
                    const docCopy: UploadedFile = { ...doc, id: newDocId };
                    // Add to target nugget
                    updateNugget(targetNuggetId, n => ({
                      ...n,
                      documents: [...n.documents, docCopy],
                      lastModifiedAt: Date.now(),
                    }));
                    // If move, also remove from source nugget
                    if (mode === 'move') {
                      removeNuggetDocument(docId);
                    }
                  }}
                  otherNuggets={nuggets.filter(n => n.id !== selectedNugget?.id).map(n => ({ id: n.id, name: n.name }))}
                  projectNuggets={projects.map(p => ({
                    projectId: p.id,
                    projectName: p.name,
                    nuggets: p.nuggetIds
                      .filter(nid => nid !== selectedNugget?.id)
                      .map(nid => nuggets.find(n => n.id === nid))
                      .filter((n): n is Nugget => !!n)
                      .map(n => ({ id: n.id, name: n.name })),
                  }))}
                  onCreateNuggetWithDoc={(nuggetName, docId) => {
                    if (!selectedNugget) return;
                    const doc = selectedNugget.documents.find(d => d.id === docId);
                    if (!doc) return;
                    const newDocId = `doc-${Math.random().toString(36).substr(2, 9)}`;
                    const docCopy: UploadedFile = { ...doc, id: newDocId };
                    const newNugget: Nugget = {
                      id: `nugget-${Math.random().toString(36).substr(2, 9)}`,
                      name: nuggetName,
                      type: 'insights',
                      documents: [docCopy],
                      headings: [],
                      messages: [],
                      createdAt: Date.now(),
                      lastModifiedAt: Date.now(),
                    };
                    addNugget(newNugget);
                    // Add to same project as the source nugget
                    const sourceProject = projects.find(p => p.nuggetIds.includes(selectedNugget.id));
                    if (sourceProject) {
                      addNuggetToProject(sourceProject.id, newNugget.id);
                    }
                  }}
                  onUploadDocuments={async (files) => {
                    for (const file of Array.from(files)) {
                      const placeholder = createPlaceholderDocument(file);
                      addNuggetDocument(placeholder);
                      processFileToDocument(file, placeholder.id)
                        .then(processed => updateNuggetDocument(placeholder.id, processed))
                        .catch(() => updateNuggetDocument(placeholder.id, { ...placeholder, status: 'error' as const }));
                    }
                  }}
                  pendingDocChanges={pendingDocChanges}
                  hasConversation={insightsHasConversation}
                  onDocChangeContinue={handleDocChangeContinue}
                  onDocChangeStartFresh={handleDocChangeStartFresh}
                />

                {/* Insights lab drag handle */}
                <div onMouseDown={handleChatPanelDragStart} className="w-px shrink-0 cursor-col-resize bg-zinc-200 hover:bg-acid-lime/40 active:bg-acid-lime/60 transition-colors duration-150 z-10" />

                {/* Asset Laboratory Panel */}
                <AssetLab
                  activeHeading={activeHeading}
                  committedSettings={committedSettings}
                  menuDraftOptions={menuDraftOptions}
                  setMenuDraftOptions={setMenuDraftOptions}
                  activeLogicTab={activeLogicTab}
                  setActiveLogicTab={setActiveLogicTab}
                  genStatus={genStatus}
                  onGenerateCard={wrappedGenerateCard}
                  onGenerateAll={() => {
                    const headings = selectedNugget?.headings || [];
                    const selected = headings.filter(h => h.selected);
                    if (selected.length === 0) { alert('Please select headings first.'); return; }
                    setManifestHeadings(selected);
                  }}
                  selectedCount={insightsSelectedCount}
                  onZoomImage={openZoom}
                  onImageModified={handleInsightsImageModified}
                  contentDirty={false}
                  currentContent={activeHeading?.synthesisMap?.[(activeHeading?.settings || DEFAULT_STYLING).levelOfDetail] || ''}
                  onDownloadImage={handleDownloadImage}
                  onDownloadAllImages={handleDownloadAllImages}
                  referenceImage={referenceImage}
                  onStampReference={handleStampReference}
                  useReferenceImage={useReferenceImage}
                  onToggleUseReference={() => setUseReferenceImage(prev => !prev)}
                  onReferenceImageModified={handleReferenceImageModified}
                  onDeleteReference={handleDeleteReference}
                  mismatchDialog={mismatchDialog}
                  onDismissMismatch={() => setMismatchDialog(null)}
                  manifestHeadings={manifestHeadings}
                  onExecuteBatch={wrappedExecuteBatch}
                  onCloseManifest={() => setManifestHeadings(null)}
                />
              </>
            ) : (
              <div
                className="flex-1 flex flex-col items-center justify-center text-center px-8 transition-colors duration-200"
                onDragOver={(e) => { e.preventDefault(); setEmptyDragging(true); }}
                onDragLeave={() => setEmptyDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setEmptyDragging(false);
                }}
                style={emptyDragging ? { backgroundColor: 'rgba(204, 255, 0, 0.04)' } : undefined}
              >
                <div className={`w-12 h-12 bg-acid-lime rounded-full flex items-center justify-center shadow-lg shadow-[#ccff0033] mb-5 transition-transform duration-300 ${emptyDragging ? 'scale-110' : ''}`}>
                  <div className="w-4 h-4 bg-white rounded-sm rotate-45" />
                </div>
                <h2 className="text-xl tracking-tight mb-1">
                  <span className="font-light italic">info</span><span className="font-semibold not-italic">nugget</span>
                </h2>
                {emptyDragging ? (
                  <p className="text-zinc-400 text-sm font-light mb-6 max-w-xs">Drop to upload</p>
                ) : nuggets.length === 0 ? (
                  <>
                    <p className="text-zinc-400 text-sm font-light mb-6 max-w-xs">
                      Create your first nugget to start building infographics.
                    </p>
                    <button
                      onClick={() => setShowNuggetCreation(true)}
                      className="px-5 py-2.5 rounded-xl bg-black text-white text-sm font-medium hover:shadow-lg hover:scale-105 active:scale-95 transition-all duration-200"
                    >
                      Create Nugget
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-zinc-400 text-sm font-light mb-6 max-w-xs">
                      Select a nugget from the sidebar or create a new one.
                    </p>
                    <button
                      onClick={() => setShowNuggetCreation(true)}
                      className="px-5 py-2.5 rounded-xl bg-black text-white text-sm font-medium hover:shadow-lg hover:scale-105 active:scale-95 transition-all duration-200"
                    >
                      Create New Nugget
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="shrink-0 flex items-center justify-center py-1.5 border-t border-zinc-100 bg-white">
          <p className="text-[10px] text-zinc-400 tracking-wide">
            <span className="font-light italic tracking-tight">info</span><span className="font-semibold not-italic tracking-tight">nugget</span>
            <span className="ml-1">is AI powered and can make mistakes. Please double-check generated content and cards.</span>
          </p>
        </footer>
      </div>
      </>
      )}
    </div>
  );
};

export default App;
