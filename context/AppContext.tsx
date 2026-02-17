
import React, { createContext, useContext, useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { UploadedFile, Heading, WorkflowMode, InsightsSession, InsightsDocument, Nugget, Project, InitialPersistedState, ChatMessage, DocChangeEvent } from '../types';

// ── Context shape ──
interface AppContextValue {
  // Core state
  isFileSidebarOpen: boolean;
  setIsFileSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  activeHeadingId: string | null;
  setActiveHeadingId: React.Dispatch<React.SetStateAction<string | null>>;

  // Workflow state
  insightsSession: InsightsSession | null;
  setInsightsSession: React.Dispatch<React.SetStateAction<InsightsSession | null>>;

  // Derived values
  activeHeading: Heading | null;

  // Nugget state
  nuggets: Nugget[];
  setNuggets: React.Dispatch<React.SetStateAction<Nugget[]>>;
  selectedNuggetId: string | null;
  setSelectedNuggetId: React.Dispatch<React.SetStateAction<string | null>>;

  // Derived nugget values
  selectedNugget: Nugget | undefined;

  // Helpers
  addNugget: (nugget: Nugget) => void;
  deleteNugget: (nuggetId: string) => void;
  updateNugget: (nuggetId: string, updater: (n: Nugget) => Nugget) => void;

  updateNuggetHeading: (headingId: string, updater: (h: Heading) => Heading) => void;
  updateNuggetHeadings: (updater: (h: Heading) => Heading) => void;
  updateNuggetContentAndHeadings: (content: string, headings: Heading[]) => void;
  appendNuggetMessage: (message: ChatMessage) => void;

  // Nugget document mutation helpers
  addNuggetDocument: (doc: UploadedFile) => void;
  updateNuggetDocument: (docId: string, updated: UploadedFile) => void;
  removeNuggetDocument: (docId: string) => void;
  renameNuggetDocument: (docId: string, newName: string) => void;
  toggleNuggetDocument: (docId: string) => void;

  // Project state
  projects: Project[];
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;

  // Project helpers
  addProject: (project: Project) => void;
  deleteProject: (projectId: string) => void;
  updateProject: (projectId: string, updater: (p: Project) => Project) => void;
  addNuggetToProject: (projectId: string, nuggetId: string) => void;
  removeNuggetFromProject: (projectId: string, nuggetId: string) => void;

}

const AppContext = createContext<AppContextValue | null>(null);

// ── Hook to consume context ──
export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used inside <AppProvider>');
  return ctx;
}

