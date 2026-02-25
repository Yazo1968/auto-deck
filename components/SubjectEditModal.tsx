import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface SubjectEditModalProps {
  nuggetId: string;
  nuggetName: string;
  currentSubject: string;
  isRegenerating?: boolean;
  onSave: (nuggetId: string, subject: string) => void;
  onRegenerate: (nuggetId: string) => void;
  onClose: () => void;
}

export const SubjectEditModal: React.FC<SubjectEditModalProps> = ({
  nuggetId,
  nuggetName,
  currentSubject,
  isRegenerating = false,
  onSave,
  onRegenerate,
  onClose,
}) => {
  const [subject, setSubject] = useState(currentSubject);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const focusTrapRef = useFocusTrap<HTMLDivElement>({ onEscape: onClose });

  useEffect(() => {
    textareaRef.current?.focus();
    // Place cursor at end
    if (textareaRef.current) {
      textareaRef.current.selectionStart = textareaRef.current.value.length;
      textareaRef.current.selectionEnd = textareaRef.current.value.length;
    }
  }, []);

  // Update local state when regeneration completes (currentSubject changes externally)
  useEffect(() => {
    if (currentSubject !== subject && isRegenerating === false) {
      setSubject(currentSubject);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- including subject would cause infinite loop (setSubject triggers re-render → effect re-runs)
  }, [currentSubject, isRegenerating]);

  const hasChanged = subject.trim() !== currentSubject;
  const isEmpty = subject.trim() === '';

  const handleSave = () => {
    if (!isEmpty) {
      onSave(nuggetId, subject.trim());
    }
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 dark:bg-black/60"
      onClick={onClose}
    >
      <div
        ref={focusTrapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="subject-edit-title"
        className="bg-white dark:bg-zinc-900 rounded-[24px] shadow-2xl dark:shadow-black/30 w-full max-w-lg mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-3">
          <h2 id="subject-edit-title" className="text-sm font-bold text-zinc-800 dark:text-zinc-200 tracking-tight">
            Subject
          </h2>
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1 truncate">{nuggetName}</p>
        </div>

        {/* Body */}
        <div className="px-6 pb-5 space-y-3">
          <div className="space-y-1.5">
            <label htmlFor="subject-textarea" className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
              Topic sentence used to prime AI as a domain expert
            </label>
            <textarea
              id="subject-textarea"
              ref={textareaRef}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={3}
              disabled={isRegenerating}
              className="w-full px-3 py-2.5 text-xs border border-zinc-200 dark:border-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-400/50 dark:focus:ring-zinc-500/50 focus:border-zinc-400 dark:bg-zinc-800 dark:text-zinc-100 resize-none disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="e.g. Quarterly financial performance analysis for a mid-cap technology company covering revenue, margins, and growth projections."
            />
            <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
              This sentence helps the AI apply relevant domain expertise across all content generation. Keep it specific
              and descriptive (15-40 words).
            </p>
          </div>

          {isRegenerating && (
            <div className="flex items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
              <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Regenerating from documents...
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex items-center justify-between">
          <button
            onClick={() => onRegenerate(nuggetId)}
            disabled={isRegenerating}
            className="text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
            </svg>
            Regenerate
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isEmpty || isRegenerating}
              className="bg-black dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg px-5 py-2 text-xs font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {hasChanged ? 'Save' : 'Close'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};
