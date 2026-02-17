
import React, { useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { UploadedFile, Nugget } from '../types';
import { processFileToDocument, createPlaceholderDocument } from '../utils/fileProcessing';

interface NuggetCreationModalProps {
  nuggets: Nugget[];
  onCreateNugget: (nugget: Nugget) => void;
  onClose: () => void;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[i]}`;
}

export const NuggetCreationModal: React.FC<NuggetCreationModalProps> = ({
  nuggets,
  onCreateNugget,
  onClose,
}) => {
  const [name, setName] = useState('');
  const [pendingDocs, setPendingDocs] = useState<UploadedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Derive processing state from pending docs
  const isProcessing = pendingDocs.some(d => d.status === 'processing');

  const nameConflict = useMemo(() => {
    const trimmed = name.trim();
    if (!trimmed) return false;
    return nuggets.some(n => n.name.toLowerCase() === trimmed.toLowerCase());
  }, [name, nuggets]);

  const hasDocuments = pendingDocs.length > 0;
  const canCreate = name.trim().length > 0 && hasDocuments && !nameConflict && !isProcessing;

  const handleFilesSelected = async (files: FileList) => {
    const fileArray = Array.from(files).filter(f => f);
    if (fileArray.length === 0) return;

    // Create placeholders immediately so they appear in the list
    const placeholders = fileArray.map(f => createPlaceholderDocument(f));
    setPendingDocs(prev => [...prev, ...placeholders]);

    // Auto-fill name from first file if empty
    if (!name.trim() && placeholders.length > 0) {
      const autoName = placeholders[0].name.replace(/\.\w+$/, '');
      setName(autoName);
    }

    // Process each file in background, update placeholder when done
    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      const placeholderId = placeholders[i].id;
      processFileToDocument(file, placeholderId).then(processed => {
        setPendingDocs(prev => prev.map(d => d.id === placeholderId ? processed : d));
      }).catch((err) => {
        console.error(`[FileProcessing] Failed to process ${file.name}:`, err);
        setPendingDocs(prev => prev.map(d => d.id === placeholderId ? { ...d, status: 'error' as const } : d));
      });
    }
  };

  const handleRemoveDoc = (docId: string) => {
    setPendingDocs(prev => prev.filter(d => d.id !== docId));
  };

  const handleCreate = () => {
    if (!canCreate) return;

    const id = `nugget-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();

    const nugget: Nugget = {
      id,
      name: name.trim(),
      type: 'insights',
      documents: pendingDocs,
      headings: [],
      messages: [],
      createdAt: now,
      lastModifiedAt: now,
    };
    onCreateNugget(nugget);

    onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-xl bg-zinc-100 flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-600">
                <path d="M12 5v14" /><path d="M5 12h14" />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-zinc-900 tracking-tight">New Nugget</h2>
          </div>

          {/* Name input */}
          <div className="mb-5">
            <label className="block text-xs font-medium text-zinc-500 mb-1.5">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter nugget name..."
              className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:border-zinc-400 transition-colors"
              autoFocus
            />
            {nameConflict && (
              <p className="mt-1.5 text-xs text-red-500">A nugget with this name already exists</p>
            )}
          </div>

          {/* Document upload */}
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1.5">
              Upload documents
            </label>

            {/* Uploaded docs list */}
            {pendingDocs.length > 0 && (
              <div className="max-h-48 overflow-y-auto border border-zinc-100 rounded-lg divide-y divide-zinc-100 mb-2">
                {pendingDocs.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-3 px-3 py-2.5">
                    {doc.status === 'processing' ? (
                      <div className="w-3.5 h-3.5 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin shrink-0" />
                    ) : doc.status === 'error' ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                        <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a1a1aa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm truncate ${doc.status === 'error' ? 'text-red-500' : doc.status === 'processing' ? 'text-zinc-500' : 'text-zinc-800'}`} title={doc.name}>{doc.name}</p>
                      <p className="text-[11px] text-zinc-400">
                        {doc.status === 'processing' ? 'Converting…' : doc.status === 'error' ? 'Conversion failed' : formatSize(doc.size)}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRemoveDoc(doc.id)}
                      className="shrink-0 w-5 h-5 rounded flex items-center justify-center text-zinc-300 hover:text-red-400 transition-colors"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Upload button */}
            <label className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
              pendingDocs.length === 0
                ? 'mt-2 px-4 py-2 bg-zinc-100 text-zinc-700 hover:bg-zinc-200 text-sm'
                : 'text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50'
            }`}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Upload documents
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".md,.pdf,.docx"
                className="hidden"
                onChange={(e) => { if (e.target.files) handleFilesSelected(e.target.files); e.target.value = ''; }}
              />
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-2 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-700 text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!canCreate}
            className="bg-black text-white rounded-lg px-5 py-2 text-sm font-medium hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Create
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
