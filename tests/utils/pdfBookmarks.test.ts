import { describe, it, expect } from 'vitest';
import {
  flattenBookmarks,
  headingsToBookmarks,
  buildTocSystemPrompt,
  renameBookmark,
  deleteBookmark,
  addBookmark,
  indentBookmark,
  outdentBookmark,
  reorderBookmark,
} from '../../utils/pdfBookmarks';
import type { BookmarkNode, Heading } from '../../types';

function makeBookmark(overrides: Partial<BookmarkNode> = {}): BookmarkNode {
  return {
    id: crypto.randomUUID(),
    title: 'Chapter 1',
    page: 1,
    level: 1,
    children: [],
    ...overrides,
  };
}

describe('flattenBookmarks', () => {
  it('returns empty array for empty input', () => {
    expect(flattenBookmarks([])).toEqual([]);
  });

  it('flattens a single-level tree', () => {
    const bookmarks = [makeBookmark({ title: 'A', level: 1 }), makeBookmark({ title: 'B', level: 1 })];
    const result = flattenBookmarks(bookmarks);
    expect(result).toHaveLength(2);
    expect(result[0].text).toBe('A');
    expect(result[1].text).toBe('B');
  });

  it('flattens nested bookmarks preserving depth-first order', () => {
    const child = makeBookmark({ title: 'Section 1.1', level: 2 });
    const parent = makeBookmark({ title: 'Chapter 1', level: 1, children: [child] });
    const result = flattenBookmarks([parent]);
    expect(result).toHaveLength(2);
    expect(result[0].text).toBe('Chapter 1');
    expect(result[0].level).toBe(1);
    expect(result[1].text).toBe('Section 1.1');
    expect(result[1].level).toBe(2);
  });
});

describe('headingsToBookmarks', () => {
  it('returns empty array for empty input', () => {
    expect(headingsToBookmarks([])).toEqual([]);
  });

  it('creates flat structure for same-level headings', () => {
    const headings: Heading[] = [
      { level: 1, text: 'A', id: 'a' },
      { level: 1, text: 'B', id: 'b' },
    ];
    const result = headingsToBookmarks(headings);
    expect(result).toHaveLength(2);
    expect(result[0].title).toBe('A');
    expect(result[0].children).toHaveLength(0);
    expect(result[1].title).toBe('B');
  });

  it('nests deeper headings as children', () => {
    const headings: Heading[] = [
      { level: 1, text: 'Chapter 1', id: 'c1' },
      { level: 2, text: 'Section 1.1', id: 's1' },
      { level: 2, text: 'Section 1.2', id: 's2' },
      { level: 1, text: 'Chapter 2', id: 'c2' },
    ];
    const result = headingsToBookmarks(headings);
    expect(result).toHaveLength(2);
    expect(result[0].title).toBe('Chapter 1');
    expect(result[0].children).toHaveLength(2);
    expect(result[0].children[0].title).toBe('Section 1.1');
    expect(result[0].children[1].title).toBe('Section 1.2');
    expect(result[1].title).toBe('Chapter 2');
    expect(result[1].children).toHaveLength(0);
  });

  it('round-trips with flattenBookmarks', () => {
    const headings: Heading[] = [
      { level: 1, text: 'A', id: 'a', page: 1 },
      { level: 2, text: 'A.1', id: 'a1', page: 2 },
      { level: 3, text: 'A.1.1', id: 'a11', page: 3 },
      { level: 1, text: 'B', id: 'b', page: 10 },
    ];
    const bookmarks = headingsToBookmarks(headings);
    const flat = flattenBookmarks(bookmarks);
    expect(flat.map((h) => h.text)).toEqual(['A', 'A.1', 'A.1.1', 'B']);
    expect(flat.map((h) => h.level)).toEqual([1, 2, 3, 1]);
  });
});

describe('buildTocSystemPrompt', () => {
  it('returns empty string for empty bookmarks', () => {
    expect(buildTocSystemPrompt([], 'doc.pdf')).toBe('');
  });

  it('builds a formatted TOC string', () => {
    const bookmarks = [
      makeBookmark({ title: 'Intro', page: 1, level: 1, children: [] }),
      makeBookmark({
        title: 'Main',
        page: 5,
        level: 1,
        children: [makeBookmark({ title: 'Sub', page: 7, level: 2, children: [] })],
      }),
    ];
    const result = buildTocSystemPrompt(bookmarks, 'test.pdf', 20);
    expect(result).toContain('Table of Contents for "test.pdf" (20 pages)');
    expect(result).toContain('- Intro (page 1)');
    expect(result).toContain('- Main (page 5)');
    expect(result).toContain('  - Sub (page 7)');
  });
});

describe('tree manipulation', () => {
  it('renameBookmark changes title immutably', () => {
    const bm = makeBookmark({ id: 'x', title: 'Old Title' });
    const result = renameBookmark([bm], 'x', 'New Title');
    expect(result[0].title).toBe('New Title');
    expect(bm.title).toBe('Old Title'); // original unchanged
  });

  it('deleteBookmark removes the node by id', () => {
    const a = makeBookmark({ id: 'a', title: 'A' });
    const b = makeBookmark({ id: 'b', title: 'B' });
    const result = deleteBookmark([a, b], 'a');
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('B');
  });

  it('addBookmark appends to top level when parentId is null', () => {
    const a = makeBookmark({ id: 'a', title: 'A' });
    const result = addBookmark([a], null, 'New', 5, 1);
    expect(result).toHaveLength(2);
    expect(result[1].title).toBe('New');
    expect(result[1].page).toBe(5);
  });

  it('addBookmark nests under parent when parentId is given', () => {
    const parent = makeBookmark({ id: 'p', title: 'Parent', level: 1 });
    const result = addBookmark([parent], 'p', 'Child', 3, 2);
    expect(result[0].children).toHaveLength(1);
    expect(result[0].children[0].title).toBe('Child');
    expect(result[0].children[0].level).toBe(2);
  });

  it('reorderBookmark swaps siblings', () => {
    const a = makeBookmark({ id: 'a', title: 'A' });
    const b = makeBookmark({ id: 'b', title: 'B' });
    const result = reorderBookmark([a, b], 'b', 'up');
    expect(result[0].title).toBe('B');
    expect(result[1].title).toBe('A');
  });

  it('indentBookmark makes node a child of previous sibling', () => {
    const a = makeBookmark({ id: 'a', title: 'A', level: 1 });
    const b = makeBookmark({ id: 'b', title: 'B', level: 1 });
    const result = indentBookmark([a, b], 'b');
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('A');
    expect(result[0].children).toHaveLength(1);
    expect(result[0].children[0].title).toBe('B');
    expect(result[0].children[0].level).toBe(2);
  });

  it('indentBookmark is no-op for the first sibling', () => {
    const a = makeBookmark({ id: 'a', title: 'A', level: 1 });
    const b = makeBookmark({ id: 'b', title: 'B', level: 1 });
    const result = indentBookmark([a, b], 'a');
    expect(result).toHaveLength(2);
    expect(result[0].title).toBe('A');
  });

  it('outdentBookmark moves node to parent level', () => {
    const child = makeBookmark({ id: 'c', title: 'Child', level: 2 });
    const parent = makeBookmark({ id: 'p', title: 'Parent', level: 1, children: [child] });
    const result = outdentBookmark([parent], 'c');
    expect(result).toHaveLength(2);
    expect(result[0].title).toBe('Parent');
    expect(result[0].children).toHaveLength(0);
    expect(result[1].title).toBe('Child');
    expect(result[1].level).toBe(1);
  });
});
