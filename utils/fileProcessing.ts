import { BookmarkSource, Heading, UploadedFile } from '../types';
import { getGeminiAI, withGeminiRetry } from './ai';
import { parseMarkdownStructure } from './markdown';
import { loadPdfjs } from './pdfLoader';
import { extractBookmarksFromPdf, flattenBookmarks, headingsToBookmarks } from './pdfBookmarks';
import { HEADING_EXTRACTION_PROMPT, PDF_CONVERSION_PROMPT } from './prompts/documentConversion';

// ── Helpers ──

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
  });
}

/**
 * Create a placeholder UploadedFile immediately from a File object.
 * Shows in the UI right away while the actual conversion runs.
 */
export function createPlaceholderDocument(file: File): UploadedFile {
  return {
    id: Math.random().toString(36).substr(2, 9),
    name: file.name,
    size: file.size,
    type: file.type,
    lastModified: file.lastModified,
    status: 'processing',
    progress: 0,
  };
}

// ── Gemini PDF Conversion ──

/**
 * Convert a PDF to well-structured Markdown via Gemini Flash.
 * Handles text, tables, charts (→ markdown tables), diagrams (→ descriptions).
 */
async function convertPdfWithGemini(file: File): Promise<string> {
  const base64 = await fileToBase64(file);
  console.debug(`[FileProcessing] PDF base64 ready (${base64.length} chars), sending to Gemini Flash…`);

  const response = await withGeminiRetry(async () => {
    const ai = await getGeminiAI();
    return await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        { parts: [{ inlineData: { data: base64, mimeType: 'application/pdf' } }, { text: PDF_CONVERSION_PROMPT }] },
      ],
      config: { httpOptions: { timeout: 300000 } },
    });
  });

  // Filter out thinking parts (Gemini 2.5 may include thought tokens)
  const text =
    response.candidates?.[0]?.content?.parts
      ?.filter((p: any) => p.text && !p.thought)
      .map((p: any) => p.text)
      .join('') || '';

  console.debug(`[FileProcessing] Gemini conversion complete (${text.length} chars)`);
  return text;
}

// ── Main Conversion Pipeline ──

/**
 * Full conversion pipeline:
 * - MD: passthrough (read text directly, no API call)
 * - PDF: converted to Markdown via Gemini Flash
 */
export async function processFileToDocument(file: File, id?: string): Promise<UploadedFile> {
  const isMd = file.name.endsWith('.md') || file.type === 'text/markdown';
  const isPdf = file.name.endsWith('.pdf') || file.type === 'application/pdf';

  let markdown = '';

  if (isMd) {
    markdown = await file.text();
  } else if (isPdf) {
    markdown = await convertPdfWithGemini(file);
  } else {
    throw new Error(`Unsupported file type: ${file.name}`);
  }

  const structure = parseMarkdownStructure(markdown);

  return {
    id: id ?? Math.random().toString(36).substr(2, 9),
    name: file.name,
    size: file.size,
    type: file.type,
    lastModified: file.lastModified,
    content: markdown,
    structure,
    status: 'ready',
    progress: 100,
    originalFormat: isMd ? 'md' : 'pdf',
    createdAt: Date.now(),
    originalName: file.name,
    version: 1,
    sourceOrigin: { type: 'uploaded' as const, timestamp: Date.now() },
  };
}

// ── Native PDF path (no markdown conversion) ──

/**
 * Process a PDF for native storage (no markdown conversion).
 * Bookmark-first extraction: tries pdf.js getOutline() first (free & instant),
 * falls back to Gemini heading extraction if no bookmarks found.
 */
