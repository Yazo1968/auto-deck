
export interface Palette {
  background: string;
  primary: string;
  secondary: string;
  accent: string;
  text: string;
}

export type DetailLevel = 'Executive' | 'Standard' | 'Detailed';

export interface FontPair {
  primary: string;   // Heading font
  secondary: string; // Body font
}

export interface StylingOptions {
  levelOfDetail: DetailLevel;
  style: string;
  palette: Palette;
  fonts: FontPair;
  aspectRatio: '1:1' | '2:3' | '3:2' | '3:4' | '4:3' | '4:5' | '5:4' | '9:16' | '16:9' | '21:9';
  resolution: '1K' | '2K' | '4K';
}

export interface ReferenceImage {
  url: string;
  settings: StylingOptions;
}

export interface Heading {
  level: number;
  text: string;
  id: string;
  selected?: boolean;
  settings?: StylingOptions;
  /** Stores synthesized content for each level of detail */
  synthesisMap?: Partial<Record<DetailLevel, string>>;
  /** Tracks synthesis state for each specific level */
  isSynthesizingMap?: Partial<Record<DetailLevel, boolean>>;
  startIndex?: number;
  /** Per-level card image URLs */
  cardUrlMap?: Partial<Record<DetailLevel, string>>;
  /** Per-level card generation state */
  isGeneratingMap?: Partial<Record<DetailLevel, boolean>>;
  /** Per-level annotation/version history */
  imageHistoryMap?: Partial<Record<DetailLevel, ImageVersion[]>>;
  /** Per-level visual layout plan from the planner step */
  visualPlanMap?: Partial<Record<DetailLevel, string>>;
  /** Per-level snapshot of synthesis content used for card generation — used to detect content changes */
  lastGeneratedContentMap?: Partial<Record<DetailLevel, string>>;
  /** Per-level full visualizer prompt used for card generation */
  lastPromptMap?: Partial<Record<DetailLevel, string>>;
  /** Timestamp when this heading was created */
  createdAt?: number;
  /** Timestamp when this heading was last edited */
  lastEditedAt?: number;
  /** Names of documents that were active when this heading was created */
  sourceDocuments?: string[];
}

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  lastModified: number;
  content?: string;
  structure?: Heading[];
  status: 'uploading' | 'processing' | 'ready' | 'error';
  progress: number;
  /** Whether the document is included in chat context (defaults to true when undefined). Not persisted. */
  enabled?: boolean;
}

export interface ZoomState {
  imageUrl: string | null;
  headingId: string | null;
  headingText: string | null;
  palette?: Palette | null;
  imageHistory?: ImageVersion[];
  aspectRatio?: string;   // e.g. '16:9', '4:3', '1:1', '3:4'
  resolution?: string;    // e.g. '1K', '2K', '4K'
}

// Phase 1: Annotation & Zoom types
export type AnnotationTool = 'select' | 'pin' | 'arrow' | 'rectangle' | 'sketch' | 'text' | 'zoom';

export interface NormalizedPoint {
  x: number; // 0.0-1.0
  y: number; // 0.0-1.0
}

export interface ZoomViewState {
  scale: number;      // 0.5 to 4.0
  panX: number;       // CSS transform translateX in px
  panY: number;       // CSS transform translateY in px
  isPanning: boolean;
}

// Phase 2: Annotation data types
export type AnnotationType = 'pin' | 'arrow' | 'rectangle' | 'sketch';

interface BaseAnnotation {
  id: string;
  type: AnnotationType;
  color: string;
  createdAt: number;
}

export interface PinAnnotation extends BaseAnnotation {
  type: 'pin';
  position: NormalizedPoint;
  instruction: string;
}

export interface RectangleAnnotation extends BaseAnnotation {
  type: 'rectangle';
  topLeft: NormalizedPoint;
  bottomRight: NormalizedPoint;
  instruction: string;
}

export interface ArrowAnnotation extends BaseAnnotation {
  type: 'arrow';
  start: NormalizedPoint;
  end: NormalizedPoint;
  instruction: string;
}

export interface SketchAnnotation extends BaseAnnotation {
  type: 'sketch';
  points: NormalizedPoint[];
  strokeWidth: number; // normalized — thick brush for area highlighting
  instruction: string;
}

export type Annotation = PinAnnotation | RectangleAnnotation | ArrowAnnotation | SketchAnnotation;

// Phase 5: Version history
export interface ImageVersion {
  imageUrl: string;    // blob URL or data URL
  timestamp: number;
  label: string;       // "Original", "Modification 1", etc.
}

export enum FileType {
  MD = 'text/markdown',
  PDF = 'application/pdf',
  DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  PLAIN = 'text/plain'
}

// ─────────────────────────────────────────────────────────────────
// Insights Workflow Types
// ─────────────────────────────────────────────────────────────────

export type WorkflowMode = 'insights';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  isCardContent?: boolean;       // true if this was a "Generate Card" response
  detailLevel?: DetailLevel;     // which level was requested
  savedAsHeadingId?: string;     // if user saved this to heading list
}

export interface InsightsDocument {
  id: string;
  name: string;
  type: 'md' | 'pdf' | 'docx';
  size: number;
  content?: string;              // text content for MD files
  base64?: string;               // binary content for PDF/DOCX
  mediaType?: string;            // MIME type for binary docs
}

export interface InsightsSession {
  id: string;
  documents: InsightsDocument[];
  messages: ChatMessage[];
  headings: Heading[];           // user-curated card headings
}

// ── Document change tracking ──

export type DocChangeEventType = 'added' | 'removed' | 'renamed' | 'enabled' | 'disabled' | 'updated';

export interface DocChangeEvent {
  type: DocChangeEventType;
  docId: string;
  docName: string;
  /** For rename events, the previous name */
  oldName?: string;
  timestamp: number;
}

// ── Nugget types ──

export type NuggetType = 'insights';

export interface Nugget {
  id: string;
  name: string;
  type: NuggetType;
  documents: UploadedFile[];
  headings: Heading[];
  messages?: ChatMessage[];
  lastDocHash?: string;           // hash of active documents at time of last API call
  /** Ordered log of document mutations for change notification */
  docChangeLog?: DocChangeEvent[];
  /** Index into docChangeLog marking last sync to chat agent */
  lastDocChangeSyncIndex?: number;
  createdAt: number;
  lastModifiedAt: number;
}

// ── Project types ──

export interface Project {
  id: string;
  name: string;
  nuggetIds: string[];
  isCollapsed?: boolean;
  createdAt: number;
  lastModifiedAt: number;
}

// ── Persistence types ──

export interface InitialPersistedState {
  nuggets: Nugget[];
  projects: Project[];
  selectedNuggetId: string | null;
  activeHeadingId: string | null;
  workflowMode: WorkflowMode;
  // Legacy compat fields — populated from nugget shim
  insightsSession: InsightsSession | null;
}
