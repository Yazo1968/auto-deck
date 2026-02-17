import { useState, useCallback, useRef, useEffect } from 'react';
import { ImageVersion } from '../types';

const MAX_VERSIONS = 10;

/**
 * Version history hook for image modification tracking.
 * Manages a stack of up to MAX_VERSIONS image versions with proper
 * blob URL cleanup on eviction and unmount.
 *
 * @param initialHistory - Optional pre-existing history (from heading.imageHistory)
 * @param originalImageUrl - The original card image URL (used to create "Original" entry if no history)
 */
export function useVersionHistory(
  initialHistory?: ImageVersion[],
  originalImageUrl?: string | null
) {
  const [versions, setVersions] = useState<ImageVersion[]>(() => {
    if (initialHistory && initialHistory.length > 0) {
      return initialHistory;
    }
    if (originalImageUrl) {
      return [{
        imageUrl: originalImageUrl,
        timestamp: Date.now(),
        label: 'Original',
      }];
    }
    return [];
  });

  const [currentIndex, setCurrentIndex] = useState<number>(() => {
    if (initialHistory && initialHistory.length > 0) {
      return initialHistory.length - 1;
    }
    return 0;
  });

  // Track blob URLs we've created so we can revoke them on cleanup
  const blobUrlsRef = useRef<Set<string>>(new Set());

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      blobUrlsRef.current.forEach(url => {
        try { URL.revokeObjectURL(url); } catch (_) { /* ignore */ }
      });
    };
  }, []);

  /**
   * Revoke a blob URL if we created it
   */
  const revokeBlobUrl = useCallback((url: string) => {
    if (blobUrlsRef.current.has(url)) {
      try { URL.revokeObjectURL(url); } catch (_) { /* ignore */ }
      blobUrlsRef.current.delete(url);
    }
  }, []);

  /**
   * Push a new version onto the stack.
   * If we're not at the end of the stack (user navigated back),
   * all versions after currentIndex are discarded.
   * If stack exceeds MAX_VERSIONS, oldest is evicted.
   */
  const pushVersion = useCallback((imageUrl: string, label: string) => {
    // Track blob URLs
    if (imageUrl.startsWith('blob:')) {
      blobUrlsRef.current.add(imageUrl);
    }

    setVersions(prev => {
      // Discard any "future" versions if user navigated back
      const truncated = prev.slice(0, currentIndex + 1);

      // Prepare new version
      const newVersion: ImageVersion = {
        imageUrl,
        timestamp: Date.now(),
        label,
      };

      let updated = [...truncated, newVersion];

      // Evict oldest if over capacity
      if (updated.length > MAX_VERSIONS) {
        const evicted = updated.shift()!;
        revokeBlobUrl(evicted.imageUrl);
      }

      return updated;
    });

    setCurrentIndex(prev => {
      // We're appending after the current position (after truncation)
      const newIdx = Math.min(currentIndex + 1, MAX_VERSIONS - 1);
      return newIdx;
    });
  }, [currentIndex, revokeBlobUrl]);

  /**
   * Navigate to the previous version (undo).
   * Returns the previous version's imageUrl, or null if already at start.
   */
  const restorePrevious = useCallback((): string | null => {
    if (currentIndex <= 0) return null;
    const newIdx = currentIndex - 1;
    setCurrentIndex(newIdx);
    return versions[newIdx]?.imageUrl || null;
  }, [currentIndex, versions]);

  /**
   * Navigate to the next version (redo).
   * Returns the next version's imageUrl, or null if already at end.
   */
  const restoreNext = useCallback((): string | null => {
    if (currentIndex >= versions.length - 1) return null;
    const newIdx = currentIndex + 1;
    setCurrentIndex(newIdx);
    return versions[newIdx]?.imageUrl || null;
  }, [currentIndex, versions]);

  /**
   * Jump to a specific version by index.
   * Returns the version's imageUrl, or null if invalid index.
   */
  const restoreByIndex = useCallback((index: number): string | null => {
    if (index < 0 || index >= versions.length) return null;
    setCurrentIndex(index);
    return versions[index]?.imageUrl || null;
  }, [versions]);

  /**
   * Reset the history — used when card is regenerated from scratch.
   * Cleans up all blob URLs.
   */
  const resetHistory = useCallback((newOriginalUrl?: string) => {
    // Cleanup old blob URLs
    versions.forEach(v => revokeBlobUrl(v.imageUrl));

    if (newOriginalUrl) {
      setVersions([{
        imageUrl: newOriginalUrl,
        timestamp: Date.now(),
        label: 'Original',
      }]);
      setCurrentIndex(0);
    } else {
      setVersions([]);
      setCurrentIndex(0);
    }
  }, [versions, revokeBlobUrl]);

  const currentVersion = versions[currentIndex] || null;
  const canUndo = currentIndex > 0;
  const canRedo = currentIndex < versions.length - 1;
  const modificationCount = versions.filter(v => v.label !== 'Original').length;

  return {
    versions,
    currentIndex,
    currentVersion,
    canUndo,
    canRedo,
    modificationCount,
    pushVersion,
    restorePrevious,
    restoreNext,
    restoreByIndex,
    resetHistory,
  };
}
