import React, { useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Nugget, Project, UploadedFile, SourceOrigin } from '../types';
import { isNameTaken } from '../utils/naming';
import { formatTimestampFull } from '../utils/formatTime';
import { useThemeContext } from '../context/ThemeContext';
import { useNuggetContext } from '../context/NuggetContext';
import { useProjectContext } from '../context/ProjectContext';
import { useSelectionContext } from '../context/SelectionContext';
import { usePanelOverlay } from '../hooks/usePanelOverlay';

interface ProjectsPanelProps {
  isOpen: boolean;
  onToggle: () => void;
  onSelectProject: (projectId: string) => void;
  onSelectNugget: (id: string) => void;
  onCreateProject: () => void;
  onRenameProject: (id: string, newName: string) => void;
  onToggleProjectCollapse: (id: string) => void;
  onCreateNuggetInProject: (projectId: string) => void;
  onRenameNugget: (id: string, newName: string) => void;
  onCopyNuggetToProject: (nuggetId: string, targetProjectId: string) => void;
  onMoveNuggetToProject: (nuggetId: string, sourceProjectId: string, targetProjectId: string) => void;
  onCreateProjectForNugget: (
    nuggetId: string,
    projectName: string,
    mode: 'copy' | 'move',
    sourceProjectId: string,
  ) => void;
  onDuplicateProject: (id: string) => void;
  // Document operations (kebab menu on docs under the selected nugget)
  onRenameDocument?: (docId: string, newName: string) => void;
  onRemoveDocument?: (docId: string) => void;
  onCopyMoveDocument?: (docId: string, targetNuggetId: string, mode: 'copy' | 'move') => void;
  onCreateNuggetWithDoc?: (nuggetName: string, docId: string) => void;
  onUploadDocuments?: (files: FileList) => void;
  onEditSubject?: (nuggetId: string) => void;
  onOpenCardsPanel?: () => void;
  onOpenSourcesPanel?: () => void;
  otherNuggets?: { id: string; name: string }[];
  projectNuggets?: { projectId: string; projectName: string; nuggets: { id: string; name: string }[] }[];
}

// ── Document Info helpers ──

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatSourceType(doc: UploadedFile): string {
  if (doc.sourceType === 'native-pdf') return 'PDF';
  switch (doc.originalFormat) {
    case 'pdf':
      return 'PDF';
    case 'md':
      return 'MD';
    default:
      return 'MD';
  }
}

function formatOrigin(origin?: SourceOrigin): string {
  if (!origin) return '—';
  if (origin.type === 'uploaded') return 'Uploaded';
  const action = origin.type === 'copied' ? 'Copied' : 'Moved';
  const from = [origin.sourceProjectName, origin.sourceNuggetName].filter(Boolean).join(' / ');
  return from ? `${action} from ${from}` : action;
}

function isConvertedToMd(doc: UploadedFile): boolean {
  // Native PDFs are NOT converted to MD; direct markdown is NOT converted
  if (doc.sourceType === 'native-pdf') return false;
  if (doc.originalFormat === 'md') return false;
  // PDF that went through markdown conversion = yes
  return doc.originalFormat === 'pdf';
}

/** A single label → value row in the info card */
const InfoRow: React.FC<{ label: string; value: string; valueClass?: string }> = ({ label, value, valueClass }) => (
  <div className="flex items-baseline justify-between gap-2">
    <span className="text-[10px] text-zinc-500 dark:text-zinc-400 shrink-0">{label}</span>
    <span
      className={`text-[10px] truncate text-right max-w-[180px] ${valueClass ?? 'text-zinc-600 dark:text-zinc-400'}`}
      title={value}
    >
      {value}
    </span>
  </div>
);

const DocumentInfoContent: React.FC<{ doc: UploadedFile; enabled: boolean }> = ({ doc, enabled }) => {
  const originalName = doc.originalName ?? doc.name;
  const isRenamed = originalName !== doc.name;
  const chatEnabled = enabled;
  const chatTimestamp = chatEnabled ? doc.lastEnabledAt : doc.lastDisabledAt;

  return (
    <>
      {/* ── Header ── */}
      <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-600">
        <p className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
          Document Info
        </p>
      </div>

      <div className="px-3 py-2.5 space-y-2">
        {/* ── Naming ── */}
        <p className="text-[9px] font-semibold text-zinc-400 dark:text-zinc-400 uppercase tracking-widest">Naming</p>
        <InfoRow label="Current Name" value={doc.name} valueClass="text-zinc-700 dark:text-zinc-300 font-medium" />
        {isRenamed && <InfoRow label="Original Name" value={originalName} />}
        {doc.lastRenamedAt && <InfoRow label="Renamed" value={formatTimestampFull(doc.lastRenamedAt)} />}

        <div className="border-t border-zinc-100 dark:border-zinc-600" />

        {/* ── Origin & Type ── */}
        <p className="text-[9px] font-semibold text-zinc-400 dark:text-zinc-400 uppercase tracking-widest">
          Origin & Type
        </p>
        <InfoRow label="Origin" value={formatOrigin(doc.sourceOrigin)} />
        {doc.sourceOrigin && <InfoRow label="Origin Date" value={formatTimestampFull(doc.sourceOrigin.timestamp)} />}
        <InfoRow label="Source Type" value={formatSourceType(doc)} />
        <InfoRow label="Converted to MD" value={isConvertedToMd(doc) ? 'Yes' : 'No'} />
        <InfoRow label="Size" value={formatFileSize(doc.size)} />

        <div className="border-t border-zinc-100 dark:border-zinc-600" />

        {/* ── Versions ── */}
        <p className="text-[9px] font-semibold text-zinc-400 dark:text-zinc-400 uppercase tracking-widest">Versions</p>
        <InfoRow label="Version" value={`V${doc.version ?? 1}`} />
        <InfoRow label="Updated" value={doc.lastEditedAt ? formatTimestampFull(doc.lastEditedAt) : '—'} />

        <div className="border-t border-zinc-100 dark:border-zinc-600" />

        {/* ── Chat ── */}
        <p className="text-[9px] font-semibold text-zinc-400 dark:text-zinc-400 uppercase tracking-widest">Chat</p>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[10px] text-zinc-500 dark:text-zinc-400 shrink-0">Status</span>
          <span className={`text-[10px] font-medium ${chatEnabled ? 'text-green-600' : 'text-red-500'}`}>
            {chatEnabled ? 'Enabled \u2713' : 'Disabled \u2717'}
          </span>
        </div>
        <InfoRow label="Changed" value={chatTimestamp ? formatTimestampFull(chatTimestamp) : '—'} />
      </div>
    </>
  );
};

/** Ellipsis (three-dot) icon */
const EllipsisIcon = () => (
  <svg
    width="16"
    height="16"
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
);

