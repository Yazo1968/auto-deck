import { useState, useCallback, useRef } from 'react';
import { useNuggetContext } from '../context/NuggetContext';
import { useProjectContext } from '../context/ProjectContext';
import { useSelectionContext } from '../context/SelectionContext';
import { Card, DetailLevel, Heading, UploadedFile, Nugget, isCoverLevel } from '../types';
import { getUniqueName } from '../utils/naming';
import {
  callClaude,
  uploadToFilesAPI,
  deleteFromFilesAPI,
} from '../utils/ai';
import {
  createPlaceholderDocument,
  processFileToDocument,
  processNativePdf,
  base64ToBlob,
} from '../utils/fileProcessing';
import { buildTocSystemPrompt, headingsToBookmarks, writeBookmarksToPdf } from '../utils/pdfBookmarks';
import { buildContentPrompt, buildNativePdfSectionHint } from '../utils/prompts/contentGeneration';
import { buildCoverContentPrompt } from '../utils/prompts/coverGeneration';
import { useToast } from '../components/ToastNotification';
import { RecordUsageFn } from './useTokenUsage';

export interface UseDocumentOperationsParams {
  recordUsage: RecordUsageFn;
  onSubjectGenPending: (nuggetId: string, docIds: string[]) => void;
}

/**
 * Document operations — save, TOC, copy/move, upload, PDF choice, content generation.
 * Extracted from App.tsx for domain separation (item 4.2).
 */
