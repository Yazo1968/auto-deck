import { describe, it, expect } from 'vitest';
import { computeDocumentHash } from '../../utils/documentHash';
import type { UploadedFile } from '../../types';

function makeDoc(overrides: Partial<UploadedFile> = {}): UploadedFile {
  return {
    id: 'doc-1',
    name: 'test.md',
    size: 100,
    type: 'text/markdown',
    lastModified: Date.now(),
    content: 'Hello world',
    status: 'ready',
    progress: 100,
    ...overrides,
  };
}

describe('computeDocumentHash', () => {
  it('returns "0" for an empty document list', () => {
    expect(computeDocumentHash([])).toBe('0');
  });

  it('returns "0" when all documents lack content and fileId', () => {
    const doc = makeDoc({ content: undefined, fileId: undefined });
    expect(computeDocumentHash([doc])).toBe('0');
  });

  it('returns "0" when all documents are disabled', () => {
    const doc = makeDoc({ enabled: false });
    expect(computeDocumentHash([doc])).toBe('0');
  });

  it('returns a deterministic hash for the same documents', () => {
    const doc = makeDoc();
    const hash1 = computeDocumentHash([doc]);
    const hash2 = computeDocumentHash([doc]);
    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe('0');
  });

  it('returns the same hash regardless of document order', () => {
    const doc1 = makeDoc({ id: 'a', name: 'a.md', content: 'AAA' });
    const doc2 = makeDoc({ id: 'b', name: 'b.md', content: 'BBB' });
    const hash1 = computeDocumentHash([doc1, doc2]);
    const hash2 = computeDocumentHash([doc2, doc1]);
    expect(hash1).toBe(hash2);
  });

  it('changes hash when document content changes', () => {
    const doc = makeDoc({ content: 'version1' });
    const hash1 = computeDocumentHash([doc]);
    const doc2 = makeDoc({ content: 'version2' });
    const hash2 = computeDocumentHash([doc2]);
    expect(hash1).not.toBe(hash2);
  });

  it('includes documents with fileId even without content', () => {
    const doc = makeDoc({ content: undefined, fileId: 'files-api-123' });
    const hash = computeDocumentHash([doc]);
    expect(hash).not.toBe('0');
  });
});
