
import React, { useState, useEffect } from 'react';
import { UploadedFile, Heading, InsightsSession, Nugget, Project, InitialPersistedState } from '../types';
import { AppProvider, useAppContext } from '../context/AppContext';
import { IndexedDBBackend } from '../utils/storage/IndexedDBBackend';
import { StorageBackend } from '../utils/storage/StorageBackend';
import {
  deserializeFile,
  deserializeHeading,
  deserializeNugget,
  deserializeNuggetDocument,
  deserializeProject,
  serializeHeading,
  serializeNugget,
  serializeNuggetDocument,
  serializeProject,
  extractImages,
} from '../utils/storage/serialize';
import { usePersistence } from '../hooks/usePersistence';
import { LoadingScreen } from './LoadingScreen';

// ── Singleton storage instance ──

const storage: StorageBackend = new IndexedDBBackend();

// ── Persistence connector (auto-save, renders nothing) ──

const PersistenceConnector: React.FC = () => {
  const {
    activeHeadingId,
    insightsSession,
    nuggets,
    projects,
    selectedNuggetId,
  } = useAppContext();

  usePersistence({
    storage,
    activeHeadingId,
    insightsSession,
    nuggets,
    projects,
    selectedNuggetId,
  });

  return null;
};

// ── Hydration logic ──

