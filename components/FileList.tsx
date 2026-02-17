import React, { useState, useEffect } from 'react';
import { UploadedFile } from '../types';

interface FileListProps {
  files: UploadedFile[];
  onRemove: (id: string) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const conversionMessages = [
  'Reading between the pages...',
  'Decoding the document...',
  'Turning pages into pixels...',
  'Parsing with enthusiasm...',
  'Making sense of formatting...',
  'Extracting the good stuff...',
  'Converting at light speed...',
  'Feeding the document monster...',
  'Almost there, probably...',
  'Translating into markdown...',
  'Untangling the structure...',
  'Crunching the content...',
  'Processing with care...',
  'Doing the heavy lifting...',
  'Wrangling paragraphs...',
  'Tidying up the markup...',
  'Herding stray headings...',
  'Ironing out the wrinkles...',
  'Teaching AI to read...',
  'Assembling the pieces...',
];

const FileList: React.FC<FileListProps> = ({ files, onRemove, selectedId, onSelect }) => {
  const isProcessing = files.some(f => f.status === 'processing');
  const [convMsgIndex, setConvMsgIndex] = useState(0);
  const [convMsgFade, setConvMsgFade] = useState(true);

  useEffect(() => {
    if (!isProcessing) {
      setConvMsgIndex(0);
      setConvMsgFade(true);
      return;
    }
    const interval = setInterval(() => {
      setConvMsgFade(false);
      setTimeout(() => {
        setConvMsgIndex(prev => (prev + 1) % conversionMessages.length);
        setConvMsgFade(true);
      }, 300);
    }, 2800);
    return () => clearInterval(interval);
  }, [isProcessing]);
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase();
    const cls = "w-5 h-5";
    switch (ext) {
      case 'pdf': return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 13H8"/><path d="M16 17H8"/><path d="M16 13h-2"/>
        </svg>
      );
      case 'docx': return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M8 13h2"/><path d="M8 17h6"/>
        </svg>
      );
      case 'md': return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M9 15l2-2 2 2"/><path d="M13 13v4"/><path d="M9 13v4"/>
        </svg>
      );
      default: return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>
        </svg>
      );
    }
  };

  return (
    <div className="space-y-2">
      {files.map((file) => {
        const isSelected = selectedId === file.id;
        const isReady = file.status === 'ready';

        return file.status === 'processing' ? (
          <div
            key={file.id}
            className="p-3 rounded-2xl border border-zinc-100 bg-white cursor-wait opacity-80 transition-all duration-300"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3 overflow-hidden">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-zinc-400 bg-zinc-50">
                  {getFileIcon(file.name)}
                </div>
                <div className="overflow-hidden">
                  <p className="text-sm font-medium truncate text-zinc-700" title={file.name}>{file.name}</p>
                  <p className="text-[10px] text-zinc-500 font-light">{formatSize(file.size)}</p>
                </div>
              </div>
              <div className="w-4 h-4 border-2 border-acid-lime/30 border-t-acid-lime rounded-full animate-spin shrink-0" />
            </div>
            <div className="mt-2.5 pl-12">
              <p
                className="text-sm font-medium text-zinc-400 italic transition-all duration-300 ease-in-out"
                style={{ opacity: convMsgFade ? 1 : 0, transform: convMsgFade ? 'translateY(0)' : 'translateY(3px)' }}
              >
                {conversionMessages[convMsgIndex]}
              </p>
            </div>
          </div>
        ) : (
          <div
            key={file.id}
            onClick={() => isReady && onSelect(file.id)}
            className={`
              group flex items-center justify-between p-3 rounded-2xl border transition-all duration-300
              ${isSelected ? 'bg-zinc-50 border-acid-lime' : 'bg-white border-zinc-100 hover:border-zinc-200'}
              cursor-pointer
            `}
          >
            <div className="flex items-center space-x-3 overflow-hidden">
              <div className={`
                w-9 h-9 rounded-xl flex items-center justify-center text-zinc-400 transition-colors
                ${isSelected ? 'bg-white' : 'bg-zinc-50 group-hover:bg-zinc-100'}
              `}>
                {getFileIcon(file.name)}
              </div>
              <div className="overflow-hidden">
                <p className={`text-sm font-medium truncate ${isSelected ? 'text-black' : 'text-zinc-700'}`}>
                  {file.name}
                </p>
                <p className="text-[10px] text-zinc-500 font-light">
                  {formatSize(file.size)}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <span className={`
                px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider rounded
                ${file.status === 'ready' ? 'bg-acid-lime text-black' : 'bg-zinc-200 text-zinc-600'}
                ${file.status === 'error' ? 'bg-red-50 text-red-500' : ''}
              `}>
                {file.status}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); onRemove(file.id); }}
                className="p-1.5 text-zinc-400 hover:text-red-500 transition-colors"
                title="Remove file"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                </svg>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default FileList;