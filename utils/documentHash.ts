import type { UploadedFile } from '../types';

/**
 * Compute a simple hash of the active document set.
 * Used to detect when documents have changed between API calls.
 * Not cryptographic — just a fast comparison hash.
 */
export function computeDocumentHash(documents: UploadedFile[]): string {
  const activeDocs = documents
    .filter((doc) => (doc.content || doc.fileId) && doc.enabled !== false)
    .sort((a, b) => a.id.localeCompare(b.id));

  if (activeDocs.length === 0) return '0';

  const payload = activeDocs.map((doc) => `${doc.id}:${doc.name}:${doc.content || doc.fileId || ''}`).join('|');

  // djb2 hash — simple, fast, good distribution
  let hash = 5381;
  for (let i = 0; i < payload.length; i++) {
    hash = ((hash << 5) + hash + payload.charCodeAt(i)) | 0;
  }
  return hash.toString(36);
}
