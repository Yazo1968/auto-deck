
import React, { useState, useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { createPortal } from 'react-dom';
import { marked } from 'marked';
import { ChatMessage, DetailLevel, Heading, UploadedFile, DocChangeEvent } from '../types';
import { DEFAULT_STYLING } from '../utils/ai';
import DocumentEditorModal, { DocumentEditorHandle } from './DocumentEditorModal';
import { UnsavedChangesDialog, DocumentChangeNotice } from './Dialogs';
import { isNameTaken } from '../utils/naming';

interface InsightsLabPanelProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onSendMessage: (text: string, isCardRequest: boolean, detailLevel?: DetailLevel) => void;
  onSaveAsHeading: (message: ChatMessage, editedContent: string) => void;
  onClearChat: () => void;
  onStop: () => void;
  widthPercent?: number;
  // Card content toolbar
  activeHeading: Heading | null;
  activeLogicTab: DetailLevel;
  onEditCardContent: () => void;
  // Content view — inline document editor
  documents: UploadedFile[];
  onSaveDocument: (docId: string, newContent: string) => void;
  onGenerateCardContent?: (headingId: string, detailLevel: DetailLevel, headingText: string) => void;
  onToggleDocument?: (docId: string) => void;
  onRenameDocument?: (docId: string, newName: string) => void;
  onRemoveDocument?: (docId: string) => void;
  onCopyMoveDocument?: (docId: string, targetNuggetId: string, mode: 'copy' | 'move') => void;
  onUploadDocuments?: (files: FileList) => void;
  /** Projects with their nuggets for copy/move target picker (excludes current nugget) */
  otherNuggets?: { id: string; name: string }[];
  /** Project-grouped nuggets for structured copy/move picker */
  projectNuggets?: { projectId: string; projectName: string; nuggets: { id: string; name: string }[] }[];
  onCreateNuggetWithDoc?: (nuggetName: string, docId: string) => void;
  // Document change notification
  pendingDocChanges?: DocChangeEvent[];
  hasConversation?: boolean;
  onDocChangeContinue?: (text: string, isCardRequest: boolean, detailLevel?: DetailLevel) => void;
  onDocChangeStartFresh?: () => void;
}

export interface InsightsLabPanelHandle {
  switchToCardView: () => void;
}

