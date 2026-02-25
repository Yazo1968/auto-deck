import { useState, useCallback } from 'react';
import { useNuggetContext } from '../context/NuggetContext';
import { useSelectionContext } from '../context/SelectionContext';
import { Card, DetailLevel, StylingOptions, ZoomState, ReferenceImage } from '../types';
import { detectSettingsMismatch } from '../utils/ai';

export interface UseImageOperationsParams {
  activeCard: Card | null;
  activeLogicTab: DetailLevel;
  committedSettings: StylingOptions;
  menuDraftOptions: StylingOptions;
  referenceImage: ReferenceImage | null;
  setReferenceImage: React.Dispatch<React.SetStateAction<ReferenceImage | null>>;
  useReferenceImage: boolean;
  setUseReferenceImage: React.Dispatch<React.SetStateAction<boolean>>;
  generateCard: (card: Card, skipReference?: boolean) => Promise<void>;
  executeBatchCardGeneration: () => Promise<void>;
}

/**
 * Image operations — zoom, reference image, card image CRUD, downloads, generation wrappers.
 * Extracted from App.tsx for domain separation (item 4.2).
 */
export function useImageOperations({
  activeCard,
  activeLogicTab,
  committedSettings,
  menuDraftOptions,
  referenceImage,
  setReferenceImage,
  useReferenceImage,
  setUseReferenceImage,
  generateCard,
  executeBatchCardGeneration,
}: UseImageOperationsParams) {
  const { selectedNugget, updateNugget } = useNuggetContext();
  const { activeCardId } = useSelectionContext();

  // ── Private state ──
  const [zoomState, setZoomState] = useState<ZoomState>({ imageUrl: null, cardId: null, cardText: null });
  const [mismatchDialog, setMismatchDialog] = useState<{
    resolve: (decision: 'disable' | 'skip' | 'cancel') => void;
  } | null>(null);

  // ── Zoom ──

  const openZoom = useCallback(
    (imageUrl: string) => {
      const settings = committedSettings;
      setZoomState({
        imageUrl,
        cardId: activeCard?.id || null,
        cardText: activeCard?.text || null,
        palette: settings.palette || null,
        imageHistory: activeCard?.imageHistoryMap?.[activeLogicTab],
        aspectRatio: settings.aspectRatio,
        resolution: settings.resolution,
      });
    },
    [activeCard, committedSettings, activeLogicTab],
  );

  const closeZoom = useCallback(() => {
    setZoomState({ imageUrl: null, cardId: null, cardText: null });
  }, []);

  // ── Reference image ──

  const handleStampReference = useCallback(() => {
    const cardUrl = activeCard?.cardUrlMap?.[activeLogicTab];
    if (!cardUrl) return;
    setReferenceImage({ url: cardUrl, settings: { ...menuDraftOptions } });
    setUseReferenceImage(true);
  }, [activeCard, activeLogicTab, menuDraftOptions, setReferenceImage, setUseReferenceImage]);

  const handleReferenceImageModified = useCallback((newImageUrl: string) => {
    setReferenceImage((prev) => (prev ? { ...prev, url: newImageUrl } : prev));
  }, [setReferenceImage]);

  const handleDeleteReference = useCallback(() => {
    setReferenceImage(null);
    setUseReferenceImage(false);
  }, [setReferenceImage, setUseReferenceImage]);

  // ── Card image CRUD ──

  const handleInsightsImageModified = useCallback(
    (cardId: string, newImageUrl: string, history: any[]) => {
      if (!selectedNugget) return;
      const card = selectedNugget.cards.find((c) => c.id === cardId);
      const level = card?.detailLevel || activeLogicTab;

      updateNugget(selectedNugget.id, (n) => ({
        ...n,
        cards: n.cards.map((c) => {
          if (c.id !== cardId) return c;
          return {
            ...c,
            cardUrlMap: { ...(c.cardUrlMap || {}), [level]: newImageUrl },
            imageHistoryMap: { ...(c.imageHistoryMap || {}), [level]: history },
          };
        }),
        lastModifiedAt: Date.now(),
      }));
    },
    [selectedNugget, updateNugget, activeLogicTab],
  );

  const handleDeleteCardImage = useCallback(() => {
    if (!activeCardId || !selectedNugget) return;
    const level = activeLogicTab;
    const cardUpdater = (c: Card) => {
      if (c.id !== activeCardId) return c;
      const newUrlMap = { ...(c.cardUrlMap || {}) };
      delete newUrlMap[level];
      const newHistoryMap = { ...(c.imageHistoryMap || {}) };
      delete newHistoryMap[level];
      const newPlanMap = { ...(c.visualPlanMap || {}) };
      delete newPlanMap[level];
      const newPromptMap = { ...(c.lastPromptMap || {}) };
      delete newPromptMap[level];
      const newGenContentMap = { ...(c.lastGeneratedContentMap || {}) };
      delete newGenContentMap[level];
      return {
        ...c,
        cardUrlMap: newUrlMap,
        imageHistoryMap: newHistoryMap,
        visualPlanMap: newPlanMap,
        lastPromptMap: newPromptMap,
        lastGeneratedContentMap: newGenContentMap,
      };
    };
    updateNugget(selectedNugget.id, (n) => ({
      ...n,
      cards: n.cards.map(cardUpdater),
      lastModifiedAt: Date.now(),
    }));
  }, [activeCardId, selectedNugget, activeLogicTab, updateNugget]);

  const handleDeleteCardVersions = useCallback(() => {
    if (!activeCardId || !selectedNugget) return;
    const level = activeLogicTab;
    const cardUpdater = (c: Card) => {
      if (c.id !== activeCardId) return c;
      const newUrlMap = { ...(c.cardUrlMap || {}) };
      delete newUrlMap[level];
      const newHistoryMap = { ...(c.imageHistoryMap || {}) };
      delete newHistoryMap[level];
      const newPlanMap = { ...(c.visualPlanMap || {}) };
      delete newPlanMap[level];
      const newPromptMap = { ...(c.lastPromptMap || {}) };
      delete newPromptMap[level];
      const newGenContentMap = { ...(c.lastGeneratedContentMap || {}) };
      delete newGenContentMap[level];
      return {
        ...c,
        cardUrlMap: newUrlMap,
        imageHistoryMap: newHistoryMap,
        visualPlanMap: newPlanMap,
        lastPromptMap: newPromptMap,
        lastGeneratedContentMap: newGenContentMap,
      };
    };
    updateNugget(selectedNugget.id, (n) => ({
      ...n,
      cards: n.cards.map(cardUpdater),
      lastModifiedAt: Date.now(),
    }));
  }, [activeCardId, selectedNugget, activeLogicTab, updateNugget]);

  const handleDeleteAllCardImages = useCallback(() => {
    if (!selectedNugget) return;
    const level = activeLogicTab;
    updateNugget(selectedNugget.id, (n) => ({
      ...n,
      cards: n.cards.map((c) => {
        const newUrlMap = { ...(c.cardUrlMap || {}) };
        delete newUrlMap[level];
        const newHistoryMap = { ...(c.imageHistoryMap || {}) };
        delete newHistoryMap[level];
        const newPlanMap = { ...(c.visualPlanMap || {}) };
        delete newPlanMap[level];
        const newPromptMap = { ...(c.lastPromptMap || {}) };
        delete newPromptMap[level];
        const newGenContentMap = { ...(c.lastGeneratedContentMap || {}) };
        delete newGenContentMap[level];
        return {
          ...c,
          cardUrlMap: newUrlMap,
          imageHistoryMap: newHistoryMap,
          visualPlanMap: newPlanMap,
          lastPromptMap: newPromptMap,
          lastGeneratedContentMap: newGenContentMap,
        };
      }),
      lastModifiedAt: Date.now(),
    }));
  }, [selectedNugget, activeLogicTab, updateNugget]);

  // ── Downloads ──

  const downloadDataUrl = useCallback((dataUrl: string, filename: string) => {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    a.click();
  }, []);

  const handleDownloadImage = useCallback(() => {
    const url = activeCard?.cardUrlMap?.[activeLogicTab];
    if (!url) return;
    const slug = activeCard!.text
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase()
      .slice(0, 40);
    downloadDataUrl(url, `${slug}-${activeLogicTab.toLowerCase()}.png`);
  }, [activeCard, activeLogicTab, downloadDataUrl]);

  const handleDownloadAllImages = useCallback(() => {
    if (!selectedNugget) return;
    for (const card of selectedNugget.cards) {
      const url = card.cardUrlMap?.[activeLogicTab];
      if (!url) continue;
      const slug = card.text
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase()
        .slice(0, 40);
      downloadDataUrl(url, `${slug}-${activeLogicTab.toLowerCase()}.png`);
    }
  }, [selectedNugget, activeLogicTab, downloadDataUrl]);

  // ── Generation wrappers (mismatch detection) ──

  const showMismatchDialog = useCallback(() => {
    return new Promise<'disable' | 'skip' | 'cancel'>((resolve) => {
      setMismatchDialog({ resolve });
    });
  }, []);

  const wrappedGenerateCard = useCallback(
    async (card: Card) => {
      if (referenceImage && useReferenceImage) {
        if (detectSettingsMismatch(menuDraftOptions, referenceImage.settings)) {
          const decision = await showMismatchDialog();
          if (decision === 'cancel') return;
          if (decision === 'disable') setUseReferenceImage(false);
          if (decision === 'disable' || decision === 'skip') {
            await generateCard(card, true);
            return;
          }
        }
      }
      await generateCard(card);
    },
    [referenceImage, useReferenceImage, menuDraftOptions, generateCard, showMismatchDialog, setUseReferenceImage],
  );

  const wrappedExecuteBatch = useCallback(async () => {
    if (referenceImage && useReferenceImage) {
      if (detectSettingsMismatch(menuDraftOptions, referenceImage.settings)) {
        const decision = await showMismatchDialog();
        if (decision === 'cancel') return;
        if (decision === 'disable') setUseReferenceImage(false);
      }
    }
    await executeBatchCardGeneration();
  }, [referenceImage, useReferenceImage, menuDraftOptions, executeBatchCardGeneration, showMismatchDialog, setUseReferenceImage]);

  return {
    // Zoom
    zoomState,
    setZoomState,
    openZoom,
    closeZoom,
    // Reference image
    handleStampReference,
    handleReferenceImageModified,
    handleDeleteReference,
    // Card image CRUD
    handleInsightsImageModified,
    handleDeleteCardImage,
    handleDeleteCardVersions,
    handleDeleteAllCardImages,
    // Downloads
    handleDownloadImage,
    handleDownloadAllImages,
    // Generation wrappers
    wrappedGenerateCard,
    wrappedExecuteBatch,
    mismatchDialog,
    setMismatchDialog,
  };
}
