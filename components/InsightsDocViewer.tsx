import React from 'react';
import { marked } from 'marked';
import { InsightsDocument } from '../types';

interface InsightsDocViewerProps {
  document: InsightsDocument | null;
  onClose: () => void;
}

const InsightsDocViewer: React.FC<InsightsDocViewerProps> = ({ document, onClose }) => {
  if (!document) return null;

  const renderContent = () => {
    // MD and DOCX both have text content — render as formatted text
    if (document.content) {
      const html = marked.parse(document.content, { async: false }) as string;
      return (
        <div className="prose prose-sm max-w-none prose-zinc px-6 py-4" dangerouslySetInnerHTML={{ __html: html }} />
      );
    }

    if (document.type === 'pdf' && document.base64) {
      const dataUrl = `data:application/pdf;base64,${document.base64}`;
      return (
        <iframe
          src={dataUrl}
          className="w-full h-full border-0"
          title={document.name}
        />
      );
    }

    // Fallback placeholder
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-8">
        <div className="w-12 h-12 bg-zinc-100 rounded-xl flex items-center justify-center mb-3">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a1a1aa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
          </svg>
        </div>
        <p className="text-sm font-medium text-zinc-700 mb-1">{document.name}</p>
        <p className="text-xs text-zinc-400 font-light">
          Preview not available.
        </p>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-white">
      {/* Header */}
      <div className="shrink-0 h-[36px] flex items-center justify-between px-5 border-b border-zinc-100">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs text-zinc-400 uppercase tracking-wider shrink-0">
            {document.type.toUpperCase()}
          </span>
          <span className="text-sm text-zinc-700 truncate" title={document.name}>{document.name}</span>
        </div>
        <button
          onClick={onClose}
          className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-zinc-300 hover:text-zinc-600 hover:bg-zinc-100 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {renderContent()}
      </div>
    </div>
  );
};

export default InsightsDocViewer;
