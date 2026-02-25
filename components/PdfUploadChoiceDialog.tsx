import React from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface PdfUploadChoiceDialogProps {
  fileName: string;
  /** Number of PDFs being uploaded (shows batch message when > 1) */
  pdfCount?: number;
  onConvertToMarkdown: () => void;
  onKeepAsPdf: () => void;
  onCancel: () => void;
}

const PdfUploadChoiceDialog: React.FC<PdfUploadChoiceDialogProps> = ({
  fileName,
  pdfCount = 1,
  onConvertToMarkdown,
  onKeepAsPdf,
  onCancel,
}) => {
  const isBatch = pdfCount > 1;
  const subtitle = isBatch ? `${pdfCount} PDF files selected` : fileName;
  const focusTrapRef = useFocusTrap<HTMLDivElement>({ onEscape: onCancel });

  return createPortal(
    <div className="fixed inset-0 z-[130] flex items-center justify-center animate-in fade-in duration-200 bg-black/30 dark:bg-black/50">
      <div
        ref={focusTrapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pdf-upload-title"
        className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-3xl p-7 border border-zinc-200 dark:border-zinc-700 animate-in zoom-in-95 duration-300"
        style={{ boxShadow: '0 12px 48px rgba(0,0,0,0.25), 0 4px 16px rgba(0,0,0,0.15)' }}
      >
        <div className="space-y-5">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="w-10 h-10 mx-auto bg-red-50 dark:bg-red-950 rounded-xl flex items-center justify-center">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-red-500"
              >
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </div>
            <p id="pdf-upload-title" className="text-[13px] font-bold text-zinc-800 dark:text-zinc-200">
              PDF Upload
            </p>
            <p
              className="text-[11px] text-zinc-500 dark:text-zinc-400 font-light leading-relaxed truncate max-w-[280px] mx-auto"
              title={subtitle}
            >
              {subtitle}
            </p>
          </div>

          {/* Options */}
          <div className="space-y-2.5">
            {/* Option 1: Convert to Markdown */}
            <button
              onClick={onConvertToMarkdown}
              className="w-full text-left p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all group cursor-pointer"
            >
              <div className="flex items-start gap-3">
                <div className="shrink-0 w-8 h-8 bg-emerald-50 dark:bg-emerald-950 rounded-lg flex items-center justify-center mt-0.5">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-emerald-600"
                  >
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold text-zinc-800 dark:text-zinc-200 group-hover:text-zinc-900">
                    Convert to Markdown{isBatch ? ' (all)' : ''}
                  </p>
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-light leading-relaxed mt-0.5">
                    Full text extraction with editable content. Best for editing and detailed section work.
                  </p>
                </div>
              </div>
            </button>

            {/* Option 2: Keep as PDF */}
            <button
              onClick={onKeepAsPdf}
              className="w-full text-left p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all group cursor-pointer"
            >
              <div className="flex items-start gap-3">
                <div className="shrink-0 w-8 h-8 bg-blue-50 dark:bg-blue-950 rounded-lg flex items-center justify-center mt-0.5">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-blue-600"
                  >
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold text-zinc-800 dark:text-zinc-200 group-hover:text-zinc-900">
                    Keep as PDF{isBatch ? ' (all)' : ''}
                  </p>
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-light leading-relaxed mt-0.5">
                    Original PDF preserved. Claude reads natively. Best for chat and quick card generation.
                  </p>
                </div>
              </div>
            </button>
          </div>

          {/* Cancel */}
          <button
            onClick={onCancel}
            className="w-full py-2.5 rounded-full bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-[9px] font-black uppercase tracking-widest hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-800 dark:hover:text-zinc-200 transition-all"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default PdfUploadChoiceDialog;
