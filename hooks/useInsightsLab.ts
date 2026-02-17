import { useState, useCallback, useRef, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { ChatMessage, DetailLevel, DocChangeEvent } from '../types';
import { callClaude, ClaudeMessage } from '../utils/ai';
import { INSIGHTS_SYSTEM_PROMPT, buildCardContentInstruction } from '../utils/prompts/insightsLab';
import { computeDocumentHash } from '../utils/documentHash';

/**
 * Chat state management + Claude API integration for the Insights Lab workflow.
 * Handles regular chat messages and structured card content generation.
 *
 * Uses prompt caching to avoid re-processing document context on every message:
 * - System blocks: INSIGHTS_SYSTEM_PROMPT + document context (cached)
 * - Messages: proper multi-turn conversation (incrementally cached)
 */
export function useInsightsLab() {
  const {
    selectedNugget,
    appendNuggetMessage,
    setNuggets,
    selectedNuggetId,
  } = useAppContext();
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  /**
   * Resolve the document contents for the active insights nugget.
   * Documents are owned directly by the nugget (no shared library lookup).
   */
  const resolveDocumentContext = useCallback((): Array<{ name: string; content: string }> => {
    if (!selectedNugget || selectedNugget.type !== 'insights') return [];
    return selectedNugget.documents
      .filter(doc => doc.content && doc.enabled !== false)
      .map(doc => ({ name: doc.name, content: doc.content! }));
  }, [selectedNugget]);

  /**
   * Send a message to Claude. Can be a regular chat message or a card content request.
   *
   * Prompt structure with caching:
   *   System: [
   *     { text: INSIGHTS_SYSTEM_PROMPT },
   *     { text: "Documents:\n...", cache: true }     ← CACHED (stable within conversation)
   *   ]
   *   Messages: [
   *     { role: "user", content: "msg 1" },
   *     { role: "assistant", content: "resp 1" },
   *     ...
   *     { role: "user", content: "new msg" }          ← cache breakpoint (auto-added by callClaude)
   *   ]
   */
  const sendMessage = useCallback(async (
    text: string,
    isCardRequest: boolean = false,
    detailLevel?: DetailLevel,
    messagesOverride?: ChatMessage[]
  ) => {
    if (!selectedNugget || selectedNugget.type !== 'insights' || !text.trim()) return;

    const resolvedDocs = resolveDocumentContext();
    // Use explicit override when caller needs to bypass stale closure
    // (e.g. handleDocChangeContinue injects system msg before React re-renders)
    const history = messagesOverride ?? (selectedNugget.messages ?? []);

    // Create user message
    const userMessage: ChatMessage = {
      id: Math.random().toString(36).substr(2, 9),
      role: 'user',
      content: text.trim(),
      timestamp: Date.now(),
    };

    // Add user message to nugget immediately
    appendNuggetMessage(userMessage);

    setIsLoading(true);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // ── Build cached system blocks ──
      // Document context goes in system (cached) — it's stable within a conversation
      const docContext = resolvedDocs.map(d =>
        `--- Document: ${d.name} ---\n${d.content}\n--- End Document ---`
      ).join('\n\n');

      // ── Build multi-turn messages array ──
      // Replay conversation history as proper user/assistant turns
      const claudeMessages: ClaudeMessage[] = [];
      for (const msg of history) {
        if (msg.role === 'system') {
          // Legacy system messages — inject as user message so Claude sees it
          claudeMessages.push({ role: 'user', content: msg.content });
          claudeMessages.push({ role: 'assistant', content: 'Understood.' });
          continue;
        }
        claudeMessages.push({ role: msg.role, content: msg.content });
      }

      // Add the new user message (card instruction goes in system, not user message)
      claudeMessages.push({ role: 'user', content: text.trim() });

      // Build system blocks — card instruction goes LAST (after documents)
      // so it's the final instruction Claude reads before generating, maximizing compliance
      const systemBlocks: Array<{ text: string; cache: boolean }> = [
        { text: INSIGHTS_SYSTEM_PROMPT, cache: false },
        { text: `Current documents:\n\n${docContext}`, cache: true },
      ];
      if (isCardRequest && detailLevel) {
        systemBlocks.push({ text: buildCardContentInstruction(detailLevel), cache: false });
      }

      // Token budget scaled to detail level to prevent over-generation
      let maxTokens = 8192;
      if (isCardRequest) {
        if (detailLevel === 'Executive') maxTokens = 300;
        else if (detailLevel === 'Standard') maxTokens = 600;
        else maxTokens = 1200; // Detailed
      }

      const response = await callClaude('', {
        systemBlocks,
        messages: claudeMessages,
        maxTokens,
        signal: controller.signal,
      });

      // Create assistant message
      const assistantMessage: ChatMessage = {
        id: Math.random().toString(36).substr(2, 9),
        role: 'assistant',
        content: response,
        timestamp: Date.now(),
        isCardContent: isCardRequest,
        detailLevel: isCardRequest ? detailLevel : undefined,
      };

      // Add assistant message to nugget
      appendNuggetMessage(assistantMessage);

      // Update lastDocHash so we know the state of docs at this point
      const currentHash = computeDocumentHash(selectedNugget.documents);
      setNuggets(prev => prev.map(n =>
        n.id === selectedNugget.id ? { ...n, lastDocHash: currentHash } : n
      ));
    } catch (err: any) {
      // Silently ignore aborted requests
      if (err.name === 'AbortError') return;

      console.error('Insights lab error:', err);

      const errorMessage: ChatMessage = {
        id: Math.random().toString(36).substr(2, 9),
        role: 'assistant',
        content: `Error: ${err.message || 'Failed to get response from Claude. Please try again.'}`,
        timestamp: Date.now(),
      };

      appendNuggetMessage(errorMessage);
    } finally {
      abortRef.current = null;
      setIsLoading(false);
    }
  }, [selectedNugget, resolveDocumentContext, appendNuggetMessage]);

  /**
   * Abort the in-flight Claude request.
   */
  const stopResponse = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsLoading(false);
  }, []);

  /**
   * Clear all messages from the active insights nugget.
   * Also advances the doc change sync index so the fresh chat starts clean.
   */
  const clearMessages = useCallback(() => {
    if (!selectedNuggetId) return;
    setNuggets(prev => prev.map(n => {
      if (n.id !== selectedNuggetId || n.type !== 'insights') return n;
      return { ...n, messages: [], lastDocChangeSyncIndex: (n.docChangeLog || []).length, lastModifiedAt: Date.now() };
    }));
  }, [selectedNuggetId, setNuggets]);

  // ── Document change detection ──

  /** Unseen document changes since last sync to chat agent */
  const pendingDocChanges: DocChangeEvent[] = useMemo(() => {
    if (!selectedNugget || selectedNugget.type !== 'insights') return [];
    const log = selectedNugget.docChangeLog || [];
    const syncIdx = selectedNugget.lastDocChangeSyncIndex ?? 0;
    return log.slice(syncIdx);
  }, [selectedNugget]);

  /** Whether the chat has any messages (i.e. agent was already informed of some document state) */
  const hasConversation = (selectedNugget?.messages?.length ?? 0) > 0;

  /**
   * Build a human-readable summary of document changes for the system message.
   */
  const buildChangeSummary = useCallback((changes: DocChangeEvent[]): string => {
    const lines = changes.map(e => {
      switch (e.type) {
        case 'added':    return `- **Added** document: "${e.docName}"`;
        case 'removed':  return `- **Removed** document: "${e.docName}"`;
        case 'renamed':  return `- **Renamed** document: "${e.oldName}" → "${e.docName}"`;
        case 'enabled':  return `- **Enabled** document: "${e.docName}" (now included in context)`;
        case 'disabled': return `- **Disabled** document: "${e.docName}" (excluded from context)`;
        case 'updated':  return `- **Updated** content of document: "${e.docName}"`;
        default:         return `- Document change: "${e.docName}"`;
      }
    });
    return `[Document Update] The following changes were made to the document set since your last update:\n${lines.join('\n')}\n\nThe system context now reflects the current document set. Base all subsequent answers on the updated documents.`;
  }, []);

  /**
   * Continue with pending changes: inject a system message summarizing changes,
   * then send the user's message.
   */
  const handleDocChangeContinue = useCallback(async (
    text: string,
    isCardRequest: boolean = false,
    detailLevel?: DetailLevel,
  ) => {
    if (!selectedNugget || selectedNugget.type !== 'insights') return;

    const changes = pendingDocChanges;
    if (changes.length === 0) {
      // No changes — just send normally
      await sendMessage(text, isCardRequest, detailLevel);
      return;
    }

    // Inject a system message into the nugget's message history
    const systemMsg: ChatMessage = {
      id: Math.random().toString(36).substr(2, 9),
      role: 'system',
      content: buildChangeSummary(changes),
      timestamp: Date.now(),
    };

    // Add system message to nugget + advance sync index
    appendNuggetMessage(systemMsg);

    // Advance the sync index
    const newSyncIdx = (selectedNugget.docChangeLog || []).length;
    setNuggets(prev => prev.map(n =>
      n.id === selectedNugget.id
        ? { ...n, lastDocChangeSyncIndex: newSyncIdx }
        : n
    ));

    // Build the updated messages array including the system message
    // (because React state won't have updated yet for the sendMessage closure)
    const updatedMessages = [...(selectedNugget.messages || []), systemMsg];

    // Now send the user message with the updated history
    await sendMessage(text, isCardRequest, detailLevel, updatedMessages);
  }, [selectedNugget, pendingDocChanges, sendMessage, buildChangeSummary, appendNuggetMessage, setNuggets]);

  /**
   * Start fresh: clear all messages and advance sync index, ready for new conversation.
   */
  const handleDocChangeStartFresh = useCallback(() => {
    clearMessages();
  }, [clearMessages]);

  return {
    messages: selectedNugget?.messages || [],
    isLoading,
    sendMessage,
    stopResponse,
    clearMessages,
    pendingDocChanges,
    hasConversation,
    handleDocChangeContinue,
    handleDocChangeStartFresh,
  };
}
