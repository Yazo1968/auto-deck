
import { DetailLevel, StylingOptions, NuggetType, ChatMessage, InsightsDocument, ImageVersion, UploadedFile, DocChangeEvent } from '../../types';

// ── Stored types (what lives in the database) ──

export interface AppSessionState {
  selectedNuggetId: string | null;
  activeHeadingId: string | null;
  // Legacy fields — kept for backward compat reads, ignored on write
  selectedFileId?: string | null;
  workflowMode?: string;
}

export interface StoredFile {
  id: string;
  name: string;
  size: number;
  type: string;
  lastModified: number;
  content?: string;
  status: 'ready' | 'error';
  progress: number;
}

export interface StoredHeading {
  fileId: string;
  headingId: string;
  level: number;
  text: string;
  selected?: boolean;
  settings?: StylingOptions;
  synthesisMap?: Partial<Record<DetailLevel, string>>;
  visualPlanMap?: Partial<Record<DetailLevel, string>>;
  lastGeneratedContentMap?: Partial<Record<DetailLevel, string>>;
  lastPromptMap?: Partial<Record<DetailLevel, string>>;
  createdAt?: number;
  lastEditedAt?: number;
  sourceDocuments?: string[];
}

export interface StoredImageVersion {
  imageUrl: string;   // guaranteed data URL (blob URLs converted before storage)
  timestamp: number;
  label: string;
}

export interface StoredImage {
  fileId: string;
  headingId: string;
  level: DetailLevel;
  cardUrl: string;
  imageHistory: StoredImageVersion[];
}

export interface StoredInsightsSession {
  id: string;
  messages: ChatMessage[];
}

export interface StoredNugget {
  id: string;
  name: string;
  type: NuggetType;
  messages?: ChatMessage[];
  docChangeLog?: DocChangeEvent[];
  lastDocChangeSyncIndex?: number;
  createdAt: number;
  lastModifiedAt: number;
}

export interface StoredNuggetDocument {
  nuggetId: string;
  docId: string;
  name: string;
  size: number;
  type: string;
  lastModified: number;
  content?: string;
  status: 'ready' | 'error';
  progress: number;
}

export interface StoredProject {
  id: string;
  name: string;
  nuggetIds: string[];
  isCollapsed?: boolean;
  createdAt: number;
  lastModifiedAt: number;
}

// ── Storage interface (swappable backend) ──

export interface StorageBackend {
  init(): Promise<void>;
  isReady(): boolean;

  // App session state
  saveAppState(state: AppSessionState): Promise<void>;
  loadAppState(): Promise<AppSessionState | null>;

  // Files (metadata + content, no structure)
  saveFile(file: StoredFile): Promise<void>;
  loadFiles(): Promise<StoredFile[]>;
  deleteFile(fileId: string): Promise<void>;

  // Headings (per file, text data only)
  saveHeadings(fileId: string, headings: StoredHeading[]): Promise<void>;
  loadHeadings(fileId: string): Promise<StoredHeading[]>;
  deleteHeadings(fileId: string): Promise<void>;

  // Images (per heading+level, separated for performance)
  saveImage(image: StoredImage): Promise<void>;
  loadImages(fileId: string): Promise<StoredImage[]>;
  deleteImages(fileId: string): Promise<void>;

  // Insights session (chat messages)
  saveInsightsSession(session: StoredInsightsSession): Promise<void>;
  loadInsightsSession(): Promise<StoredInsightsSession | null>;
  deleteInsightsSession(): Promise<void>;

  // Insights documents
  saveInsightsDoc(doc: InsightsDocument): Promise<void>;
  loadInsightsDocs(): Promise<InsightsDocument[]>;
  deleteInsightsDoc(docId: string): Promise<void>;

  // Insights headings
  saveInsightsHeadings(headings: StoredHeading[]): Promise<void>;
  loadInsightsHeadings(): Promise<StoredHeading[]>;
  deleteInsightsHeadings(): Promise<void>;

  // Insights images
  saveInsightsImage(image: StoredImage): Promise<void>;
  loadInsightsImages(): Promise<StoredImage[]>;
  deleteInsightsImages(): Promise<void>;

  // Nugget documents (per-nugget owned)
  saveNuggetDocument(doc: StoredNuggetDocument): Promise<void>;
  loadNuggetDocuments(nuggetId: string): Promise<StoredNuggetDocument[]>;
  deleteNuggetDocument(nuggetId: string, docId: string): Promise<void>;
  deleteNuggetDocuments(nuggetId: string): Promise<void>;

  // Documents (v2 legacy — kept for migration reads only)
  loadDocuments(): Promise<StoredFile[]>;

  // Nuggets
  saveNugget(nugget: StoredNugget): Promise<void>;
  loadNuggets(): Promise<StoredNugget[]>;
  deleteNugget(nuggetId: string): Promise<void>;

  // Nugget headings (keyed by nuggetId)
  saveNuggetHeadings(nuggetId: string, headings: StoredHeading[]): Promise<void>;
  loadNuggetHeadings(nuggetId: string): Promise<StoredHeading[]>;
  deleteNuggetHeadings(nuggetId: string): Promise<void>;

  // Nugget images (keyed by nuggetId)
  saveNuggetImage(image: StoredImage): Promise<void>;
  loadNuggetImages(nuggetId: string): Promise<StoredImage[]>;
  deleteNuggetImages(nuggetId: string): Promise<void>;

  // Projects
  saveProject(project: StoredProject): Promise<void>;
  loadProjects(): Promise<StoredProject[]>;
  deleteProject(projectId: string): Promise<void>;

  // Clear everything
  clearAll(): Promise<void>;
}
