
import { useEffect, useRef, useCallback } from 'react';
import { Heading, Nugget, Project, InsightsSession } from '../types';
import { StorageBackend } from '../utils/storage/StorageBackend';
import {
  serializeHeading,
  serializeNugget,
  serializeNuggetDocument,
  serializeProject,
  extractImages,
  serializeInsightsSession,
} from '../utils/storage/serialize';

const APP_STATE_DEBOUNCE_MS = 300;
const DATA_DEBOUNCE_MS = 1500;

interface PersistenceOptions {
  storage: StorageBackend;
  activeHeadingId: string | null;
  insightsSession: InsightsSession | null;
  nuggets: Nugget[];
  projects: Project[];
  selectedNuggetId: string | null;
}

export function usePersistence({
  storage,
  activeHeadingId,
  insightsSession,
  nuggets,
  projects,
  selectedNuggetId,
}: PersistenceOptions): void {
  const appStateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insightsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nuggetsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const projectsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track whether initial hydration is done to avoid saving the hydrated state right back
  const hydrationDone = useRef(false);
  useEffect(() => {
    // Skip the first render (which is the hydrated state)
    const timer = setTimeout(() => { hydrationDone.current = true; }, DATA_DEBOUNCE_MS + 500);
    return () => clearTimeout(timer);
  }, []);

  // Stable reference to latest values for save functions
  const latestRef = useRef({ insightsSession, nuggets, projects });
  useEffect(() => {
    latestRef.current = { insightsSession, nuggets, projects };
  });

  // ── App state save (lightweight) ──
  useEffect(() => {
    if (!storage.isReady() || !hydrationDone.current) return;
    if (appStateTimer.current) clearTimeout(appStateTimer.current);
    appStateTimer.current = setTimeout(() => {
      storage.saveAppState({ selectedNuggetId, activeHeadingId })
        .catch(err => console.warn('[Persistence] Failed to save app state:', err));
    }, APP_STATE_DEBOUNCE_MS);
    return () => { if (appStateTimer.current) clearTimeout(appStateTimer.current); };
  }, [selectedNuggetId, activeHeadingId, storage]);

  // ── Insights session save ──
  const saveInsights = useCallback(async () => {
    const { insightsSession: session } = latestRef.current;

    if (!session) {
      await storage.deleteInsightsSession();
      await storage.deleteInsightsHeadings();
      await storage.deleteInsightsImages();
      return;
    }

    const { session: storedSession, headings, images } = serializeInsightsSession(session);
    await storage.saveInsightsSession(storedSession);

    // Save documents
    const storedDocs = await storage.loadInsightsDocs();
    const currentDocIds = new Set(session.documents.map(d => d.id));
    for (const sd of storedDocs) {
      if (!currentDocIds.has(sd.id)) {
        await storage.deleteInsightsDoc(sd.id);
      }
    }
    for (const doc of session.documents) {
      await storage.saveInsightsDoc(doc);
    }

    // Save headings
    await storage.saveInsightsHeadings(headings);

    // Save images
    for (const img of images) {
      await storage.saveInsightsImage(img);
    }
  }, [storage]);

  useEffect(() => {
    if (!storage.isReady() || !hydrationDone.current) return;
    if (insightsTimer.current) clearTimeout(insightsTimer.current);
    insightsTimer.current = setTimeout(() => {
      saveInsights().catch(err => console.warn('[Persistence] Failed to save insights:', err));
    }, DATA_DEBOUNCE_MS);
    return () => { if (insightsTimer.current) clearTimeout(insightsTimer.current); };
  }, [insightsSession, saveInsights, storage]);

  // ── Nuggets save (includes per-nugget documents) ──
  const saveAllNuggets = useCallback(async () => {
    const { nuggets: currentNuggets } = latestRef.current;

    for (const nugget of currentNuggets) {
      // Save nugget metadata
      await storage.saveNugget(serializeNugget(nugget));

      // Save nugget documents + clean up removed ones
      for (const doc of nugget.documents) {
        if (doc.status !== 'ready') continue;
        await storage.saveNuggetDocument(serializeNuggetDocument(nugget.id, doc));
      }
      const storedDocs = await storage.loadNuggetDocuments(nugget.id);
      const currentDocIds = new Set(nugget.documents.filter(d => d.status === 'ready').map(d => d.id));
      for (const sd of storedDocs) {
        if (!currentDocIds.has(sd.docId)) {
          await storage.deleteNuggetDocument(nugget.id, sd.docId);
        }
      }

      // Save nugget headings
      const storedHeadings = nugget.headings.map(h => serializeHeading(h, nugget.id));
      await storage.saveNuggetHeadings(nugget.id, storedHeadings);

      // Save nugget images
      for (const h of nugget.headings) {
        const images = extractImages(h, nugget.id);
        for (const img of images) {
          await storage.saveNuggetImage(img);
        }
      }
    }

    // Clean up deleted nuggets
    const storedNuggets = await storage.loadNuggets();
    const currentNuggetIds = new Set(currentNuggets.map(n => n.id));
    for (const sn of storedNuggets) {
      if (!currentNuggetIds.has(sn.id)) {
        await storage.deleteNugget(sn.id);
        await storage.deleteNuggetDocuments(sn.id);
        await storage.deleteNuggetHeadings(sn.id);
        await storage.deleteNuggetImages(sn.id);
      }
    }
  }, [storage]);

  useEffect(() => {
    if (!storage.isReady() || !hydrationDone.current) return;
    if (nuggetsTimer.current) clearTimeout(nuggetsTimer.current);
    nuggetsTimer.current = setTimeout(() => {
      saveAllNuggets().catch(err => console.warn('[Persistence] Failed to save nuggets:', err));
    }, DATA_DEBOUNCE_MS);
    return () => { if (nuggetsTimer.current) clearTimeout(nuggetsTimer.current); };
  }, [nuggets, saveAllNuggets, storage]);

  // ── Projects save ──
  const saveAllProjects = useCallback(async () => {
    const { projects: currentProjects } = latestRef.current;

    for (const project of currentProjects) {
      await storage.saveProject(serializeProject(project));
    }

    // Clean up deleted projects
    const storedProjects = await storage.loadProjects();
    const currentProjectIds = new Set(currentProjects.map(p => p.id));
    for (const sp of storedProjects) {
      if (!currentProjectIds.has(sp.id)) {
        await storage.deleteProject(sp.id);
      }
    }
  }, [storage]);

  useEffect(() => {
    if (!storage.isReady() || !hydrationDone.current) return;
    if (projectsTimer.current) clearTimeout(projectsTimer.current);
    projectsTimer.current = setTimeout(() => {
      saveAllProjects().catch(err => console.warn('[Persistence] Failed to save projects:', err));
    }, DATA_DEBOUNCE_MS);
    return () => { if (projectsTimer.current) clearTimeout(projectsTimer.current); };
  }, [projects, saveAllProjects, storage]);
}
