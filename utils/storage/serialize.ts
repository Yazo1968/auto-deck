
import { UploadedFile, Heading, DetailLevel, InsightsSession, Nugget, Project, ImageVersion } from '../../types';
import { StoredFile, StoredHeading, StoredImage, StoredImageVersion, StoredInsightsSession, StoredNugget, StoredNuggetDocument, StoredProject } from './StorageBackend';

const DETAIL_LEVELS: DetailLevel[] = ['Executive', 'Standard', 'Detailed'];

// ── File serialization ──

export function serializeFile(f: UploadedFile): StoredFile {
  return {
    id: f.id,
    name: f.name,
    size: f.size,
    type: f.type,
    lastModified: f.lastModified,
    content: f.content,
    status: f.status === 'ready' ? 'ready' : 'error',
    progress: f.status === 'ready' ? 100 : 0,
  };
}

export function deserializeFile(sf: StoredFile, structure?: Heading[]): UploadedFile {
  return {
    id: sf.id,
    name: sf.name,
    size: sf.size,
    type: sf.type,
    lastModified: sf.lastModified,
    content: sf.content,
    status: sf.status,
    progress: sf.progress,
    structure,
  };
}

// ── Heading serialization ──

export function serializeHeading(h: Heading, fileId: string): StoredHeading {
  return {
    fileId,
    headingId: h.id,
    level: h.level,
    text: h.text,
    selected: h.selected,
    settings: h.settings,
    synthesisMap: h.synthesisMap,
    visualPlanMap: h.visualPlanMap,
    lastGeneratedContentMap: h.lastGeneratedContentMap,
    lastPromptMap: h.lastPromptMap,
    createdAt: h.createdAt,
    lastEditedAt: h.lastEditedAt,
    sourceDocuments: h.sourceDocuments,
    // Excluded: isSynthesizingMap, isGeneratingMap, startIndex, cardUrlMap, imageHistoryMap
  };
}

export function extractImages(h: Heading, fileId: string): StoredImage[] {
  const images: StoredImage[] = [];
  for (const level of DETAIL_LEVELS) {
    const cardUrl = h.cardUrlMap?.[level];
    if (cardUrl) {
      images.push({
        fileId,
        headingId: h.id,
        level,
        cardUrl,
        imageHistory: (h.imageHistoryMap?.[level] || []).map(v => ({
          imageUrl: v.imageUrl,
          timestamp: v.timestamp,
          label: v.label,
        })),
      });
    }
  }
  return images;
}

export function deserializeHeading(stored: StoredHeading, images: StoredImage[]): Heading {
  const heading: Heading = {
    id: stored.headingId,
    level: stored.level,
    text: stored.text,
    selected: stored.selected,
    settings: stored.settings,
    synthesisMap: stored.synthesisMap,
    visualPlanMap: stored.visualPlanMap,
    lastGeneratedContentMap: stored.lastGeneratedContentMap,
    lastPromptMap: stored.lastPromptMap,
    isSynthesizingMap: {},
    isGeneratingMap: {},
    createdAt: stored.createdAt,
    lastEditedAt: stored.lastEditedAt,
    sourceDocuments: stored.sourceDocuments,
  };

  // Merge image data back into heading
  const matchingImages = images.filter(img => img.headingId === stored.headingId);
  if (matchingImages.length > 0) {
    const cardUrlMap: Partial<Record<DetailLevel, string>> = {};
    const imageHistoryMap: Partial<Record<DetailLevel, ImageVersion[]>> = {};

    for (const img of matchingImages) {
      cardUrlMap[img.level] = img.cardUrl;
      if (img.imageHistory?.length > 0) {
        imageHistoryMap[img.level] = img.imageHistory;
      }
    }

    heading.cardUrlMap = cardUrlMap;
    if (Object.keys(imageHistoryMap).length > 0) {
      heading.imageHistoryMap = imageHistoryMap;
    }
  }

  return heading;
}

// ── Insights serialization ──

export function serializeInsightsSession(session: InsightsSession): {
  session: StoredInsightsSession;
  headings: StoredHeading[];
  images: StoredImage[];
} {
  const storedSession: StoredInsightsSession = {
    id: session.id,
    messages: session.messages,
  };

  const headings: StoredHeading[] = [];
  const images: StoredImage[] = [];
  const insightsFileId = '__insights__';

  for (const h of session.headings) {
    headings.push(serializeHeading(h, insightsFileId));
    images.push(...extractImages(h, insightsFileId));
  }

  return { session: storedSession, headings, images };
}

// ── Nugget serialization ──

export function serializeNugget(n: Nugget): StoredNugget {
  return {
    id: n.id,
    name: n.name,
    type: n.type,
    messages: n.messages,
    docChangeLog: n.docChangeLog,
    lastDocChangeSyncIndex: n.lastDocChangeSyncIndex,
    createdAt: n.createdAt,
    lastModifiedAt: n.lastModifiedAt,
  };
}

export function deserializeNugget(sn: StoredNugget, headings: Heading[], documents: UploadedFile[]): Nugget {
  return {
    id: sn.id,
    name: sn.name,
    type: sn.type as 'insights',
    documents,
    headings,
    messages: sn.messages,
    docChangeLog: sn.docChangeLog,
    lastDocChangeSyncIndex: sn.lastDocChangeSyncIndex,
    createdAt: sn.createdAt,
    lastModifiedAt: sn.lastModifiedAt,
  };
}

// ── Nugget document serialization ──

export function serializeNuggetDocument(nuggetId: string, doc: UploadedFile): StoredNuggetDocument {
  return {
    nuggetId,
    docId: doc.id,
    name: doc.name,
    size: doc.size,
    type: doc.type,
    lastModified: doc.lastModified,
    content: doc.content,
    status: doc.status === 'ready' ? 'ready' : 'error',
    progress: doc.status === 'ready' ? 100 : 0,
  };
}

export function deserializeNuggetDocument(stored: StoredNuggetDocument): UploadedFile {
  return {
    id: stored.docId,
    name: stored.name,
    size: stored.size,
    type: stored.type,
    lastModified: stored.lastModified,
    content: stored.content,
    status: stored.status,
    progress: stored.progress,
  };
}

// ── Project serialization ──

export function serializeProject(p: Project): StoredProject {
  return {
    id: p.id,
    name: p.name,
    nuggetIds: p.nuggetIds,
    isCollapsed: p.isCollapsed,
    createdAt: p.createdAt,
    lastModifiedAt: p.lastModifiedAt,
  };
}

export function deserializeProject(sp: StoredProject): Project {
  return {
    id: sp.id,
    name: sp.name,
    nuggetIds: sp.nuggetIds,
    isCollapsed: sp.isCollapsed,
    createdAt: sp.createdAt,
    lastModifiedAt: sp.lastModifiedAt,
  };
}