export async function processNativePdf(file: File, id?: string): Promise<UploadedFile> {
  const base64 = await fileToBase64(file);
  console.debug(`[FileProcessing] Native PDF base64 ready: ${file.name} (${base64.length} chars)`);

  // Attempt bookmark-first extraction via pdf.js
  let bookmarkSource: BookmarkSource = 'manual';
  let bookmarks: import('../types').BookmarkNode[] = [];

  try {
    const pdfjsLib = await loadPdfjs();
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const pdfDoc = await pdfjsLib.getDocument({ data: bytes }).promise;

    bookmarks = await extractBookmarksFromPdf(pdfDoc);

    if (bookmarks.length > 0) {
      bookmarkSource = 'pdf_bookmarks';
      console.debug(`[FileProcessing] Extracted ${bookmarks.length} bookmarks from PDF outline: "${file.name}"`);
    } else {
      // No embedded bookmarks — fall back to Gemini
      console.debug(`[FileProcessing] No PDF bookmarks found, falling back to Gemini extraction: "${file.name}"`);
      const headings = await extractHeadingsWithGemini(file);
      if (headings.length > 0) {
        bookmarks = headingsToBookmarks(headings);
        bookmarkSource = 'ai_generated';
      }
    }

    pdfDoc.destroy();
  } catch (err) {
    console.warn('[FileProcessing] Bookmark extraction failed, continuing without bookmarks:', err);
  }

  // Build flat structure for backward compat
  const structure = flattenBookmarks(bookmarks);

  return {
    id: id ?? Math.random().toString(36).substr(2, 9),
    name: file.name,
    size: file.size,
    type: file.type,
    lastModified: file.lastModified,
    sourceType: 'native-pdf',
    pdfBase64: base64,
    bookmarks,
    bookmarkSource,
    structure,
    status: 'ready',
    progress: 100,
    createdAt: Date.now(),
    originalName: file.name,
    version: 1,
    sourceOrigin: { type: 'uploaded' as const, timestamp: Date.now() },
  };
}

// ── Gemini Heading Extraction (for native PDF path) ──

/**
 * Extract heading/bookmark structure from a PDF via Gemini Flash.
 * Returns Heading[] with page numbers, or empty array on failure.
 * Used by the "Keep as PDF" upload path.
 */
export async function extractHeadingsWithGemini(file: File): Promise<Heading[]> {
  try {
    const base64 = await fileToBase64(file);
    console.debug(`[FileProcessing] Extracting headings via Gemini Flash for "${file.name}"…`);

    const response = await withGeminiRetry(async () => {
      const ai = await getGeminiAI();
      return await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            parts: [{ inlineData: { data: base64, mimeType: 'application/pdf' } }, { text: HEADING_EXTRACTION_PROMPT }],
          },
        ],
        config: { httpOptions: { timeout: 300000 } },
      });
    });

    // Filter out thinking parts (Gemini 2.5 may include thought tokens)
    const text =
      response.candidates?.[0]?.content?.parts
        ?.filter((p: any) => p.text && !p.thought)
        .map((p: any) => p.text)
        .join('') || '';

    console.debug(`[FileProcessing] Gemini heading response (${text.length} chars)`);

    // Parse JSON response — Gemini may wrap it in markdown fences
    const cleaned = text
      .replace(/```(?:json)?\s*/g, '')
      .replace(/```\s*/g, '')
      .trim();
    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);

    if (!arrayMatch) {
      console.warn('[FileProcessing] No heading array found in Gemini response. Raw:', text.substring(0, 500));
      return [];
    }

    const parsed = JSON.parse(arrayMatch[0]) as Array<{ level: number; title: string; page?: number }>;
    const headings: Heading[] = parsed.map((entry, i) => ({
      level: entry.level,
      text: entry.title,
      id: `h-${i}-${Math.random().toString(36).substr(2, 4)}`,
      selected: false,
      page: entry.page,
    }));

    console.debug(`[FileProcessing] Gemini heading extraction: ${headings.length} headings from "${file.name}"`);
    return headings;
  } catch (err) {
    console.warn('[FileProcessing] Gemini heading extraction failed, user can create bookmarks manually:', err);
    return [];
  }
}

// ── Utilities ──

/**
 * Convert a base64 string to a Blob. Useful for re-uploading native PDFs.
 */
export function base64ToBlob(base64: string, mimeType: string = 'application/pdf'): Blob {
  const byteChars = atob(base64);
  const byteNumbers = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteNumbers[i] = byteChars.charCodeAt(i);
  }
  return new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
}
