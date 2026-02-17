import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Nugget, Project } from '../types';
import { isNameTaken } from '../utils/naming';

interface FileSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  nuggets: Nugget[];
  projects: Project[];
  selectedNuggetId: string | null;
  onSelectNugget: (id: string) => void;
  onCreateProject: () => void;
  onRenameProject: (id: string, newName: string) => void;
  onDeleteProject: (id: string) => void;
  onToggleProjectCollapse: (id: string) => void;
  onCreateNuggetInProject: (projectId: string) => void;
  onRenameNugget: (id: string, newName: string) => void;
  onDeleteNugget: (id: string) => void;
  onCopyNuggetToProject: (nuggetId: string, targetProjectId: string) => void;
  onMoveNuggetToProject: (nuggetId: string, sourceProjectId: string, targetProjectId: string) => void;
  onCreateProjectForNugget: (nuggetId: string, projectName: string, mode: 'copy' | 'move', sourceProjectId: string) => void;
}

/** Lucide panel-left icon */
const PanelLeftIcon = ({ className = '' }: { className?: string }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect width="18" height="18" x="3" y="3" rx="2"/>
    <path d="M9 3v18"/>
  </svg>
);

/** Ellipsis (three-dot) icon */
const EllipsisIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>
  </svg>
);

/** Chevron icon for collapse/expand */
const ChevronIcon = ({ isCollapsed }: { isCollapsed: boolean }) => (
  <svg
    width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
    className={`transition-transform duration-150 ${isCollapsed ? '-rotate-90' : ''}`}
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

/** Folder icon */
const FolderIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
  </svg>
);

