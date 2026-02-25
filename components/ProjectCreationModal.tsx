import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Project } from '../types';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface ProjectCreationModalProps {
  projects: Project[];
  onCreateProject: (name: string, description: string) => void;
  onClose: () => void;
}

export const ProjectCreationModal: React.FC<ProjectCreationModalProps> = ({ projects, onCreateProject, onClose }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const focusTrapRef = useFocusTrap<HTMLDivElement>({ onEscape: onClose });

  const nameConflict = useMemo(() => {
    const trimmed = name.trim();
    if (!trimmed) return false;
    return projects.some((p) => p.name.toLowerCase() === trimmed.toLowerCase());
  }, [name, projects]);

  const canCreate = name.trim().length > 0 && !nameConflict;

  const handleCreate = () => {
    if (!canCreate) return;
    onCreateProject(name.trim(), description.trim());
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && canCreate) {
      e.preventDefault();
      handleCreate();
    }
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 dark:bg-black/60"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={focusTrapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-creation-title"
        className="bg-white dark:bg-zinc-900 rounded-[24px] shadow-2xl dark:shadow-black/30 w-full max-w-md mx-4 overflow-hidden animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800/50 flex items-center justify-center">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-zinc-600 dark:text-zinc-400"
              >
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <h2
              id="project-creation-title"
              className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 tracking-tight"
            >
              New Project
            </h2>
          </div>

          {/* Name input */}
          <div className="mb-4">
            <label
              htmlFor="project-name"
              className="block text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mb-1.5"
            >
              Name
            </label>
            <input
              id="project-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter project name..."
              className="w-full px-3 py-2 text-xs border border-zinc-200 dark:border-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-400/50 dark:focus:ring-zinc-500/50 focus:border-zinc-400 transition-colors dark:bg-zinc-800 dark:text-zinc-100"
              autoFocus
              aria-invalid={nameConflict || undefined}
              aria-describedby={nameConflict ? 'project-name-error' : undefined}
            />
            {nameConflict && (
              <p id="project-name-error" className="mt-1.5 text-[11px] text-red-500">
                A project with this name already exists
              </p>
            )}
          </div>

          {/* Description input */}
          <div>
            <label
              htmlFor="project-description"
              className="block text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mb-1.5"
            >
              Description <span className="font-normal text-zinc-400 dark:text-zinc-500">(optional)</span>
            </label>
            <textarea
              id="project-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="What is this project about..."
              rows={3}
              className="w-full px-3 py-2 text-xs border border-zinc-200 dark:border-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-400/50 dark:focus:ring-zinc-500/50 focus:border-zinc-400 transition-colors resize-none dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-2 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 text-xs transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!canCreate}
            className="bg-black text-white rounded-lg px-5 py-2 text-xs font-medium hover:bg-zinc-800 disabled:opacity-40 disabled:pointer-events-none transition-colors"
          >
            Create
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