// ── Provider ──
export const AppProvider: React.FC<{
  children: React.ReactNode;
  initialState?: InitialPersistedState;
}> = ({ children, initialState }) => {
  // Core state
  const [isFileSidebarOpen, setIsFileSidebarOpen] = useState(true);
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(initialState?.activeHeadingId ?? null);

  // Insights session (backward compat shim for nugget data)
  const [insightsSession, setInsightsSession] = useState<InsightsSession | null>(initialState?.insightsSession ?? null);

  // Nugget state (documents are now owned per-nugget, no global library)
  const [nuggets, setNuggets] = useState<Nugget[]>(initialState?.nuggets ?? []);
  const [selectedNuggetId, setSelectedNuggetId] = useState<string | null>(initialState?.selectedNuggetId ?? null);

  // Project state
  const [projects, setProjects] = useState<Project[]>(initialState?.projects ?? []);

  // Derived: selected nugget
  const selectedNugget = useMemo(
    () => nuggets.find(n => n.id === selectedNuggetId),
    [nuggets, selectedNuggetId],
  );

  // ── Compatibility shim: selectedNuggetId → populate insights session ──
  const shimReady = useRef(false);
  useEffect(() => {
    const timer = setTimeout(() => { shimReady.current = true; }, 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!shimReady.current) return;
    const nugget = nuggets.find(n => n.id === selectedNuggetId);

    if (!nugget) {
      setInsightsSession(null);
      return;
    }

    // Build synthetic session from nugget's owned documents
    const syntheticSession: InsightsSession = {
      id: nugget.id,
      documents: nugget.documents.map(doc => ({
        id: doc.id,
        name: doc.name,
        type: (doc.type === 'application/pdf' ? 'pdf'
          : doc.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ? 'docx'
          : 'md') as 'md' | 'pdf' | 'docx',
        size: doc.size,
        content: doc.content,
      })),
      messages: nugget.messages ?? [],
      headings: nugget.headings,
    };
    setInsightsSession(syntheticSession);
  }, [selectedNuggetId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Reverse sync: insights session changes → update active nugget ──
  useEffect(() => {
    if (!shimReady.current || !selectedNuggetId || !insightsSession) return;
    const nugget = nuggets.find(n => n.id === selectedNuggetId);
    if (!nugget) return;
    setNuggets(prev => prev.map(n =>
      n.id === selectedNuggetId
        ? {
            ...n,
            messages: insightsSession.messages,
            headings: insightsSession.headings,
            lastModifiedAt: Date.now(),
          }
        : n
    ));
  }, [insightsSession]); // eslint-disable-line react-hooks/exhaustive-deps

  // Derived: currently active heading — from nugget/insights headings
  const activeHeading = useMemo(() => {
    const headings = selectedNugget?.headings ?? insightsSession?.headings ?? [];
    if (headings.length === 0) return null;
    return headings.find(h => h.id === activeHeadingId) || headings[0];
  }, [selectedNugget, insightsSession, activeHeadingId]);

  // Nugget helpers
  const addNugget = useCallback((nugget: Nugget) => {
    setNuggets(prev => [...prev, nugget]);
  }, []);

  const deleteNugget = useCallback((nuggetId: string) => {
    setNuggets(prev => prev.filter(n => n.id !== nuggetId));
    // Also remove from whichever project contains it
    setProjects(prev => prev.map(p =>
      p.nuggetIds.includes(nuggetId)
        ? { ...p, nuggetIds: p.nuggetIds.filter(id => id !== nuggetId), lastModifiedAt: Date.now() }
        : p
    ));
    if (selectedNuggetId === nuggetId) {
      setSelectedNuggetId(null);
    }
  }, [selectedNuggetId]);

  const updateNugget = useCallback((nuggetId: string, updater: (n: Nugget) => Nugget) => {
    setNuggets(prev => prev.map(n => n.id === nuggetId ? updater(n) : n));
  }, []);

  // ── Unified nugget helpers ──

  const updateNuggetHeading = useCallback((headingId: string, updater: (h: Heading) => Heading) => {
    if (!selectedNuggetId) return;
    const mapFn = (h: Heading) => h.id === headingId ? updater(h) : h;

    setNuggets(prev => prev.map(n =>
      n.id === selectedNuggetId
        ? { ...n, headings: n.headings.map(mapFn), lastModifiedAt: Date.now() }
        : n
    ));

    if (insightsSession) {
      setInsightsSession(prev => prev ? { ...prev, headings: prev.headings.map(mapFn) } : prev);
    }
  }, [selectedNuggetId, insightsSession]);

  const updateNuggetHeadings = useCallback((updater: (h: Heading) => Heading) => {
    if (!selectedNuggetId) return;

    setNuggets(prev => prev.map(n =>
      n.id === selectedNuggetId
        ? { ...n, headings: n.headings.map(updater), lastModifiedAt: Date.now() }
        : n
    ));

    if (insightsSession) {
      setInsightsSession(prev => prev ? { ...prev, headings: prev.headings.map(updater) } : prev);
    }
  }, [selectedNuggetId, insightsSession]);

  const updateNuggetContentAndHeadings = useCallback((content: string, headings: Heading[]) => {
    if (!selectedNuggetId) return;
    setNuggets(prev => prev.map(n =>
      n.id === selectedNuggetId
        ? { ...n, headings, lastModifiedAt: Date.now() }
        : n
    ));
  }, [selectedNuggetId]);

  const appendNuggetMessage = useCallback((message: ChatMessage) => {
    if (!selectedNuggetId) return;
    setNuggets(prev => prev.map(n =>
      n.id === selectedNuggetId
        ? { ...n, messages: [...(n.messages || []), message], lastModifiedAt: Date.now() }
        : n
    ));
    setInsightsSession(prev => prev ? { ...prev, messages: [...prev.messages, message] } : prev);
  }, [selectedNuggetId]);

  // ── Nugget document mutation helpers ──

  /** Convert UploadedFile → InsightsDocument for session sync */
  const toInsightsDoc = useCallback((doc: UploadedFile): InsightsDocument => ({
    id: doc.id,
    name: doc.name,
    type: (doc.type === 'application/pdf' ? 'pdf'
      : doc.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ? 'docx'
      : 'md') as 'md' | 'pdf' | 'docx',
    size: doc.size,
    content: doc.content,
  }), []);

  const addNuggetDocument = useCallback((doc: UploadedFile) => {
    if (!selectedNuggetId) return;
    const event: DocChangeEvent = { type: 'added', docId: doc.id, docName: doc.name, timestamp: Date.now() };
    setNuggets(prev => prev.map(n =>
      n.id === selectedNuggetId
        ? { ...n, documents: [...n.documents, doc], docChangeLog: [...(n.docChangeLog || []), event], lastModifiedAt: Date.now() }
        : n
    ));
    // Sync insights session
    setInsightsSession(prev => {
      if (!prev) return prev;
      return { ...prev, documents: [...prev.documents, toInsightsDoc(doc)] };
    });
  }, [selectedNuggetId, toInsightsDoc]);

  const updateNuggetDocument = useCallback((docId: string, updated: UploadedFile) => {
    if (!selectedNuggetId) return;
    const event: DocChangeEvent = { type: 'updated', docId, docName: updated.name, timestamp: Date.now() };
    setNuggets(prev => prev.map(n => {
      if (n.id !== selectedNuggetId) return n;
      // Only log if the doc was already fully processed (skip placeholder→ready transitions)
      const existing = n.documents.find(d => d.id === docId);
      const shouldLog = existing && existing.status === 'ready' && updated.status === 'ready';
      return {
        ...n,
        documents: n.documents.map(d => d.id === docId ? updated : d),
        ...(shouldLog ? { docChangeLog: [...(n.docChangeLog || []), event] } : {}),
        lastModifiedAt: Date.now(),
      };
    }));
    // Sync insights session
    setInsightsSession(prev => {
      if (!prev) return prev;
      const exists = prev.documents.some(d => d.id === docId);
      if (exists) {
        return { ...prev, documents: prev.documents.map(d => d.id === docId ? toInsightsDoc(updated) : d) };
      }
      // Doc was a placeholder that just finished processing — add it
      return { ...prev, documents: [...prev.documents, toInsightsDoc(updated)] };
    });
  }, [selectedNuggetId, toInsightsDoc, nuggets]);

  const removeNuggetDocument = useCallback((docId: string) => {
    if (!selectedNuggetId) return;
    setNuggets(prev => prev.map(n => {
      if (n.id !== selectedNuggetId) return n;
      const doc = n.documents.find(d => d.id === docId);
      const event: DocChangeEvent = { type: 'removed', docId, docName: doc?.name || 'Unknown', timestamp: Date.now() };
      return { ...n, documents: n.documents.filter(d => d.id !== docId), docChangeLog: [...(n.docChangeLog || []), event], lastModifiedAt: Date.now() };
    }));
    // Sync insights session
    setInsightsSession(prev => {
      if (!prev) return prev;
      return { ...prev, documents: prev.documents.filter(d => d.id !== docId) };
    });
  }, [selectedNuggetId]);

  const renameNuggetDocument = useCallback((docId: string, newName: string) => {
    if (!selectedNuggetId) return;
    setNuggets(prev => prev.map(n => {
      if (n.id !== selectedNuggetId) return n;
      const doc = n.documents.find(d => d.id === docId);
      const event: DocChangeEvent = { type: 'renamed', docId, docName: newName, oldName: doc?.name, timestamp: Date.now() };
      return { ...n, documents: n.documents.map(d => d.id === docId ? { ...d, name: newName } : d), docChangeLog: [...(n.docChangeLog || []), event], lastModifiedAt: Date.now() };
    }));
    // Sync insights session
    setInsightsSession(prev => {
      if (!prev) return prev;
      return { ...prev, documents: prev.documents.map(d => d.id === docId ? { ...d, name: newName } : d) };
    });
  }, [selectedNuggetId]);

  const toggleNuggetDocument = useCallback((docId: string) => {
    if (!selectedNuggetId) return;
    // Capture current state before toggle
    const nugget = nuggets.find(n => n.id === selectedNuggetId);
    const doc = nugget?.documents.find(d => d.id === docId);
    const wasEnabled = doc?.enabled !== false;

    const event: DocChangeEvent = { type: wasEnabled ? 'disabled' : 'enabled', docId, docName: doc?.name || 'Unknown', timestamp: Date.now() };
    setNuggets(prev => prev.map(n =>
      n.id === selectedNuggetId
        ? { ...n, documents: n.documents.map(d => d.id === docId ? { ...d, enabled: !(d.enabled !== false) } : d), docChangeLog: [...(n.docChangeLog || []), event], lastModifiedAt: Date.now() }
        : n
    ));
    // Sync insights session — remove disabled docs, add enabled ones back
    setInsightsSession(prev => {
      if (!prev) return prev;
      if (wasEnabled) {
        // Was enabled, now being disabled — remove from session
        return { ...prev, documents: prev.documents.filter(d => d.id !== docId) };
      } else {
        // Was disabled, now being enabled — add back to session
        if (doc) return { ...prev, documents: [...prev.documents, toInsightsDoc(doc)] };
        return prev;
      }
    });
  }, [selectedNuggetId, nuggets, toInsightsDoc]);

  // ── Project helpers ──

  const addProject = useCallback((project: Project) => {
    setProjects(prev => [...prev, project]);
  }, []);

  const deleteProject = useCallback((projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (project) {
      // Cascade: delete all nuggets in this project
      for (const nuggetId of project.nuggetIds) {
        setNuggets(prev => prev.filter(n => n.id !== nuggetId));
        if (selectedNuggetId === nuggetId) {
          setSelectedNuggetId(null);
        }
      }
    }
    setProjects(prev => prev.filter(p => p.id !== projectId));
  }, [projects, selectedNuggetId]);

  const updateProject = useCallback((projectId: string, updater: (p: Project) => Project) => {
    setProjects(prev => prev.map(p => p.id === projectId ? updater(p) : p));
  }, []);

  const addNuggetToProject = useCallback((projectId: string, nuggetId: string) => {
    setProjects(prev => prev.map(p =>
      p.id === projectId
        ? { ...p, nuggetIds: [...p.nuggetIds, nuggetId], lastModifiedAt: Date.now() }
        : p
    ));
  }, []);

  const removeNuggetFromProject = useCallback((projectId: string, nuggetId: string) => {
    setProjects(prev => prev.map(p =>
      p.id === projectId
        ? { ...p, nuggetIds: p.nuggetIds.filter(id => id !== nuggetId), lastModifiedAt: Date.now() }
        : p
    ));
  }, []);

  const value = useMemo<AppContextValue>(() => ({
    isFileSidebarOpen, setIsFileSidebarOpen,
    activeHeadingId, setActiveHeadingId,
    insightsSession, setInsightsSession,
    nuggets, setNuggets,
    selectedNuggetId, setSelectedNuggetId,
    selectedNugget,
    activeHeading,
    addNugget, deleteNugget, updateNugget,
    updateNuggetHeading, updateNuggetHeadings,
    updateNuggetContentAndHeadings,
    appendNuggetMessage,
    addNuggetDocument, updateNuggetDocument, removeNuggetDocument, renameNuggetDocument, toggleNuggetDocument,
    projects, setProjects,
    addProject, deleteProject, updateProject, addNuggetToProject, removeNuggetFromProject,
  }), [
    isFileSidebarOpen, activeHeadingId,
    insightsSession,
    nuggets, selectedNuggetId, selectedNugget,
    activeHeading,
    addNugget, deleteNugget, updateNugget,
    updateNuggetHeading, updateNuggetHeadings,
    updateNuggetContentAndHeadings,
    appendNuggetMessage,
    addNuggetDocument, updateNuggetDocument, removeNuggetDocument, renameNuggetDocument, toggleNuggetDocument,
    projects,
    addProject, deleteProject, updateProject, addNuggetToProject, removeNuggetFromProject,
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