async function hydrateFromStorage(): Promise<InitialPersistedState | null> {
  await storage.init();

  // Load from all stores in parallel
  const [
    appState,
    storedFiles,
    insightsSessionData,
    insightsDocs,
    insightsHeadingsStored,
    insightsImagesStored,
    storedNuggets,
    storedProjects,
  ] = await Promise.all([
    storage.loadAppState(),
    storage.loadFiles(),
    storage.loadInsightsSession(),
    storage.loadInsightsDocs(),
    storage.loadInsightsHeadings(),
    storage.loadInsightsImages(),
    storage.loadNuggets(),
    storage.loadProjects(),
  ]);

  // Reconstitute insights session (legacy stores)
  let insightsSession: InsightsSession | null = null;
  if (insightsSessionData) {
    const iHeadings = insightsHeadingsStored.map(sh =>
      deserializeHeading(sh, insightsImagesStored)
    );
    insightsSession = {
      id: insightsSessionData.id,
      documents: insightsDocs,
      messages: insightsSessionData.messages,
      headings: iHeadings,
    };
  }

  // Reconstitute nuggets — load headings, images, and documents per-nugget
  let nuggets: Nugget[] = [];
  for (const sn of storedNuggets) {
    const [headings, images, nuggetDocs] = await Promise.all([
      storage.loadNuggetHeadings(sn.id),
      storage.loadNuggetImages(sn.id),
      storage.loadNuggetDocuments(sn.id),
    ]);
    const hydratedHeadings = headings.map(sh => deserializeHeading(sh, images));
    const hydratedDocs = nuggetDocs.map(sd => deserializeNuggetDocument(sd));
    nuggets.push(deserializeNugget(sn, hydratedHeadings, hydratedDocs));
  }

  // ── Runtime migration: v2 data → v3 (documents were in global library, nuggets had documentIds) ──
  const nuggetsNeedDocMigration = nuggets.length > 0 && nuggets.every(n => n.documents.length === 0);
  if (nuggetsNeedDocMigration) {
    const oldDocuments = await storage.loadDocuments();
    if (oldDocuments.length > 0) {
      console.log(`[Storage] Migrating v2→v3: ${oldDocuments.length} documents to embed in nuggets`);
      const docMap = new Map(oldDocuments.map(sd => [sd.id, deserializeFile(sd)]));

      for (const nugget of nuggets) {
        const rawNugget = storedNuggets.find(sn => sn.id === nugget.id) as any;
        const oldDocIds: string[] = rawNugget?.documentIds ?? [];
        if (oldDocIds.length > 0) {
          nugget.documents = oldDocIds
            .map(id => docMap.get(id))
            .filter((d): d is UploadedFile => d !== undefined);
          for (const doc of nugget.documents) {
            await storage.saveNuggetDocument(serializeNuggetDocument(nugget.id, doc));
          }
          await storage.saveNugget(serializeNugget(nugget));
        }
      }
      console.log(`[Storage] v2→v3 migration complete`);
    }
  }

  // ── Runtime migration: v1 data (files + insightsSession but no nuggets) → nuggets ──
  if (nuggets.length === 0 && (storedFiles.length > 0 || insightsSession)) {
    const now = Date.now();

    // Migrate old files → insights nuggets (convert synthesis type to insights)
    for (const sf of storedFiles) {
      if (sf.status !== 'ready') continue;
      const [headings, images] = await Promise.all([
        storage.loadHeadings(sf.id),
        storage.loadImages(sf.id),
      ]);
      if (headings.length > 0) {
        const hydratedHeadings = headings.map(sh => deserializeHeading(sh, images));
        const file = deserializeFile(sf, hydratedHeadings);
        const nuggetId = `migrated-${sf.id}`;
        const nugget: Nugget = {
          id: nuggetId,
          name: sf.name.replace(/\.\w+$/, ''),
          type: 'insights',
          documents: [file],
          headings: hydratedHeadings,
          messages: [],
          createdAt: now,
          lastModifiedAt: now,
        };
        nuggets.push(nugget);

        await storage.saveNugget(serializeNugget(nugget));
        await storage.saveNuggetDocument(serializeNuggetDocument(nuggetId, file));
        const storedH = nugget.headings.map(h => serializeHeading(h, nuggetId));
        await storage.saveNuggetHeadings(nuggetId, storedH);
        for (const h of nugget.headings) {
          const imgs = extractImages(h, nuggetId);
          for (const img of imgs) {
            await storage.saveNuggetImage(img);
          }
        }
      }
    }

    // Migrate insights session → insights nugget
    if (insightsSession) {
      const nuggetId = `migrated-insights-${insightsSession.id}`;
      const insightsDocs: UploadedFile[] = insightsSession.documents.map(doc => ({
        id: doc.id,
        name: doc.name,
        size: doc.size,
        type: doc.type === 'pdf' ? 'application/pdf'
          : doc.type === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          : 'text/markdown',
        lastModified: now,
        content: doc.content,
        status: 'ready' as const,
        progress: 100,
      }));

      const nugget: Nugget = {
        id: nuggetId,
        name: 'Migrated Insights',
        type: 'insights',
        documents: insightsDocs,
        headings: insightsSession.headings,
        messages: insightsSession.messages,
        createdAt: now,
        lastModifiedAt: now,
      };
      nuggets.push(nugget);

      await storage.saveNugget(serializeNugget(nugget));
      for (const doc of insightsDocs) {
        await storage.saveNuggetDocument(serializeNuggetDocument(nuggetId, doc));
      }
      const storedH = nugget.headings.map(h => serializeHeading(h, nuggetId));
      await storage.saveNuggetHeadings(nuggetId, storedH);
      for (const h of nugget.headings) {
        const imgs = extractImages(h, nuggetId);
        for (const img of imgs) {
          await storage.saveNuggetImage(img);
        }
      }
    }

    console.log(`[Storage] Migrated v1→v3: ${nuggets.length} nuggets created`);
  }

  // ── Migration: convert any remaining synthesis-type nuggets to insights ──
  for (const nugget of nuggets) {
    if ((nugget.type as string) === 'synthesis') {
      (nugget as any).type = 'insights';
      if (!nugget.messages) nugget.messages = [];
      await storage.saveNugget(serializeNugget(nugget));
    }
  }

  // ── Reconstitute projects ──
  let projects: Project[] = storedProjects.map(sp => deserializeProject(sp));

  // ── Migration: existing nuggets but no projects → create default project ──
  if (projects.length === 0 && nuggets.length > 0) {
    const now = Date.now();
    const defaultProject: Project = {
      id: `project-${now}-${Math.random().toString(36).substr(2, 9)}`,
      name: 'My Project',
      nuggetIds: nuggets.map(n => n.id),
      createdAt: now,
      lastModifiedAt: now,
    };
    projects = [defaultProject];
    await storage.saveProject(serializeProject(defaultProject));
    console.log(`[Storage] Migrated nuggets→project: created default "My Project" with ${nuggets.length} nuggets`);
  }

  // Only return state if there's actually data to restore
  if (!insightsSession && nuggets.length === 0) return null;

  return {
    nuggets,
    projects,
    selectedNuggetId: appState?.selectedNuggetId ?? null,
    activeHeadingId: appState?.activeHeadingId ?? null,
    workflowMode: 'insights',
    insightsSession,
  };
}

// ── Provider component ──

export const StorageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [initialState, setInitialState] = useState<InitialPersistedState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    hydrateFromStorage()
      .then(state => {
        if (!cancelled) setInitialState(state);
      })
      .catch(err => {
        console.error('[Storage] Hydration failed, starting fresh:', err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <AppProvider initialState={initialState ?? undefined}>
      <PersistenceConnector />
      {children}
    </AppProvider>
  );
};
