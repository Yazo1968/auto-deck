
import { useState, useCallback, useRef, useEffect } from 'react';

// Inline styles — Tailwind CDN can't do opacity variants on custom colors
const MARK_ACTIVE = 'background-color:rgba(204,255,0,0.55);border-radius:2px;padding:1px 0;color:inherit;';
const MARK_INACTIVE = 'background-color:rgba(250,204,21,0.35);border-radius:2px;padding:1px 0;color:inherit;';

/**
 * Standalone find/replace hook that accepts refs as parameters
 * instead of reading them from AppContext.
 * (Identical logic to useFindReplace, decoupled from context.)
 */
export function useDocumentFindReplace(
  editorRef: React.RefObject<HTMLDivElement | null>,
  scrollContainerRef: React.RefObject<HTMLDivElement | null>,
  editorObserverRef: React.MutableRefObject<MutationObserver | null>,
) {
  // ── State ──
  const [showFind, setShowFind] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [findMatchCount, setFindMatchCount] = useState(0);
  const [findActiveIndex, setFindActiveIndex] = useState(0);
  const [findMatchCase, setFindMatchCase] = useState(false);
  const findInputRef = useRef<HTMLInputElement>(null);

  // ── Refs for latest values (avoids stale closures in imperative calls) ──
  const findQueryRef = useRef(findQuery);
  const findMatchCaseRef = useRef(findMatchCase);
  const findActiveIndexRef = useRef(findActiveIndex);
  const findMatchCountRef = useRef(findMatchCount);
  findQueryRef.current = findQuery;
  findMatchCaseRef.current = findMatchCase;
  findActiveIndexRef.current = findActiveIndex;
  findMatchCountRef.current = findMatchCount;

  // ── Observer pause/resume ──
  const withObserverPaused = useCallback(<T,>(fn: () => T): T => {
    const observer = editorObserverRef.current;
    const editor = editorRef.current;
    if (observer) observer.disconnect();
    const result = fn();
    if (observer && editor) {
      observer.observe(editor, { childList: true, subtree: true, characterData: true });
    }
    return result;
  }, [editorObserverRef, editorRef]);

  // ── Low-level DOM helpers ──

  const clearMarks = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const marks = editor.querySelectorAll('mark[data-find]');
    marks.forEach(mark => {
      const parent = mark.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(mark.textContent || ''), mark);
        parent.normalize();
      }
    });
  }, [editorRef]);

  const scrollToMark = useCallback((mark: HTMLElement) => {
    const scrollParent = scrollContainerRef.current;
    if (!mark || !scrollParent) return;
    const containerRect = scrollParent.getBoundingClientRect();
    const markRect = mark.getBoundingClientRect();
    if (markRect.top < containerRect.top || markRect.bottom > containerRect.bottom) {
      scrollParent.scrollTo({
        top: markRect.top - containerRect.top + scrollParent.scrollTop - 100,
        behavior: 'smooth',
      });
    }
  }, [scrollContainerRef]);

  // ── Core: inject marks into editor DOM ──
  const injectMarks = useCallback((query: string, activeIdx: number, matchCase: boolean): number => {
    const editor = editorRef.current;
    if (!editor || !query) return 0;

    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null);
    const textNodes: Text[] = [];
    let node: Node | null;
    while ((node = walker.nextNode())) {
      if ((node as Text).parentElement?.closest('[data-find-bar]')) continue;
      textNodes.push(node as Text);
    }

    const cmpQuery = matchCase ? query : query.toLowerCase();
    let count = 0;

    for (const textNode of textNodes) {
      const text = textNode.textContent || '';
      const cmpText = matchCase ? text : text.toLowerCase();
      let idx = cmpText.indexOf(cmpQuery);
      if (idx === -1) continue;

      const frag = document.createDocumentFragment();
      let last = 0;

      while (idx !== -1) {
        if (idx > last) frag.appendChild(document.createTextNode(text.slice(last, idx)));

        const mark = document.createElement('mark');
        mark.setAttribute('data-find', 'true');
        mark.textContent = text.slice(idx, idx + query.length);
        mark.setAttribute('style', count === activeIdx ? MARK_ACTIVE : MARK_INACTIVE);
        if (count === activeIdx) mark.setAttribute('data-find-active', 'true');
        frag.appendChild(mark);

        count++;
        last = idx + query.length;
        idx = cmpText.indexOf(cmpQuery, last);
      }

      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      textNode.parentNode?.replaceChild(frag, textNode);
    }

    return count;
  }, [editorRef]);

  // ── Rebuild: clear + inject + scroll (all inside observer pause) ──
  const rebuild = useCallback((query?: string, activeIdx?: number, matchCase?: boolean) => {
    const q = query ?? findQueryRef.current;
    const idx = activeIdx ?? findActiveIndexRef.current;
    const mc = matchCase ?? findMatchCaseRef.current;

    const count = withObserverPaused(() => {
      clearMarks();
      if (!q) return 0;
      return injectMarks(q, idx, mc);
    });

    setFindMatchCount(count);
    if (idx >= count && count > 0) {
      setFindActiveIndex(0);
      withObserverPaused(() => {
        clearMarks();
        injectMarks(q, 0, mc);
      });
    }

    if (count > 0) {
      const editor = editorRef.current;
      const activeMark = editor?.querySelector('mark[data-find-active]') as HTMLElement;
      if (activeMark) requestAnimationFrame(() => scrollToMark(activeMark));
    }

    return count;
  }, [withObserverPaused, clearMarks, injectMarks, scrollToMark, editorRef]);

  // ── Lightweight: just swap styles on existing marks ──
  const swapActive = useCallback((activeIdx: number) => {
    const editor = editorRef.current;
    if (!editor) return;
    const marks = Array.from(editor.querySelectorAll('mark[data-find]')) as HTMLElement[];
    if (marks.length === 0) return;

    for (let i = 0; i < marks.length; i++) {
      if (i === activeIdx) {
        marks[i].setAttribute('style', MARK_ACTIVE);
        marks[i].setAttribute('data-find-active', 'true');
      } else {
        marks[i].setAttribute('style', MARK_INACTIVE);
        marks[i].removeAttribute('data-find-active');
      }
    }

    if (activeIdx >= 0 && activeIdx < marks.length) {
      requestAnimationFrame(() => scrollToMark(marks[activeIdx]));
    }
  }, [editorRef, scrollToMark]);

  // ── Effects ──

  useEffect(() => {
    if (!editorRef.current || !showFind || !findQuery) {
      withObserverPaused(() => clearMarks());
      setFindMatchCount(0);
      return;
    }
    const timeout = setTimeout(() => {
      rebuild(findQuery, findActiveIndex, findMatchCase);
    }, 80);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [findQuery, findMatchCase, showFind]);

  useEffect(() => {
    if (!editorRef.current || !showFind || !findQuery) return;
    swapActive(findActiveIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [findActiveIndex]);

  // ── Actions ──

  const findNext = useCallback(() => {
    const count = findMatchCountRef.current;
    if (count === 0) return;
    setFindActiveIndex(prev => (prev + 1) % count);
  }, []);

  const findPrev = useCallback(() => {
    const count = findMatchCountRef.current;
    if (count === 0) return;
    setFindActiveIndex(prev => (prev - 1 + count) % count);
  }, []);

  const closeFindBar = useCallback(() => {
    withObserverPaused(() => clearMarks());
    setShowFind(false);
    setFindQuery('');
    setReplaceQuery('');
    setFindActiveIndex(0);
    setFindMatchCount(0);
  }, [withObserverPaused, clearMarks]);

  const handleReplace = useCallback(() => {
    if (!editorRef.current) return;
    const query = findQueryRef.current;
    const mc = findMatchCaseRef.current;
    if (!query) return;

    const editor = editorRef.current;
    const marks = Array.from(editor.querySelectorAll('mark[data-find]')) as HTMLElement[];
    const idx = findActiveIndexRef.current;
    if (idx < 0 || idx >= marks.length) return;

    const activeMark = marks[idx];
    if (!activeMark.parentNode) return;

    const newCount = withObserverPaused(() => {
      activeMark.parentNode!.replaceChild(document.createTextNode(replaceQuery), activeMark);
      activeMark.parentNode?.normalize();
      clearMarks();
      const nextIdx = Math.min(idx, Math.max(0, marks.length - 2));
      return injectMarks(query, nextIdx, mc);
    });

    setFindMatchCount(newCount);
    const newIdx = newCount > 0 ? Math.min(idx, newCount - 1) : 0;
    setFindActiveIndex(newIdx);

    if (newCount > 0) {
      const newActive = editor.querySelector('mark[data-find-active]') as HTMLElement;
      if (newActive) requestAnimationFrame(() => scrollToMark(newActive));
    }
  }, [editorRef, replaceQuery, withObserverPaused, clearMarks, injectMarks, scrollToMark]);

  const handleReplaceAll = useCallback(() => {
    if (!editorRef.current) return;
    const query = findQueryRef.current;
    if (!query) return;

    const editor = editorRef.current;
    const marks = Array.from(editor.querySelectorAll('mark[data-find]')) as HTMLElement[];
    if (marks.length === 0) return;

    withObserverPaused(() => {
      for (let i = marks.length - 1; i >= 0; i--) {
        const mark = marks[i];
        if (!mark.parentNode) continue;
        mark.parentNode.replaceChild(document.createTextNode(replaceQuery), mark);
      }
      editor.normalize();
    });

    setFindMatchCount(0);
    setFindActiveIndex(0);
  }, [editorRef, replaceQuery, withObserverPaused]);

  const clearFindHighlights = useCallback(() => {
    withObserverPaused(() => clearMarks());
  }, [withObserverPaused, clearMarks]);

  return {
    showFind, setShowFind,
    findQuery, setFindQuery,
    replaceQuery, setReplaceQuery,
    findMatchCount,
    findActiveIndex, setFindActiveIndex,
    findMatchCase, setFindMatchCase,
    findInputRef,
    findNext, findPrev,
    closeFindBar,
    handleReplace, handleReplaceAll,
    clearFindHighlights,
  };
}