const InsightsLabPanel = forwardRef<InsightsLabPanelHandle, InsightsLabPanelProps>(({
  messages,
  isLoading,
  onSendMessage,
  onSaveAsHeading,
  onClearChat,
  onStop,
  widthPercent,
  activeHeading,
  activeLogicTab,
  onEditCardContent,
  documents,
  onSaveDocument,
  onGenerateCardContent,
  onToggleDocument,
  onRenameDocument,
  onRemoveDocument,
  onCopyMoveDocument,
  onUploadDocuments,
  otherNuggets,
  projectNuggets,
  onCreateNuggetWithDoc,
  pendingDocChanges,
  hasConversation,
  onDocChangeContinue,
  onDocChangeStartFresh,
}, ref) => {
  const [inputText, setInputText] = useState('');
  const [showSendMenu, setShowSendMenu] = useState(false);
  const [showCardSubmenu, setShowCardSubmenu] = useState(false);
  const [sendMenuPos, setSendMenuPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const sendMenuRef = useRef<HTMLDivElement>(null);
  const sendBtnRef = useRef<HTMLDivElement>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [viewMode, setViewMode] = useState<'chat' | 'content'>('chat');
  const [copied, setCopied] = useState(false);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [activeDocTab, setActiveDocTab] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevMessagesRef = useRef<typeof messages>(messages);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editorHandleRef = useRef<DocumentEditorHandle>(null);
  const kebabMenuRef = useRef<HTMLDivElement>(null);

  // ── Doc tab kebab menu + inline rename + copy/move ──
  const [kebabDocId, setKebabDocId] = useState<string | null>(null);
  const [kebabPos, setKebabPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [kebabMode, setKebabMode] = useState<'hover' | 'locked'>('hover');
  const kebabBtnRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [renamingDocId, setRenamingDocId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState('');
  const [showCopyMoveSubmenu, setShowCopyMoveSubmenu] = useState(false);
  const [newNuggetName, setNewNuggetName] = useState('');
  const [confirmRemoveDocId, setConfirmRemoveDocId] = useState<string | null>(null);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [noNuggetsModalDocId, setNoNuggetsModalDocId] = useState<string | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const openKebab = useCallback((docId: string, e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setKebabPos({ x: rect.right, y: rect.bottom + 4 });
    setKebabMode('locked');
    setKebabDocId(prev => (prev === docId && kebabMode === 'locked') ? null : docId);
  }, [kebabMode]);

  // Close kebab menu on click outside (only when locked)
  useEffect(() => {
    if (!kebabDocId || kebabMode !== 'locked') return;
    const handleClick = (e: MouseEvent) => {
      if (kebabMenuRef.current && !kebabMenuRef.current.contains(e.target as Node)) {
        setKebabDocId(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [kebabDocId, kebabMode]);

  // Reset copy/move submenu when kebab closes
  useEffect(() => {
    if (!kebabDocId) setShowCopyMoveSubmenu(false);
  }, [kebabDocId]);

  // Focus rename input when entering rename mode
  useEffect(() => {
    if (renamingDocId) renameInputRef.current?.focus();
  }, [renamingDocId]);

  const commitRename = useCallback(() => {
    if (!renamingDocId || !renameValue.trim()) {
      setRenamingDocId(null);
      setRenameValue('');
      setRenameError('');
      return;
    }
    const trimmed = renameValue.trim();
    const currentDoc = documents.find(d => d.id === renamingDocId);
    if (currentDoc && trimmed !== currentDoc.name) {
      const siblingNames = documents.map(d => d.name);
      if (isNameTaken(trimmed, siblingNames, currentDoc.name)) {
        setRenameError('A document with this name already exists');
        return;
      }
    }
    if (onRenameDocument) onRenameDocument(renamingDocId, trimmed);
    setRenamingDocId(null);
    setRenameValue('');
    setRenameError('');
  }, [renamingDocId, renameValue, onRenameDocument, documents]);

  // ── Unsaved-changes gating ──
  // When the user tries to navigate away from a dirty editor, we stash the intended
  // action and show the UnsavedChangesDialog. On save/discard we execute the stashed action.
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const gatedAction = useCallback((action: () => void) => {
    if (editorHandleRef.current?.isDirty) {
      setPendingAction(() => action);
      return;
    }
    action();
  }, []);

  // Expose switchToCardView to parent via ref (kept for backward compat — switches to content view)
  useImperativeHandle(ref, () => ({
    switchToCardView: () => setViewMode('content'),
  }), []);

  // Auto-select first document tab when switching to content view or when documents change
  useEffect(() => {
    if (viewMode === 'content') {
      if (documents.length > 0 && (!activeDocTab || !documents.some(d => d.id === activeDocTab))) {
        setActiveDocTab(documents[0].id);
      }
    }
  }, [viewMode, documents, activeDocTab]);

  // Auto-save card content as heading when a new card message arrives
  const autoSavedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const msg of messages) {
      if (msg.isCardContent && msg.role === 'assistant' && !msg.savedAsHeadingId && !autoSavedRef.current.has(msg.id)) {
        autoSavedRef.current.add(msg.id);
        onSaveAsHeading(msg, msg.content);
      }
    }
  }, [messages, onSaveAsHeading]);

  // Scroll: instant on load/nugget switch, smooth on new messages
  useEffect(() => {
    const prev = prevMessagesRef.current;
    const isAppend = messages.length > prev.length
      && prev.length > 0
      && messages[prev.length - 1] === prev[prev.length - 1];
    if (isAppend || isLoading) {
      // New message in same conversation → smooth scroll
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    } else if (messages.length > 0) {
      // Nugget switch / hydration / refresh → instant scroll (no animation)
      messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
    }
    prevMessagesRef.current = messages;
  }, [messages, isLoading]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + 'px';
    }
  }, [inputText]);


  // ── Document change notice state ──
  const [showDocChangeNotice, setShowDocChangeNotice] = useState(false);
  const [pendingSendText, setPendingSendText] = useState('');
  const [pendingSendIsCard, setPendingSendIsCard] = useState(false);
  const [pendingSendLevel, setPendingSendLevel] = useState<DetailLevel | undefined>(undefined);

  // Send as regular chat message (default action, Enter key)
  const handleSend = useCallback(() => {
    if (!inputText.trim() || isLoading) return;
    const text = inputText.trim();

    // Check for pending doc changes with an active conversation
    if (pendingDocChanges && pendingDocChanges.length > 0 && hasConversation && onDocChangeContinue) {
      setPendingSendText(text);
      setPendingSendIsCard(false);
      setPendingSendLevel(undefined);
      setShowDocChangeNotice(true);
      return;
    }

    onSendMessage(text, false);
    setInputText('');
  }, [inputText, isLoading, onSendMessage, pendingDocChanges, hasConversation, onDocChangeContinue]);

  // Send as card with specific detail level (from menu)
  const handleSendAsCard = useCallback((level: DetailLevel) => {
    if (!inputText.trim() || isLoading) return;
    const text = inputText.trim();
    setShowSendMenu(false);

    // Check for pending doc changes with an active conversation
    if (pendingDocChanges && pendingDocChanges.length > 0 && hasConversation && onDocChangeContinue) {
      setPendingSendText(text);
      setPendingSendIsCard(true);
      setPendingSendLevel(level);
      setShowDocChangeNotice(true);
      return;
    }

    onSendMessage(text, true, level);
    setInputText('');
  }, [inputText, isLoading, onSendMessage, pendingDocChanges, hasConversation, onDocChangeContinue]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  // Close send menu on outside click or Escape
  useEffect(() => {
    if (!showSendMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (sendMenuRef.current && !sendMenuRef.current.contains(e.target as Node) &&
          sendBtnRef.current && !sendBtnRef.current.contains(e.target as Node)) {
        setShowSendMenu(false);
        setShowCardSubmenu(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setShowSendMenu(false); setShowCardSubmenu(false); }
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [showSendMenu]);

  const handleCopyChatMarkdown = useCallback(() => {
    const text = messages.map(m => {
      if (m.role === 'user') return `**You:** ${m.content}`;
      if (m.role === 'system') return `> ${m.content}`;
      return `**Claude:** ${m.content}`;
    }).join('\n\n');
    if (text) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }, [messages]);

  const startEditing = (msg: ChatMessage) => {
    setEditingMessageId(msg.id);
    setEditContent(msg.content);
  };

  const handleSaveHeading = (msg: ChatMessage) => {
    const content = editingMessageId === msg.id ? editContent : msg.content;
    onSaveAsHeading(msg, content);
    setEditingMessageId(null);
  };

  const handleCopyMessage = (msg: ChatMessage) => {
    navigator.clipboard.writeText(msg.content);
    setCopiedMsgId(msg.id);
    setTimeout(() => setCopiedMsgId(null), 1500);
  };

  /**
   * Parse card-suggestions block from assistant content.
   * Returns { body, suggestions } where body has the block stripped out.
   */
  const parseCardSuggestions = useCallback((content: string): { body: string; suggestions: string[] } => {
    const regex = /```card-suggestions\n([\s\S]*?)```/;
    const match = content.match(regex);
    if (!match) return { body: content, suggestions: [] };
    const body = content.replace(regex, '').trimEnd();
    const suggestions = match[1]
      .split('\n')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    return { body, suggestions };
  }, []);

  const renderMarkdown = (content: string) => {
    const html = marked.parse(content, { async: false }) as string;
    return <div className="document-prose chat-prose" dangerouslySetInnerHTML={{ __html: html }} />;
  };

  /** Extract the first heading from markdown content as the card title */
  const extractCardTitle = (content: string): string => {
    const match = content.match(/^#+\s+(.+)$/m);
    return match ? match[1].trim() : 'Card Content';
  };

  const toggleCardExpanded = (msgId: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId);
      else next.add(msgId);
      return next;
    });
  };

  const formatTime = (timestamp: number) => {
    const d = new Date(timestamp);
    const now = new Date();
    const isToday = d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    if (isToday) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div style={widthPercent ? { width: `${widthPercent}%` } : undefined} className="shrink-0 flex flex-col min-w-0 bg-white">
      {/* Header */}
      <div className="shrink-0 flex flex-col items-center justify-center px-5 pt-2 pb-1">
        <span className="text-[17px] tracking-tight text-zinc-900">
          <span className="font-light italic">insight</span><span className="font-semibold not-italic">lab</span>
        </span>
        {documents.length > 0 && (
          <p className="text-[9px] text-zinc-400 mt-0.5 text-center">Generate content using <span className="font-semibold text-zinc-500">CHAT</span> agent or directly from the <span className="font-semibold text-zinc-500">SOURCES</span> agent</p>
        )}
      </div>

      {/* ─── Toolbar ─── */}
      <div className="shrink-0">
        <div className="px-5 h-[32px] flex items-center justify-center gap-0">
          <button
            onClick={() => gatedAction(() => setViewMode('chat'))}
            title="Show chat"
            className={`h-7 px-2.5 text-[11px] flex items-center justify-center cursor-pointer ${
              viewMode === 'chat'
                ? 'rounded-[14px] font-bold text-zinc-900 border-2 border-black bg-zinc-100'
                : 'rounded-[6px] hover:rounded-[14px] font-medium border border-black text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50'
            }`}
            style={{ transition: 'border-radius 200ms ease, background-color 150ms ease, color 150ms ease' }}
          >
            Chat
          </button>
          <button
            onClick={() => setViewMode('content')}
            title="Show sources"
            className={`h-7 px-2.5 text-[11px] flex items-center justify-center cursor-pointer ${
              viewMode === 'content'
                ? 'rounded-[14px] font-bold text-zinc-900 border-2 border-black bg-zinc-100'
                : 'rounded-[6px] hover:rounded-[14px] font-medium border border-black text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50'
            }`}
            style={{ transition: 'border-radius 200ms ease, background-color 150ms ease, color 150ms ease' }}
          >
            Sources
          </button>
        </div>
      </div>

      {/* ─── Document tabs — always visible ─── */}
      <>
        {/* Document tabs */}
        <div className="shrink-0 flex items-start gap-0 px-4 pt-1 pb-1 border-y border-zinc-100">
          {/* Upload button — stays fixed on the left */}
          {onUploadDocuments && (
            <div className="shrink-0 flex items-center gap-0.5">
              <button
                onClick={() => uploadInputRef.current?.click()}
                title="Upload document"
                className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-all duration-150"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14" /><path d="M5 12h14" />
                </svg>
              </button>
              <input
                ref={uploadInputRef}
                type="file"
                accept=".md,.pdf,.docx"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) {
                    onUploadDocuments(e.target.files);
                    e.target.value = '';
                  }
                }}
              />
              {documents.length > 0 && (
                <div className="shrink-0 w-px h-4 bg-zinc-300 mx-0.5" />
              )}
            </div>
          )}
          {/* Document tab chips — wrap within their own container so rows align left */}
          <div className="flex flex-wrap items-center gap-0 min-w-0">
            {documents.length === 0 && (
              <span className="text-[11px] text-zinc-400 font-light italic ml-1 py-1.5">Upload a document or copy/move documents from other nuggets</span>
            )}
            {documents.map(doc => {
              const isEnabled = doc.enabled !== false;
              const isActive = activeDocTab === doc.id;
              const isRenaming = renamingDocId === doc.id;
              return (
                <div
                  key={doc.id}
                  data-doc-id={doc.id}
                  className={`relative shrink-0 h-7 px-2 text-[11px] max-w-[200px] flex items-center gap-1.5 cursor-pointer border ${
                    isActive
                      ? 'rounded-[14px] font-bold text-zinc-900 border-zinc-900 bg-zinc-100'
                      : `rounded-[6px] hover:rounded-[14px] font-medium border-black hover:bg-zinc-50 ${isEnabled ? 'text-zinc-500 hover:text-zinc-800' : 'text-zinc-300'}`
                  }`}
                  style={{ transition: 'border-radius 200ms ease, background-color 150ms ease, color 150ms ease' }}
                  onClick={() => { if (doc.id !== activeDocTab && !isRenaming) gatedAction(() => setActiveDocTab(doc.id)); }}
                  title={doc.name}
                  onMouseEnter={() => {
                    if (kebabDocId && kebabMode === 'locked') return;
                    const kebabBtn = kebabBtnRefs.current.get(doc.id);
                    if (kebabBtn) {
                      const rect = kebabBtn.getBoundingClientRect();
                      setKebabPos({ x: rect.right, y: rect.bottom + 4 });
                    }
                    setKebabMode('hover');
                    setKebabDocId(doc.id);
                  }}
                  onMouseLeave={(e) => {
                    if (kebabMode === 'locked') return;
                    const related = e.relatedTarget as Node | null;
                    if (kebabMenuRef.current && related && kebabMenuRef.current.contains(related)) return;
                    setKebabDocId(null);
                  }}
                >
                  {/* Enabled checkbox */}
                  <button
                    onClick={(e) => { e.stopPropagation(); onToggleDocument?.(doc.id); }}
                    className={`shrink-0 w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${
                      isEnabled
                        ? 'border-zinc-300 bg-zinc-900'
                        : 'border-zinc-200 bg-white hover:border-zinc-300'
                    }`}
                  >
                    {isEnabled && (
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    )}
                  </button>

                  {/* Name or inline rename input */}
                  {isRenaming ? (
                    <div className="relative flex-1 min-w-[60px]">
                      <input
                        ref={renameInputRef}
                        value={renameValue}
                        onChange={(e) => { setRenameValue(e.target.value); setRenameError(''); }}
                        onBlur={commitRename}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitRename();
                          if (e.key === 'Escape') { setRenamingDocId(null); setRenameValue(''); setRenameError(''); }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className={`w-full bg-transparent outline-none text-[11px] font-medium text-zinc-900 border-b ${renameError ? 'border-red-400' : 'border-zinc-400'}`}
                      />
                      {renameError && (
                        <div className="absolute left-0 top-full mt-1 bg-white border border-red-200 rounded px-2 py-1 text-[9px] text-red-500 whitespace-nowrap z-50 shadow-sm">
                          {renameError}
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <span className="truncate">{doc.name}</span>
                      {doc.status === 'processing' && (
                        <div className="shrink-0 w-3 h-3 border-[1.5px] border-zinc-300 border-t-zinc-600 rounded-full animate-spin" />
                      )}
                    </>
                  )}

                  {/* Kebab menu trigger */}
                  <button
                    ref={(el) => { if (el) kebabBtnRefs.current.set(doc.id, el); else kebabBtnRefs.current.delete(doc.id); }}
                    onClick={(e) => { e.stopPropagation(); openKebab(doc.id, e); }}
                    className="shrink-0 w-4 h-4 flex items-center justify-center rounded text-zinc-300 hover:text-zinc-600 transition-colors"
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

          {/* Kebab dropdown — rendered as portal to escape overflow clipping */}
          {kebabDocId && createPortal(
            <div
              ref={kebabMenuRef}
              className="fixed z-[130] min-w-[120px] bg-white rounded-[6px] border border-black py-1 animate-in fade-in zoom-in-95 duration-100"
              style={{ top: kebabPos.y, left: kebabPos.x, transform: 'translateX(-100%)' }}
              onMouseLeave={(e) => {
                if (kebabMode === 'locked') return;
                // Check if moving back to the doc tab chip
                const related = e.relatedTarget as Node | null;
                const chipEl = kebabDocId ? document.querySelector(`[data-doc-id="${kebabDocId}"]`) : null;
                if (chipEl && related && chipEl.contains(related)) return;
                setKebabDocId(null);
              }}
            >
              <button
                onClick={() => {
                  const docId = kebabDocId;
                  const doc = documents.find(d => d.id === docId);
                  setKebabDocId(null);
                  if (doc) { setRenamingDocId(docId); setRenameValue(doc.name); }
                }}
                className="w-full text-left px-3 py-1.5 text-[11px] text-black hover:bg-zinc-50 transition-colors flex items-center gap-2"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400">
                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                </svg>
                Rename Source
              </button>
              {/* Copy / Move — with hover submenu */}
              {onCopyMoveDocument && (
                <div
                  className="relative"
                  onMouseEnter={() => setShowCopyMoveSubmenu(true)}
                  onMouseLeave={() => setShowCopyMoveSubmenu(false)}
                >
                  <button
                    onClick={() => {
                      // If no other nuggets, open create-new-nugget modal
                      if (!otherNuggets || otherNuggets.length === 0) {
                        setNoNuggetsModalDocId(kebabDocId);
                        setKebabDocId(null);
                      }
                    }}
                    className="w-full text-left px-3 py-1.5 text-[11px] text-black hover:bg-zinc-50 transition-colors flex items-center justify-between"
                  >
                    <span className="flex items-center gap-2">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400">
                        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" />
                      </svg>
                      Copy/Move
                    </span>
                    {otherNuggets && otherNuggets.length > 0 && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-300">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    )}
                  </button>

                  {/* Nugget list submenu — appears on hover, to the right, slightly lower */}
                  {showCopyMoveSubmenu && otherNuggets && otherNuggets.length > 0 && (
                    <div
                      className="absolute left-full top-0 mt-4 ml-1 w-[220px] bg-white rounded-[6px] border border-black py-1 z-[140]"
                    >
                      <div className="px-3 pb-1 border-b border-zinc-100 mb-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Send to nugget</span>
                      </div>
                      <div className="max-h-[200px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                        {projectNuggets && projectNuggets.length > 0 ? (
                          projectNuggets.map(pg => (
                            <div key={pg.projectId}>
                              <div className="px-3 pt-1.5 pb-0.5 flex items-center gap-1.5">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-300 shrink-0">
                                  <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
                                </svg>
                                <span className="text-[9px] font-semibold text-zinc-400 truncate">{pg.projectName}</span>
                              </div>
                              {pg.nuggets.length === 0 ? (
                                <p className="text-zinc-300 text-[9px] font-light pl-6 pr-2 py-0.5 italic">No other nuggets</p>
                              ) : (
                                pg.nuggets.map(n => (
                                  <div key={n.id} className="pl-5 pr-2 py-1 flex items-center gap-1.5 hover:bg-zinc-50 rounded-lg mx-1 group">
                                    <div className="w-1.5 h-1.5 rounded-full bg-acid-lime shrink-0" />
                                    <span className="flex-1 text-[11px] text-black truncate" title={n.name}>{n.name}</span>
                                    <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button
                                        onClick={() => {
                                          const docId = kebabDocId!;
                                          setKebabDocId(null);
                                          onCopyMoveDocument?.(docId, n.id, 'copy');
                                        }}
                                        className="px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-black bg-zinc-100 hover:bg-zinc-200 rounded transition-colors"
                                      >
                                        Copy
                                      </button>
                                      <button
                                        onClick={() => {
                                          const docId = kebabDocId!;
                                          setKebabDocId(null);
                                          onCopyMoveDocument?.(docId, n.id, 'move');
                                        }}
                                        className="px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-black bg-zinc-100 hover:bg-zinc-200 rounded transition-colors"
                                      >
                                        Move
                                      </button>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          ))
                        ) : (
                          otherNuggets.map(n => (
                            <div key={n.id} className="px-2 py-1 flex items-center gap-1.5 hover:bg-zinc-50 rounded-lg mx-1 group">
                              <div className="w-1.5 h-1.5 rounded-full bg-acid-lime shrink-0" />
                              <span className="flex-1 text-[11px] text-black truncate" title={n.name}>{n.name}</span>
                              <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => {
                                    const docId = kebabDocId!;
                                    setKebabDocId(null);
                                    onCopyMoveDocument?.(docId, n.id, 'copy');
                                  }}
                                  className="px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-black bg-zinc-100 hover:bg-zinc-200 rounded transition-colors"
                                >
                                  Copy
                                </button>
                                <button
                                  onClick={() => {
                                    const docId = kebabDocId!;
                                    setKebabDocId(null);
                                    onCopyMoveDocument?.(docId, n.id, 'move');
                                  }}
                                  className="px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-black bg-zinc-100 hover:bg-zinc-200 rounded transition-colors"
                                >
                                  Move
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
              <button
                onClick={() => {
                  const doc = documents.find(d => d.id === kebabDocId);
                  setKebabDocId(null);
                  if (doc?.content) {
                    const blob = new Blob([doc.content], { type: 'text/markdown' });
                    const url = URL.createObjectURL(blob);
                    const a = Object.assign(document.createElement('a'), { href: url, download: `${doc.name.replace(/\.[^.]+$/, '')}.md` });
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  }
                }}
                className="w-full text-left px-3 py-1.5 text-[11px] text-black hover:bg-zinc-50 transition-colors flex items-center gap-2"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download Source
              </button>
              <button
                onClick={() => {
                  const docId = kebabDocId;
                  setKebabDocId(null);
                  setConfirmRemoveDocId(docId);
                }}
                className="w-full text-left px-3 py-1.5 text-[11px] text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400">
                  <path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                </svg>
                Remove Source
              </button>
            </div>,
            document.body
          )}

          {/* Copy/Move — no other nuggets: inline create modal */}
          {noNuggetsModalDocId && createPortal(
            <div
              className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50"
              onClick={() => { setNoNuggetsModalDocId(null); setNewNuggetName(''); }}
            >
              <div
                className="bg-white rounded-2xl shadow-2xl mx-4 overflow-hidden"
                style={{ minWidth: 300, maxWidth: 'calc(100vw - 32px)', width: 'fit-content' }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-6 pt-6 pb-3 text-center">
                  <div className="w-9 h-9 rounded-full bg-zinc-100 flex items-center justify-center mx-auto mb-3">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#71717a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" />
                    </svg>
                  </div>
                  <h3 className="text-sm font-semibold text-zinc-900 tracking-tight mb-1">No Other Nuggets</h3>
                  <p className="text-[13px] text-zinc-400 mt-1">Create a new nugget to copy this document to.</p>
                  {(() => {
                    const allNuggetNames = (otherNuggets || []).map(n => n.name);
                    const nameConflict = isNameTaken(newNuggetName.trim(), allNuggetNames);
                    return (
                      <>
                        <input
                          type="text"
                          value={newNuggetName}
                          onChange={(e) => setNewNuggetName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && newNuggetName.trim() && !nameConflict && onCreateNuggetWithDoc) {
                              const docId = noNuggetsModalDocId;
                              setNoNuggetsModalDocId(null);
                              setNewNuggetName('');
                              onCreateNuggetWithDoc(newNuggetName.trim(), docId);
                            }
                          }}
                          placeholder="Nugget name"
                          autoFocus
                          className={`mt-3 w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-300 transition-all placeholder:text-zinc-300 ${nameConflict ? 'border-red-300 focus:border-red-400' : 'border-zinc-200 focus:border-zinc-400'}`}
                        />
                        {nameConflict && <p className="text-[10px] text-red-500 mt-1">A nugget with this name already exists</p>}
                      </>
                    );
                  })()}
                </div>
                <div className="px-6 pb-5 pt-1 flex items-center justify-center gap-2">
                  <button
                    onClick={() => { setNoNuggetsModalDocId(null); setNewNuggetName(''); }}
                    className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  {onCreateNuggetWithDoc && (() => {
                    const nameConflict = isNameTaken(newNuggetName.trim(), (otherNuggets || []).map(n => n.name));
                    const canCreate = !!newNuggetName.trim() && !nameConflict;
                    return (
                      <button
                        onClick={() => {
                          if (!canCreate) return;
                          const docId = noNuggetsModalDocId;
                          setNoNuggetsModalDocId(null);
                          setNewNuggetName('');
                          onCreateNuggetWithDoc(newNuggetName.trim(), docId);
                        }}
                        disabled={!canCreate}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                          canCreate
                            ? 'bg-zinc-900 text-white hover:bg-zinc-800'
                            : 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
                        }`}
                      >
                        New Nugget
                      </button>
                    );
                  })()}
                </div>
              </div>
            </div>,
            document.body
          )}
      </>

      {/* Remove document confirmation modal */}
      {confirmRemoveDocId && (() => {
        const doc = documents.find(d => d.id === confirmRemoveDocId);
        if (!doc) return null;
        return createPortal(
          <div
            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50"
            onClick={() => setConfirmRemoveDocId(null)}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl mx-4 overflow-hidden"
              style={{ minWidth: 260, maxWidth: 'calc(100vw - 32px)', width: 'fit-content' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 pt-6 pb-3 text-center">
                <div className="w-9 h-9 rounded-full bg-zinc-100 flex items-center justify-center mx-auto mb-3">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#71717a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                  </svg>
                </div>
                <h3 className="text-sm font-semibold text-zinc-900 tracking-tight mb-1">Remove Document</h3>
                <p className="text-sm font-medium text-zinc-700 whitespace-nowrap">{doc.name}</p>
                <p className="text-[13px] text-zinc-400 mt-2">This cannot be undone.</p>
              </div>
              <div className="px-6 pb-5 pt-1 flex items-center justify-center gap-2">
                <button
                  onClick={() => setConfirmRemoveDocId(null)}
                  className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => { setConfirmRemoveDocId(null); onRemoveDocument?.(doc.id); }}
                  className="px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-lg hover:bg-zinc-800 transition-colors"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>,
          document.body
        );
      })()}

      {/* ─── Content view — Document editor ─── */}
      {viewMode === 'content' ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          {documents.length > 0 ? (
            <>
              {/* Universal editor — inline mode, keyed by doc id to remount on tab switch */}
              {(() => {
                const activeDoc = documents.find(d => d.id === activeDocTab);
                if (!activeDoc?.content) {
                  return (
                    <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
                      <p className="text-sm text-zinc-400 font-light max-w-xs">
                        This document has no editable content.
                      </p>
                    </div>
                  );
                }
                return (
                  <DocumentEditorModal
                    ref={editorHandleRef}
                    key={activeDoc.id}
                    document={activeDoc}
                    mode="inline"
                    onSave={(newContent) => onSaveDocument(activeDoc.id, newContent)}
                    onClose={() => setViewMode('chat')}
                    onGenerateCard={onGenerateCardContent}
                  />
                );
              })()}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
              <div className="w-10 h-10 bg-zinc-100 rounded-full flex items-center justify-center mb-3">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a1a1aa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              </div>
              <p className="text-sm text-zinc-400 font-light max-w-xs">
                No documents uploaded yet. Add documents via the nuggetcards sidebar.
              </p>
            </div>
          )}
        </div>
      ) : (
      /* ─── Chat messages view ─── */
      <>
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <div className="w-10 h-10 bg-zinc-100 rounded-full flex items-center justify-center mb-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a1a1aa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
            </div>
            <p className="text-sm text-zinc-400 font-light max-w-xs">
              Ask questions about your documents, explore themes, and generate card content from the conversation.
            </p>
          </div>
        )}

        {messages.map((msg) => {
          // System messages — styled document update notice with markdown rendering
          if (msg.role === 'system') {
            const noticeHtml = marked.parse(msg.content, { async: false }) as string;
            return (
              <div key={msg.id} className="px-5 py-2">
                <div className="rounded-xl px-4 py-3 system-notice-prose text-[11px] leading-relaxed" style={{ backgroundColor: 'rgba(204, 255, 0, 0.06)', border: '1px solid rgba(204, 255, 0, 0.2)', color: '#3f6212' }} dangerouslySetInnerHTML={{ __html: noticeHtml }} />
              </div>
            );
          }

          // User messages — right-aligned, compact
          if (msg.role === 'user') {
            return (
              <div key={msg.id} className="group/msg px-5 py-3 flex justify-end">
                <div className="max-w-[85%]">
                  <p className="text-[13px] text-zinc-800 whitespace-pre-wrap leading-relaxed bg-zinc-100 rounded-2xl rounded-br-md px-4 py-2.5">{msg.content}</p>
                  <div className="flex items-center justify-end gap-2 mt-1 opacity-0 group-hover/msg:opacity-100 transition-opacity">
                    <span className="text-[11px] text-zinc-300">{formatTime(msg.timestamp)}</span>
                    <button
                      onClick={() => handleCopyMessage(msg)}
                      title="Copy"
                      className="p-0.5 rounded text-zinc-300 hover:text-zinc-500 transition-colors"
                    >
                      {copiedMsgId === msg.id ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          }

          // Assistant messages — left-aligned, more padding
          const { body, suggestions } = parseCardSuggestions(msg.content);
          return (
            <div key={msg.id} className="group/msg px-5 py-3">
              <div className={`max-w-[95%] ${msg.isCardContent ? 'bg-zinc-50 rounded-xl border border-zinc-300 overflow-hidden' : ''}`}>
                {/* Card content — collapsible, default collapsed */}
                {msg.isCardContent ? (
                  <>
                    <div className="flex items-center gap-2 px-4 py-2.5 hover:bg-zinc-100 transition-colors">
                      <button
                        onClick={() => toggleCardExpanded(msg.id)}
                        className="flex items-center gap-2 min-w-0 text-left"
                      >
                        <svg
                          width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                          className={`shrink-0 text-zinc-400 transition-transform duration-150 ${expandedCards.has(msg.id) ? 'rotate-90' : ''}`}
                        >
                          <path d="m9 18 6-6-6-6"/>
                        </svg>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-white bg-zinc-900 px-2 py-0.5 rounded-full shrink-0">Card</span>
                        {msg.detailLevel && (
                          <span className="text-[10px] text-zinc-400 shrink-0">{msg.detailLevel}</span>
                        )}
                        <span className="text-xs font-medium text-zinc-700 truncate">{extractCardTitle(body)}</span>
                      </button>
                      {/* Hover actions — inline on card title row */}
                      <div className="flex items-center gap-1.5 ml-auto shrink-0 opacity-0 group-hover/msg:opacity-100 transition-opacity">
                        <div className="flex items-center gap-1 px-0.5" title="Card content (auto-saved)">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                          <span className="text-[10px] text-green-600/60">Saved</span>
                        </div>
                        <span className="text-[10px] text-zinc-300">{formatTime(msg.timestamp)}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleCopyMessage(msg); }}
                          title="Copy"
                          className="p-0.5 rounded text-zinc-300 hover:text-zinc-500 transition-colors"
                        >
                          {copiedMsgId === msg.id ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M20 6L9 17l-5-5" />
                            </svg>
                          ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                    {expandedCards.has(msg.id) && (
                      <div className="px-4 pb-3">
                        {renderMarkdown(body)}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {/* Content */}
                    {renderMarkdown(body)}

                    {/* Hover actions — timestamp, copy, add as card */}
                    <div className="flex items-center gap-2.5 mt-2 opacity-0 group-hover/msg:opacity-100 transition-opacity">
                      <span className="text-[10px] text-zinc-300">{formatTime(msg.timestamp)}</span>
                      <button
                        onClick={() => handleCopyMessage(msg)}
                        title="Copy"
                        className="p-1 rounded text-zinc-300 hover:text-zinc-500 transition-colors"
                      >
                        {copiedMsgId === msg.id ? (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        ) : (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                          </svg>
                        )}
                      </button>
                      {/* Save as heading */}
                      {!msg.savedAsHeadingId ? (
                        <button
                          onClick={() => handleSaveHeading(msg)}
                          title="Add as card"
                          className="p-1 rounded text-zinc-300 hover:text-zinc-500 transition-colors"
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect width="18" height="18" x="3" y="3" rx="2" />
                            <path d="M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2" />
                            <path d="M3 11h3c.8 0 1.6.3 2.1.9l1.1.9c1.6 1.6 4.1 1.6 5.7 0l1.1-.9c.5-.5 1.3-.9 2.1-.9H21" />
                          </svg>
                        </button>
                      ) : (
                        <div className="flex items-center gap-1.5 px-0.5" title="Saved as card">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                          <span className="text-[10px] text-green-600/60">Saved</span>
                        </div>
                      )}
                    </div>

                    {suggestions.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {suggestions.map((s, i) => (
                          <button
                            key={i}
                            onClick={() => {
                              setInputText(s);
                              textareaRef.current?.focus();
                            }}
                            className="text-[11px] text-zinc-500 bg-zinc-50 border border-zinc-200 rounded-full px-3 py-1 hover:bg-zinc-100 hover:text-zinc-700 transition-colors text-left"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="shrink-0 px-4 py-3">
        <div className="rounded-2xl border border-zinc-200 bg-white focus-within:ring-1 focus-within:ring-zinc-300 transition-shadow">
          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your documents..."
            disabled={isLoading}
            rows={2}
            className="w-full resize-none bg-transparent px-4 pt-3 pb-1 text-sm focus:outline-none disabled:opacity-50 placeholder:text-zinc-400"
          />
          <div className="flex items-center justify-between px-2 pb-2">
            {/* Left actions */}
            <div className="flex items-center gap-1.5">
              {/* Copy chat as markdown */}
              {messages.length > 0 && (
                <button
                  onClick={handleCopyChatMarkdown}
                  title="Copy chat as Markdown"
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-300 hover:text-zinc-500 hover:bg-zinc-100 transition-colors"
                >
                  {copied ? (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  ) : (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                    </svg>
                  )}
                </button>
              )}
              {/* Clear chat */}
              {messages.length > 0 && (
                <button
                  onClick={onClearChat}
                  title="Clear chat"
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-300 hover:text-zinc-500 hover:bg-zinc-100 transition-colors"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  </svg>
                </button>
              )}
            </div>

            {/* Send / Stop — with dropdown menu */}
            {isLoading ? (
              <button
                onClick={onStop}
                title="Stop response"
                className="w-8 h-8 rounded-lg bg-zinc-900 text-white flex items-center justify-center hover:bg-zinc-700 transition-colors animate-pulse"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round" className="animate-[spin_3s_linear_infinite]">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeDasharray="20 43" />
                  <rect x="9" y="9" width="6" height="6" rx="1" fill="currentColor" />
                </svg>
              </button>
            ) : (
              <div ref={sendBtnRef}>
                <button
                  onClick={() => {
                    if (!showSendMenu && sendBtnRef.current) {
                      const rect = sendBtnRef.current.getBoundingClientRect();
                      setSendMenuPos({ x: rect.right, y: rect.top });
                    }
                    setShowSendMenu(prev => !prev);
                    setShowCardSubmenu(false);
                  }}
                  onMouseEnter={() => {
                    if (!showSendMenu && inputText.trim() && sendBtnRef.current) {
                      const rect = sendBtnRef.current.getBoundingClientRect();
                      setSendMenuPos({ x: rect.right, y: rect.top });
                      setShowSendMenu(true);
                      setShowCardSubmenu(false);
                    }
                  }}
                  disabled={!inputText.trim()}
                  title="Send options"
                  className="w-8 h-8 rounded-lg bg-zinc-900 text-white flex items-center justify-center hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-zinc-900 transition-colors"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 12L3.269 3.126A59.768 59.768 0 0 1 21.485 12 59.77 59.77 0 0 1 3.27 20.876L5.999 12Zm0 0h7.5" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      </>
      )}

      {/* Document change notice — shown when sending with unseen doc changes */}
      {showDocChangeNotice && pendingDocChanges && pendingDocChanges.length > 0 && (
        <DocumentChangeNotice
          changes={pendingDocChanges}
          onContinue={() => {
            setShowDocChangeNotice(false);
            onDocChangeContinue?.(pendingSendText, pendingSendIsCard, pendingSendLevel);
            setInputText('');
          }}
          onStartFresh={() => {
            setShowDocChangeNotice(false);
            onDocChangeStartFresh?.();
          }}
          onCancel={() => setShowDocChangeNotice(false)}
        />
      )}

      {/* Unsaved changes dialog — shown when navigating away from dirty editor */}
      {pendingAction && (
        <UnsavedChangesDialog
          onSave={() => {
            editorHandleRef.current?.save();
            const action = pendingAction;
            setPendingAction(null);
            action();
          }}
          onDiscard={() => {
            editorHandleRef.current?.discard();
            const action = pendingAction;
            setPendingAction(null);
            action();
          }}
          onCancel={() => setPendingAction(null)}
        />
      )}

      {/* Send menu — rendered as portal to escape overflow clipping */}
      {showSendMenu && createPortal(
        <div
          ref={sendMenuRef}
          className="fixed min-w-[180px] bg-white rounded-[6px] border border-black py-1 z-[200]"
          style={{
            right: Math.max(8, window.innerWidth - sendMenuPos.x),
            bottom: Math.max(8, window.innerHeight - sendMenuPos.y + 6),
          }}
        >
          {/* Send Message option */}
          <button
            onClick={() => { setShowSendMenu(false); setShowCardSubmenu(false); handleSend(); }}
            className="w-full text-left px-3 py-2 text-[11px] text-black hover:bg-zinc-50 transition-colors flex items-center gap-2"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400">
              <path d="M6 12L3.269 3.126A59.768 59.768 0 0 1 21.485 12 59.77 59.77 0 0 1 3.27 20.876L5.999 12Zm0 0h7.5" />
            </svg>
            Send Message
          </button>

          <div className="h-px bg-zinc-100 my-1" />

          {/* Generate Card — with submenu */}
          <div
            className="relative"
            onMouseEnter={() => setShowCardSubmenu(true)}
            onMouseLeave={() => setShowCardSubmenu(false)}
          >
            <button
              className="w-full text-left px-3 py-2 text-[11px] font-semibold text-black hover:bg-zinc-50 transition-colors flex items-center justify-between"
            >
              <span className="flex items-center gap-2">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400">
                  <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M12 8v8" /><path d="M8 12h8" />
                </svg>
                Generate Card
              </span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-300">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>

            {/* Detail level submenu — appears on hover, grows upward */}
            {showCardSubmenu && (
              <div
                className="absolute right-full bottom-0 mr-1 min-w-[140px] bg-white rounded-[6px] border border-black py-1 z-[201]"
              >
                {([
                  { level: 'Executive' as DetailLevel, label: 'Executive', desc: '70-100 words' },
                  { level: 'Standard' as DetailLevel, label: 'Standard', desc: '200-250 words' },
                  { level: 'Detailed' as DetailLevel, label: 'Detailed', desc: '450-500 words' },
                ]).map(opt => (
                  <button
                    key={opt.level}
                    onClick={() => handleSendAsCard(opt.level)}
                    className="w-full text-left px-3 py-2 text-[11px] text-black hover:bg-zinc-50 transition-colors flex items-center justify-between gap-3"
                  >
                    <span className="font-medium">{opt.label}</span>
                    <span className="text-[9px] text-zinc-400">{opt.desc}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
});

export default InsightsLabPanel;
