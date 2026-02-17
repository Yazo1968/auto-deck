
import { useState, useCallback, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { Heading, DetailLevel, StylingOptions, ImageVersion, ReferenceImage } from '../types';
import { DEFAULT_STYLING, withRetry, callClaude, FLASH_TEXT_CONFIG, PRO_IMAGE_CONFIG } from '../utils/ai';
import { extractBase64, extractMime } from '../utils/modificationEngine';
import { buildContentPrompt, buildPlannerPrompt } from '../utils/prompts/contentGeneration';
import { buildVisualizerPrompt } from '../utils/prompts/imageGeneration';
import { GoogleGenAI } from "@google/genai";

// Lazy singleton: avoids recreating the SDK instance on every API call.
let _aiInstance: GoogleGenAI | null = null;
function getAI(): GoogleGenAI {
  if (!_aiInstance) {
    _aiInstance = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }
  return _aiInstance;
}

/**
 * Card generation pipeline — shared by the insights workflow.
 * Handles: content synthesis → layout planning → image generation → batch operations.
 */
export function useCardGeneration(
  menuDraftOptions: StylingOptions,
  referenceImage: ReferenceImage | null = null,
  useReferenceImage: boolean = false
) {
  const {
    selectedNugget,
    updateNuggetHeading,
  } = useAppContext();

  // State
  const [genStatus, setGenStatus] = useState<string>('');
  const [activeLogicTab, setActiveLogicTab] = useState<DetailLevel>('Standard');
  const [manifestHeadings, setManifestHeadings] = useState<Heading[] | null>(null);

  // Derived
  const activeHeading = useMemo(() => {
    if (!selectedNugget) return null;
    return selectedNugget.headings.find(h => h.id === selectedNugget.headings.find(() => true)?.id) || null;
  }, [selectedNugget]);

  const currentSynthesisContent = useMemo(() => {
    const heading = selectedNugget?.headings.find(h => h.id === selectedNugget?.headings[0]?.id);
    if (!heading) return '';
    const level = (heading.settings || DEFAULT_STYLING).levelOfDetail;
    return heading.synthesisMap?.[level] || '';
  }, [selectedNugget]);

  const contentDirty = useMemo(() => {
    if (!selectedNugget) return false;
    const heading = selectedNugget.headings[0];
    if (!heading?.cardUrlMap?.[activeLogicTab]) return false;
    if (!heading.lastGeneratedContentMap?.[activeLogicTab]) return false;
    const content = heading.synthesisMap?.[(heading.settings || DEFAULT_STYLING).levelOfDetail] || '';
    return content !== heading.lastGeneratedContentMap[activeLogicTab];
  }, [selectedNugget, activeLogicTab]);

  const selectedCount = useMemo(() => {
    const headings = selectedNugget?.headings ?? [];
    return headings.filter(h => h.selected).length;
  }, [selectedNugget]);

  // ── Helpers ──

  const getSectionContext = (target: Heading, structure: Heading[], content: string): string => {
    const targetIdx = structure.findIndex(h => h.id === target.id);
    if (targetIdx === -1) return content;

    const findOffset = (heading: Heading) => {
      const escapedText = heading.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`^(#{1,6})\\s+${escapedText}\\s*$`, 'g');
      const matches = [...content.matchAll(regex)];
      const match = matches.find(m => m[0].includes(heading.text));
      return match ? match.index : null;
    };

    const targetOffset = findOffset(target) ?? 0;

    let nextHeadingOffset = content.length;
    for (let i = targetIdx + 1; i < structure.length; i++) {
      if (structure[i].level <= target.level) {
        nextHeadingOffset = findOffset(structure[i]) ?? content.length;
        break;
      }
    }

    return content.substring(targetOffset, nextHeadingOffset);
  };

  // ── Internal: synthesize content for a heading ──

  const performSynthesis = useCallback(async (heading: Heading, level: DetailLevel) => {
    if (!selectedNugget) return null;
    const activeContent = selectedNugget.documents.filter(d => d.enabled !== false && d.content).map(d => d.content).join('\n\n---\n\n');
    const activeStructure = selectedNugget.headings;

    if (!activeContent || !activeStructure) return null;

    // Set synthesizing status
    updateNuggetHeading(heading.id, h => ({
      ...h,
      isSynthesizingMap: { ...(h.isSynthesizingMap || {}), [level]: true }
    }));

    if (!manifestHeadings) setGenStatus(`Synthesizing ${level} Mapping for [${heading.text}]...`);

    try {
      const sectionText = getSectionContext(heading, activeStructure, activeContent);
      const synthesisPrompt = buildContentPrompt(heading.text, level, activeContent, sectionText, true);

      let synthesizedText = await callClaude(synthesisPrompt, {
        systemBlocks: [
          { text: 'You are an expert content synthesizer. You extract, restructure, and condense document content into infographic-ready text. Follow the formatting and word count requirements precisely.', cache: false },
          { text: `FULL DOCUMENT CONTEXT:\n${activeContent}`, cache: true },
        ],
        maxTokens: 4096,
      });
      synthesizedText = synthesizedText.replace(/^\s*#\s+[^\n]*\n*/, '');
      synthesizedText = `# ${heading.text}\n\n${synthesizedText.trimStart()}`;

      updateNuggetHeading(heading.id, h => ({
        ...h,
        synthesisMap: { ...(h.synthesisMap || {}), [level]: synthesizedText },
        isSynthesizingMap: { ...(h.isSynthesizingMap || {}), [level]: false },
      }));

      return synthesizedText;
    } catch (err: any) {
      console.error("Synthesis failed:", err);
      updateNuggetHeading(heading.id, h => ({
        ...h,
        isSynthesizingMap: { ...(h.isSynthesizingMap || {}), [level]: false }
      }));
      return null;
    } finally {
      if (!manifestHeadings) setGenStatus('');
    }
  }, [selectedNugget, manifestHeadings, updateNuggetHeading]);

  // ── Generate card image for a heading ──

  const generateCardForHeading = useCallback(async (heading: Heading, skipReferenceOnce?: boolean) => {
    if (typeof window !== 'undefined' && (window as any).aistudio) {
      const hasKey = await (window as any).aistudio.hasSelectedApiKey();
      if (!hasKey) {
        await (window as any).aistudio.openSelectKey();
      }
    }

    const settings = { ...menuDraftOptions };
    const currentLevel = settings.levelOfDetail;

    // Apply settings
    updateNuggetHeading(heading.id, h => ({ ...h, settings: { ...settings } }));

    // Set generating status
    updateNuggetHeading(heading.id, h => ({
      ...h,
      isGeneratingMap: { ...(h.isGeneratingMap || {}), [currentLevel]: true }
    }));

    try {
      let contentToMap = heading.synthesisMap?.[currentLevel];

      if (!contentToMap) {
        contentToMap = await performSynthesis(heading, currentLevel) || '';
      }

      if (!contentToMap) throw new Error(`Could not obtain ${currentLevel} synthesis for mapping.`);

      setGenStatus(`Planning layout for [${heading.text}]...`);
      const ai = getAI();

      let visualPlan: string | undefined;
      try {
        const plannerResponse = await withRetry(async () => {
          return await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: buildPlannerPrompt(heading.text, contentToMap, settings.style, settings.aspectRatio),
            config: { ...FLASH_TEXT_CONFIG },
          });
        });
        visualPlan = plannerResponse.text || undefined;
      } catch (err) {
        console.warn('Planner step failed, falling back to direct visualization:', err);
      }

      setGenStatus(`Rendering ${settings.style} Visual [${currentLevel}] for [${heading.text}]...`);

      const shouldUseRef = !!(referenceImage && useReferenceImage && !skipReferenceOnce);
      const lastPrompt = buildVisualizerPrompt(heading.text, contentToMap, settings, visualPlan, shouldUseRef);

      const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];
      if (shouldUseRef) {
        parts.push({
          inlineData: {
            mimeType: extractMime(referenceImage!.url),
            data: extractBase64(referenceImage!.url),
          },
        });
      }
      parts.push({ text: lastPrompt });

      const imageResponse = await withRetry(async () => {
        return await ai.models.generateContent({
          model: 'gemini-3-pro-image-preview',
          contents: [{ parts }],
          config: {
            ...PRO_IMAGE_CONFIG,
            imageConfig: {
              aspectRatio: settings.aspectRatio,
              imageSize: settings.resolution
            }
          }
        });
      });

      let cardUrl = '';
      for (const part of imageResponse.candidates[0].content.parts) {
        if (part.inlineData) {
          cardUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
          break;
        }
      }

      if (cardUrl) {
        updateNuggetHeading(heading.id, h => ({
          ...h,
          cardUrlMap: { ...(h.cardUrlMap || {}), [currentLevel]: cardUrl },
          isGeneratingMap: { ...(h.isGeneratingMap || {}), [currentLevel]: false },
          imageHistoryMap: { ...(h.imageHistoryMap || {}), [currentLevel]: undefined },
          lastGeneratedContentMap: { ...(h.lastGeneratedContentMap || {}), [currentLevel]: contentToMap },
          visualPlanMap: { ...(h.visualPlanMap || {}), [currentLevel]: visualPlan },
          lastPromptMap: { ...(h.lastPromptMap || {}), [currentLevel]: lastPrompt },
        }));
      }
    } catch (err: any) {
      console.error("Generation failed:", err);
      console.error("Generation error details:", JSON.stringify({
        message: err.message, status: err.status, code: err.code,
        details: err.details, errorInfo: err.errorInfo,
        aspectRatio: settings.aspectRatio, resolution: settings.resolution,
        style: settings.style, level: currentLevel,
      }, null, 2));
      if (err.message?.includes("Requested entity was not found") || err.status === 404) {
        if (typeof window !== 'undefined' && (window as any).aistudio) {
          await (window as any).aistudio.openSelectKey();
        }
      }
      alert(`Generation failed: ${err.message || "Unknown error"}. Please try again later.`);
    } finally {
      if (!manifestHeadings) setGenStatus('');
      updateNuggetHeading(heading.id, h => ({
        ...h,
        isGeneratingMap: { ...(h.isGeneratingMap || {}), [currentLevel]: false }
      }));
    }
  }, [performSynthesis, manifestHeadings, menuDraftOptions, referenceImage, useReferenceImage, updateNuggetHeading]);

  // ── Batch operations ──

  const handleGenerateAll = useCallback(() => {
    const headings = selectedNugget?.headings;
    if (!headings) return;

    const selectedItems = headings.filter(h => h.selected);
    if (selectedItems.length === 0) {
      alert("Please select items in the sidebar first.");
      return;
    }

    setManifestHeadings(selectedItems);
  }, [selectedNugget]);

  const executeBatchCardGeneration = async () => {
    if (!manifestHeadings) return;
    const selectedItems = [...manifestHeadings];
    setManifestHeadings(null);

    setGenStatus(`Executing batch card generation for ${selectedItems.length} items...`);
    for (const item of selectedItems) {
      await generateCardForHeading(item);
    }
    setGenStatus('');
  };

  // ── Image modification handler ──

  const handleImageModified = useCallback((headingId: string, newImageUrl: string, history: ImageVersion[]) => {
    const headings = selectedNugget?.headings ?? [];
    const heading = headings.find(h => h.id === headingId);
    const level = (heading?.settings || DEFAULT_STYLING).levelOfDetail;
    const currentContent = heading?.synthesisMap?.[level] || '';

    updateNuggetHeading(headingId, h => ({
      ...h,
      cardUrlMap: { ...(h.cardUrlMap || {}), [level]: newImageUrl },
      imageHistoryMap: { ...(h.imageHistoryMap || {}), [level]: history },
      lastGeneratedContentMap: { ...(h.lastGeneratedContentMap || {}), [level]: currentContent || h.lastGeneratedContentMap?.[level] },
    }));
  }, [selectedNugget, updateNuggetHeading]);

  return {
    genStatus,
    activeLogicTab, setActiveLogicTab,
    manifestHeadings, setManifestHeadings,
    currentSynthesisContent, contentDirty, selectedCount,
    generateCardForHeading,
    handleGenerateAll,
    executeBatchCardGeneration,
    handleImageModified,
  };
}
