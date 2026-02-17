
import React from 'react';
import { createPortal } from 'react-dom';
import { Heading, DocChangeEvent } from '../types';

// ── Manifest Batch Confirmation Modal ──
interface ManifestModalProps {
  manifestHeadings: Heading[];
  onExecute: () => void;
  onClose: () => void;
}

export const ManifestModal: React.FC<ManifestModalProps> = ({ manifestHeadings, onExecute, onClose }) => {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center animate-in fade-in duration-200 bg-black/20">
      <div className="w-full max-w-xs bg-white rounded-3xl p-7 border border-zinc-200 animate-in zoom-in-95 duration-300" style={{ boxShadow: '0 12px 48px rgba(0,0,0,0.25), 0 4px 16px rgba(0,0,0,0.15)' }}>
        <div className="space-y-4 text-center">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto text-zinc-900">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
          <div className="space-y-2">
            <p className="text-xs text-zinc-500 font-light leading-relaxed">
              Render <span className="font-bold text-zinc-900">{manifestHeadings.length}</span> card {manifestHeadings.length === 1 ? 'image' : 'images'} using the current template settings?
            </p>
          </div>
          <div className="flex flex-col space-y-2 pt-2">
            <button
              onClick={onExecute}
              className="w-full py-3 rounded-full bg-acid-lime text-black text-[9px] font-black uppercase tracking-widest shadow-lg shadow-acid-lime/20 hover:scale-[1.02] transition-all"
            >
              Generate
            </button>
            <button
              onClick={onClose}
              className="w-full py-3 rounded-full bg-zinc-50 text-zinc-500 text-[9px] font-black uppercase tracking-widest hover:bg-zinc-100 transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Unsaved Changes Dialog ──
interface UnsavedChangesDialogProps {
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}

export const UnsavedChangesDialog: React.FC<UnsavedChangesDialogProps> = ({ onSave, onDiscard, onCancel }) => {
  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 animate-in fade-in duration-300">
      <div className="w-full max-w-sm bg-white rounded-[40px] p-10 shadow-2xl border border-zinc-100 animate-in zoom-in-95 duration-300">
        <div className="space-y-6 text-center">
          <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-black tracking-tight text-zinc-900">Unsaved changes</h3>
            <p className="text-sm text-zinc-500 font-light leading-relaxed">
              You have unsaved edits. Save or discard them to continue.
            </p>
          </div>
          <div className="flex flex-col space-y-3 pt-4">
            <button
              onClick={onSave}
              className="w-full py-4 rounded-full bg-acid-lime text-black text-[10px] font-black uppercase tracking-widest shadow-lg shadow-acid-lime/20 hover:scale-[1.02] transition-all"
            >
              Save Changes
            </button>
            <button
              onClick={onDiscard}
              className="w-full py-4 rounded-full bg-zinc-50 text-zinc-500 text-[10px] font-black uppercase tracking-widest hover:bg-zinc-100 transition-all"
            >
              Discard Changes
            </button>
            <button
              onClick={onCancel}
              className="w-full py-2 text-zinc-400 text-[10px] font-bold uppercase tracking-widest hover:text-zinc-600 transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

// ── Reference Image Mismatch Dialog ──
interface ReferenceMismatchDialogProps {
  onDisableReference: () => void;
  onSkipOnce: () => void;
  onCancel: () => void;
}

// ── Document Change Notice Dialog ──
interface DocumentChangeNoticeProps {
  changes: DocChangeEvent[];
  onContinue: () => void;
  onStartFresh: () => void;
  onCancel: () => void;
}

export const DocumentChangeNotice: React.FC<DocumentChangeNoticeProps> = ({ changes, onContinue, onStartFresh, onCancel }) => {
  const summary = changes.map(e => {
    switch (e.type) {
      case 'added':    return `Added "${e.docName}"`;
      case 'removed':  return `Removed "${e.docName}"`;
      case 'renamed':  return `Renamed "${e.oldName}" → "${e.docName}"`;
      case 'enabled':  return `Enabled "${e.docName}"`;
      case 'disabled': return `Disabled "${e.docName}"`;
      case 'updated':  return `Updated "${e.docName}"`;
      default:         return `Changed "${e.docName}"`;
    }
  });

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 animate-in fade-in duration-300">
      <div className="w-full max-w-sm bg-white rounded-[40px] p-10 shadow-2xl border border-zinc-100 animate-in zoom-in-95 duration-300">
        <div className="space-y-6 text-center">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
              <polyline points="14 2 14 8 20 8" />
              <path d="M12 18v-6" /><path d="M9 15l3-3 3 3" />
            </svg>
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-black tracking-tight text-zinc-900">Sources changed</h3>
            <p className="text-sm text-zinc-500 font-light leading-relaxed">
              {changes.length === 1 ? '1 change was' : `${changes.length} changes were`} made since the last message:
            </p>
            <ul className="text-left text-[11px] text-zinc-600 space-y-0.5 mt-2 max-h-32 overflow-y-auto px-2">
              {summary.map((s, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="text-zinc-300 mt-px shrink-0">-</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col space-y-3 pt-4">
            <button
              onClick={onContinue}
              className="w-full py-4 rounded-full bg-acid-lime text-black text-[10px] font-black uppercase tracking-widest shadow-lg shadow-acid-lime/20 hover:scale-[1.02] transition-all"
            >
              Continue Chat
            </button>
            <button
              onClick={onStartFresh}
              className="w-full py-4 rounded-full bg-zinc-50 text-zinc-500 text-[10px] font-black uppercase tracking-widest hover:bg-zinc-100 transition-all"
            >
              Start Fresh
            </button>
            <button
              onClick={onCancel}
              className="w-full py-2 text-zinc-400 text-[10px] font-bold uppercase tracking-widest hover:text-zinc-600 transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export const ReferenceMismatchDialog: React.FC<ReferenceMismatchDialogProps> = ({ onDisableReference, onSkipOnce, onCancel }) => {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center animate-in fade-in duration-200 bg-black/20">
      <div className="w-full max-w-xs bg-white rounded-3xl p-7 border border-zinc-200 animate-in zoom-in-95 duration-300" style={{ boxShadow: '0 12px 48px rgba(0,0,0,0.25), 0 4px 16px rgba(0,0,0,0.15)' }}>
        <div className="space-y-4 text-center">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto text-zinc-900">
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <div className="space-y-2 mt-4">
            <p className="text-xs text-zinc-500 font-light leading-relaxed">
              Your image generation style settings do not match the reference image styling.
            </p>
          </div>
          <div className="flex flex-col space-y-2 pt-2">
            <button
              onClick={onSkipOnce}
              className="w-full py-3 rounded-full bg-acid-lime text-black text-[9px] font-black uppercase tracking-widest shadow-lg shadow-acid-lime/20 hover:scale-[1.02] transition-all"
            >
              Skip Reference This Time
            </button>
            <button
              onClick={onDisableReference}
              className="w-full py-3 rounded-full bg-zinc-50 text-zinc-500 text-[9px] font-black uppercase tracking-widest hover:bg-zinc-100 transition-all"
            >
              Turn Off Reference
            </button>
            <button
              onClick={onCancel}
              className="w-full py-3 rounded-full bg-zinc-50 text-zinc-500 text-[9px] font-black uppercase tracking-widest hover:bg-zinc-100 transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