/** Chevron icon for collapse/expand */
const ChevronIcon = ({ isCollapsed }: { isCollapsed: boolean }) => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`transition-transform duration-150 ${isCollapsed ? '-rotate-90' : ''}`}
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const ProjectsPanel: React.FC<ProjectsPanelProps> = ({
  isOpen,
  onToggle,
  onSelectProject,
  onSelectNugget,
  onCreateProject,
  onRenameProject,
  onToggleProjectCollapse,
  onCreateNuggetInProject,
  onRenameNugget,
  onCopyNuggetToProject,
  onMoveNuggetToProject,
  onCreateProjectForNugget,
  onDuplicateProject,
  onRenameDocument,
  onRemoveDocument,
  onCopyMoveDocument,
  onCreateNuggetWithDoc,
  onUploadDocuments,
  onEditSubject,
  onOpenCardsPanel,
  onOpenSourcesPanel,
  otherNuggets,
  projectNuggets,
}) => {
  const { darkMode } = useThemeContext();
  const { nuggets, selectedNuggetId, selectedDocumentId, deleteNugget } = useNuggetContext();
  const { projects, deleteProject } = useProjectContext();
  const { selectedProjectId, selectionLevel, selectEntity } = useSelectionContext();

  // Local aliases — bridge context values to names expected by internal sub-components
  const selectedDocId = selectedDocumentId;
  const onOpenDocument = useCallback(
    (docId: string) => selectEntity({ documentId: docId }),
    [selectEntity],
  );
  const onSelectDoc = useCallback(
    (docId: string | null) => selectEntity({ documentId: docId ?? undefined }),
    [selectEntity],
  );

  const { stripRef, shouldRender, handleResizeStart, overlayStyle } = usePanelOverlay({
    isOpen,
    defaultWidth: 350,
    minWidth: 350,
  });
  // Dropdown menu state (shared for project, nugget, and document kebabs)
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [menuType, setMenuType] = useState<'nugget' | 'project' | 'document'>('nugget');
  const [menuMode, setMenuMode] = useState<'hover' | 'locked'>('hover');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteType, setConfirmDeleteType] = useState<'nugget' | 'project'>('nugget');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renamingType, setRenamingType] = useState<'nugget' | 'project'>('nugget');
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState('');
  // Nugget copy/move hover submenu state
  const [showCopyMoveSubmenu, setShowCopyMoveSubmenu] = useState(false);
  const [showDocInfoSubmenu, setShowDocInfoSubmenu] = useState(false);
  const [noProjectsNuggetId, setNoProjectsNuggetId] = useState<string | null>(null);
  const [newProjectName, setNewProjectName] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  // ── Nugget expansion state (lifted so it survives panel collapse) ──
  const [expandedNuggetIds, setExpandedNuggetIds] = useState<Set<string>>(new Set());
  // Auto-expand the selected nugget and uncollapse its parent project
  useEffect(() => {
    if (selectedNuggetId) {
      setExpandedNuggetIds((prev) => {
        if (prev.has(selectedNuggetId)) return prev;
        return new Set(prev).add(selectedNuggetId);
      });
      const parentProject = projects.find((p) => p.nuggetIds.includes(selectedNuggetId));
      if (parentProject?.isCollapsed) {
        onToggleProjectCollapse(parentProject.id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only auto-expand on selection change; including projects/onToggleProjectCollapse would re-run on every project update
  }, [selectedNuggetId]);

  // ── Document kebab menu state ──
  const [docRenamingId, setDocRenamingId] = useState<string | null>(null);
  const [docRenameValue, setDocRenameValue] = useState('');
  const [docRenameError, setDocRenameError] = useState('');
  const [confirmRemoveDocId, setConfirmRemoveDocId] = useState<string | null>(null);
  const [noNuggetsModalDocId, setNoNuggetsModalDocId] = useState<string | null>(null);
  const [newNuggetName, setNewNuggetName] = useState('');
  const [docShowCopyMoveSubmenu, setDocShowCopyMoveSubmenu] = useState(false);
  const docRenameInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click (only when locked)
  useEffect(() => {
    if (!menuOpenId || menuMode !== 'locked') return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpenId, menuMode]);

  // Reset copy/move submenus when menu closes
  useEffect(() => {
    if (!menuOpenId) {
      setShowCopyMoveSubmenu(false);
      setDocShowCopyMoveSubmenu(false);
      setShowDocInfoSubmenu(false);
    }
  }, [menuOpenId]);

  // Focus rename input when entering rename mode
  useEffect(() => {
    if (renamingId) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [renamingId]);

  // Focus document rename input
  useEffect(() => {
    if (docRenamingId) {
      docRenameInputRef.current?.focus();
      docRenameInputRef.current?.select();
    }
  }, [docRenamingId]);

  const commitRename = () => {
    if (!renamingId || !renameValue.trim()) {
      setRenamingId(null);
      setRenameValue('');
      setRenameError('');
      return;
    }
    const trimmed = renameValue.trim();
    if (renamingType === 'nugget') {
      const nugget = nuggets.find((n) => n.id === renamingId);
      if (nugget && trimmed !== nugget.name) {
        // Check uniqueness within the same project
        const parentProject = projects.find((p) => p.nuggetIds.includes(renamingId));
        const siblingNames = parentProject
          ? parentProject.nuggetIds.map((nid) => nuggets.find((n) => n.id === nid)?.name || '').filter(Boolean)
          : nuggets.map((n) => n.name);
        if (isNameTaken(trimmed, siblingNames, nugget.name)) {
          setRenameError('A nugget with this name already exists');
          return;
        }
        onRenameNugget(renamingId, trimmed);
      }
    } else {
      const project = projects.find((p) => p.id === renamingId);
      if (project && trimmed !== project.name) {
        if (
          isNameTaken(
            trimmed,
            projects.map((p) => p.name),
            project.name,
          )
        ) {
          setRenameError('A project with this name already exists');
          return;
        }
        onRenameProject(renamingId, trimmed);
      }
    }
    setRenamingId(null);
    setRenameValue('');
    setRenameError('');
  };

  // ── Document rename commit ──
  const _selectedNugget = nuggets.find((n) => n.id === selectedNuggetId);
  const commitDocRename = () => {
    if (!docRenamingId || !docRenameValue.trim()) {
      setDocRenamingId(null);
      setDocRenameValue('');
      setDocRenameError('');
      return;
    }
    const trimmed = docRenameValue.trim();
    const renameResult = findDocAcrossNuggets(docRenamingId);
    if (renameResult) {
      const currentDoc = renameResult.doc;
      if (currentDoc && trimmed !== currentDoc.name) {
        const siblingNames = renameResult.nugget.documents.map((d) => d.name);
        if (isNameTaken(trimmed, siblingNames, currentDoc.name)) {
          setDocRenameError('A document with this name already exists');
          return;
        }
      }
    }
    if (onRenameDocument) onRenameDocument(docRenamingId, trimmed);
    setDocRenamingId(null);
    setDocRenameValue('');
    setDocRenameError('');
  };

  // Helper: find a document and its parent nugget across all nuggets
  const findDocAcrossNuggets = (docId: string) => {
    for (const n of nuggets) {
      const doc = n.documents?.find((d) => d.id === docId);
      if (doc) return { doc, nugget: n };
    }
    return null;
  };

  // Build a nugget lookup for quick access
  const nuggetMap = new Map(nuggets.map((n) => [n.id, n]));

  return (
    <>
      <button
        ref={stripRef}
        data-panel-strip
        onClick={onToggle}
        className="rounded-l-lg shadow-[5px_0_10px_rgba(0,0,0,0.35)] flex flex-col items-center pt-2 pb-1 h-full overflow-hidden shrink-0 w-10 cursor-pointer z-[4] relative"
        style={{ backgroundColor: darkMode ? 'rgb(40,52,62)' : 'rgb(217,232,241)' }}
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
            <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
          </svg>
        </div>
        <span
          className="text-[13px] font-bold uppercase tracking-wider text-white mt-2"
          style={{ writingMode: 'vertical-lr', transform: 'rotate(180deg)' } as React.CSSProperties}
        >
          Projects
        </span>
      </button>
      {/* Hidden file input for document upload */}
      <input
        ref={uploadInputRef}
        type="file"
        accept=".md,.pdf"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) {
            onUploadDocuments?.(e.target.files);
            e.target.value = '';
          }
        }}
      />

      {/* Overlay panel — portaled to body */}
      {shouldRender &&
        createPortal(
          <div
            data-panel-overlay
            className="fixed z-[108] flex flex-col bg-white dark:bg-zinc-900 border-4 rounded-r-lg shadow-[5px_0_6px_rgba(0,0,0,0.35)] overflow-hidden"
            style={{
              borderColor: darkMode ? 'rgb(40,52,62)' : 'rgb(217,232,241)',
              ...overlayStyle,
            }}
          >
            {/* Resize handle */}
            <div
              onMouseDown={handleResizeStart}
              className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize z-10 hover:bg-black/10 transition-colors"
            />
            {/* New Project bar */}
            <div className="shrink-0 border-b border-zinc-100 dark:border-zinc-600">
              <button
                onClick={onCreateProject}
                className="w-full flex items-center gap-1.5 px-3 py-1.5 cursor-pointer transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                <span
                  className="text-[11px] font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 flex-1 min-w-0 text-left"
                  style={{ textShadow: '0 1px 2px rgba(0,0,0,0.15)' }}
                >
                  New Project
                </span>
                <span className="text-[9px] text-zinc-500 dark:text-zinc-400 font-light">{projects.length}</span>
                <span className="shrink-0 w-5 h-5 rounded flex items-center justify-center text-zinc-600 dark:text-zinc-400">
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
                </span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <p className="text-[9px] text-zinc-400 dark:text-zinc-400 font-light italic px-3 pt-1">
                Right-click to view menu
              </p>
              <div className="px-3 pt-2 pb-3">
                {projects.length === 0 ? (
                  <p className="text-zinc-500 dark:text-zinc-400 text-[11px] font-light px-2 py-2">No projects yet</p>
                ) : (
                  <div className="space-y-0" role="tree" aria-label="Projects">
                    {projects.map((project) => (
                      <ProjectRow
                        key={project.id}
                        project={project}
                        nuggets={project.nuggetIds.map((id) => nuggetMap.get(id)).filter((n): n is Nugget => !!n)}
                        selectedNuggetId={selectedNuggetId}
                        isRenaming={renamingId === project.id && renamingType === 'project'}
                        renameValue={renameValue}
                        renameError={renamingId === project.id && renamingType === 'project' ? renameError : ''}
                        renameInputRef={
                          renamingId === project.id && renamingType === 'project' ? renameInputRef : undefined
                        }
                        onRenameChange={(v) => {
                          setRenameValue(v);
                          setRenameError('');
                        }}
                        onRenameCommit={commitRename}
                        onRenameCancel={() => {
                          setRenamingId(null);
                          setRenameValue('');
                          setRenameError('');
                        }}
                        onToggleCollapse={() => onToggleProjectCollapse(project.id)}
                        onMenuToggle={(pos: { x: number; y: number }) => {
                          if (menuOpenId === project.id) {
                            setMenuOpenId(null);
                          } else {
                            setMenuPos(pos);
                            setMenuType('project');
                            setMenuMode('locked');
                            setMenuOpenId(project.id);
                          }
                        }}
                        onRename={() => {
                          setMenuOpenId(null);
                          setRenamingId(project.id);
                          setRenamingType('project');
                          setRenameValue(project.name);
                        }}
                        onNewNugget={() => {
                          setMenuOpenId(null);
                          onCreateNuggetInProject(project.id);
                        }}
                        onDelete={() => {
                          setMenuOpenId(null);
                          setConfirmDeleteId(project.id);
                          setConfirmDeleteType('project');
                        }}
                        onSelectNugget={(id) => {
                          setExpandedNuggetIds((prev) => new Set(prev).add(id));
                          onSelectNugget(id);
                        }}
                        isProjectSelected={selectedProjectId === project.id}
                        selectionLevel={selectionLevel}
                        onSelectProject={() => onSelectProject(project.id)}
                        selectedDocId={selectedDocId ?? null}
                        onSelectDoc={(docId: string) => {
                          onSelectDoc?.(docId);
                        }}
                        onOpenDocument={onOpenDocument}
                        onOpenCardsPanel={onOpenCardsPanel}
                        onOpenSourcesPanel={onOpenSourcesPanel}
                        expandedNuggetIds={expandedNuggetIds}
                        onToggleNuggetExpand={(nuggetId: string) =>
                          setExpandedNuggetIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(nuggetId)) next.delete(nuggetId);
                            else next.add(nuggetId);
                            return next;
                          })
                        }
                        // Nugget-level actions
                        nuggetRenamingId={renamingType === 'nugget' ? renamingId : null}
                        nuggetRenameValue={renameValue}
                        nuggetRenameError={renamingType === 'nugget' ? renameError : ''}
                        nuggetRenameInputRef={renamingType === 'nugget' ? renameInputRef : undefined}
                        onNuggetRenameChange={(v) => {
                          setRenameValue(v);
                          setRenameError('');
                        }}
                        onNuggetRenameCommit={commitRename}
                        onNuggetRenameCancel={() => {
                          setRenamingId(null);
                          setRenameValue('');
                          setRenameError('');
                        }}
                        onNuggetMenuToggle={(nuggetId: string, pos: { x: number; y: number }) => {
                          if (menuOpenId === nuggetId) {
                            setMenuOpenId(null);
                          } else {
                            setMenuPos(pos);
                            setMenuType('nugget');
                            setMenuMode('locked');
                            setMenuOpenId(nuggetId);
                          }
                        }}
                        onNuggetRename={(nuggetId: string) => {
                          setMenuOpenId(null);
                          setRenamingId(nuggetId);
                          setRenamingType('nugget');
                          setRenameValue(nuggets.find((n) => n.id === nuggetId)?.name || '');
                        }}
                        onNuggetDelete={(nuggetId: string) => {
                          setMenuOpenId(null);
                          setConfirmDeleteId(nuggetId);
                          setConfirmDeleteType('nugget');
                        }}
                        docRenamingId={docRenamingId}
                        docRenameValue={docRenameValue}
                        docRenameError={docRenameError}
                        docRenameInputRef={docRenameInputRef}
                        onDocRenameChange={(v) => {
                          setDocRenameValue(v);
                          setDocRenameError('');
                        }}
                        onDocRenameCommit={commitDocRename}
                        onDocRenameCancel={() => {
                          setDocRenamingId(null);
                          setDocRenameValue('');
                          setDocRenameError('');
                        }}
                        onDocMenuToggle={(docId: string, pos: { x: number; y: number }) => {
                          if (menuOpenId === docId) {
                            setMenuOpenId(null);
                          } else {
                            setMenuPos(pos);
                            setMenuType('document');
                            setMenuMode('locked');
                            setMenuOpenId(docId);
                          }
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-3 py-2 shrink-0 flex items-center justify-between">
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-light">v4.0</p>
              <div className="w-7 h-7 rounded-full bg-zinc-900 flex items-center justify-center">
                <span className="text-[9px] font-bold text-white tracking-wide">YD</span>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* ── Kebab dropdown (project/nugget) — rendered as portal to escape overflow clipping ── */}
      {menuOpenId &&
        menuType !== 'document' &&
        (() => {
          const isProjectMenu = menuType === 'project';
          const nugget = !isProjectMenu ? nuggets.find((n) => n.id === menuOpenId) : null;
          const project = isProjectMenu ? projects.find((p) => p.id === menuOpenId) : null;
          if (!nugget && !project) return null;

          // For nugget copy/move submenu
          const sourceProject = nugget ? projects.find((p) => p.nuggetIds.includes(nugget.id)) : null;
          const otherProjects = nugget ? projects.filter((p) => !p.nuggetIds.includes(nugget.id)) : [];

          return createPortal(
            <div
              ref={menuRef}
              className="fixed z-[130] w-36 bg-white dark:bg-zinc-900 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-600 py-1"
              style={{ top: menuPos.y, left: menuPos.x }}
            >
              {/* Rename */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const id = menuOpenId;
                  setMenuOpenId(null);
                  if (isProjectMenu && project) {
                    setRenamingId(id);
                    setRenamingType('project');
                    setRenameValue(project.name);
                  } else if (nugget) {
                    setRenamingId(id);
                    setRenamingType('nugget');
                    setRenameValue(nugget.name);
                  }
                }}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[11px] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
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
                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                  <path d="m15 5 4 4" />
                </svg>
                {isProjectMenu ? 'Rename Project' : 'Rename Nugget'}
              </button>

              {/* Project-only: Duplicate Project */}
              {isProjectMenu && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const id = menuOpenId;
                    setMenuOpenId(null);
                    if (id) onDuplicateProject(id);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[11px] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
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
                    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                  </svg>
                  Duplicate Project
                </button>
              )}

              {/* Project-only: New Nugget */}
              {isProjectMenu && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpenId(null);
                    if (project) onCreateNuggetInProject(project.id);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[11px] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
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
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  New Nugget
                </button>
              )}

              {/* Nugget-only: Move / Copy — hover submenu */}
              {!isProjectMenu && nugget && (
                <div
                  className="relative"
                  onMouseEnter={() => setShowCopyMoveSubmenu(true)}
                  onMouseLeave={() => setShowCopyMoveSubmenu(false)}
                >
                  <button className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors">
                    <span className="flex items-center gap-2.5">
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
                        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                        <polyline points="10 17 15 12 10 7" />
                        <line x1="15" y1="12" x2="3" y2="12" />
                      </svg>
                      Move/Copy
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

                  {/* Project list submenu */}
                  {showCopyMoveSubmenu && (
                    <div className="absolute left-full top-0 mt-4 ml-1 w-[220px] bg-white dark:bg-zinc-900 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-600 py-1 z-[140]">
                      <div className="px-3 pb-1 border-b border-zinc-100 dark:border-zinc-600 mb-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                          Move/Copy to
                        </span>
                      </div>
                      <div className="max-h-[200px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                        {/* Same project — Duplicate option */}
                        {sourceProject && (
                          <div className="px-2 py-1 flex items-center gap-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg mx-1 group">
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="text-amber-500 shrink-0"
                            >
                              <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
                            </svg>
                            <span
                              className="flex-1 text-[11px] text-amber-600 font-medium truncate"
                              title={sourceProject.name}
                            >
                              {sourceProject.name}
                            </span>
                            <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => {
                                  const nid = menuOpenId!;
                                  setMenuOpenId(null);
                                  onCopyNuggetToProject(nid, sourceProject.id);
                                }}
                                className="px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-600 bg-amber-50 hover:bg-amber-100 hover:text-amber-700 rounded transition-colors"
                              >
                                Duplicate
                              </button>
                            </div>
                          </div>
                        )}
                        {/* Other projects — Copy / Move options */}
                        {otherProjects.map((p) => (
                          <div
                            key={p.id}
                            className="px-2 py-1 flex items-center gap-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg mx-1 group"
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
                              className="text-zinc-500 dark:text-zinc-400 shrink-0"
                            >
                              <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
                            </svg>
                            <span className="flex-1 text-[11px] text-black truncate" title={p.name}>
                              {p.name}
                            </span>
                            <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => {
                                  const nid = menuOpenId!;
                                  setMenuOpenId(null);
                                  onCopyNuggetToProject(nid, p.id);
                                }}
                                className="px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800/50 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-800 dark:hover:text-zinc-200 rounded transition-colors"
                              >
                                Copy
                              </button>
                              <button
                                onClick={() => {
                                  if (!sourceProject) return;
                                  const nid = menuOpenId!;
                                  setMenuOpenId(null);
                                  onMoveNuggetToProject(nid, sourceProject.id, p.id);
                                }}
                                className="px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800/50 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-800 dark:hover:text-zinc-200 rounded transition-colors"
                              >
                                Move
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Nugget-only: Upload Document (only for selected nugget) */}
              {!isProjectMenu && nugget && nugget.id === selectedNuggetId && onUploadDocuments && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpenId(null);
                    uploadInputRef.current?.click();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[11px] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
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
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  Upload Document
                </button>
              )}

              {/* Nugget-only: Subject */}
              {!isProjectMenu && nugget && onEditSubject && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const nid = menuOpenId!;
                    setMenuOpenId(null);
                    onEditSubject(nid);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[11px] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
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
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 16v-4" />
                    <path d="M12 8h.01" />
                  </svg>
                  Subject
                </button>
              )}

              <div className="border-t border-zinc-100 dark:border-zinc-600" />
              {/* Remove */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const id = menuOpenId;
                  setMenuOpenId(null);
                  setConfirmDeleteId(id);
                  setConfirmDeleteType(isProjectMenu ? 'project' : 'nugget');
                }}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[11px] text-red-600 hover:bg-red-50 transition-colors"
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
                  <path d="M3 6h18" />
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                </svg>
                {isProjectMenu ? 'Remove Project' : 'Remove Nugget'}
              </button>
            </div>,
            document.body,
          );
        })()}

      {/* ── Document kebab dropdown — rendered as portal ── */}
      {menuOpenId &&
        menuType === 'document' &&
        (() => {
          // Find the doc across all nuggets
          const found = findDocAcrossNuggets(menuOpenId);
          if (!found) return null;
          const doc = found.doc;

          return createPortal(
            <div
              ref={menuRef}
              className="fixed z-[130] w-36 bg-white dark:bg-zinc-900 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-600 py-1"
              style={{ top: menuPos.y, left: menuPos.x }}
            >
              {/* Document Info — click submenu */}
              <div className="relative">
                <button
                  onClick={() => setShowDocInfoSubmenu((prev) => !prev)}
                  className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
                >
                  <span className="flex items-center gap-2.5">
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
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 16v-4" />
                      <path d="M12 8h.01" />
                    </svg>
                    Document Info
                  </span>
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-zinc-400"
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
                {showDocInfoSubmenu && (
                  <div className="absolute left-full top-0 ml-1 w-64 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-600 rounded-lg shadow-lg z-[140] dark:shadow-black/30 max-h-[400px] overflow-y-auto">
                    <DocumentInfoContent doc={doc} enabled={doc.enabled !== false} />
                  </div>
                )}
              </div>
              <div className="border-t border-zinc-200 my-0.5" />

              {/* Open */}
              {onOpenDocument && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpenId(null);
                    onOpenDocument(doc.id);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[11px] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
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
                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                  </svg>
                  Open
                </button>
              )}

              {/* Rename */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpenId(null);
                  setDocRenamingId(doc.id);
                  setDocRenameValue(doc.name);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[11px] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
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
                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                </svg>
                Rename
              </button>

              {/* Copy/Move — hover submenu */}
              {onCopyMoveDocument && (
                <div
                  className="relative"
                  onMouseEnter={() => setDocShowCopyMoveSubmenu(true)}
                  onMouseLeave={() => setDocShowCopyMoveSubmenu(false)}
                >
                  <button
                    onClick={() => {
                      if (!otherNuggets || otherNuggets.length === 0) {
                        setNoNuggetsModalDocId(menuOpenId);
                        setMenuOpenId(null);
                      }
                    }}
                    className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
                  >
                    <span className="flex items-center gap-2.5">
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
                        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                        <polyline points="10 17 15 12 10 7" />
                        <line x1="15" y1="12" x2="3" y2="12" />
                      </svg>
                      Copy/Move
                    </span>
                    {otherNuggets && otherNuggets.length > 0 && (
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
                    )}
                  </button>

                  {/* Nugget list submenu */}
                  {docShowCopyMoveSubmenu && otherNuggets && otherNuggets.length > 0 && (
                    <div className="absolute left-full top-0 -ml-1 w-[220px] bg-white dark:bg-zinc-900 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-600 py-1 z-[140]">
                      <div className="px-3 pb-1 border-b border-zinc-100 dark:border-zinc-600 mb-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                          Copy/Move to nugget
                        </span>
                      </div>
                      <div className="max-h-[200px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                        {projectNuggets && projectNuggets.length > 0
                          ? projectNuggets.map((pg) => (
                              <div key={pg.projectId}>
                                <div className="px-3 pt-1.5 pb-0.5 flex items-center gap-1.5">
                                  <svg
                                    width="12"
                                    height="12"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="text-zinc-500 dark:text-zinc-400 shrink-0"
                                  >
                                    <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
                                  </svg>
                                  <span className="text-[9px] font-semibold text-zinc-500 dark:text-zinc-400 truncate">
                                    {pg.projectName}
                                  </span>
                                </div>
                                {pg.nuggets.length === 0 ? (
                                  <p className="text-zinc-500 dark:text-zinc-400 text-[9px] font-light pl-6 pr-2 py-0.5 italic">
                                    No other nuggets
                                  </p>
                                ) : (
                                  pg.nuggets.map((n) => (
                                    <div
                                      key={n.id}
                                      className="pl-5 pr-2 py-1 flex items-center gap-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg mx-1 group"
                                    >
                                      <div className="w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
                                      <span className="flex-1 text-[11px] text-black truncate" title={n.name}>
                                        {n.name}
                                      </span>
                                      <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                          onClick={() => {
                                            const dId = menuOpenId!;
                                            setMenuOpenId(null);
                                            onCopyMoveDocument(dId, n.id, 'copy');
                                          }}
                                          className="px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800/50 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-800 dark:hover:text-zinc-200 rounded transition-colors"
                                        >
                                          Copy
                                        </button>
                                        <button
                                          onClick={() => {
                                            const dId = menuOpenId!;
                                            setMenuOpenId(null);
                                            onCopyMoveDocument(dId, n.id, 'move');
                                          }}
                                          className="px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800/50 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-800 dark:hover:text-zinc-200 rounded transition-colors"
                                        >
                                          Move
                                        </button>
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            ))
                          : otherNuggets.map((n) => (
                              <div
                                key={n.id}
                                className="px-2 py-1 flex items-center gap-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg mx-1 group"
                              >
                                <div className="w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
                                <span className="flex-1 text-[11px] text-black truncate" title={n.name}>
                                  {n.name}
                                </span>
                                <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={() => {
                                      const dId = menuOpenId!;
                                      setMenuOpenId(null);
                                      onCopyMoveDocument(dId, n.id, 'copy');
                                    }}
                                    className="px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800/50 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-800 dark:hover:text-zinc-200 rounded transition-colors"
                                  >
                                    Copy
                                  </button>
                                  <button
                                    onClick={() => {
                                      const dId = menuOpenId!;
                                      setMenuOpenId(null);
                                      onCopyMoveDocument(dId, n.id, 'move');
                                    }}
                                    className="px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800/50 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-800 dark:hover:text-zinc-200 rounded transition-colors"
                                  >
                                    Move
                                  </button>
                                </div>
                              </div>
                            ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Download */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpenId(null);
                  if (doc.content) {
                    const blob = new Blob([doc.content], { type: 'text/markdown' });
                    const url = URL.createObjectURL(blob);
                    const a = Object.assign(document.createElement('a'), {
                      href: url,
                      download: `${doc.name.replace(/\.[^.]+$/, '')}.md`,
                    });
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  }
                }}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[11px] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
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
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download
              </button>

              <div className="border-t border-zinc-100 dark:border-zinc-600" />

              {/* Remove */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpenId(null);
                  setConfirmRemoveDocId(doc.id);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[11px] text-red-600 hover:bg-red-50 transition-colors"
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
                  <path d="M3 6h18" />
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                </svg>
                Remove
              </button>
            </div>,
            document.body,
          );
        })()}

      {/* ── No other projects — create-project modal ── */}
      {noProjectsNuggetId &&
        (() => {
          const sourceProject = projects.find((p) => p.nuggetIds.includes(noProjectsNuggetId));
          return createPortal(
            <div
              className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 dark:bg-black/60"
              onClick={() => {
                setNoProjectsNuggetId(null);
                setNewProjectName('');
              }}
            >
              <div
                className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl dark:shadow-black/30 mx-4 overflow-hidden"
                style={{ minWidth: 300, maxWidth: 'calc(100vw - 32px)', width: 'fit-content' }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-6 pt-6 pb-3 text-center">
                  <div className="w-9 h-9 rounded-full bg-zinc-100 dark:bg-zinc-800/50 flex items-center justify-center mx-auto mb-3">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      className="text-zinc-500 dark:text-zinc-400"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                      <polyline points="10 17 15 12 10 7" />
                      <line x1="15" y1="12" x2="3" y2="12" />
                    </svg>
                  </div>
                  <h3 className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 tracking-tight mb-1">
                    No Other Projects
                  </h3>
                  <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mt-1">
                    Create a new project to move or copy this nugget to.
                  </p>
                  <input
                    type="text"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    onKeyDown={(e) => {
                      if (
                        e.key === 'Enter' &&
                        newProjectName.trim() &&
                        sourceProject &&
                        !isNameTaken(
                          newProjectName.trim(),
                          projects.map((p) => p.name),
                        )
                      ) {
                        const nid = noProjectsNuggetId;
                        setNoProjectsNuggetId(null);
                        setNewProjectName('');
                        onCreateProjectForNugget(nid, newProjectName.trim(), 'move', sourceProject.id);
                      }
                    }}
                    placeholder="Project name"
                    autoFocus
                    className={`mt-3 w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-300 transition-all text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-500 ${
                      isNameTaken(
                        newProjectName.trim(),
                        projects.map((p) => p.name),
                      )
                        ? 'border-red-300 focus:border-red-400'
                        : 'border-zinc-200 dark:border-zinc-600 focus:border-zinc-400'
                    }`}
                  />
                  {isNameTaken(
                    newProjectName.trim(),
                    projects.map((p) => p.name),
                  ) && <p className="text-[10px] text-red-500 mt-1">A project with this name already exists</p>}
                </div>
                <div className="px-6 pb-5 pt-1 flex items-center justify-center gap-2">
                  {(() => {
                    const nameConflict = isNameTaken(
                      newProjectName.trim(),
                      projects.map((p) => p.name),
                    );
                    const canSubmit = !!newProjectName.trim() && !nameConflict;
                    return (
                      <>
                        <button
                          onClick={() => {
                            setNoProjectsNuggetId(null);
                            setNewProjectName('');
                          }}
                          className="px-4 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => {
                            if (!canSubmit || !sourceProject) return;
                            const nid = noProjectsNuggetId;
                            setNoProjectsNuggetId(null);
                            setNewProjectName('');
                            onCreateProjectForNugget(nid, newProjectName.trim(), 'copy', sourceProject.id);
                          }}
                          disabled={!canSubmit}
                          className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors ${canSubmit ? 'bg-zinc-100 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700' : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 opacity-40 cursor-not-allowed'}`}
                        >
                          Copy
                        </button>
                        <button
                          onClick={() => {
                            if (!canSubmit || !sourceProject) return;
                            const nid = noProjectsNuggetId;
                            setNoProjectsNuggetId(null);
                            setNewProjectName('');
                            onCreateProjectForNugget(nid, newProjectName.trim(), 'move', sourceProject.id);
                          }}
                          disabled={!canSubmit}
                          className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors ${canSubmit ? 'bg-zinc-900 text-white hover:bg-zinc-800' : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 opacity-40 cursor-not-allowed'}`}
                        >
                          Move
                        </button>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>,
            document.body,
          );
        })()}

      {/* Delete confirmation modal — centered, dimmed background */}
      {confirmDeleteId &&
        (() => {
          const isProject = confirmDeleteType === 'project';
          const item = isProject
            ? projects.find((p) => p.id === confirmDeleteId)
            : nuggets.find((n) => n.id === confirmDeleteId);
          if (!item) return null;
          const projectNuggetCount = isProject ? (item as Project).nuggetIds.length : 0;
          return createPortal(
            <div
              className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 dark:bg-black/60"
              onClick={() => setConfirmDeleteId(null)}
            >
              <div
                className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl dark:shadow-black/30 mx-4 overflow-hidden"
                style={{ minWidth: 260, maxWidth: 'calc(100vw - 32px)', width: 'fit-content' }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-6 pt-6 pb-3 text-center">
                  <div className="w-9 h-9 rounded-full bg-zinc-100 dark:bg-zinc-800/50 flex items-center justify-center mx-auto mb-3">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      className="text-zinc-500 dark:text-zinc-400"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3 6h18" />
                      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                    </svg>
                  </div>
                  <h3 className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 tracking-tight mb-1">
                    Delete {isProject ? 'Project' : 'Nugget'}
                  </h3>
                  <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 whitespace-nowrap">{item.name}</p>
                  {isProject && projectNuggetCount > 0 && (
                    <p className="text-[12px] text-amber-600 mt-2">
                      This will also delete {projectNuggetCount} nugget{projectNuggetCount > 1 ? 's' : ''}.
                    </p>
                  )}
                  <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mt-2">This cannot be undone.</p>
                </div>
                <div className="px-6 pb-5 pt-1 flex items-center justify-center gap-2">
                  <button
                    onClick={() => setConfirmDeleteId(null)}
                    className="px-4 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setConfirmDeleteId(null);
                      if (isProject) deleteProject(confirmDeleteId);
                      else deleteNugget(confirmDeleteId);
                    }}
                    className="px-4 py-2 bg-zinc-900 text-white text-xs font-medium rounded-lg hover:bg-zinc-800 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          );
        })()}

      {/* ── Document remove confirmation modal ── */}
      {confirmRemoveDocId &&
        (() => {
          const found = findDocAcrossNuggets(confirmRemoveDocId);
          if (!found) return null;
          const doc = found.doc;
          return createPortal(
            <div
              className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 dark:bg-black/60"
              onClick={() => setConfirmRemoveDocId(null)}
            >
              <div
                className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl dark:shadow-black/30 mx-4 overflow-hidden"
                style={{ minWidth: 260, maxWidth: 'calc(100vw - 32px)', width: 'fit-content' }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-6 pt-6 pb-3 text-center">
                  <div className="w-9 h-9 rounded-full bg-zinc-100 dark:bg-zinc-800/50 flex items-center justify-center mx-auto mb-3">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      className="text-zinc-500 dark:text-zinc-400"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3 6h18" />
                      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                    </svg>
                  </div>
                  <h3 className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 tracking-tight mb-1">
                    Remove Document
                  </h3>
                  <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 whitespace-nowrap">{doc.name}</p>
                  <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mt-2">This cannot be undone.</p>
                </div>
                <div className="px-6 pb-5 pt-1 flex items-center justify-center gap-2">
                  <button
                    onClick={() => setConfirmRemoveDocId(null)}
                    className="px-4 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setConfirmRemoveDocId(null);
                      onRemoveDocument?.(doc.id);
                    }}
                    className="px-4 py-2 bg-zinc-900 text-white text-xs font-medium rounded-lg hover:bg-zinc-800 transition-colors"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          );
        })()}

      {/* ── No other nuggets — create-nugget-with-doc modal ── */}
      {noNuggetsModalDocId &&
        onCreateNuggetWithDoc &&
        createPortal(
          <div
            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 dark:bg-black/60"
            onClick={() => {
              setNoNuggetsModalDocId(null);
              setNewNuggetName('');
            }}
          >
            <div
              className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl dark:shadow-black/30 mx-4 overflow-hidden"
              style={{ minWidth: 300, maxWidth: 'calc(100vw - 32px)', width: 'fit-content' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 pt-6 pb-3 text-center">
                <div className="w-9 h-9 rounded-full bg-zinc-100 dark:bg-zinc-800/50 flex items-center justify-center mx-auto mb-3">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    className="text-zinc-500 dark:text-zinc-400"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                    <polyline points="10 17 15 12 10 7" />
                    <line x1="15" y1="12" x2="3" y2="12" />
                  </svg>
                </div>
                <h3 className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 tracking-tight mb-1">
                  No Other Nuggets
                </h3>
                <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mt-1">
                  Create a new nugget to copy this document to.
                </p>
                {(() => {
                  const allNuggetNames = (otherNuggets || []).map((n) => n.name);
                  const nameConflict = isNameTaken(newNuggetName.trim(), allNuggetNames);
                  return (
                    <>
                      <input
                        type="text"
                        value={newNuggetName}
                        onChange={(e) => setNewNuggetName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newNuggetName.trim() && !nameConflict) {
                            const docId = noNuggetsModalDocId;
                            setNoNuggetsModalDocId(null);
                            setNewNuggetName('');
                            onCreateNuggetWithDoc(newNuggetName.trim(), docId);
                          }
                        }}
                        placeholder="Nugget name"
                        autoFocus
                        className={`mt-3 w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-300 transition-all text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-500 ${nameConflict ? 'border-red-300 focus:border-red-400' : 'border-zinc-200 dark:border-zinc-600 focus:border-zinc-400'}`}
                      />
                      {nameConflict && (
                        <p className="text-[10px] text-red-500 mt-1">A nugget with this name already exists</p>
                      )}
                    </>
                  );
                })()}
              </div>
              <div className="px-6 pb-5 pt-1 flex items-center justify-center gap-2">
                <button
                  onClick={() => {
                    setNoNuggetsModalDocId(null);
                    setNewNuggetName('');
                  }}
                  className="px-4 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                {(() => {
                  const nameConflict = isNameTaken(
                    newNuggetName.trim(),
                    (otherNuggets || []).map((n) => n.name),
                  );
                  const canCreate = !!newNuggetName.trim() && !nameConflict;
                  return (
                    <button
                      onClick={() => {
                        if (!canCreate) return;
                        const docId = noNuggetsModalDocId;
                        setNoNuggetsModalDocId(null);
                        setNewNuggetName('');
                        onCreateNuggetWithDoc(newNuggetName.trim(), docId);
                      }}
                      disabled={!canCreate}
                      className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors ${
                        canCreate
                          ? 'bg-zinc-900 text-white hover:bg-zinc-800'
                          : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 opacity-40 cursor-not-allowed'
                      }`}
                    >
                      New Nugget
                    </button>
                  );
                })()}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
};

// ── Project row sub-component ──

interface ProjectRowProps {
  project: Project;
  nuggets: Nugget[];
  selectedNuggetId: string | null;
  isRenaming: boolean;
  renameValue: string;
  renameError: string;
  renameInputRef?: React.RefObject<HTMLInputElement | null>;
  onRenameChange: (value: string) => void;
  onRenameCommit: () => void;
  onRenameCancel: () => void;
  onToggleCollapse: () => void;
  onMenuToggle: (pos: { x: number; y: number }) => void;
  onRename: () => void;
  onNewNugget: () => void;
  onDelete: () => void;
  onSelectNugget: (id: string) => void;
  isProjectSelected: boolean;
  selectionLevel: 'project' | 'nugget' | 'document' | null;
  onSelectProject: () => void;
  selectedDocId: string | null;
  onSelectDoc: (docId: string) => void;
  onOpenDocument?: (docId: string) => void;
  onOpenCardsPanel?: () => void;
  onOpenSourcesPanel?: () => void;
  expandedNuggetIds: Set<string>;
  onToggleNuggetExpand: (nuggetId: string) => void;
  // Nugget-level props (passed through)
  nuggetRenamingId: string | null;
  nuggetRenameValue: string;
  nuggetRenameError: string;
  nuggetRenameInputRef?: React.RefObject<HTMLInputElement | null>;
  onNuggetRenameChange: (value: string) => void;
  onNuggetRenameCommit: () => void;
  onNuggetRenameCancel: () => void;
  onNuggetMenuToggle: (nuggetId: string, pos: { x: number; y: number }) => void;
  onNuggetRename: (nuggetId: string) => void;
  onNuggetDelete: (nuggetId: string) => void;
  // Document kebab menu props (passed through to NuggetRow)
  docRenamingId: string | null;
  docRenameValue: string;
  docRenameError: string;
  docRenameInputRef?: React.RefObject<HTMLInputElement | null>;
  onDocRenameChange: (value: string) => void;
  onDocRenameCommit: () => void;
  onDocRenameCancel: () => void;
  onDocMenuToggle: (docId: string, pos: { x: number; y: number }) => void;
}

const ProjectRow: React.FC<ProjectRowProps> = ({
  project,
  nuggets,
  selectedNuggetId,
  isRenaming,
  renameValue,
  renameError,
  renameInputRef,
  onRenameChange,
  onRenameCommit,
  onRenameCancel,
  onToggleCollapse,
  onMenuToggle,
  onRename: _onRename,
  onNewNugget: _onNewNugget,
  onDelete: _onDelete,
  onSelectNugget,
  isProjectSelected,
  selectionLevel,
  onSelectProject,
  selectedDocId,
  onSelectDoc,
  onOpenDocument,
  onOpenCardsPanel,
  onOpenSourcesPanel,
  expandedNuggetIds,
  onToggleNuggetExpand,
  nuggetRenamingId,
  nuggetRenameValue,
  nuggetRenameError,
  nuggetRenameInputRef,
  onNuggetRenameChange,
  onNuggetRenameCommit,
  onNuggetRenameCancel,
  onNuggetMenuToggle,
  onNuggetRename: _onNuggetRename,
  onNuggetDelete: _onNuggetDelete,
  docRenamingId,
  docRenameValue,
  docRenameError,
  docRenameInputRef,
  onDocRenameChange,
  onDocRenameCommit,
  onDocRenameCancel,
  onDocMenuToggle,
}) => {
  const isPrimaryProject = isProjectSelected && selectionLevel === 'project';
  const clickedDocId = selectionLevel === 'document' ? selectedDocId : null;

  return (
    <div role="treeitem" aria-expanded={nuggets.length > 0 ? !project.isCollapsed : undefined}>
      {/* Project header row — table-of-contents style */}
      <div
        role="button"
        tabIndex={0}
        className={`group flex items-center gap-1 px-1.5 py-1 cursor-pointer select-none transition-colors duration-150 border border-transparent ${isPrimaryProject ? '' : 'hover:border-blue-300'}`}
        style={isPrimaryProject ? { backgroundColor: 'rgb(50,90,130)', borderRadius: 4 } : undefined}
        onClick={() => {
          if (isRenaming) return;
          onSelectProject();
        }}
        onKeyDown={(e) => {
          if (isRenaming) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelectProject();
          }
        }}
      >
        {/* Collapse chevron — only if project has nuggets */}
        {nuggets.length > 0 ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleCollapse();
            }}
            className="w-4 h-4 flex items-center justify-center shrink-0"
            style={{
              color: isPrimaryProject ? 'white' : isProjectSelected ? 'var(--tree-icon)' : 'var(--tree-icon-dim)',
            }}
            aria-label={project.isCollapsed ? 'Expand project' : 'Collapse project'}
          >
            <ChevronIcon isCollapsed={!!project.isCollapsed} />
          </button>
        ) : (
          <span className="w-4 h-4 shrink-0" />
        )}

        {/* Folder icon */}
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0"
          style={{
            color: isPrimaryProject ? 'white' : isProjectSelected ? 'var(--tree-text)' : 'var(--tree-text-dim)',
          }}
        >
          <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
        </svg>

        {/* Project name */}
        <div className="flex-1 min-w-0">
          {isRenaming ? (
            <div>
              <input
                ref={renameInputRef}
                value={renameValue}
                onChange={(e) => onRenameChange(e.target.value)}
                onBlur={onRenameCommit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onRenameCommit();
                  if (e.key === 'Escape') onRenameCancel();
                }}
                onClick={(e) => e.stopPropagation()}
                className={`w-full text-[11px] font-semibold text-zinc-800 dark:text-zinc-200 bg-white dark:bg-zinc-900 border rounded px-1.5 py-0.5 outline-none ${renameError ? 'border-red-400 focus:border-red-400' : 'border-zinc-300 dark:border-zinc-600 focus:border-zinc-400'}`}
                aria-invalid={!!renameError || undefined}
                aria-describedby={renameError ? 'project-rename-error' : undefined}
              />
              {renameError && (
                <p id="project-rename-error" className="text-[9px] text-red-500 mt-0.5">
                  {renameError}
                </p>
              )}
            </div>
          ) : (
            <p
              className="text-[11px] font-semibold truncate"
              style={{
                color: isPrimaryProject ? 'white' : isProjectSelected ? 'var(--tree-text)' : 'var(--tree-text-dim)',
              }}
              title={project.name}
            >
              {project.name}
            </p>
          )}
        </div>

        {/* Kebab menu button */}
        {!isRenaming && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMenuToggle({ x: e.clientX, y: e.clientY });
            }}
            className="shrink-0 w-5 h-5 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity hover:text-zinc-600"
            style={{ color: isPrimaryProject ? 'rgba(255,255,255,0.7)' : 'rgba(100,116,139,0.5)' }}
            aria-label="Project menu"
          >
            <EllipsisIcon />
          </button>
        )}
      </div>

      {/* Nuggets list (indented) */}
      {!project.isCollapsed && (
        <div className="ml-3 pl-2 border-l" style={{ borderColor: 'var(--tree-icon-dim)' }}>
          {nuggets.length === 0 ? (
            <p className="text-[10px] font-light px-2 py-1.5 italic" style={{ color: 'var(--tree-icon-dim)' }}>
              No nuggets
            </p>
          ) : (
            <div className="space-y-0" role="group">
              {nuggets.map((nugget) => (
                <NuggetRow
                  key={nugget.id}
                  nugget={nugget}
                  isSelected={selectedNuggetId === nugget.id && selectionLevel === 'nugget'}
                  isInSelectedProject={isProjectSelected}
                  clickedDocId={clickedDocId}
                  isRenaming={nuggetRenamingId === nugget.id}
                  renameValue={nuggetRenameValue}
                  renameError={nuggetRenamingId === nugget.id ? nuggetRenameError : ''}
                  renameInputRef={nuggetRenamingId === nugget.id ? nuggetRenameInputRef : undefined}
                  onRenameChange={onNuggetRenameChange}
                  onRenameCommit={onNuggetRenameCommit}
                  onRenameCancel={onNuggetRenameCancel}
                  onSelect={() => onSelectNugget(nugget.id)}
                  onMenuToggle={(pos: { x: number; y: number }) => onNuggetMenuToggle(nugget.id, pos)}
                  docRenamingId={docRenamingId}
                  docRenameValue={docRenameValue}
                  docRenameError={docRenameError}
                  docRenameInputRef={
                    docRenamingId && nugget.documents?.some((d) => d.id === docRenamingId)
                      ? docRenameInputRef
                      : undefined
                  }
                  onDocRenameChange={onDocRenameChange}
                  onDocRenameCommit={onDocRenameCommit}
                  onDocRenameCancel={onDocRenameCancel}
                  onDocMenuToggle={onDocMenuToggle}
                  onOpenDocument={onOpenDocument}
                  selectedDocId={selectedDocId}
                  onSelectDoc={onSelectDoc}
                  onOpenCardsPanel={onOpenCardsPanel}
                  onOpenSourcesPanel={onOpenSourcesPanel}
                  isExpanded={expandedNuggetIds.has(nugget.id)}
                  onToggleExpand={() => onToggleNuggetExpand(nugget.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Nugget row sub-component ──

interface NuggetRowProps {
  nugget: Nugget;
  isSelected: boolean;
  isInSelectedProject: boolean;
  clickedDocId: string | null;
  isRenaming: boolean;
  renameValue: string;
  renameError: string;
  renameInputRef?: React.RefObject<HTMLInputElement | null>;
  onRenameChange: (value: string) => void;
  onRenameCommit: () => void;
  onRenameCancel: () => void;
  onSelect: () => void;
  onMenuToggle: (pos: { x: number; y: number }) => void;
  // Document kebab menu props (only active when isSelected)
  docRenamingId: string | null;
  docRenameValue: string;
  docRenameError: string;
  docRenameInputRef?: React.RefObject<HTMLInputElement | null>;
  onDocRenameChange: (value: string) => void;
  onDocRenameCommit: () => void;
  onDocRenameCancel: () => void;
  onDocMenuToggle: (docId: string, pos: { x: number; y: number }) => void;
  onOpenDocument?: (docId: string) => void;
  selectedDocId: string | null;
  onSelectDoc: (docId: string) => void;
  onOpenCardsPanel?: () => void;
  onOpenSourcesPanel?: () => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

const NuggetRow: React.FC<NuggetRowProps> = ({
  nugget,
  isSelected,
  isInSelectedProject,
  clickedDocId,
  isRenaming,
  renameValue,
  renameError,
  renameInputRef,
  onRenameChange,
  onRenameCommit,
  onRenameCancel,
  onSelect,
  onMenuToggle,
  docRenamingId,
  docRenameValue,
  docRenameError,
  docRenameInputRef,
  onDocRenameChange,
  onDocRenameCommit,
  onDocRenameCancel,
  onDocMenuToggle,
  onOpenDocument,
  selectedDocId: _selectedDocId,
  onSelectDoc,
  onOpenCardsPanel,
  onOpenSourcesPanel,
  isExpanded,
  onToggleExpand,
}) => {
  const docCount = nugget.documents?.length ?? 0;
  return (
    <div role="treeitem" aria-expanded={docCount > 0 ? isExpanded : undefined}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          if (isRenaming) return;
          onSelect();
        }}
        onDoubleClick={() => {
          if (isRenaming) return;
          onSelect();
          onOpenCardsPanel?.();
        }}
        onKeyDown={(e) => {
          if (isRenaming) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect();
          }
        }}
        className={`group relative flex items-center gap-1 px-1.5 py-1 cursor-pointer select-none transition-all duration-150 ${
          isSelected ? 'sidebar-node-active' : 'border border-transparent hover:border-blue-300'
        }`}
      >
        {/* Expand/collapse chevron — only if nugget has docs */}
        {docCount > 0 ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
            className="w-4 h-4 flex items-center justify-center shrink-0"
            style={{
              color: isSelected
                ? 'var(--tree-icon)'
                : isInSelectedProject
                  ? 'var(--tree-icon)'
                  : 'var(--tree-icon-dim)',
            }}
            aria-label={isExpanded ? 'Collapse nugget' : 'Expand nugget'}
          >
            <ChevronIcon isCollapsed={!isExpanded} />
          </button>
        ) : (
          <span className="w-4 h-4 shrink-0" />
        )}

        <div className="flex-1 min-w-0 flex items-center gap-1">
          {isRenaming ? (
            <div className="flex-1 min-w-0">
              <input
                ref={renameInputRef}
                value={renameValue}
                onChange={(e) => onRenameChange(e.target.value)}
                onBlur={onRenameCommit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onRenameCommit();
                  if (e.key === 'Escape') onRenameCancel();
                }}
                onClick={(e) => e.stopPropagation()}
                className={`w-full text-[11px] font-medium text-zinc-800 dark:text-zinc-200 bg-white dark:bg-zinc-900 border rounded px-1.5 py-0.5 outline-none ${renameError ? 'border-red-400 focus:border-red-400' : 'border-zinc-300 dark:border-zinc-600 focus:border-zinc-400'}`}
                aria-invalid={!!renameError || undefined}
                aria-describedby={renameError ? 'nugget-rename-error' : undefined}
              />
              {renameError && (
                <p id="nugget-rename-error" className="text-[9px] text-red-500 mt-0.5">
                  {renameError}
                </p>
              )}
            </div>
          ) : (
            <>
              <p
                className={`text-[11px] truncate ${isSelected ? 'font-medium' : 'font-normal'}`}
                style={{
                  color: isSelected
                    ? 'var(--tree-active)'
                    : isInSelectedProject
                      ? 'var(--tree-text)'
                      : 'var(--tree-text-dim)',
                }}
                title={nugget.name}
              >
                {nugget.name}
              </p>
              {docCount > 0 && (
                <span
                  className="shrink-0 text-[10px] font-normal"
                  style={{
                    color: isSelected
                      ? 'var(--tree-icon)'
                      : isInSelectedProject
                        ? 'var(--tree-icon)'
                        : 'var(--tree-icon-dim)',
                  }}
                >
                  {docCount}
                </span>
              )}
            </>
          )}
        </div>

        {/* Kebab menu button */}
        {!isRenaming && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMenuToggle({ x: e.clientX, y: e.clientY });
            }}
            className="shrink-0 w-5 h-5 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity"
            style={{
              color: isSelected
                ? 'var(--tree-icon)'
                : isInSelectedProject
                  ? 'var(--tree-icon)'
                  : 'var(--tree-icon-dim)',
            }}
            aria-label="Nugget menu"
          >
            <EllipsisIcon />
          </button>
        )}
      </div>

      {/* Documents list */}
      {isExpanded && docCount > 0 && (
        <div className="ml-3 pl-2 border-l" role="group" style={{ borderColor: 'var(--tree-icon-dim)' }}>
          {nugget.documents.map((doc) => {
            const isDocRenaming = docRenamingId === doc.id;
            const isThisDocSelected = clickedDocId === doc.id;
            return (
              <div
                key={doc.id}
                role="treeitem"
                className={`group flex items-center gap-1.5 px-1.5 py-0.5 select-none transition-colors duration-150 cursor-pointer ${
                  isThisDocSelected ? 'sidebar-node-active' : 'border border-transparent hover:border-blue-300'
                }`}
              >
                {isDocRenaming ? (
                  <>
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="shrink-0"
                      style={{ color: 'var(--tree-icon-dim)' }}
                    >
                      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
                      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
                    </svg>
                    <div className="flex-1 min-w-0">
                      <input
                        ref={docRenameInputRef}
                        value={docRenameValue}
                        onChange={(e) => onDocRenameChange(e.target.value)}
                        onBlur={onDocRenameCommit}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') onDocRenameCommit();
                          if (e.key === 'Escape') onDocRenameCancel();
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className={`w-full text-[10px] font-medium text-zinc-800 dark:text-zinc-200 bg-white dark:bg-zinc-900 border rounded px-1 py-0 outline-none ${docRenameError ? 'border-red-400 focus:border-red-400' : 'border-zinc-300 dark:border-zinc-600 focus:border-zinc-400'}`}
                        aria-invalid={!!docRenameError || undefined}
                        aria-describedby={docRenameError ? 'doc-rename-error' : undefined}
                      />
                      {docRenameError && (
                        <p id="doc-rename-error" className="text-[8px] text-red-500 mt-0.5">
                          {docRenameError}
                        </p>
                      )}
                    </div>
                  </>
                ) : (
                  <DocRow
                    doc={doc}
                    isSelected={isThisDocSelected}
                    isInSelectedProject={isInSelectedProject}
                    onMenuToggle={(pos) => onDocMenuToggle(doc.id, pos)}
                    onOpenDocument={onOpenDocument}
                    onSelectDoc={onSelectDoc}
                    onOpenSourcesPanel={onOpenSourcesPanel}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ── Document row sub-component (interactive, for selected nugget) ──

interface DocRowProps {
  doc: { id: string; name: string; status?: string };
  isSelected?: boolean;
  isInSelectedProject?: boolean;
  onMenuToggle: (pos: { x: number; y: number }) => void;
  onOpenDocument?: (docId: string) => void;
  onSelectDoc?: (docId: string) => void;
  onOpenSourcesPanel?: () => void;
}

const DocRow: React.FC<DocRowProps> = ({
  doc,
  isSelected,
  isInSelectedProject,
  onMenuToggle,
  onOpenDocument,
  onSelectDoc,
  onOpenSourcesPanel,
}) => {
  return (
    <div
      role="button"
      tabIndex={0}
      className="flex items-center gap-1.5 flex-1 min-w-0 cursor-pointer"
      onClick={(e) => {
        e.stopPropagation();
        onSelectDoc?.(doc.id);
        onOpenDocument?.(doc.id);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          onSelectDoc?.(doc.id);
          onOpenDocument?.(doc.id);
        }
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onSelectDoc?.(doc.id);
        onOpenDocument?.(doc.id);
        onOpenSourcesPanel?.();
      }}
    >
      {doc.status === 'processing' || doc.status === 'uploading' ? (
        <div className="shrink-0 w-2.5 h-2.5 border-[1.5px] border-zinc-300 dark:border-zinc-600 border-t-zinc-600 dark:border-t-zinc-400 rounded-full animate-spin" />
      ) : (
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0"
          style={{
            color: isSelected
              ? 'var(--tree-active)'
              : isInSelectedProject
                ? 'var(--tree-icon)'
                : 'var(--tree-icon-dim)',
          }}
        >
          <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
          <path d="M14 2v4a2 2 0 0 0 2 2h4" />
        </svg>
      )}
      <span
        className="flex-1 text-[10px] truncate"
        style={{
          color: isSelected ? 'var(--tree-active)' : isInSelectedProject ? 'var(--tree-text)' : 'var(--tree-text-dim)',
        }}
        title={doc.name}
      >
        {doc.name}
      </span>
      {/* Kebab menu button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onMenuToggle({ x: e.clientX, y: e.clientY });
        }}
        className="shrink-0 w-4 h-4 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity"
        style={{
          color: isSelected ? 'var(--tree-icon)' : isInSelectedProject ? 'var(--tree-icon)' : 'var(--tree-icon-dim)',
        }}
        aria-label="Document menu"
      >
        <EllipsisIcon />
      </button>
    </div>
  );
};

export default React.memo(ProjectsPanel);
