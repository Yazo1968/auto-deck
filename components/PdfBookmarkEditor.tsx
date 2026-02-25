import React, { useState, useCallback, useRef, useEffect } from 'react';
import { BookmarkNode } from '../types';
import {
  renameBookmark,
  deleteBookmark,
  addBookmark,
  indentBookmark,
  outdentBookmark,
  reorderBookmark,
} from '../utils/pdfBookmarks';
import { useThemeContext } from '../context/ThemeContext';

interface PdfBookmarkEditorProps {
  bookmarks: BookmarkNode[];
  onSave: (bookmarks: BookmarkNode[]) => void;
  onDiscard: () => void;
  onRegenerateWithAI?: () => void;
  isRegenerating?: boolean;
}

/**
 * Bookmark tree editor for native PDFs.
 * Supports rename, delete, add, indent, outdent, and reorder.
 * Hard-lock: user must save or discard before leaving.
 */
const PdfBookmarkEditor: React.FC<PdfBookmarkEditorProps> = ({
  bookmarks: initialBookmarks,
  onSave,
  onDiscard,
  onRegenerateWithAI,
  isRegenerating,
}) => {
  const { darkMode: _darkMode } = useThemeContext();
  const [draft, setDraft] = useState<BookmarkNode[]>(initialBookmarks);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [addTitle, setAddTitle] = useState('');
  const [addPage, setAddPage] = useState('1');
  const renameInputRef = useRef<HTMLInputElement>(null);
  const addTitleRef = useRef<HTMLInputElement>(null);

  const isDirty = JSON.stringify(draft) !== JSON.stringify(initialBookmarks);

  // Focus rename input when editing
  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  // Focus add-title input when shown
  useEffect(() => {
    if (showAddForm && addTitleRef.current) {
      addTitleRef.current.focus();
    }
  }, [showAddForm]);

  // ── Handlers ──

  const handleSelect = useCallback((id: string) => {
    setSelectedId((prev) => (prev === id ? null : id));
    setRenamingId(null);
  }, []);

  const handleStartRename = useCallback((id: string, currentTitle: string) => {
    setRenamingId(id);
    setRenameValue(currentTitle);
  }, []);

  const handleCommitRename = useCallback(() => {
    if (renamingId && renameValue.trim()) {
      setDraft((prev) => renameBookmark(prev, renamingId, renameValue.trim()));
    }
    setRenamingId(null);
    setRenameValue('');
  }, [renamingId, renameValue]);

  const handleCancelRename = useCallback(() => {
    setRenamingId(null);
    setRenameValue('');
  }, []);

  const handleDelete = useCallback(
    (id: string) => {
      setDraft((prev) => deleteBookmark(prev, id));
      if (selectedId === id) setSelectedId(null);
    },
    [selectedId],
  );

  const handleIndent = useCallback((id: string) => {
    setDraft((prev) => indentBookmark(prev, id));
  }, []);

  const handleOutdent = useCallback((id: string) => {
    setDraft((prev) => outdentBookmark(prev, id));
  }, []);

  const handleMoveUp = useCallback((id: string) => {
    setDraft((prev) => reorderBookmark(prev, id, 'up'));
  }, []);

  const handleMoveDown = useCallback((id: string) => {
    setDraft((prev) => reorderBookmark(prev, id, 'down'));
  }, []);

  const handleAdd = useCallback(() => {
    if (!addTitle.trim()) return;
    const page = parseInt(addPage, 10) || 1;
    setDraft((prev) => addBookmark(prev, selectedId, addTitle.trim(), page, 1));
    setAddTitle('');
    setAddPage('1');
    setShowAddForm(false);
  }, [addTitle, addPage, selectedId]);

  const handleSave = useCallback(() => {
    onSave(draft);
  }, [onSave, draft]);

  // ── Render tree ──

  const renderNode = (node: BookmarkNode, depth: number = 0): React.ReactNode => {
    const isSelected = selectedId === node.id;
    const isRenaming = renamingId === node.id;

    return (
      <div key={node.id} role="treeitem" aria-expanded={node.children.length > 0 ? true : undefined}>
        <div
          className={`group flex items-center gap-1 py-1 px-1.5 rounded cursor-pointer transition-colors ${
            isSelected
              ? 'bg-blue-50 dark:bg-blue-950 border border-blue-300 dark:border-blue-700'
              : 'hover:bg-zinc-50 dark:hover:bg-zinc-800 border border-transparent'
          }`}
          style={{ paddingLeft: `${depth * 16 + 4}px` }}
          onClick={() => handleSelect(node.id)}
          onDoubleClick={() => handleStartRename(node.id, node.title)}
        >
          {/* Bookmark icon */}
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0 text-zinc-400 dark:text-zinc-400"
          >
            <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
          </svg>

          {/* Title or rename input */}
          {isRenaming ? (
            <input
              ref={renameInputRef}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={handleCommitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCommitRename();
                if (e.key === 'Escape') handleCancelRename();
              }}
              className="flex-1 min-w-0 text-[11px] px-1 py-0.5 rounded border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950 text-zinc-800 dark:text-zinc-200 outline-none"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="flex-1 min-w-0 truncate text-[11px] text-zinc-700 dark:text-zinc-300">{node.title}</span>
          )}

          {/* Page badge */}
          <span className="shrink-0 text-[9px] px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-400">
            p{node.page}
          </span>

          {/* Action buttons — visible on hover or when selected */}
          <div
            className={`flex items-center gap-0.5 shrink-0 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}
          >
            {/* Rename */}
            <button
              title="Rename"
              aria-label="Rename"
              onClick={(e) => {
                e.stopPropagation();
                handleStartRename(node.id, node.title);
              }}
              className="w-4 h-4 flex items-center justify-center rounded text-zinc-400 hover:text-blue-500 dark:text-zinc-400 dark:hover:text-blue-400 transition-colors"
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
              </svg>
            </button>
            {/* Indent */}
            <button
              title="Indent (make child)"
              aria-label="Indent"
              onClick={(e) => {
                e.stopPropagation();
                handleIndent(node.id);
              }}
              className="w-4 h-4 flex items-center justify-center rounded text-zinc-400 hover:text-violet-500 dark:text-zinc-400 dark:hover:text-violet-400 transition-colors"
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="13 17 18 12 13 7" />
                <polyline points="6 17 11 12 6 7" />
              </svg>
            </button>
            {/* Outdent */}
            <button
              title="Outdent (move to parent level)"
              aria-label="Outdent"
              onClick={(e) => {
                e.stopPropagation();
                handleOutdent(node.id);
              }}
              className="w-4 h-4 flex items-center justify-center rounded text-zinc-400 hover:text-violet-500 dark:text-zinc-400 dark:hover:text-violet-400 transition-colors"
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="11 17 6 12 11 7" />
                <polyline points="18 17 13 12 18 7" />
              </svg>
            </button>
            {/* Move up */}
            <button
              title="Move up"
              aria-label="Move up"
              onClick={(e) => {
                e.stopPropagation();
                handleMoveUp(node.id);
              }}
              className="w-4 h-4 flex items-center justify-center rounded text-zinc-400 hover:text-zinc-600 dark:text-zinc-400 dark:hover:text-zinc-300 transition-colors"
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m18 15-6-6-6 6" />
              </svg>
            </button>
            {/* Move down */}
            <button
              title="Move down"
              aria-label="Move down"
              onClick={(e) => {
                e.stopPropagation();
                handleMoveDown(node.id);
              }}
              className="w-4 h-4 flex items-center justify-center rounded text-zinc-400 hover:text-zinc-600 dark:text-zinc-400 dark:hover:text-zinc-300 transition-colors"
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
            {/* Delete */}
            <button
              title="Delete"
              aria-label="Delete"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(node.id);
              }}
              className="w-4 h-4 flex items-center justify-center rounded text-zinc-400 hover:text-red-500 dark:text-zinc-400 dark:hover:text-red-400 transition-colors"
            >
              <svg
                width="10"
                height="10"
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
            </button>
          </div>
        </div>

        {/* Children */}
        {node.children.length > 0 && (
          <div role="group">{node.children.map((child) => renderNode(child, depth + 1))}</div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-700">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
        <div className="flex items-center gap-2">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-blue-500"
          >
            <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
          </svg>
          <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Edit Bookmarks</span>
          {isDirty && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 font-medium">
              Unsaved
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {/* Regenerate with AI */}
          {onRegenerateWithAI && (
            <button
              onClick={onRegenerateWithAI}
              disabled={isRegenerating}
              className="text-[10px] px-2 py-1 rounded bg-violet-50 dark:bg-violet-950 text-violet-600 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
                <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                <path d="M16 16h5v5" />
              </svg>
              {isRegenerating ? 'Regenerating…' : 'Regenerate AI'}
            </button>
          )}
          {/* Discard */}
          <button
            onClick={onDiscard}
            className="text-[10px] px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
          >
            Discard
          </button>
          {/* Save */}
          <button
            onClick={handleSave}
            disabled={!isDirty}
            className="text-[10px] px-2 py-1 rounded bg-blue-500 text-white hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-zinc-100 dark:border-zinc-800">
        <button
          onClick={() => setShowAddForm((prev) => !prev)}
          className="text-[10px] px-2 py-1 rounded bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors flex items-center gap-1"
          aria-expanded={showAddForm}
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12h14" />
            <path d="M12 5v14" />
          </svg>
          Add Bookmark
        </button>
        <span className="text-[9px] text-zinc-400 dark:text-zinc-400 ml-auto">
          {draft.length === 0
            ? 'No bookmarks'
            : `${countBookmarks(draft)} bookmark${countBookmarks(draft) === 1 ? '' : 's'}`}
        </span>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 flex items-center gap-2">
          <input
            ref={addTitleRef}
            value={addTitle}
            onChange={(e) => setAddTitle(e.target.value)}
            placeholder="Bookmark title"
            className="flex-1 min-w-0 text-[11px] px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 outline-none focus:border-blue-300 dark:focus:border-blue-700"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd();
              if (e.key === 'Escape') setShowAddForm(false);
            }}
          />
          <input
            value={addPage}
            onChange={(e) => setAddPage(e.target.value)}
            placeholder="Page"
            type="number"
            min="1"
            className="w-14 text-[11px] px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 outline-none focus:border-blue-300 dark:focus:border-blue-700"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd();
              if (e.key === 'Escape') setShowAddForm(false);
            }}
          />
          <button
            onClick={handleAdd}
            disabled={!addTitle.trim()}
            className="text-[10px] px-2 py-1 rounded bg-blue-500 text-white hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add
          </button>
          <button
            onClick={() => setShowAddForm(false)}
            className="text-[10px] px-1 py-1 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
            aria-label="Close add form"
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
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Bookmark tree */}
      <div className="flex-1 overflow-y-auto px-1 py-1" role="tree" aria-label="PDF bookmarks">
        {draft.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-zinc-400 dark:text-zinc-400">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mb-2 opacity-50"
            >
              <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
            </svg>
            <span className="text-[11px]">No bookmarks</span>
            <span className="text-[10px] mt-1">Click "Add Bookmark" or "Regenerate AI" to start</span>
          </div>
        ) : (
          draft.map((node) => renderNode(node, 0))
        )}
      </div>

      {/* Helper text */}
      <div className="px-3 py-1.5 border-t border-zinc-100 dark:border-zinc-800 text-[9px] text-zinc-400 dark:text-zinc-400">
        Double-click to rename • Select a bookmark, then "Add" to nest under it
      </div>
    </div>
  );
};

/** Count all bookmarks recursively. */
function countBookmarks(nodes: BookmarkNode[]): number {
  let count = nodes.length;
  for (const n of nodes) count += countBookmarks(n.children);
  return count;
}

export default PdfBookmarkEditor;
