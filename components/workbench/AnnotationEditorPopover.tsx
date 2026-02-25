import React, { useState, useRef, useEffect } from 'react';

interface AnnotationEditorPopoverProps {
  type: 'pin' | 'area';
  instruction: string;
  position: { x: number; y: number }; // screen coordinates
  onSave: (instruction: string) => void;
  onDelete: () => void;
  onClose: () => void;
}

const LABELS: Record<'pin' | 'area', { heading: string; placeholder: string; deleteTitle: string }> = {
  pin: {
    heading: 'Pin Instruction',
    placeholder: 'e.g., Change this data point to 22%',
    deleteTitle: 'Delete Pin',
  },
  area: {
    heading: 'Area Instruction',
    placeholder: 'e.g., Redesign this chart area with updated data',
    deleteTitle: 'Delete Annotation',
  },
};

// Pin: offset to the right of the pin mark
// Area: offset above/left of the annotation
const OFFSETS: Record<'pin' | 'area', { dx: number; dy: number }> = {
  pin: { dx: 20, dy: -40 },
  area: { dx: -180, dy: -150 },
};

const AnnotationEditorPopover: React.FC<AnnotationEditorPopoverProps> = ({
  type,
  instruction,
  position,
  onSave,
  onDelete,
  onClose,
}) => {
  const [text, setText] = useState(instruction);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const { heading, placeholder, deleteTitle } = LABELS[type];
  const { dx, dy } = OFFSETS[type];

  useEffect(() => {
    // Focus textarea on mount
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, []);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        handleSave();
      }
    };
    // Delay to avoid the creating click from triggering close
    const timer = setTimeout(() => {
      window.addEventListener('mousedown', handleClickOutside);
    }, 100);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('mousedown', handleClickOutside);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handleSave is defined below and intentionally excluded to avoid re-registering listeners on every edit
  }, [text]);

  const handleSave = () => {
    if (text.trim() === '') {
      onDelete();
    } else {
      onSave(text);
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      onClose();
    }
    // Stop propagation so overlay doesn't close
    e.stopPropagation();
  };

  const popoverStyle: React.CSSProperties = {
    position: 'fixed',
    left: Math.max(16, Math.min(position.x + dx, window.innerWidth - 400)),
    top: Math.max(16, Math.min(position.y + dy, window.innerHeight - 180)),
    zIndex: 120,
  };

  return (
    <div
      ref={popoverRef}
      style={popoverStyle}
      className="animate-in fade-in zoom-in-95 duration-200"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="w-[360px] bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-lg dark:shadow-black/30 overflow-hidden">
        <div className="px-4 py-2.5 flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-[0.15em] text-zinc-500 dark:text-zinc-400">
            {heading}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={onDelete}
              className="w-6 h-6 rounded-full flex items-center justify-center text-zinc-400 dark:text-zinc-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
              title={deleteTitle}
              aria-label={deleteTitle}
            >
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
                <path d="M3 6h18" />
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              </svg>
            </button>
            <button
              onClick={handleSave}
              className="w-6 h-6 rounded-full flex items-center justify-center text-zinc-400 dark:text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
              title="Save & close"
              aria-label="Save & close"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </button>
          </div>
        </div>
        <div className="px-4 pb-3">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={6}
            aria-label={heading}
            className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2.5 text-[13px] leading-relaxed text-zinc-700 dark:text-zinc-300 resize-none focus:outline-none focus:ring-2 focus:ring-zinc-400/50 dark:focus:ring-zinc-500/50 focus:border-zinc-400 dark:focus:border-zinc-500 transition-colors placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
          />
        </div>
      </div>
    </div>
  );
};

export default AnnotationEditorPopover;
