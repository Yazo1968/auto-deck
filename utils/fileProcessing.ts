
import { UploadedFile } from '../types';
import { callClaude } from './ai';
import { DOCUMENT_ANALYSIS_PROMPT, DOCX_TEXT_ANALYSIS_PROMPT } from './prompts/documentAnalysis';
import { parseMarkdownStructure } from './markdown';
import { extractDocxText } from './docx';

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

/**
 * Full conversion pipeline: MD (passthrough), DOCX (JSZip + Claude), PDF (Claude document block).
 * @param id - Optional ID to reuse (e.g. from a placeholder created via createPlaceholderDocument)
 */
export async function processFileToDocument(file: File, id?: string): Promise<UploadedFile> {
  const isMd = file.name.endsWith('.md') || file.type === 'text/markdown';
  const isDocx = file.name.endsWith('.docx') || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const isPdf = file.name.endsWith('.pdf') || file.type === 'application/pdf';

  let markdown = '';
  if (isMd) {
    markdown = await file.text();
  } else if (isDocx) {
    try {
      const rawText = await extractDocxText(file);
      console.debug(`[FileProcessing] DOCX extracted (${rawText.length} chars), sending to Claude…`);
      markdown = await callClaude(DOCX_TEXT_ANALYSIS_PROMPT + '\n\n---\n\n' + rawText);
    } catch (err) {
      console.error(`[FileProcessing] DOCX conversion failed for "${file.name}":`, err);
      throw err;
    }
  } else if (isPdf) {
    try {
      const base64 = await fileToBase64(file);
      console.debug(`[FileProcessing] PDF base64 ready (${base64.length} chars), sending to Claude…`);
      markdown = await callClaude(
        DOCUMENT_ANALYSIS_PROMPT,
        { document: { base64, mediaType: 'application/pdf' } }
      );
    } catch (err) {
      console.error(`[FileProcessing] PDF conversion failed for "${file.name}":`, err);
      throw err;
    }
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
  };
}
