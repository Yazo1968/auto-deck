
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Nugget } from '../types';

interface NuggetSettingsModalProps {
  nugget: Nugget;
  nuggets: Nugget[];
  onUpdateNugget: (nuggetId: string, updater: (n: Nugget) => Nugget) => void;
  onDeleteNugget: (nuggetId: string) => void;
  onClose: () => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const NuggetSettingsModal: React.FC<NuggetSettingsModalProps> = ({
  nugget,
  nuggets,
  onUpdateNugget,
  onDeleteNugget,
  onClose,
}) => {
  const [name, setName] = useState(nugget.name);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const isDuplicate = nuggets.some(
    (n) => n.id !== nugget.id && n.name.toLowerCase() === name.trim().toLowerCase()
  );

  const nameChanged = name.trim() !== '' && name.trim() !== nugget.name && !isDuplicate;

  const handleClose = () => {
    if (nameChanged) {
      const trimmed = name.trim();
      onUpdateNugget(nugget.id, (n) => ({ ...n, name: trimmed, lastModifiedAt: Date.now() }));
    }
    onClose();
  };

  const handleConfirmDelete = () => {
    onDeleteNugget(nugget.id);
    onClose();
  };

  const docCount = nugget.documents.length;

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50"
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-[24px] shadow-2xl w-full max-w-md mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <h2 className="text-base font-bold text-zinc-900 tracking-tight">Nugget Settings</h2>
        </div>

        {/* Body */}
        <div className="px-6 pb-6 space-y-5">
          {/* Name field */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-500">Name</label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleClose();
              }}
              className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:border-zinc-400"
              placeholder="Nugget name"
            />
            {isDuplicate && (
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                Name already exists
              </p>
            )}
          </div>

          {/* Type badge */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-500">Type</label>
            <div>
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700">
                Insights
              </span>
            </div>
          </div>

          {/* Document info */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-500">Documents</label>
            <p className="text-sm text-zinc-700">
              {docCount} attached document{docCount !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Delete confirmation sub-dialog */}
          {showDeleteConfirm && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
              <p className="text-sm text-red-800 font-medium">
                Delete this nugget? This cannot be undone.
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleConfirmDelete}
                  className="px-4 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 transition-colors"
                >
                  Confirm Delete
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-1.5 text-zinc-500 text-xs font-medium hover:text-zinc-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex items-center justify-between">
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="text-red-500 hover:text-red-700 text-sm font-medium transition-colors"
            >
              Delete Nugget
            </button>
          ) : (
            <div />
          )}
          <button
            onClick={handleClose}
            className="bg-black text-white rounded-lg px-5 py-2 text-sm font-medium hover:bg-zinc-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
