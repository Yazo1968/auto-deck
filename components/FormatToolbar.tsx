import React from 'react';

interface FormatToolbarProps {
  activeFormats: Set<string>;
  executeCommand: (command: string, value?: string) => void;
  insertTable: () => void;
  showFind: boolean;
  setShowFind: React.Dispatch<React.SetStateAction<boolean>>;
  findInputRef: React.RefObject<HTMLInputElement | null>;
  isDirty: boolean;
  onSave: () => void;
  hasContent: boolean;
}

export const FormatToolbar: React.FC<FormatToolbarProps> = ({
  activeFormats,
  executeCommand,
  insertTable,
  showFind,
  setShowFind,
  findInputRef,
  isDirty,
  onSave,
  hasContent,
}) => {
  const disabled = !hasContent;
  const btnBase = 'w-7 h-7 rounded-full flex items-center justify-center transition-all';
  const disabledClass = disabled ? 'opacity-40 pointer-events-none' : '';

  return (
    <div className="z-30 flex items-center justify-center px-1.5 h-9 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="flex items-center space-x-1">
        <button
          onClick={() => executeCommand('undo')}
          className={`${btnBase} hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-800 dark:hover:text-zinc-200 text-zinc-600 dark:text-zinc-400 ${disabledClass}`}
          title="Undo"
          aria-label="Undo"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M9 14L4 9l5-5" />
            <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
          </svg>
        </button>
        <button
          onClick={() => executeCommand('redo')}
          className={`${btnBase} hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-800 dark:hover:text-zinc-200 text-zinc-600 dark:text-zinc-400 ${disabledClass}`}
          title="Redo"
          aria-label="Redo"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M15 14l5-5-5-5" />
            <path d="M4 20v-7a4 4 0 0 1 4-4h12" />
          </svg>
        </button>

        <div className="w-px h-3.5 bg-zinc-200 dark:bg-zinc-700 mx-0.5" />

        {['H1', 'H2', 'H3'].map((h) => (
          <button
            key={h}
            onClick={() => executeCommand('formatBlock', h)}
            className={`w-7 h-7 rounded-full text-[11px] font-medium uppercase transition-all ${disabledClass} ${activeFormats.has(h) ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200' : 'hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-800 dark:hover:text-zinc-200 text-zinc-600 dark:text-zinc-400'}`}
          >
            {h}
          </button>
        ))}

        <div className="w-px h-3.5 bg-zinc-200 dark:bg-zinc-700 mx-0.5" />

        <button
          onClick={() => executeCommand('bold')}
          className={`w-7 h-7 rounded-full text-[11px] font-medium uppercase transition-all ${disabledClass} ${activeFormats.has('bold') ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200' : 'hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-800 dark:hover:text-zinc-200 text-zinc-600 dark:text-zinc-400'}`}
          title="Bold"
        >
          <b>B</b>
        </button>
        <button
          onClick={() => executeCommand('italic')}
          className={`w-7 h-7 rounded-full text-[11px] font-medium uppercase transition-all ${disabledClass} ${activeFormats.has('italic') ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200' : 'hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-800 dark:hover:text-zinc-200 text-zinc-600 dark:text-zinc-400'}`}
          title="Italic"
        >
          <i>I</i>
        </button>

        <div className="w-px h-3.5 bg-zinc-200 dark:bg-zinc-700 mx-0.5" />

        <button
          onClick={() => executeCommand('insertUnorderedList')}
          className={`${btnBase} ${disabledClass} ${activeFormats.has('unorderedList') ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200' : 'hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-800 dark:hover:text-zinc-200 text-zinc-600 dark:text-zinc-400'}`}
          title="Bullet list"
          aria-label="Bullet list"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" />
            <line x1="3" y1="12" x2="3.01" y2="12" />
            <line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
        </button>
        <button
          onClick={() => executeCommand('insertOrderedList')}
          className={`${btnBase} ${disabledClass} ${activeFormats.has('orderedList') ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200' : 'hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-800 dark:hover:text-zinc-200 text-zinc-600 dark:text-zinc-400'}`}
          title="Numbered list"
          aria-label="Numbered list"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <line x1="10" y1="6" x2="21" y2="6" />
            <line x1="10" y1="12" x2="21" y2="12" />
            <line x1="10" y1="18" x2="21" y2="18" />
            <path d="M4 6h1v4" />
            <path d="M4 10h2" />
            <path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" />
          </svg>
        </button>

        <div className="w-px h-3.5 bg-zinc-200 dark:bg-zinc-700 mx-0.5" />

        <button
          onClick={() => insertTable()}
          className={`${btnBase} hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-800 dark:hover:text-zinc-200 text-zinc-600 dark:text-zinc-400 ${disabledClass}`}
          title="Insert table"
          aria-label="Insert table"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="3" width="16" height="16" rx="2" />
            <line x1="3" y1="9" x2="21" y2="9" />
            <line x1="3" y1="15" x2="21" y2="15" />
            <line x1="9" y1="3" x2="9" y2="21" />
            <line x1="15" y1="3" x2="15" y2="21" />
          </svg>
        </button>
        <button
          onClick={() => executeCommand('insertHorizontalRule')}
          className={`${btnBase} hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-800 dark:hover:text-zinc-200 text-zinc-600 dark:text-zinc-400 ${disabledClass}`}
          title="Horizontal rule"
          aria-label="Horizontal rule"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
        <button
          onClick={() => executeCommand('removeFormat')}
          className={`${btnBase} hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-800 dark:hover:text-zinc-200 text-zinc-600 dark:text-zinc-400 ${disabledClass}`}
          title="Clear formatting"
          aria-label="Clear formatting"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
            <path d="M22 21H7" />
            <path d="m5 11 9 9" />
          </svg>
        </button>

        <div className="w-px h-3.5 bg-zinc-200 dark:bg-zinc-700 mx-0.5" />

        <button
          onClick={() => {
            setShowFind((prev) => !prev);
            if (!showFind) setTimeout(() => findInputRef.current?.focus(), 50);
          }}
          className={`${btnBase} ${disabledClass} ${showFind ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200' : 'hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-800 dark:hover:text-zinc-200 text-zinc-600 dark:text-zinc-400'}`}
          title="Find & Replace (Ctrl+F)"
          aria-label="Find and Replace"
          aria-expanded={showFind}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </button>

        {/* Save */}
        <div className="w-px h-3.5 bg-zinc-200 dark:bg-zinc-700 mx-0.5" />

        <button
          onClick={onSave}
          disabled={!isDirty}
          className={`${btnBase} ${isDirty ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-300' : 'text-zinc-600 dark:text-zinc-400 opacity-40 pointer-events-none'}`}
          title="Save changes (Ctrl+S)"
          aria-label="Save changes"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};