const FileSidebar: React.FC<FileSidebarProps> = ({
  isOpen,
  onToggle,
  nuggets,
  projects,
  selectedNuggetId,
  onSelectNugget,
  onCreateProject,
  onRenameProject,
  onDeleteProject,
  onToggleProjectCollapse,
  onCreateNuggetInProject,
  onRenameNugget,
  onDeleteNugget,
  onCopyNuggetToProject,
  onMoveNuggetToProject,
  onCreateProjectForNugget,
}) => {
  // Dropdown menu state (shared for both project and nugget kebabs)
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [menuType, setMenuType] = useState<'nugget' | 'project'>('nugget');
  const [menuMode, setMenuMode] = useState<'hover' | 'locked'>('hover');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteType, setConfirmDeleteType] = useState<'nugget' | 'project'>('nugget');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renamingType, setRenamingType] = useState<'nugget' | 'project'>('nugget');
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState('');
  // Nugget copy/move hover submenu state
  const [showCopyMoveSubmenu, setShowCopyMoveSubmenu] = useState(false);
  const [noProjectsNuggetId, setNoProjectsNuggetId] = useState<string | null>(null);
  const [newProjectName, setNewProjectName] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

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

  // Reset copy/move submenu when menu closes
  useEffect(() => {
    if (!menuOpenId) setShowCopyMoveSubmenu(false);
  }, [menuOpenId]);

  // Focus rename input when entering rename mode
  useEffect(() => {
    if (renamingId) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [renamingId]);

  const commitRename = () => {
    if (!renamingId || !renameValue.trim()) {
      setRenamingId(null);
      setRenameValue('');
      setRenameError('');
      return;
    }
    const trimmed = renameValue.trim();
    if (renamingType === 'nugget') {
      const nugget = nuggets.find(n => n.id === renamingId);
      if (nugget && trimmed !== nugget.name) {
        // Check uniqueness within the same project
        const parentProject = projects.find(p => p.nuggetIds.includes(renamingId));
        const siblingNames = parentProject
          ? parentProject.nuggetIds.map(nid => nuggets.find(n => n.id === nid)?.name || '').filter(Boolean)
          : nuggets.map(n => n.name);
        if (isNameTaken(trimmed, siblingNames, nugget.name)) {
          setRenameError('A nugget with this name already exists');
          return;
        }
        onRenameNugget(renamingId, trimmed);
      }
    } else {
      const project = projects.find(p => p.id === renamingId);
      if (project && trimmed !== project.name) {
        if (isNameTaken(trimmed, projects.map(p => p.name), project.name)) {
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

  // Build a nugget lookup for quick access
  const nuggetMap = new Map(nuggets.map(n => [n.id, n]));

  return (
    <div
      className={`shrink-0 border-r border-zinc-100 bg-[#fafafa] flex flex-col h-full overflow-hidden transition-all duration-300 ease-out ${isOpen ? 'w-[280px]' : 'w-[48px]'}`}
    >
      {/* Header strip — always visible */}
      <div className={`h-9 flex items-center shrink-0 ${isOpen ? 'px-3 justify-between' : 'justify-center'}`}>
        {isOpen ? (
          <>
            <span className="text-sm tracking-tight text-zinc-500 whitespace-nowrap">
              <span className="font-light italic">info</span>
              <span className="font-semibold not-italic">nugget</span>
            </span>
            <button
              onClick={onToggle}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition-colors shrink-0"
              title="Collapse panel"
            >
              <PanelLeftIcon />
            </button>
          </>
        ) : (
          <button
            onClick={onToggle}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition-colors shrink-0"
            title="Expand panel"
          >
            <PanelLeftIcon />
          </button>
        )}
      </div>

      {/* Collapsed: + button + avatar at bottom */}
      {!isOpen && (
        <>
          <div className="flex flex-col items-center pt-1 gap-1">
            <button
              onClick={onCreateProject}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
              title="New project"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </button>
          </div>
          <div className="flex-1" />
          <div className="flex items-center justify-center pb-3">
            <div className="w-7 h-7 rounded-full bg-zinc-900 flex items-center justify-center">
              <span className="text-[9px] font-bold text-white tracking-wide">YD</span>
            </div>
          </div>
        </>
      )}

      {/* Expanded: full panel */}
      {isOpen && (
        <>
          <div className="flex-1 overflow-y-auto">
            <div className="shrink-0 flex flex-col items-center justify-center px-5 pt-2 pb-1">
              <span className="text-[17px] tracking-tight text-zinc-900"><span className="font-light italic">projects</span><span className="font-semibold not-italic">list</span></span>
              <p className="text-[9px] text-zinc-400 mt-0.5 text-center">create, edit and delete <span className="font-semibold text-zinc-500">PROJECTS</span></p>
            </div>
            <div className="px-5 pb-1.5 flex items-center justify-center">
              <button
                onClick={onCreateProject}
                className="h-7 px-2.5 text-[11px] flex items-center justify-center cursor-pointer rounded-[6px] hover:rounded-[14px] font-medium border border-black text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50"
                style={{ transition: 'border-radius 200ms ease, background-color 150ms ease, color 150ms ease' }}
              >
                New Project
              </button>
            </div>
            <div className="px-3 pt-2 pb-3">

              {projects.length === 0 ? (
                <p className="text-zinc-300 text-[11px] font-light px-2 py-2">No projects yet</p>
              ) : (
                <div className="space-y-0">
                  {projects.map(project => (
                    <ProjectRow
                      key={project.id}
                      project={project}
                      nuggets={project.nuggetIds.map(id => nuggetMap.get(id)).filter((n): n is Nugget => !!n)}
                      selectedNuggetId={selectedNuggetId}
                      isRenaming={renamingId === project.id && renamingType === 'project'}
                      renameValue={renameValue}
                      renameError={renamingId === project.id && renamingType === 'project' ? renameError : ''}
                      renameInputRef={renamingId === project.id && renamingType === 'project' ? renameInputRef : undefined}
                      onRenameChange={(v) => { setRenameValue(v); setRenameError(''); }}
                      onRenameCommit={commitRename}
                      onRenameCancel={() => { setRenamingId(null); setRenameValue(''); setRenameError(''); }}
                      onToggleCollapse={() => onToggleProjectCollapse(project.id)}
                      onMenuToggle={(pos: { x: number; y: number }) => {
                        if (menuOpenId === project.id && menuMode === 'locked') { setMenuOpenId(null); }
                        else { setMenuPos(pos); setMenuType('project'); setMenuMode('locked'); setMenuOpenId(project.id); }
                      }}
                      onMenuHoverEnter={(pos: { x: number; y: number }) => {
                        if (menuOpenId && menuMode === 'locked') return;
                        setMenuPos(pos); setMenuType('project'); setMenuMode('hover'); setMenuOpenId(project.id);
                      }}
                      onMenuHoverLeave={(e: React.MouseEvent) => {
                        if (menuMode === 'locked') return;
                        const related = e.relatedTarget as Node | null;
                        if (menuRef.current && related && menuRef.current.contains(related)) return;
                        setMenuOpenId(null);
                      }}
                      onRename={() => { setMenuOpenId(null); setRenamingId(project.id); setRenamingType('project'); setRenameValue(project.name); }}
                      onNewNugget={() => { setMenuOpenId(null); onCreateNuggetInProject(project.id); }}
                      onDelete={() => { setMenuOpenId(null); setConfirmDeleteId(project.id); setConfirmDeleteType('project'); }}
                      onSelectNugget={onSelectNugget}
                      // Nugget-level actions
                      nuggetRenamingId={renamingType === 'nugget' ? renamingId : null}
                      nuggetRenameValue={renameValue}
                      nuggetRenameError={renamingType === 'nugget' ? renameError : ''}
                      nuggetRenameInputRef={renamingType === 'nugget' ? renameInputRef : undefined}
                      onNuggetRenameChange={(v) => { setRenameValue(v); setRenameError(''); }}
                      onNuggetRenameCommit={commitRename}
                      onNuggetRenameCancel={() => { setRenamingId(null); setRenameValue(''); setRenameError(''); }}
                      onNuggetMenuToggle={(nuggetId: string, pos: { x: number; y: number }) => {
                        if (menuOpenId === nuggetId && menuMode === 'locked') { setMenuOpenId(null); }
                        else { setMenuPos(pos); setMenuType('nugget'); setMenuMode('locked'); setMenuOpenId(nuggetId); }
                      }}
                      onNuggetMenuHoverEnter={(nuggetId: string, pos: { x: number; y: number }) => {
                        if (menuOpenId && menuMode === 'locked') return;
                        setMenuPos(pos); setMenuType('nugget'); setMenuMode('hover'); setMenuOpenId(nuggetId);
                      }}
                      onNuggetMenuHoverLeave={(e: React.MouseEvent) => {
                        if (menuMode === 'locked') return;
                        const related = e.relatedTarget as Node | null;
                        if (menuRef.current && related && menuRef.current.contains(related)) return;
                        setMenuOpenId(null);
                      }}
                      onNuggetRename={(nuggetId: string) => { setMenuOpenId(null); setRenamingId(nuggetId); setRenamingType('nugget'); setRenameValue(nuggets.find(n => n.id === nuggetId)?.name || ''); }}
                      onNuggetDelete={(nuggetId: string) => { setMenuOpenId(null); setConfirmDeleteId(nuggetId); setConfirmDeleteType('nugget'); }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-3 py-2 shrink-0 flex items-center justify-between">
            <p className="text-[10px] text-zinc-300 font-light">v4.0</p>
            <div className="w-7 h-7 rounded-full bg-zinc-900 flex items-center justify-center">
              <span className="text-[9px] font-bold text-white tracking-wide">YD</span>
            </div>
          </div>
        </>
      )}

      {/* ── Kebab dropdown — rendered as portal to escape overflow clipping ── */}
      {menuOpenId && (() => {
        const isProjectMenu = menuType === 'project';
        const nugget = !isProjectMenu ? nuggets.find(n => n.id === menuOpenId) : null;
        const project = isProjectMenu ? projects.find(p => p.id === menuOpenId) : null;
        if (!nugget && !project) return null;

        // For nugget copy/move submenu
        const sourceProject = nugget ? projects.find(p => p.nuggetIds.includes(nugget.id)) : null;
        const otherProjects = nugget ? projects.filter(p => !p.nuggetIds.includes(nugget.id)) : [];

        return createPortal(
          <div
            ref={menuRef}
            className="fixed z-[130] w-36 bg-white rounded-[6px] border border-black py-1"
            style={{ top: menuPos.y, left: menuPos.x, transform: 'translateX(-100%)' }}
            onMouseLeave={() => {
              if (menuMode === 'locked') return;
              setMenuOpenId(null);
            }}
          >
            {/* Rename */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                const id = menuOpenId;
                setMenuOpenId(null);
                if (isProjectMenu && project) { setRenamingId(id); setRenamingType('project'); setRenameValue(project.name); }
                else if (nugget) { setRenamingId(id); setRenamingType('nugget'); setRenameValue(nugget.name); }
              }}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-black hover:bg-zinc-50 transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400">
                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>
              </svg>
              {isProjectMenu ? 'Rename Project' : 'Rename Nugget'}
            </button>

            {/* Project-only: New Nugget */}
            {isProjectMenu && (
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpenId(null); if (project) onCreateNuggetInProject(project.id); }}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-black hover:bg-zinc-50 transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
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
                <button
                  onClick={() => {
                    if (otherProjects.length === 0) {
                      setNoProjectsNuggetId(menuOpenId);
                      setMenuOpenId(null);
                    }
                  }}
                  className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-black hover:bg-zinc-50 transition-colors"
                >
                  <span className="flex items-center gap-2.5">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400">
                      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" />
                    </svg>
                    Move/Copy
                  </span>
                  {otherProjects.length > 0 && (
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-300">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  )}
                </button>

                {/* Project list submenu */}
                {showCopyMoveSubmenu && otherProjects.length > 0 && (
                  <div
                    className="absolute left-full top-0 mt-4 ml-1 w-[220px] bg-white rounded-[6px] border border-black py-1 z-[140]"
                  >
                    <div className="px-3 pb-1 border-b border-zinc-100 mb-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Move/Copy to</span>
                    </div>
                    <div className="max-h-[200px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                      {otherProjects.map(p => (
                        <div key={p.id} className="px-2 py-1 flex items-center gap-1.5 hover:bg-zinc-50 rounded-lg mx-1 group">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400 shrink-0">
                            <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
                          </svg>
                          <span className="flex-1 text-[11px] text-black truncate" title={p.name}>{p.name}</span>
                          <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => { const nid = menuOpenId!; setMenuOpenId(null); onCopyNuggetToProject(nid, p.id); }}
                              className="px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-black bg-zinc-100 hover:bg-zinc-200 rounded transition-colors"
                            >Copy</button>
                            <button
                              onClick={() => { if (!sourceProject) return; const nid = menuOpenId!; setMenuOpenId(null); onMoveNuggetToProject(nid, sourceProject.id, p.id); }}
                              className="px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-black bg-zinc-100 hover:bg-zinc-200 rounded transition-colors"
                            >Move</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="border-t border-zinc-100" />
            {/* Remove */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                const id = menuOpenId;
                setMenuOpenId(null);
                setConfirmDeleteId(id);
                setConfirmDeleteType(isProjectMenu ? 'project' : 'nugget');
              }}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
              </svg>
              {isProjectMenu ? 'Remove Project' : 'Remove Nugget'}
            </button>
          </div>,
          document.body
        );
      })()}

      {/* ── No other projects — create-project modal ── */}
      {noProjectsNuggetId && (() => {
        const sourceProject = projects.find(p => p.nuggetIds.includes(noProjectsNuggetId));
        return createPortal(
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50" onClick={() => { setNoProjectsNuggetId(null); setNewProjectName(''); }}>
            <div className="bg-white rounded-2xl shadow-2xl mx-4 overflow-hidden" style={{ minWidth: 300, maxWidth: 'calc(100vw - 32px)', width: 'fit-content' }} onClick={(e) => e.stopPropagation()}>
              <div className="px-6 pt-6 pb-3 text-center">
                <div className="w-9 h-9 rounded-full bg-zinc-100 flex items-center justify-center mx-auto mb-3">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#71717a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" />
                  </svg>
                </div>
                <h3 className="text-sm font-semibold text-zinc-900 tracking-tight mb-1">No Other Projects</h3>
                <p className="text-[13px] text-zinc-400 mt-1">Create a new project to move or copy this nugget to.</p>
                <input type="text" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && newProjectName.trim() && sourceProject && !isNameTaken(newProjectName.trim(), projects.map(p => p.name))) { const nid = noProjectsNuggetId; setNoProjectsNuggetId(null); setNewProjectName(''); onCreateProjectForNugget(nid, newProjectName.trim(), 'move', sourceProject.id); } }}
                  placeholder="Project name" autoFocus className={`mt-3 w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-300 transition-all placeholder:text-zinc-300 ${isNameTaken(newProjectName.trim(), projects.map(p => p.name)) ? 'border-red-300 focus:border-red-400' : 'border-zinc-200 focus:border-zinc-400'}`} />
                {isNameTaken(newProjectName.trim(), projects.map(p => p.name)) && (
                  <p className="text-[10px] text-red-500 mt-1">A project with this name already exists</p>
                )}
              </div>
              <div className="px-6 pb-5 pt-1 flex items-center justify-center gap-2">
                {(() => {
                  const nameConflict = isNameTaken(newProjectName.trim(), projects.map(p => p.name));
                  const canSubmit = !!newProjectName.trim() && !nameConflict;
                  return (
                    <>
                      <button onClick={() => { setNoProjectsNuggetId(null); setNewProjectName(''); }} className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors">Cancel</button>
                      <button onClick={() => { if (!canSubmit || !sourceProject) return; const nid = noProjectsNuggetId; setNoProjectsNuggetId(null); setNewProjectName(''); onCreateProjectForNugget(nid, newProjectName.trim(), 'copy', sourceProject.id); }} disabled={!canSubmit} className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${canSubmit ? 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200' : 'bg-zinc-50 text-zinc-300 cursor-not-allowed'}`}>Copy</button>
                      <button onClick={() => { if (!canSubmit || !sourceProject) return; const nid = noProjectsNuggetId; setNoProjectsNuggetId(null); setNewProjectName(''); onCreateProjectForNugget(nid, newProjectName.trim(), 'move', sourceProject.id); }} disabled={!canSubmit} className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${canSubmit ? 'bg-zinc-900 text-white hover:bg-zinc-800' : 'bg-zinc-200 text-zinc-400 cursor-not-allowed'}`}>Move</button>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>,
          document.body
        );
      })()}

      {/* Delete confirmation modal — centered, dimmed background */}
      {confirmDeleteId && (() => {
        const isProject = confirmDeleteType === 'project';
        const item = isProject
          ? projects.find(p => p.id === confirmDeleteId)
          : nuggets.find(n => n.id === confirmDeleteId);
        if (!item) return null;
        const projectNuggetCount = isProject
          ? (item as Project).nuggetIds.length
          : 0;
        return createPortal(
          <div
            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50"
            onClick={() => setConfirmDeleteId(null)}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl mx-4 overflow-hidden"
              style={{ minWidth: 260, maxWidth: 'calc(100vw - 32px)', width: 'fit-content' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 pt-6 pb-3 text-center">
                <div className="w-9 h-9 rounded-full bg-zinc-100 flex items-center justify-center mx-auto mb-3">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#71717a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                  </svg>
                </div>
                <h3 className="text-sm font-semibold text-zinc-900 tracking-tight mb-1">
                  Delete {isProject ? 'Project' : 'Nugget'}
                </h3>
                <p className="text-sm font-medium text-zinc-700 whitespace-nowrap">{item.name}</p>
                {isProject && projectNuggetCount > 0 && (
                  <p className="text-[13px] text-amber-600 mt-2">
                    This will also delete {projectNuggetCount} nugget{projectNuggetCount > 1 ? 's' : ''}.
                  </p>
                )}
                <p className="text-[13px] text-zinc-400 mt-2">This cannot be undone.</p>
              </div>
              <div className="px-6 pb-5 pt-1 flex items-center justify-center gap-2">
                <button
                  onClick={() => setConfirmDeleteId(null)}
                  className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setConfirmDeleteId(null);
                    if (isProject) onDeleteProject(confirmDeleteId);
                    else onDeleteNugget(confirmDeleteId);
                  }}
                  className="px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-lg hover:bg-zinc-800 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>,
          document.body
        );
      })()}
    </div>
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
  onMenuHoverEnter: (pos: { x: number; y: number }) => void;
  onMenuHoverLeave: (e: React.MouseEvent) => void;
  onRename: () => void;
  onNewNugget: () => void;
  onDelete: () => void;
  onSelectNugget: (id: string) => void;
  // Nugget-level props (passed through)
  nuggetRenamingId: string | null;
  nuggetRenameValue: string;
  nuggetRenameError: string;
  nuggetRenameInputRef?: React.RefObject<HTMLInputElement | null>;
  onNuggetRenameChange: (value: string) => void;
  onNuggetRenameCommit: () => void;
  onNuggetRenameCancel: () => void;
  onNuggetMenuToggle: (nuggetId: string, pos: { x: number; y: number }) => void;
  onNuggetMenuHoverEnter: (nuggetId: string, pos: { x: number; y: number }) => void;
  onNuggetMenuHoverLeave: (e: React.MouseEvent) => void;
  onNuggetRename: (nuggetId: string) => void;
  onNuggetDelete: (nuggetId: string) => void;
}

const ProjectRow: React.FC<ProjectRowProps> = ({
  project, nuggets, selectedNuggetId,
  isRenaming, renameValue, renameError, renameInputRef, onRenameChange, onRenameCommit, onRenameCancel,
  onToggleCollapse, onMenuToggle, onMenuHoverEnter, onMenuHoverLeave, onRename, onNewNugget, onDelete,
  onSelectNugget,
  nuggetRenamingId, nuggetRenameValue, nuggetRenameError, nuggetRenameInputRef,
  onNuggetRenameChange, onNuggetRenameCommit, onNuggetRenameCancel,
  onNuggetMenuToggle, onNuggetMenuHoverEnter, onNuggetMenuHoverLeave, onNuggetRename, onNuggetDelete,
}) => {
  const kebabRef = useRef<HTMLButtonElement>(null);
  return (
  <div>
    {/* Project header row */}
    <div
      className="group flex items-center gap-1 px-2 h-[46px] rounded-[6px] hover:rounded-[22px] border border-black hover:bg-zinc-50 cursor-pointer"
      style={{ transition: 'border-radius 200ms ease, background-color 150ms ease, color 150ms ease' }}
      onMouseEnter={() => {
        if (kebabRef.current) {
          const rect = kebabRef.current.getBoundingClientRect();
          onMenuHoverEnter({ x: rect.left, y: rect.bottom + 4 });
        }
      }}
      onMouseLeave={onMenuHoverLeave}
    >
      {/* Collapse chevron */}
      <button
        onClick={onToggleCollapse}
        className="w-5 h-5 flex items-center justify-center text-zinc-400 hover:text-zinc-600 shrink-0"
      >
        <ChevronIcon isCollapsed={!!project.isCollapsed} />
      </button>

      {/* Folder icon */}
      <div className="text-zinc-400 shrink-0">
        <FolderIcon />
      </div>

      {/* Project name */}
      <div className="flex-1 min-w-0" onClick={isRenaming ? undefined : onToggleCollapse}>
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
              className={`w-full bg-transparent outline-none text-xs font-medium text-zinc-900 border-b py-0 ${renameError ? 'border-red-400' : 'border-zinc-400'}`}
            />
            {renameError && <p className="text-[9px] text-red-500 mt-0.5">{renameError}</p>}
          </div>
        ) : (
          <p className="text-xs font-medium text-zinc-700 truncate" title={project.name}>{project.name}</p>
        )}
      </div>

      {/* Kebab menu trigger */}
      {!isRenaming && (
        <button
          ref={kebabRef}
          onClick={(e) => {
            e.stopPropagation();
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            onMenuToggle({ x: rect.left, y: rect.bottom + 4 });
          }}
          className="shrink-0 p-1 text-zinc-300 hover:text-zinc-600 transition-all rounded hover:bg-zinc-200"
          title="Project options"
        >
          <EllipsisIcon />
        </button>
      )}
    </div>

    {/* Nuggets list (indented) */}
    {!project.isCollapsed && (
      <div className="ml-3 pl-2 border-l border-zinc-100">
        {nuggets.length === 0 ? (
          <p className="text-zinc-300 text-[10px] font-light px-2 py-1.5 italic">No nuggets</p>
        ) : (
          <div className="space-y-0">
            {nuggets.map(nugget => (
              <NuggetRow
                key={nugget.id}
                nugget={nugget}
                isSelected={selectedNuggetId === nugget.id}
                isRenaming={nuggetRenamingId === nugget.id}
                renameValue={nuggetRenameValue}
                renameError={nuggetRenamingId === nugget.id ? nuggetRenameError : ''}
                renameInputRef={nuggetRenamingId === nugget.id ? nuggetRenameInputRef : undefined}
                onRenameChange={onNuggetRenameChange}
                onRenameCommit={onNuggetRenameCommit}
                onRenameCancel={onNuggetRenameCancel}
                onSelect={() => onSelectNugget(nugget.id)}
                onMenuToggle={(pos: { x: number; y: number }) => onNuggetMenuToggle(nugget.id, pos)}
                onMenuHoverEnter={(pos: { x: number; y: number }) => onNuggetMenuHoverEnter(nugget.id, pos)}
                onMenuHoverLeave={onNuggetMenuHoverLeave}
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
  isRenaming: boolean;
  renameValue: string;
  renameError: string;
  renameInputRef?: React.RefObject<HTMLInputElement | null>;
  onRenameChange: (value: string) => void;
  onRenameCommit: () => void;
  onRenameCancel: () => void;
  onSelect: () => void;
  onMenuToggle: (pos: { x: number; y: number }) => void;
  onMenuHoverEnter: (pos: { x: number; y: number }) => void;
  onMenuHoverLeave: (e: React.MouseEvent) => void;
}

const NuggetRow: React.FC<NuggetRowProps> = ({
  nugget, isSelected,
  isRenaming, renameValue, renameError, renameInputRef, onRenameChange, onRenameCommit, onRenameCancel,
  onSelect, onMenuToggle, onMenuHoverEnter, onMenuHoverLeave,
}) => {
  const kebabRef = useRef<HTMLButtonElement>(null);
  return (
  <div
    onClick={isRenaming ? undefined : onSelect}
    className={`group flex items-center gap-2 px-2 h-[46px] cursor-pointer ${
      isSelected ? 'rounded-[22px] bg-zinc-100 border-2 border-black' : 'rounded-[6px] hover:rounded-[22px] border border-black hover:bg-zinc-50'
    }`}
    style={{ transition: 'border-radius 200ms ease, background-color 150ms ease, color 150ms ease' }}
    onMouseEnter={() => {
      if (kebabRef.current) {
        const rect = kebabRef.current.getBoundingClientRect();
        onMenuHoverEnter({ x: rect.left, y: rect.bottom + 4 });
      }
    }}
    onMouseLeave={onMenuHoverLeave}
  >
    {/* Nugget indicator */}
    <div className="w-2 h-2 rounded-full shrink-0 bg-acid-lime" />
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
            className={`w-full bg-transparent outline-none text-xs font-medium text-zinc-900 border-b py-0 ${renameError ? 'border-red-400' : 'border-zinc-400'}`}
          />
          {renameError && <p className="text-[9px] text-red-500 mt-0.5">{renameError}</p>}
        </div>
      ) : (
        <p className={`text-xs truncate ${isSelected ? 'font-medium text-zinc-800' : 'text-zinc-600'}`} title={nugget.name}>{nugget.name}</p>
      )}
    </div>

    {!isRenaming && (
      <button
        ref={kebabRef}
        onClick={(e) => {
          e.stopPropagation();
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          onMenuToggle({ x: rect.left, y: rect.bottom + 4 });
        }}
        className="shrink-0 p-1 transition-all rounded text-zinc-300 hover:text-zinc-600 hover:bg-zinc-200"
        title="Nugget options"
      >
        <EllipsisIcon />
      </button>
    )}
  </div>
  );
};

export default FileSidebar;
