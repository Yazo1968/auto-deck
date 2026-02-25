import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Nugget, UploadedFile } from '../types';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { createPlaceholderDocument } from '../utils/fileProcessing';
import { getUniqueName } from '../utils/naming';
import { useNuggetContext } from '../context/NuggetContext';
import PdfUploadChoiceDialog from './PdfUploadChoiceDialog';

/** Describes a file waiting to be processed after the nugget is created. */
export interface PendingFileUpload {
  file: File;
  placeholderId: string;
  mode: 'markdown' | 'native-pdf';
}

interface NuggetCreationModalProps {
  onCreateNugget: (nugget: Nugget, pendingFiles?: PendingFileUpload[]) => void;
  onClose: () => void;
}

export const NuggetCreationModal: React.FC<NuggetCreationModalProps> = ({ onCreateNugget, onClose }) => {
  const { nuggets } = useNuggetContext();
  const [name, setName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const focusTrapRef = useFocusTrap<HTMLDivElement>({ onEscape: onClose });

  // PDF choice dialog state
  const [pdfChoiceDialog, setPdfChoiceDialog] = useState<{ fileName: string; pdfCount: number } | null>(null);
  const pdfChoiceResolverRef = useRef<((choice: 'markdown' | 'native-pdf' | 'cancel') => void) | null>(null);

  const askPdfChoice = (fileName: string, pdfCount: number): Promise<'markdown' | 'native-pdf' | 'cancel'> => {
    return new Promise((resolve) => {
      pdfChoiceResolverRef.current = resolve;
      setPdfChoiceDialog({ fileName, pdfCount });
    });
  };

  const handleFilesSelected = async (files: FileList) => {
    const fileArray = Array.from(files).filter((f) => f);
    if (fileArray.length === 0) return;

    const pdfFiles = fileArray.filter((f) => f.name.endsWith('.pdf') || f.type === 'application/pdf');
    const mdFiles = fileArray.filter((f) => !f.name.endsWith('.pdf') && f.type !== 'application/pdf');

    // Resolve nugget name: user-entered or auto-fill from first filename
    let nuggetName = name.trim();
    if (!nuggetName && fileArray.length > 0) {
      nuggetName = fileArray[0].name.replace(/\.\w+$/, '');
    }
    // Ensure unique name among existing nuggets
    const existingNames = nuggets.map((n) => n.name);
    nuggetName = getUniqueName(nuggetName, existingNames);

    // Ask once for all PDFs (if any)
    let pdfChoice: 'markdown' | 'native-pdf' | 'cancel' | null = null;
    if (pdfFiles.length > 0) {
      pdfChoice = await askPdfChoice(pdfFiles[0].name, pdfFiles.length);
      if (pdfChoice === 'cancel') return; // User cancelled — stay in modal
    }

    // Build placeholders and pending files list
    const placeholders: UploadedFile[] = [];
    const pendingFiles: PendingFileUpload[] = [];

    if (pdfChoice) {
      for (const file of pdfFiles) {
        const ph = createPlaceholderDocument(file);
        placeholders.push(ph);
        pendingFiles.push({ file, placeholderId: ph.id, mode: pdfChoice as 'markdown' | 'native-pdf' });
      }
    }

    for (const file of mdFiles) {
      const ph = createPlaceholderDocument(file);
      placeholders.push(ph);
      pendingFiles.push({ file, placeholderId: ph.id, mode: 'markdown' });
    }

    if (placeholders.length === 0) return;

    // Create nugget with placeholder documents and hand off to App
    const id = `nugget-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();

    const nugget: Nugget = {
      id,
      name: nuggetName,
      type: 'insights',
      documents: placeholders,
      cards: [],
      messages: [],
      createdAt: now,
      lastModifiedAt: now,
    };

    onCreateNugget(nugget, pendingFiles);
    onClose();
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
        aria-labelledby="nugget-creation-title"
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
                <path d="M12 5v14" />
                <path d="M5 12h14" />
              </svg>
            </div>
            <h2
              id="nugget-creation-title"
              className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 tracking-tight"
            >
              New Nugget
            </h2>
          </div>

          {/* Name input */}
          <div className="mb-5">
            <label
              htmlFor="nugget-name"
              className="block text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mb-1.5"
            >
              Name
            </label>
            <input
              id="nugget-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Auto-fills from filename…"
              className="w-full px-3 py-2 text-xs border border-zinc-200 dark:border-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-400/50 dark:focus:ring-zinc-500/50 focus:border-zinc-400 transition-colors dark:bg-zinc-800 dark:text-zinc-100"
              autoFocus
            />
            <p className="mt-1.5 text-[10px] text-zinc-400 dark:text-zinc-500">Leave blank to use the filename</p>
          </div>

          {/* Upload button — primary action */}
          <label className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl bg-black dark:bg-white text-white dark:text-black text-xs font-semibold cursor-pointer hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors">
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
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Upload Documents
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".md,.pdf"
              className="hidden"
              onChange={(e) => {
                if (e.target.files) handleFilesSelected(e.target.files);
                e.target.value = '';
              }}
            />
          </label>
          <p className="mt-2 text-[10px] text-zinc-400 dark:text-zinc-500 text-center">PDF and Markdown files</p>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-1 flex items-center justify-center">
          <button
            onClick={onClose}
            className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 text-xs transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>

      {/* PDF upload choice dialog */}
      {pdfChoiceDialog && (
        <PdfUploadChoiceDialog
          fileName={pdfChoiceDialog.fileName}
          pdfCount={pdfChoiceDialog.pdfCount}
          onConvertToMarkdown={() => {
            pdfChoiceResolverRef.current?.('markdown');
            pdfChoiceResolverRef.current = null;
            setPdfChoiceDialog(null);
          }}
          onKeepAsPdf={() => {
            pdfChoiceResolverRef.current?.('native-pdf');
            pdfChoiceResolverRef.current = null;
            setPdfChoiceDialog(null);
          }}
          onCancel={() => {
            pdfChoiceResolverRef.current?.('cancel');
            pdfChoiceResolverRef.current = null;
            setPdfChoiceDialog(null);
          }}
        />
      )}
    </div>,
    document.body,
  );
};
