import { useState, useCallback, useRef, useEffect } from 'react';
import { useNuggetContext } from '../context/NuggetContext';
import { useProjectContext } from '../context/ProjectContext';
import { useSelectionContext } from '../context/SelectionContext';
import { Nugget, Project, UploadedFile } from '../types';
import { PendingFileUpload } from '../components/NuggetCreationModal';
import { getUniqueName } from '../utils/naming';
import { uploadToFilesAPI } from '../utils/ai';
import { processFileToDocument, processNativePdf, base64ToBlob } from '../utils/fileProcessing';
import { useToast } from '../components/ToastNotification';
import { generateSubject } from '../utils/subjectGeneration';
import { RecordUsageFn } from './useTokenUsage';

export interface UseProjectOperationsParams {
  recordUsage: RecordUsageFn;
}

/**
 * Project & nugget operations — creation, duplication, copy/move, subject management.
 * Extracted from App.tsx for domain separation (item 4.2).
 */
export function useProjectOperations({ recordUsage }: UseProjectOperationsParams) {
  const { nuggets, addNugget, updateNugget, setSelectedNuggetId } = useNuggetContext();
  const { projects, setProjects, addProject, addNuggetToProject, removeNuggetFromProject } = useProjectContext();
  const { setSelectionLevel } = useSelectionContext();

  const { addToast } = useToast();

  // ── Nugget modal state ──
  const [showNuggetCreation, setShowNuggetCreation] = useState(false);
  const [nuggetCreationProjectId, setNuggetCreationProjectId] = useState<string | null>(null);

  // ── Project modal state ──
  const [showProjectCreation, setShowProjectCreation] = useState(false);
  const [projectCreationChainToNugget, setProjectCreationChainToNugget] = useState(false);

  // ── Subject edit modal state ──
  const [subjectEditNuggetId, setSubjectEditNuggetId] = useState<string | null>(null);
  const [isRegeneratingSubject, setIsRegeneratingSubject] = useState(false);

  // ── Subject auto-generation on first upload ──
  const pendingSubjectGenRef = useRef<string | null>(null); // nuggetId awaiting subject gen
  const subjectGenDocIdsRef = useRef<Set<string>>(new Set()); // doc IDs to wait for

  // ── Cross-hook communication: let useDocumentOperations trigger subject auto-gen ──
  const setSubjectGenPending = useCallback((nuggetId: string, docIds: string[]) => {
    pendingSubjectGenRef.current = nuggetId;
    subjectGenDocIdsRef.current = new Set(docIds);
  }, []);

  // ── Nugget creation ──

  const handleCreateNugget = useCallback(
    (nugget: Nugget, pendingFiles?: PendingFileUpload[]) => {
      addNugget(nugget);
      setSelectedNuggetId(nugget.id);
      setSelectionLevel('nugget');
      // Add to target project if specified
      if (nuggetCreationProjectId) {
        addNuggetToProject(nuggetCreationProjectId, nugget.id);
        setNuggetCreationProjectId(null);
      }

      // If pending files are provided, process them in background and update nugget via updateNugget
      // (uses explicit nuggetId — safe for async, no selectedNuggetId dependency)
      if (pendingFiles && pendingFiles.length > 0) {
        // Track for subject auto-generation once all docs are ready
        pendingSubjectGenRef.current = nugget.id;
        subjectGenDocIdsRef.current = new Set(pendingFiles.map((pf) => pf.placeholderId));

        for (const pf of pendingFiles) {
          (async () => {
            try {
              let processed: UploadedFile;

              if (pf.mode === 'native-pdf') {
                // processNativePdf now handles bookmark-first extraction internally
                const nativePdf = await processNativePdf(pf.file, pf.placeholderId);
                // Upload PDF to Files API
                let pdfFileId: string | undefined;
                try {
                  pdfFileId = await uploadToFilesAPI(
                    base64ToBlob(nativePdf.pdfBase64!, 'application/pdf'),
                    pf.file.name,
                    'application/pdf',
                  );
                } catch (err) {
                  console.warn('[App] Native PDF Files API upload failed:', err);
                }
                processed = {
                  ...nativePdf,
                  fileId: pdfFileId,
                };
              } else {
                processed = await processFileToDocument(pf.file, pf.placeholderId);
                // Try Files API upload for Claude context
                if (processed.content) {
                  try {
                    const fileId = await uploadToFilesAPI(processed.content, pf.file.name, 'text/plain');
                    processed = { ...processed, fileId };
                  } catch (err) {
                    console.warn('[App] Files API upload failed (will use inline fallback):', err);
                  }
                }
              }

              // Update the document within the nugget
              updateNugget(nugget.id, (n) => ({
                ...n,
                documents: n.documents.map((d) => (d.id === pf.placeholderId ? processed : d)),
                lastModifiedAt: Date.now(),
              }));
            } catch (err) {
              console.error(`[App] Processing failed for ${pf.file.name}:`, err);
              updateNugget(nugget.id, (n) => ({
                ...n,
                documents: n.documents.map((d) => (d.id === pf.placeholderId ? { ...d, status: 'error' as const } : d)),
              }));
              addToast({
                type: 'error',
                message: `Failed to process "${pf.file.name}"`,
                detail: err instanceof Error ? err.message : 'An unexpected error occurred.',
                duration: 10000,
              });
            }
          })();
        }
      } else {
        // No pending files — docs are already ready (shouldn't happen with new flow, but defensive)
        const readyDocs = nugget.documents.filter(
          (d) => d.status === 'ready' && (d.content || d.fileId || d.pdfBase64),
        );
        if (readyDocs.length > 0 && !nugget.subject) {
          (async () => {
            try {
              const subject = await generateSubject(readyDocs, recordUsage);
              updateNugget(nugget.id, (n) => ({ ...n, subject, lastModifiedAt: Date.now() }));
              addToast({
                type: 'info',
                message: `Subject: ${subject}`,
                detail: 'Edit via nugget menu > Subject',
                duration: 8000,
              });
            } catch (err) {
              console.warn('[App] Subject auto-generation failed for new nugget:', err);
              addToast({
                type: 'warning',
                message: 'Could not auto-generate subject',
                detail: 'You can set it manually via the nugget menu > Subject.',
                duration: 8000,
              });
            }
          })();
        }
      }
    },
    [addNugget, setSelectedNuggetId, nuggetCreationProjectId, addNuggetToProject, updateNugget, recordUsage, addToast, setSelectionLevel],
  );

  // ── Project creation ──

  const handleCreateProject = useCallback(
    (name: string, description: string): string => {
      const now = Date.now();
      const id = `project-${now}-${Math.random().toString(36).substr(2, 9)}`;
      const project: Project = {
        id,
        name,
        description: description || undefined,
        nuggetIds: [],
        createdAt: now,
        lastModifiedAt: now,
      };
      addProject(project);
      return id;
    },
    [addProject],
  );

  // ── Copy nugget to project ──

  const handleCopyNuggetToProject = useCallback(
    (nuggetId: string, targetProjectId: string) => {
      const nugget = nuggets.find((n) => n.id === nuggetId);
      if (!nugget) return;
      const now = Date.now();
      const newNuggetId = `nugget-${now}-${Math.random().toString(36).substr(2, 9)}`;
      // Get existing nugget names in the target project for dedup
      const targetProject = projects.find((p) => p.id === targetProjectId);
      const targetNuggetNames = targetProject
        ? targetProject.nuggetIds.map((nid) => nuggets.find((n) => n.id === nid)?.name || '').filter(Boolean)
        : [];
      const copiedNugget: Nugget = {
        ...nugget,
        id: newNuggetId,
        name: getUniqueName(`${nugget.name} (copy)`, targetNuggetNames),
        documents: nugget.documents.map((d) => ({ ...d, id: `doc-${Math.random().toString(36).substr(2, 9)}` })),
        cards: nugget.cards.map((c) => ({ ...c, id: `card-${Math.random().toString(36).substr(2, 9)}` })),
        messages: [...(nugget.messages || [])],
        createdAt: now,
        lastModifiedAt: now,
      };
      addNugget(copiedNugget);
      addNuggetToProject(targetProjectId, newNuggetId);
    },
    [nuggets, projects, addNugget, addNuggetToProject],
  );

  // ── Duplicate project ──

  const handleDuplicateProject = useCallback(
    (projectId: string) => {
      const project = projects.find((p) => p.id === projectId);
      if (!project) return;
      const now = Date.now();
      const newProjectId = `project-${now}-${Math.random().toString(36).substr(2, 9)}`;
      const newNuggetIds: string[] = [];

      // Deep-clone each nugget in the project
      for (const nuggetId of project.nuggetIds) {
        const nugget = nuggets.find((n) => n.id === nuggetId);
        if (!nugget) continue;
        const newNuggetId = `nugget-${now}-${Math.random().toString(36).substr(2, 9)}-${newNuggetIds.length}`;
        const copiedNugget: Nugget = {
          ...nugget,
          id: newNuggetId,
          name: nugget.name, // keep same name — it's in a different project
          documents: nugget.documents.map((d) => ({ ...d, id: `doc-${Math.random().toString(36).substr(2, 9)}` })),
          cards: nugget.cards.map((c) => ({ ...c, id: `card-${Math.random().toString(36).substr(2, 9)}` })),
          messages: [...(nugget.messages || [])],
          createdAt: now,
          lastModifiedAt: now,
        };
        addNugget(copiedNugget);
        newNuggetIds.push(newNuggetId);
      }

      // Create the new project with cloned nugget IDs
      const newProject: Project = {
        id: newProjectId,
        name: getUniqueName(
          `${project.name} (copy)`,
          projects.map((p) => p.name),
        ),
        description: project.description,
        nuggetIds: newNuggetIds,
        createdAt: now,
        lastModifiedAt: now,
      };
      addProject(newProject);
    },
    [nuggets, projects, addNugget, addProject],
  );

  // ── Move nugget to project ──

  const handleMoveNuggetToProject = useCallback(
    (nuggetId: string, sourceProjectId: string, targetProjectId: string) => {
      // Auto-rename if name collides in target project
      const nugget = nuggets.find((n) => n.id === nuggetId);
      if (nugget) {
        const targetProject = projects.find((p) => p.id === targetProjectId);
        const targetNuggetNames = targetProject
          ? targetProject.nuggetIds.map((nid) => nuggets.find((n) => n.id === nid)?.name || '').filter(Boolean)
          : [];
        const uniqueName = getUniqueName(nugget.name, targetNuggetNames);
        if (uniqueName !== nugget.name) {
          updateNugget(nuggetId, (n) => ({ ...n, name: uniqueName, lastModifiedAt: Date.now() }));
        }
      }
      removeNuggetFromProject(sourceProjectId, nuggetId);
      addNuggetToProject(targetProjectId, nuggetId);
    },
    [nuggets, projects, removeNuggetFromProject, addNuggetToProject, updateNugget],
  );

  // ── Create project for nugget (copy or move) ──

  const handleCreateProjectForNugget = useCallback(
    (nuggetId: string, projectName: string, mode: 'copy' | 'move', sourceProjectId: string) => {
      const now = Date.now();
      const newProjectId = `project-${now}-${Math.random().toString(36).substr(2, 9)}`;
      // Auto-increment project name if it already exists
      const uniqueProjectName = getUniqueName(
        projectName,
        projects.map((p) => p.name),
      );

      if (mode === 'move') {
        // Move: create project with the nuggetId already included, remove from source
        const newProject: Project = {
          id: newProjectId,
          name: uniqueProjectName,
          nuggetIds: [nuggetId],
          createdAt: now,
          lastModifiedAt: now,
        };
        // Single setProjects call: add new project + remove nugget from source
        setProjects((prev) => [
          ...prev.map((p) =>
            p.id === sourceProjectId
              ? { ...p, nuggetIds: p.nuggetIds.filter((id) => id !== nuggetId), lastModifiedAt: now }
              : p,
          ),
          newProject,
        ]);
      } else {
        // Copy: duplicate the nugget, create project with the copy's ID
        const nugget = nuggets.find((n) => n.id === nuggetId);
        if (!nugget) return;
        const newNuggetId = `nugget-${now}-${Math.random().toString(36).substr(2, 9)}`;
        const copiedNugget: Nugget = {
          ...nugget,
          id: newNuggetId,
          name: `${nugget.name} (copy)`,
          documents: nugget.documents.map((d) => ({ ...d, id: `doc-${Math.random().toString(36).substr(2, 9)}` })),
          cards: nugget.cards.map((c) => ({ ...c, id: `card-${Math.random().toString(36).substr(2, 9)}` })),
          messages: [...(nugget.messages || [])],
          createdAt: now,
          lastModifiedAt: now,
        };
        const newProject: Project = {
          id: newProjectId,
          name: uniqueProjectName,
          nuggetIds: [newNuggetId],
          createdAt: now,
          lastModifiedAt: now,
        };
        addNugget(copiedNugget);
        setProjects((prev) => [...prev, newProject]);
      }
    },
    [nuggets, projects, addNugget, setProjects],
  );

  // ── Subject modal handlers ──

  const handleSaveSubject = useCallback(
    (nuggetId: string, subject: string) => {
      updateNugget(nuggetId, (n) => ({ ...n, subject, lastModifiedAt: Date.now() }));
    },
    [updateNugget],
  );

  const handleRegenerateSubject = useCallback(
    async (nuggetId: string) => {
      const nugget = nuggets.find((n) => n.id === nuggetId);
      if (!nugget) return;
      const readyDocs = nugget.documents.filter((d) => d.status === 'ready' && (d.content || d.fileId || d.pdfBase64));
      if (readyDocs.length === 0) {
        addToast({
          type: 'warning',
          message: 'No processed documents available to generate subject from.',
          duration: 6000,
        });
        return;
      }
      setIsRegeneratingSubject(true);
      try {
        const subject = await generateSubject(readyDocs, recordUsage);
        updateNugget(nuggetId, (n) => ({ ...n, subject, lastModifiedAt: Date.now() }));
        addToast({ type: 'success', message: 'Subject regenerated successfully.', duration: 4000 });
      } catch (err) {
        console.warn('[App] Subject regeneration failed:', err);
        addToast({
          type: 'error',
          message: 'Failed to regenerate subject.',
          detail: err instanceof Error ? err.message : 'Unknown error',
          duration: 8000,
        });
      } finally {
        setIsRegeneratingSubject(false);
      }
    },
    [nuggets, updateNugget, recordUsage, addToast],
  );

  // ── Subject auto-generation watcher ──
  // Watches nuggets state; when all tracked docs reach 'ready', triggers generation
  useEffect(() => {
    const nuggetId = pendingSubjectGenRef.current;
    if (!nuggetId) return;
    const trackedIds = subjectGenDocIdsRef.current;
    if (trackedIds.size === 0) return;

    const nugget = nuggets.find((n) => n.id === nuggetId);
    if (!nugget) {
      pendingSubjectGenRef.current = null;
      return;
    }

    // Check if all tracked docs have finished processing (ready or error)
    const allDone = [...trackedIds].every((docId) => {
      const doc = nugget.documents.find((d) => d.id === docId);
      return doc && (doc.status === 'ready' || doc.status === 'error');
    });
    if (!allDone) return;

    // All done — clear refs and trigger generation
    pendingSubjectGenRef.current = null;
    subjectGenDocIdsRef.current = new Set();

    // Use ALL ready docs in the nugget (not just the batch) so subject covers the full document set
    const allReadyDocs = nugget.documents.filter((d) => d.status === 'ready' && (d.content || d.fileId || d.pdfBase64));
    if (allReadyDocs.length === 0) {
      addToast({
        type: 'warning',
        message: 'Could not generate subject — no documents processed successfully.',
        duration: 6000,
      });
      return;
    }

    (async () => {
      try {
        const subject = await generateSubject(allReadyDocs, recordUsage);
        updateNugget(nuggetId, (n) => ({ ...n, subject, lastModifiedAt: Date.now() }));
        addToast({
          type: 'info',
          message: `Subject: ${subject}`,
          detail: 'Edit via nugget menu > Subject',
          duration: 8000,
        });
      } catch (err) {
        console.warn('[App] Subject auto-generation failed:', err);
        addToast({
          type: 'warning',
          message: 'Could not auto-generate subject',
          detail: 'You can set it manually via the nugget menu > Subject.',
          duration: 8000,
        });
      }
    })();
  }, [nuggets, updateNugget, recordUsage, addToast]);

  return {
    // Nugget modal state
    showNuggetCreation,
    setShowNuggetCreation,
    nuggetCreationProjectId,
    setNuggetCreationProjectId,
    // Project modal state
    showProjectCreation,
    setShowProjectCreation,
    projectCreationChainToNugget,
    setProjectCreationChainToNugget,
    // Subject edit modal state
    subjectEditNuggetId,
    setSubjectEditNuggetId,
    isRegeneratingSubject,
    // Callbacks
    handleCreateNugget,
    handleCreateProject,
    handleCopyNuggetToProject,
    handleDuplicateProject,
    handleMoveNuggetToProject,
    handleCreateProjectForNugget,
    handleSaveSubject,
    handleRegenerateSubject,
    // Cross-hook communication
    setSubjectGenPending,
  };
}