export function useDocumentOperations({
  recordUsage,
  onSubjectGenPending,
}: UseDocumentOperationsParams) {
  const { selectedNugget, nuggets, updateNugget, addNugget, addNuggetDocument, updateNuggetDocument, removeNuggetDocument } = useNuggetContext();
  const { projects, addNuggetToProject } = useProjectContext();
  const { setActiveCardId } = useSelectionContext();

  const { addToast } = useToast();

  // ── PDF upload choice dialog state ──
  const [pdfChoiceDialog, setPdfChoiceDialog] = useState<{ fileName: string; pdfCount?: number } | null>(null);
  const pdfChoiceResolverRef = useRef<((choice: 'markdown' | 'native-pdf' | 'cancel') => void) | null>(null);

  // ── Source-side generation spinner state (lifted from SourcesPanel to survive panel collapse) ──
  const [generatingSourceIds, setGeneratingSourceIds] = useState<Set<string>>(new Set());

  // ── TOC hard lock state (blocks all UI except SourcesPanel while TOC is dirty) ──
  const [tocLockActive, setTocLockActive] = useState(false);

  // ── Content generation from source documents ──

  const handleGenerateCardContent = useCallback(
    async (_editorCardId: string, detailLevel: DetailLevel, cardTitle: string, sourceDocName?: string) => {
      if (!selectedNugget || !cardTitle) return;
      // Track this generation in lifted state so spinners survive panel collapse
      setGeneratingSourceIds((prev) => {
        const next = new Set(prev);
        next.add(_editorCardId);
        return next;
      });

      // Gather document content from all enabled nugget documents (including native PDFs with fileId only)
      const enabledDocs = selectedNugget.documents.filter((d) => d.enabled !== false && (d.content || d.fileId));
      // Split: docs with fileId go via Files API only; docs without fileId go inline
      const fileApiDocs = enabledDocs.filter((d) => d.fileId);
      const inlineDocs = enabledDocs.filter((d) => !d.fileId && d.content);
      // fullDocument is built from inline-only docs (no fileId) for section extraction
      const inlineContent = inlineDocs.map((d) => d.content).join('\n\n---\n\n');
      if (!inlineContent && fileApiDocs.length === 0) return;

      // Find the section text for this card title in inline markdown docs
      let sectionText = '';
      if (inlineContent) {
        const escapedText = cardTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const headingRegex = new RegExp(`^(#{1,6})\\s+${escapedText}\\s*$`, 'gm');
        const match = headingRegex.exec(inlineContent);
        const startOffset = match ? match.index : 0;
        const headingLevel = match ? match[1].length : 1;
        const nextHeadingRegex = new RegExp(`^#{1,${headingLevel}}\\s+`, 'gm');
        nextHeadingRegex.lastIndex = startOffset + (match ? match[0].length : 0);
        const nextMatch = nextHeadingRegex.exec(inlineContent);
        sectionText = inlineContent.substring(startOffset, nextMatch ? nextMatch.index : inlineContent.length);
      }

      // For native PDFs (no markdown), build a section hint with page boundaries
      // so Claude can locate the right section within the file_id document
      const nativePdfSectionHint =
        !sectionText && fileApiDocs.length > 0 ? buildNativePdfSectionHint(cardTitle, enabledDocs) : '';

      // ── Direct Content: use raw section text as-is, no AI synthesis ──
      // (Only works for markdown docs — native PDFs have no raw text to copy)
      if (detailLevel === 'DirectContent' && inlineContent) {
        const isWholeDoc = _editorCardId === '__whole_document__';
        let directText = isWholeDoc ? inlineContent.trim() : sectionText.trim();
        if (!directText.startsWith('#')) {
          directText = `# ${cardTitle}\n\n${directText}`;
        }

        const newCardId = `card-${Math.random().toString(36).substr(2, 9)}`;
        const cardSourceDocs = sourceDocName ? [sourceDocName] : enabledDocs.map((d) => d.name);
        const uniqueCardName = getUniqueName(
          cardTitle,
          selectedNugget.cards.map((c) => c.text),
        );

        const newCard: Card = {
          id: newCardId,
          text: uniqueCardName,
          level: 1,
          selected: false,
          synthesisMap: { [detailLevel]: directText },
          isSynthesizingMap: {},
          detailLevel,
          createdAt: Date.now(),
          sourceDocuments: cardSourceDocs,
        };

        updateNugget(selectedNugget.id, (n) => ({
          ...n,
          cards: [...n.cards, newCard],
          lastModifiedAt: Date.now(),
        }));

        setActiveCardId(newCardId);
        return;
      }

      // Build prompt and call Claude — branch for cover vs content
      const isCover = isCoverLevel(detailLevel);
      const synthesisPrompt = isCover
        ? buildCoverContentPrompt(cardTitle, detailLevel, inlineContent, sectionText, true)
        : buildContentPrompt(cardTitle, detailLevel, inlineContent, sectionText, true);
      // Append native PDF section hint when section extraction wasn't possible via regex
      const finalPrompt = synthesisPrompt + nativePdfSectionHint;

      const systemRole = isCover
        ? 'You are an expert cover slide content designer. You create bold, concise titles, subtitles, and taglines for presentation cover slides. Follow the format and word count requirements precisely.'
        : 'You are an expert content synthesizer. You extract, restructure, and condense document content into infographic-ready text. Follow the formatting and word count requirements precisely.';

      try {
        const systemBlocks: Array<{ text: string; cache: boolean }> = [{ text: systemRole, cache: false }];
        // Only inline docs (no fileId) go into system blocks — avoids double-sending
        if (inlineDocs.length > 0) {
          systemBlocks.push({ text: `FULL DOCUMENT CONTEXT:\n${inlineContent}`, cache: true });
        }

        // Build messages array with Files API document blocks prepended
        const messages: Array<{ role: 'user' | 'assistant'; content: any }> = [];
        if (fileApiDocs.length > 0) {
          const docBlocks = fileApiDocs.map((d) => ({
            type: 'document' as const,
            source: { type: 'file' as const, file_id: d.fileId! },
            title: d.name,
          }));
          // Inject bookmark-based TOC into system prompt for native PDFs
          for (const d of fileApiDocs) {
            if (d.sourceType === 'native-pdf' && d.bookmarks?.length) {
              const tocPrompt = buildTocSystemPrompt(d.bookmarks, d.name);
              if (tocPrompt) systemBlocks.push({ text: tocPrompt, cache: true });
            }
          }
          messages.push({
            role: 'user' as const,
            content: [...docBlocks, { type: 'text' as const, text: finalPrompt }],
          });
        }

        const { text: rawSynthesized, usage: claudeUsage } = await callClaude(
          fileApiDocs.length > 0 ? '' : finalPrompt,
          {
            systemBlocks,
            ...(fileApiDocs.length > 0 ? { messages } : {}),
            maxTokens: isCover
              ? detailLevel === 'TakeawayCard'
                ? 350
                : 256
              : detailLevel === 'Executive'
                ? 300
                : detailLevel === 'Standard'
                  ? 600
                  : 1200,
          },
        );

        recordUsage({
          provider: 'claude',
          model: 'claude-sonnet-4-6',
          inputTokens: claudeUsage.input_tokens,
          outputTokens: claudeUsage.output_tokens,
          cacheReadTokens: claudeUsage.cache_read_input_tokens,
          cacheWriteTokens: claudeUsage.cache_creation_input_tokens,
        });

        let synthesizedText = rawSynthesized;
        if (!isCover) {
          // Strip any leading H1 that Claude may have included, then re-add with the correct title
          synthesizedText = synthesizedText.replace(/^\s*#\s+[^\n]*\n*/, '');
          synthesizedText = `# ${cardTitle}\n\n${synthesizedText.trimStart()}`;
        }

        // Create a new card with the synthesized content
        const newCardId = `card-${Math.random().toString(36).substr(2, 9)}`;
        const cardSourceDocs = sourceDocName ? [sourceDocName] : enabledDocs.map((d) => d.name);
        const uniqueCardName = getUniqueName(
          cardTitle,
          selectedNugget.cards.map((c) => c.text),
        );

        const newCard: Card = {
          id: newCardId,
          text: uniqueCardName,
          level: 1,
          selected: false,
          synthesisMap: { [detailLevel]: synthesizedText },
          isSynthesizingMap: {},
          detailLevel,
          createdAt: Date.now(),
          sourceDocuments: cardSourceDocs,
        };

        // Add card to nugget
        updateNugget(selectedNugget.id, (n) => ({
          ...n,
          cards: [...n.cards, newCard],
          lastModifiedAt: Date.now(),
        }));

        // Select the new card
        setActiveCardId(newCardId);
      } catch (err) {
        console.error('Generate card content failed:', err);
      } finally {
        setGeneratingSourceIds((prev) => {
          const next = new Set(prev);
          next.delete(_editorCardId);
          return next;
        });
      }
    },
    [selectedNugget, updateNugget, setActiveCardId, recordUsage],
  );

  // ── Document save ──

  const handleSaveDocument = useCallback(
    async (docId: string, newContent: string) => {
      if (!selectedNugget) return;
      const doc = selectedNugget.documents.find((d) => d.id === docId);
      if (!doc) return;
      // Re-upload to Files API with updated content
      let fileId = doc.fileId;
      try {
        if (doc.fileId) deleteFromFilesAPI(doc.fileId);
        fileId = await uploadToFilesAPI(newContent, doc.name, 'text/plain');
      } catch (err) {
        console.warn('[App] Files API re-upload failed (will use inline fallback):', err);
      }
      updateNuggetDocument(docId, {
        ...doc,
        content: newContent,
        fileId,
        lastEditedAt: Date.now(),
        version: (doc.version ?? 1) + 1,
      });
    },
    [selectedNugget, updateNuggetDocument],
  );

  // ── Save TOC / bookmark changes ──

  const handleSaveToc = useCallback(
    async (docId: string, newStructure: Heading[]) => {
      if (!selectedNugget) return;
      const doc = selectedNugget.documents.find((d) => d.id === docId);
      if (!doc) return;

      // Convert flat headings to bookmark tree if this is a native PDF
      const newBookmarks = doc.sourceType === 'native-pdf' ? headingsToBookmarks(newStructure) : undefined;

      // Write bookmarks into the PDF for export if available
      let newPdfBase64 = doc.pdfBase64;
      if (newBookmarks && newBookmarks.length > 0 && doc.pdfBase64) {
        try {
          newPdfBase64 = await writeBookmarksToPdf(doc.pdfBase64, newBookmarks);
        } catch (err) {
          console.warn('[App] Failed to write bookmarks into PDF:', err);
        }
      }

      // Update document in nugget state
      updateNuggetDocument(docId, {
        ...doc,
        structure: newStructure,
        bookmarks: newBookmarks ?? doc.bookmarks,
        bookmarkSource: newBookmarks ? ('manual' as const) : doc.bookmarkSource,
        pdfBase64: newPdfBase64,
        version: (doc.version ?? 1) + 1,
      });

      // Log TOC update for chat notification
      updateNugget(selectedNugget.id, (n) => ({
        ...n,
        docChangeLog: [
          ...(n.docChangeLog || []),
          {
            type: 'toc_updated' as const,
            docId,
            docName: doc.name,
            timestamp: Date.now(),
          },
        ],
        lastModifiedAt: Date.now(),
      }));
    },
    [selectedNugget, updateNuggetDocument, updateNugget],
  );

  // ── Copy/move document ──

  const handleCopyMoveDocument = useCallback(
    async (docId: string, targetNuggetId: string, mode: 'copy' | 'move') => {
      if (!selectedNugget) return;
      const doc = selectedNugget.documents.find((d) => d.id === docId);
      if (!doc) return;
      // Auto-increment name if it collides in target nugget
      const targetNugget = nuggets.find((n) => n.id === targetNuggetId);
      const targetDocNames = targetNugget ? targetNugget.documents.map((d) => d.name) : [];
      const uniqueDocName = getUniqueName(doc.name, targetDocNames, true);
      // Copy the document to the target nugget with a new ID
      const newDocId = `doc-${Math.random().toString(36).substr(2, 9)}`;
      // Upload the copy to Files API so it has its own file_id
      let copyFileId: string | undefined;
      try {
        if (doc.sourceType === 'native-pdf' && doc.pdfBase64) {
          copyFileId = await uploadToFilesAPI(
            base64ToBlob(doc.pdfBase64, 'application/pdf'),
            uniqueDocName,
            'application/pdf',
          );
        } else if (doc.content) {
          copyFileId = await uploadToFilesAPI(doc.content, uniqueDocName, 'text/plain');
        }
      } catch (err) {
        console.warn('[App] Files API upload for document copy failed:', err);
      }
      // Derive source project name for origin tracking
      const sourceProject = projects.find((p) => p.nuggetIds.includes(selectedNugget.id));
      const docCopy: UploadedFile = {
        ...doc,
        id: newDocId,
        name: uniqueDocName,
        fileId: copyFileId,
        originalName: doc.originalName ?? doc.name,
        sourceOrigin: {
          type: mode === 'copy' ? 'copied' : 'moved',
          sourceProjectName: sourceProject?.name,
          sourceNuggetName: selectedNugget.name,
          timestamp: Date.now(),
        },
        createdAt: Date.now(),
        version: 1,
        lastEditedAt: undefined,
        lastRenamedAt: undefined,
        lastEnabledAt: undefined,
        lastDisabledAt: undefined,
      };
      // Add to target nugget
      updateNugget(targetNuggetId, (n) => ({
        ...n,
        documents: [...n.documents, docCopy],
        lastModifiedAt: Date.now(),
      }));
      // If move, also remove from source nugget (and delete the original's Files API file)
      if (mode === 'move') {
        if (doc.fileId) deleteFromFilesAPI(doc.fileId);
        removeNuggetDocument(docId);
      }
    },
    [selectedNugget, nuggets, projects, updateNugget, removeNuggetDocument],
  );

  // ── Create nugget with document ──

  const handleCreateNuggetWithDoc = useCallback(
    async (nuggetName: string, docId: string) => {
      if (!selectedNugget) return;
      const doc = selectedNugget.documents.find((d) => d.id === docId);
      if (!doc) return;
      // Auto-increment nugget name within the same project
      const sourceProject = projects.find((p) => p.nuggetIds.includes(selectedNugget.id));
      const projectNuggetNames = sourceProject
        ? sourceProject.nuggetIds.map((nid) => nuggets.find((n) => n.id === nid)?.name || '').filter(Boolean)
        : nuggets.map((n) => n.name);
      const uniqueNuggetName = getUniqueName(nuggetName, projectNuggetNames);
      const newDocId = `doc-${Math.random().toString(36).substr(2, 9)}`;
      // Upload the copy to Files API so it has its own file_id
      let copyFileId: string | undefined;
      try {
        if (doc.sourceType === 'native-pdf' && doc.pdfBase64) {
          copyFileId = await uploadToFilesAPI(
            base64ToBlob(doc.pdfBase64, 'application/pdf'),
            doc.name,
            'application/pdf',
          );
        } else if (doc.content) {
          copyFileId = await uploadToFilesAPI(doc.content, doc.name, 'text/plain');
        }
      } catch (err) {
        console.warn('[App] Files API upload for new nugget doc copy failed:', err);
      }
      const docCopy: UploadedFile = {
        ...doc,
        id: newDocId,
        fileId: copyFileId,
        originalName: doc.originalName ?? doc.name,
        sourceOrigin: {
          type: 'copied',
          sourceProjectName: sourceProject?.name,
          sourceNuggetName: selectedNugget.name,
          timestamp: Date.now(),
        },
        createdAt: Date.now(),
        version: 1,
        lastEditedAt: undefined,
        lastRenamedAt: undefined,
        lastEnabledAt: undefined,
        lastDisabledAt: undefined,
      };
      const newNugget: Nugget = {
        id: `nugget-${Math.random().toString(36).substr(2, 9)}`,
        name: uniqueNuggetName,
        type: 'insights',
        documents: [docCopy],
        cards: [],
        messages: [],
        createdAt: Date.now(),
        lastModifiedAt: Date.now(),
      };
      addNugget(newNugget);
      // Add to same project as the source nugget
      if (sourceProject) {
        addNuggetToProject(sourceProject.id, newNugget.id);
      }
    },
    [selectedNugget, projects, nuggets, addNugget, addNuggetToProject],
  );

  // ── PDF choice dialog ──

  const askPdfChoice = useCallback(
    (fileName: string, pdfCount?: number): Promise<'markdown' | 'native-pdf' | 'cancel'> => {
      return new Promise((resolve) => {
        pdfChoiceResolverRef.current = resolve;
        setPdfChoiceDialog({ fileName, pdfCount });
      });
    },
    [],
  );

  // ── Upload documents ──

  const handleUploadDocuments = useCallback(
    async (files: FileList) => {
      const needsSubject = !selectedNugget?.subject;
      const batchDocIds: string[] = [];
      const currentDocNames = [...(selectedNugget?.documents || []).map((d) => d.name)];
      const allFiles = Array.from(files);

      // Separate PDFs and non-PDFs
      const pdfFiles = allFiles.filter((f) => f.name.endsWith('.pdf') || f.type === 'application/pdf');
      const mdFiles = allFiles.filter((f) => !f.name.endsWith('.pdf') && f.type !== 'application/pdf');

      // Ask once for all PDFs in the batch
      let pdfChoice: 'markdown' | 'native-pdf' | 'cancel' | null = null;
      if (pdfFiles.length > 0) {
        pdfChoice = await askPdfChoice(pdfFiles[0].name, pdfFiles.length);
      }

      // Process PDFs (if not cancelled)
      if (pdfChoice && pdfChoice !== 'cancel') {
        for (const file of pdfFiles) {
          const uniqueName = getUniqueName(file.name, currentDocNames, true);
          currentDocNames.push(uniqueName);

          const placeholder = createPlaceholderDocument(file);
          placeholder.name = uniqueName;
          addNuggetDocument(placeholder);
          if (needsSubject) batchDocIds.push(placeholder.id);

          if (pdfChoice === 'native-pdf') {
            (async () => {
              try {
                // processNativePdf now handles bookmark-first extraction internally
                const nativePdf = await processNativePdf(file, placeholder.id);
                // Upload PDF to Files API
                let pdfFileId: string | undefined;
                try {
                  pdfFileId = await uploadToFilesAPI(
                    base64ToBlob(nativePdf.pdfBase64!, 'application/pdf'),
                    uniqueName,
                    'application/pdf',
                  );
                } catch (err) {
                  console.warn('[App] Native PDF Files API upload failed:', err);
                }
                updateNuggetDocument(placeholder.id, {
                  ...nativePdf,
                  name: uniqueName,
                  fileId: pdfFileId,
                });
              } catch (err) {
                console.error('[App] Native PDF processing failed:', err);
                updateNuggetDocument(placeholder.id, { ...placeholder, status: 'error' as const });
                addToast({
                  type: 'error',
                  message: `Failed to process "${uniqueName}"`,
                  detail: err instanceof Error ? err.message : 'An unexpected error occurred while processing the PDF.',
                  duration: 10000,
                });
              }
            })();
          } else {
            // markdown conversion
            processFileToDocument(file, placeholder.id)
              .then(async (processed) => {
                let fileId: string | undefined;
                if (processed.content) {
                  try {
                    fileId = await uploadToFilesAPI(processed.content, uniqueName, 'text/plain');
                  } catch (err) {
                    console.warn('[App] Files API upload failed (will use inline fallback):', err);
                  }
                }
                updateNuggetDocument(placeholder.id, { ...processed, name: uniqueName, fileId });
              })
              .catch((err) => {
                updateNuggetDocument(placeholder.id, { ...placeholder, status: 'error' as const });
                addToast({
                  type: 'error',
                  message: `Failed to convert "${uniqueName}" to markdown`,
                  detail: err instanceof Error ? err.message : 'The document could not be processed.',
                  duration: 10000,
                });
              });
          }
        }
      }

      // Process markdown files (no dialog needed)
      for (const file of mdFiles) {
        const uniqueName = getUniqueName(file.name, currentDocNames, true);
        currentDocNames.push(uniqueName);

        const placeholder = createPlaceholderDocument(file);
        placeholder.name = uniqueName;
        addNuggetDocument(placeholder);
        if (needsSubject) batchDocIds.push(placeholder.id);

        processFileToDocument(file, placeholder.id)
          .then(async (processed) => {
            let fileId: string | undefined;
            if (processed.content) {
              try {
                fileId = await uploadToFilesAPI(processed.content, uniqueName, 'text/plain');
              } catch (err) {
                console.warn('[App] Files API upload failed (will use inline fallback):', err);
              }
            }
            updateNuggetDocument(placeholder.id, { ...processed, name: uniqueName, fileId });
          })
          .catch((err) => {
            updateNuggetDocument(placeholder.id, { ...placeholder, status: 'error' as const });
            addToast({
              type: 'error',
              message: `Failed to process "${uniqueName}"`,
              detail: err instanceof Error ? err.message : 'The document could not be processed.',
              duration: 10000,
            });
          });
      }

      // Trigger subject auto-generation for first upload batch
      if (needsSubject && batchDocIds.length > 0 && selectedNugget) {
        onSubjectGenPending(selectedNugget.id, batchDocIds);
      }
    },
    [selectedNugget, addNuggetDocument, updateNuggetDocument, askPdfChoice, addToast, onSubjectGenPending],
  );

  return {
    // PDF choice dialog
    pdfChoiceDialog,
    pdfChoiceResolverRef,
    setPdfChoiceDialog,
    // Source generation spinner
    generatingSourceIds,
    // TOC lock
    tocLockActive,
    setTocLockActive,
    // Callbacks
    handleGenerateCardContent,
    handleSaveDocument,
    handleSaveToc,
    handleCopyMoveDocument,
    handleCreateNuggetWithDoc,
    askPdfChoice,
    handleUploadDocuments,
  };
}
