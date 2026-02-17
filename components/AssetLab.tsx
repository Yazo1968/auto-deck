import React, { useRef, useState, useEffect } from 'react';
import { marked } from 'marked';
import { Heading, StylingOptions, Palette, DetailLevel, ImageVersion, ReferenceImage } from '../types';
import { VISUAL_STYLES, STYLE_FONTS } from '../utils/ai';
import AnnotationWorkbench from './workbench/AnnotationWorkbench';
import type { AnnotationToolbarState } from './workbench/AnnotationWorkbench';
import AnnotationToolbar from './workbench/AnnotationToolbar';
import { ReferenceMismatchDialog, ManifestModal } from './Dialogs';

interface AssetLabProps {
  activeHeading: Heading | null;
  committedSettings: StylingOptions;
  menuDraftOptions: StylingOptions;
  setMenuDraftOptions: React.Dispatch<React.SetStateAction<StylingOptions>>;
  activeLogicTab: DetailLevel;
  setActiveLogicTab: (level: DetailLevel) => void;
  genStatus: string;
  onGenerateCard: (heading: Heading) => void;
  onGenerateAll: () => void;
  selectedCount: number;
  onZoomImage: (url: string) => void;
  onImageModified?: (headingId: string, newImageUrl: string, history: ImageVersion[]) => void;
  contentDirty?: boolean;
  currentContent?: string;
  onDownloadImage?: () => void;
  onDownloadAllImages?: () => void;
  referenceImage?: ReferenceImage | null;
  onStampReference?: () => void;
  useReferenceImage?: boolean;
  onToggleUseReference?: () => void;
  onReferenceImageModified?: (newImageUrl: string) => void;
  onDeleteReference?: () => void;
  mismatchDialog?: { resolve: (decision: 'disable' | 'skip' | 'cancel') => void } | null;
  onDismissMismatch?: () => void;
  manifestHeadings?: Heading[] | null;
  onExecuteBatch?: () => void;
  onCloseManifest?: () => void;
}

const AssetLab: React.FC<AssetLabProps> = ({
  activeHeading,
  committedSettings,
  menuDraftOptions,
  setMenuDraftOptions,
  activeLogicTab,
  setActiveLogicTab,
  genStatus,
  onGenerateCard,
  onGenerateAll,
  selectedCount,
  onZoomImage,
  onImageModified,
  contentDirty,
  currentContent,
  onDownloadImage,
  onDownloadAllImages,
  referenceImage,
  onStampReference,
  useReferenceImage,
  onToggleUseReference,
  onReferenceImageModified,
  onDeleteReference,
  mismatchDialog,
  onDismissMismatch,
  manifestHeadings,
  onExecuteBatch,
  onCloseManifest,
}) => {
  const colorRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [showPrompt, setShowPrompt] = useState(false);
  const [showReference, setShowReference] = useState(false);
  const [openMenu, setOpenMenu] = useState<'style' | 'ratio' | 'resolution' | 'reference' | 'download' | 'generate' | 'palette-background' | 'palette-primary' | 'palette-secondary' | 'palette-accent' | 'palette-text' | null>(null);
  const [menuMode, setMenuMode] = useState<'hover' | 'locked'>('hover');
  const [toolbarState, setToolbarState] = useState<AnnotationToolbarState | null>(null);

  const handleDownloadReference = () => {
    if (!referenceImage) return;
    const link = document.createElement('a');
    link.href = referenceImage.url;
    link.download = `reference-${referenceImage.settings.style}-${referenceImage.settings.aspectRatio}.png`;
    link.click();
  };

  const handleStyleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStyle = e.target.value;
    setMenuDraftOptions(prev => ({
      ...prev,
      style: newStyle,
      palette: VISUAL_STYLES[newStyle] || prev.palette,
      fonts: STYLE_FONTS[newStyle] || prev.fonts
    }));
  };

  const updatePalette = (key: keyof Palette, value: string) => {
    setMenuDraftOptions(prev => ({
      ...prev,
      palette: { ...prev.palette, [key]: value }
    }));
  };

  const hasImage = !!activeHeading?.cardUrlMap?.[activeLogicTab];

  // Clear toolbar state when no image
  useEffect(() => {
    if (!hasImage) setToolbarState(null);
  }, [hasImage]);
  const isGenerating = !!activeHeading?.isGeneratingMap?.[activeLogicTab];

  const paletteKeys: Array<keyof Palette> = ['background', 'primary', 'secondary', 'accent', 'text'];

  const imageContainerRef = useRef<HTMLDivElement>(null);

  // ── Rotating fun status messages ──
  const funMessages = [
    'Brewing visual magic...',
    'Pixels falling into place...',
    'Teaching colors to dance...',
    'Consulting the design gods...',
    'Waking up the AI hamsters...',
    'Sketching at the speed of thought...',
    'Mixing the perfect pixel potion...',
    'Crunching creative numbers...',
    'Painting between the lines...',
    'Warming up the idea engine...',
    'Convincing gradients to behave...',
    'Almost there, probably...',
    'Aligning all the things...',
    'Letting the AI cook...',
    'Sprinkling some visual fairy dust...',
    'Doing something very clever...',
    'Polishing every last pixel...',
    'Channeling inner Picasso...',
    'Rendering with reckless ambition...',
    'Making it look effortless...',
  ];

  const styleToolbarRef = useRef<HTMLDivElement>(null);

  // Close menu on click outside (only when locked)
  useEffect(() => {
    if (!openMenu || menuMode !== 'locked') return;
    const handler = (e: MouseEvent) => {
      if (styleToolbarRef.current && !styleToolbarRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openMenu, menuMode]);

  // Helpers for hover/locked menu pattern
  const toggleMenuLocked = (key: typeof openMenu) => {
    if (openMenu === key && menuMode === 'locked') { setOpenMenu(null); }
    else { setMenuMode('locked'); setOpenMenu(key); }
  };
  const hoverMenuEnter = (key: typeof openMenu) => {
    if (openMenu && menuMode === 'locked') return;
    setMenuMode('hover'); setOpenMenu(key);
  };
  const hoverMenuLeave = () => {
    if (menuMode === 'locked') return;
    setOpenMenu(null);
  };

  const [funMsgIndex, setFunMsgIndex] = useState(0);
  const [funMsgFade, setFunMsgFade] = useState(true);

  useEffect(() => {
    if (!isGenerating) {
      setFunMsgIndex(0);
      setFunMsgFade(true);
      return;
    }
    const interval = setInterval(() => {
      setFunMsgFade(false); // fade out
      setTimeout(() => {
        setFunMsgIndex(prev => (prev + 1) % funMessages.length);
        setFunMsgFade(true); // fade in
      }, 300);
    }, 2800);
    return () => clearInterval(interval);
  }, [isGenerating]);

  return (
    <section className="flex-1 flex flex-col bg-white relative overflow-hidden group">
      {/* Clean canvas — no texture */}

      {/* ─── Design Toolbar ─── */}
      <div className="relative z-30">
        {/* ─── Title row ─── */}
        <div className="px-5 h-[36px] flex items-center justify-center shrink-0">
          <span className="text-[17px] tracking-tight text-zinc-900"><span className="font-light italic">card</span><span className="font-semibold not-italic">lab</span></span>
        </div>
        {/* ─── Toolbar row ─── */}
        <div ref={styleToolbarRef} className="px-5 h-[40px] mb-1 flex items-center justify-center gap-2">
          {/* Style controls toolbar */}
          <div className="flex items-center gap-1 px-1.5 h-9">
            {/* Style selector */}
            <div className="relative" onMouseEnter={() => hoverMenuEnter('style')} onMouseLeave={hoverMenuLeave}>
              <button
                onClick={() => toggleMenuLocked('style')}
                title={`Style: ${menuDraftOptions.style}`}
                className={`h-7 px-2 rounded-full flex items-center justify-center text-[11px] font-medium uppercase transition-all duration-200 active:scale-95 whitespace-nowrap ${openMenu === 'style' ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'}`}
              >
                {menuDraftOptions.style}
              </button>
              {openMenu === 'style' && (
                <div className="absolute left-1/2 -translate-x-1/2 top-full pt-2 z-50">
                <div className="glass-toolbar rounded-2xl py-2 px-1 shadow-lg border border-zinc-100 max-h-[280px] overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-150">
                  {Object.keys(VISUAL_STYLES).map(styleName => (
                    <button
                      key={styleName}
                      onClick={() => { handleStyleChange({ target: { value: styleName } } as React.ChangeEvent<HTMLSelectElement>); setOpenMenu(null); }}
                      className={`block w-full text-left px-3 py-1.5 text-[11px] font-medium uppercase rounded-lg whitespace-nowrap transition-colors ${menuDraftOptions.style === styleName ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'}`}
                    >
                      {styleName}
                    </button>
                  ))}
                </div>
                </div>
              )}
            </div>

            <span className="text-zinc-300 text-[11px]">|</span>

            {/* Aspect ratio selector */}
            <div className="relative" onMouseEnter={() => hoverMenuEnter('ratio')} onMouseLeave={hoverMenuLeave}>
              <button
                onClick={() => toggleMenuLocked('ratio')}
                title={`Ratio: ${menuDraftOptions.aspectRatio}`}
                className={`h-7 px-2 rounded-full flex items-center justify-center text-[11px] font-medium uppercase transition-all duration-200 active:scale-95 whitespace-nowrap ${openMenu === 'ratio' ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'}`}
              >
                {menuDraftOptions.aspectRatio}
              </button>
              {openMenu === 'ratio' && (
                <div className="absolute left-1/2 -translate-x-1/2 top-full pt-2 z-50">
                <div className="glass-toolbar rounded-2xl py-2 px-1 shadow-lg border border-zinc-100 animate-in fade-in slide-in-from-top-2 duration-150">
                  {(['16:9', '4:3', '1:1', '9:16', '3:2', '2:3', '3:4', '4:5', '5:4', '21:9'] as const).map(ratio => (
                    <button
                      key={ratio}
                      onClick={() => { setMenuDraftOptions(prev => ({ ...prev, aspectRatio: ratio })); setOpenMenu(null); }}
                      className={`block w-full text-left px-3 py-1.5 text-[11px] font-medium uppercase rounded-lg whitespace-nowrap transition-colors ${menuDraftOptions.aspectRatio === ratio ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'}`}
                    >
                      {ratio}
                    </button>
                  ))}
                </div>
                </div>
              )}
            </div>

            <span className="text-zinc-300 text-[11px]">|</span>

            {/* Resolution selector */}
            <div className="relative" onMouseEnter={() => hoverMenuEnter('resolution')} onMouseLeave={hoverMenuLeave}>
              <button
                onClick={() => toggleMenuLocked('resolution')}
                title={`Resolution: ${menuDraftOptions.resolution}`}
                className={`h-7 px-2 rounded-full flex items-center justify-center text-[11px] font-medium uppercase transition-all duration-200 active:scale-95 whitespace-nowrap ${openMenu === 'resolution' ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'}`}
              >
                {menuDraftOptions.resolution}
              </button>
              {openMenu === 'resolution' && (
                <div className="absolute left-1/2 -translate-x-1/2 top-full pt-2 z-50">
                <div className="glass-toolbar rounded-2xl py-2 px-1 shadow-lg border border-zinc-100 animate-in fade-in slide-in-from-top-2 duration-150">
                  {(['1K', '2K', '4K'] as const).map(res => (
                    <button
                      key={res}
                      onClick={() => { setMenuDraftOptions(prev => ({ ...prev, resolution: res as StylingOptions['resolution'] })); setOpenMenu(null); }}
                      className={`block w-full text-left px-3 py-1.5 text-[11px] font-medium uppercase rounded-lg whitespace-nowrap transition-colors ${menuDraftOptions.resolution === res ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'}`}
                    >
                      {res}
                    </button>
                  ))}
                </div>
                </div>
              )}
            </div>

            <div className="w-px h-3.5 bg-zinc-200 mx-0.5" />

            {/* Reference image menu */}
            <div className="relative" onMouseEnter={() => hoverMenuEnter('reference')} onMouseLeave={hoverMenuLeave}>
              <button
                onClick={() => toggleMenuLocked('reference')}
                title="Reference image"
                className={`w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 ${openMenu === 'reference' ? 'bg-zinc-900 text-white' : referenceImage && useReferenceImage ? 'bg-zinc-900 text-white' : 'text-black hover:bg-zinc-100'}`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>
                </svg>
              </button>
              {openMenu === 'reference' && (
                <div className="absolute left-1/2 -translate-x-1/2 top-full pt-2 z-50">
                <div className="glass-toolbar rounded-2xl py-2 px-1 shadow-lg border border-zinc-100 animate-in fade-in slide-in-from-top-2 duration-150 min-w-[170px]">
                  {referenceImage && (
                    <>
                      {/* Use Reference toggle */}
                      <button
                        onClick={() => { onToggleUseReference?.(); }}
                        className="flex items-center justify-between w-full px-3 py-1.5 rounded-lg transition-colors text-zinc-600 hover:bg-zinc-100"
                      >
                        <span className="text-[11px] font-medium uppercase">Use Ref.</span>
                        <div className={`relative w-6 h-3.5 rounded-full transition-colors duration-200 ${useReferenceImage ? 'bg-zinc-900' : 'bg-zinc-300'}`}>
                          <div className={`absolute top-[2px] w-2.5 h-2.5 rounded-full bg-white border border-zinc-300 transition-all duration-200 ${useReferenceImage ? 'left-[12px]' : 'left-[2px]'}`} />
                        </div>
                      </button>
                      {/* View Reference toggle */}
                      <button
                        onClick={() => { setShowReference(prev => !prev); }}
                        className="flex items-center justify-between w-full px-3 py-1.5 rounded-lg transition-colors text-zinc-600 hover:bg-zinc-100"
                      >
                        <span className="text-[11px] font-medium uppercase">View Ref.</span>
                        <div className={`relative w-6 h-3.5 rounded-full transition-colors duration-200 ${showReference ? 'bg-zinc-900' : 'bg-zinc-300'}`}>
                          <div className={`absolute top-[2px] w-2.5 h-2.5 rounded-full bg-white border border-zinc-300 transition-all duration-200 ${showReference ? 'left-[12px]' : 'left-[2px]'}`} />
                        </div>
                      </button>
                      <div className="h-px bg-zinc-200/60 mx-2 my-1" />
                    </>
                  )}
                  <button
                    onClick={() => { onStampReference?.(); setOpenMenu(null); }}
                    disabled={!hasImage}
                    className={`block w-full text-left px-3 py-1.5 text-[11px] font-medium uppercase rounded-lg whitespace-nowrap transition-colors ${referenceImage && hasImage && activeHeading?.cardUrlMap?.[activeLogicTab] === referenceImage.url ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'} disabled:opacity-30 disabled:cursor-not-allowed`}
                  >
                    Set Current as Ref.
                  </button>
                  {referenceImage && (
                    <>
                      <button
                        onClick={() => { handleDownloadReference(); setOpenMenu(null); }}
                        className="block w-full text-left px-3 py-1.5 text-[11px] font-medium uppercase rounded-lg whitespace-nowrap text-zinc-600 hover:bg-zinc-100 transition-colors"
                      >
                        Download Ref.
                      </button>
                      <button
                        onClick={() => { onDeleteReference?.(); setShowReference(false); setOpenMenu(null); }}
                        className="block w-full text-left px-3 py-1.5 text-[11px] font-medium uppercase rounded-lg whitespace-nowrap text-red-500 hover:bg-red-50 transition-colors"
                      >
                        Delete Ref.
                      </button>
                    </>
                  )}
                </div>
                </div>
              )}
            </div>

            <div className="w-px h-3.5 bg-zinc-200 mx-0.5" />

            {/* Palette dots */}
            {paletteKeys.map((key) => {
              const menuKey = `palette-${key}` as typeof openMenu;
              return (
                <div key={key} className="relative flex items-center justify-center" onMouseEnter={() => hoverMenuEnter(menuKey)} onMouseLeave={hoverMenuLeave}>
                  <button
                    onClick={() => toggleMenuLocked(menuKey)}
                    className={`w-[18px] h-[18px] rounded-full transition-all duration-200 cursor-pointer ring-1 hover:scale-125 hover:shadow-lg active:scale-95 ${openMenu === menuKey ? 'ring-black/40 scale-125' : 'ring-black/[0.06] hover:ring-black/20'}`}
                    style={{ backgroundColor: menuDraftOptions.palette[key] }}
                    title={key.charAt(0).toUpperCase() + key.slice(1)}
                  />
                  {openMenu === menuKey && (
                    <div className="absolute left-1/2 -translate-x-1/2 top-full pt-2 z-50">
                    <div className="glass-toolbar rounded-2xl py-2 px-2 shadow-lg border border-zinc-100 animate-in fade-in slide-in-from-top-2 duration-150 flex items-center gap-2">
                      <input
                        type="color"
                        value={menuDraftOptions.palette[key]}
                        onChange={(e) => updatePalette(key, e.target.value)}
                        className="w-7 h-7 rounded-lg cursor-pointer border-0 p-0 bg-transparent"
                      />
                      <input
                        type="text"
                        value={menuDraftOptions.palette[key]}
                        onChange={(e) => { const v = e.target.value; if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) updatePalette(key, v); }}
                        className="w-[68px] text-[11px] font-mono font-medium text-zinc-700 bg-zinc-50 rounded-lg px-2 py-1.5 border border-zinc-200 focus:outline-none focus:border-zinc-400 uppercase"
                        spellCheck={false}
                      />
                    </div>
                    </div>
                  )}
                </div>
              );
            })}
            <div className="w-px h-3.5 bg-zinc-200 mx-0.5" />

            {/* Generate menu */}
            <div className="relative" onMouseEnter={() => hoverMenuEnter('generate')} onMouseLeave={hoverMenuLeave}>
              <button
                onClick={() => toggleMenuLocked('generate')}
                disabled={!!genStatus}
                title="Generate"
                className={`w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 ${openMenu === 'generate' ? 'bg-zinc-900 text-white' : 'text-black hover:bg-zinc-100'} disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:active:scale-100`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
                </svg>
              </button>
              {openMenu === 'generate' && (
                <div className="absolute left-1/2 -translate-x-1/2 top-full pt-2 z-50">
                <div className="glass-toolbar rounded-2xl py-2 px-1 shadow-lg border border-zinc-100 animate-in fade-in slide-in-from-top-2 duration-150 min-w-[160px]">
                  <button
                    onClick={() => { activeHeading && onGenerateCard(activeHeading); setOpenMenu(null); }}
                    disabled={!activeHeading}
                    className="flex items-center gap-2 w-full text-left px-3 py-1.5 text-[11px] font-medium uppercase rounded-lg whitespace-nowrap text-zinc-600 hover:bg-zinc-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Generate Card
                  </button>
                  <button
                    onClick={() => { onGenerateAll(); setOpenMenu(null); }}
                    disabled={selectedCount === 0}
                    className="flex items-center gap-2 w-full text-left px-3 py-1.5 text-[11px] font-medium uppercase rounded-lg whitespace-nowrap text-zinc-600 hover:bg-zinc-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Generate Selected
                  </button>
                </div>
                </div>
              )}
            </div>

            <div className="w-px h-3.5 bg-zinc-200 mx-0.5" />

            {/* Toggle image / prompt view */}
            <button
              onClick={() => setShowPrompt(prev => !prev)}
              disabled={!activeHeading?.lastPromptMap?.[activeLogicTab]}
              title={showPrompt ? 'Show generated image' : 'Show generation prompt'}
              className={`w-7 h-7 rounded-full flex items-center justify-center active:scale-90 transition-all duration-200 ${showPrompt && activeHeading?.lastPromptMap?.[activeLogicTab] ? 'bg-zinc-900 text-white' : 'text-black hover:bg-zinc-100'} disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:active:scale-100`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
            </button>

            <div className="w-px h-3.5 bg-zinc-200 mx-0.5" />

            {/* Download menu */}
            <div className="relative" onMouseEnter={() => hoverMenuEnter('download')} onMouseLeave={hoverMenuLeave}>
              <button
                onClick={() => toggleMenuLocked('download')}
                disabled={!hasImage}
                title="Download"
                className={`w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 ${openMenu === 'download' ? 'bg-zinc-900 text-white' : 'text-black hover:bg-zinc-100'} disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:active:scale-100`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
              </button>
              {openMenu === 'download' && (
                <div className="absolute left-1/2 -translate-x-1/2 top-full pt-2 z-50">
                <div className="glass-toolbar rounded-2xl py-2 px-1 shadow-lg border border-zinc-100 animate-in fade-in slide-in-from-top-2 duration-150 min-w-[140px]">
                  <button
                    onClick={() => { onDownloadImage?.(); setOpenMenu(null); }}
                    className="flex items-center gap-2 w-full text-left px-3 py-1.5 text-[11px] font-medium uppercase rounded-lg whitespace-nowrap text-zinc-600 hover:bg-zinc-100 transition-colors"
                  >
                    Download Card
                  </button>
                  <button
                    onClick={() => { onDownloadAllImages?.(); setOpenMenu(null); }}
                    className="flex items-center gap-2 w-full text-left px-3 py-1.5 text-[11px] font-medium uppercase rounded-lg whitespace-nowrap text-zinc-600 hover:bg-zinc-100 transition-colors"
                  >
                    Download All
                  </button>
                </div>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 text-center animate-in fade-in duration-1000 relative border-b border-zinc-100">
        {showReference && referenceImage ? (
          <div className="w-full h-full animate-in fade-in duration-300 relative">
            <AnnotationWorkbench
              imageUrl={referenceImage.url}
              headingId={null}
              headingText={null}
              palette={referenceImage.settings.palette}
              style={referenceImage.settings.style}
              aspectRatio={referenceImage.settings.aspectRatio}
              resolution={referenceImage.settings.resolution}
              mode="inline"
              onImageModified={onReferenceImageModified ? (_id: string, newUrl: string) => onReferenceImageModified(newUrl) : undefined}
              onRequestFullscreen={() => onZoomImage(referenceImage.url)}
              onToolbarStateChange={setToolbarState}
              overlay={
                <div className="absolute top-0 right-0 overflow-hidden w-32 h-32 pointer-events-none z-10" style={{ borderRadius: '0 20px 0 0' }}>
                  <div className="absolute top-[18px] right-[-36px] w-[180px] text-center rotate-45 text-black text-[11px] font-bold uppercase tracking-[0.2em] py-1 shadow-sm" style={{ backgroundColor: 'rgba(204, 255, 0, 0.75)' }}>
                    ref. Image
                  </div>
                </div>
              }
            />
          </div>
        ) : showPrompt && activeHeading?.lastPromptMap?.[activeLogicTab] ? (
          <div className="absolute inset-0 overflow-y-auto text-left px-6 py-4 animate-in fade-in duration-300">
            <article className="document-prose chat-prose pb-20 max-w-none" dangerouslySetInnerHTML={{ __html: marked.parse(activeHeading.lastPromptMap[activeLogicTab]!) as string }} />
          </div>
        ) : isGenerating ? (
          <div className="flex flex-col items-center space-y-8 animate-in fade-in duration-500">
            <div className="relative w-24 h-24">
              <div className="absolute inset-0 border-4 border-acid-lime/10 rounded-full" />
              <div className="absolute inset-0 border-4 border-t-acid-lime rounded-full animate-spin" />
              <div className="absolute inset-4 border-2 border-acid-lime/20 rounded-full animate-pulse" />
            </div>
            <div className="space-y-2">
              <p
                className="text-[11px] font-medium text-zinc-500 italic transition-all duration-300 ease-in-out"
                style={{ opacity: funMsgFade ? 1 : 0, transform: funMsgFade ? 'translateY(0)' : 'translateY(4px)' }}
              >
                {funMessages[funMsgIndex]}
              </p>
            </div>
          </div>
        ) : hasImage ? (
          <div
            ref={imageContainerRef}
            className="w-full h-full animate-in fade-in duration-300 relative"
          >
            <AnnotationWorkbench
              imageUrl={activeHeading!.cardUrlMap![activeLogicTab]!}
              headingId={activeHeading!.id}
              headingText={activeHeading!.text}
              palette={committedSettings.palette}
              style={committedSettings.style}
              aspectRatio={committedSettings.aspectRatio}
              resolution={committedSettings.resolution}
              imageHistory={activeHeading!.imageHistoryMap?.[activeLogicTab]}
              mode="inline"
              onImageModified={onImageModified}
              onRequestFullscreen={() => onZoomImage(activeHeading!.cardUrlMap![activeLogicTab] || '')}
              contentDirty={contentDirty}
              currentContent={currentContent}
              onToolbarStateChange={setToolbarState}
            />

          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center relative">
            {/* Generate button */}
            <button
              onClick={() => activeHeading && onGenerateCard(activeHeading)}
              disabled={!activeHeading || !!genStatus}
              className="w-14 h-14 rounded-full bg-black flex items-center justify-center shadow-lg shadow-[#00000033] hover:shadow-[0_0_24px_rgba(0,0,0,0.3)] hover:scale-110 active:scale-95 disabled:opacity-40 disabled:hover:shadow-lg disabled:hover:scale-100 disabled:active:scale-100 transition-all duration-300 mb-5"
              title="Generate card image"
            >
              <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
                {/* Image file icon (behind, shifted left) */}
                <path d="M4 4h8l6 6v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M12 4v4a2 2 0 0 0 2 2h4" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="7" cy="17" r="1.5" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />
                <path d="M16 24l-4-4a1 1 0 0 0-1.4 0L2 28" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                {/* Sparkle icon (front, shifted right, larger) */}
                <path d="M21 7l1.75 5.32a1.8 1.8 0 0 0 1.14 1.14L29.2 15.2l-5.32 1.75a1.8 1.8 0 0 0-1.14 1.14L21 23.4l-1.75-5.32a1.8 1.8 0 0 0-1.14-1.14L12.8 15.2l5.32-1.75a1.8 1.8 0 0 0 1.14-1.14L21 7Z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            <p className="text-zinc-400 text-xs font-light">
              Use AI Agent to generate <span className="tracking-tight"><span className="font-light italic">info</span><span className="font-semibold not-italic">nugget</span></span> card
            </p>
          </div>
        )}

        {/* Image info — below image, left-aligned */}
        {(showReference && referenceImage) || (hasImage && activeHeading?.settings) ? (
          <div className="absolute bottom-2 left-3 z-20">
            {showReference && referenceImage ? (
              <div className="flex items-center gap-1">
                <span className="text-[9px] font-medium uppercase text-zinc-300 tracking-[0.1em]">Image Properties</span>
                <span className="text-[9px] text-zinc-300">·</span>
                <span className="text-[9px] font-medium uppercase" style={{ color: '#ccff00' }}>ref</span>
                <span className="text-[9px] text-zinc-300">·</span>
                <span className="text-[9px] font-medium uppercase text-zinc-400">{referenceImage.settings.style}</span>
                <span className="text-[9px] text-zinc-300">·</span>
                <span className="text-[9px] font-medium uppercase text-zinc-400">{referenceImage.settings.aspectRatio}</span>
                <span className="text-[9px] text-zinc-300">·</span>
                <span className="text-[9px] font-medium uppercase text-zinc-400">{referenceImage.settings.resolution}</span>
                <div className="flex -space-x-0.5 ml-0.5">
                  {Object.values(referenceImage.settings.palette).map((color, i) => (
                    <div key={i} className="w-2 h-2 rounded-full ring-1 ring-white" style={{ backgroundColor: color, zIndex: 5 - i }} />
                  ))}
                </div>
              </div>
            ) : hasImage && activeHeading?.settings && (
              <div className="flex items-center gap-1">
                <span className="text-[9px] font-medium uppercase text-zinc-300 tracking-[0.1em]">Image Properties</span>
                <span className="text-[9px] text-zinc-300">·</span>
                <span className="text-[9px] font-medium uppercase text-zinc-400">{activeHeading.settings.style}</span>
                <span className="text-[9px] text-zinc-300">·</span>
                <span className="text-[9px] font-medium uppercase text-zinc-400">{activeHeading.settings.aspectRatio}</span>
                <span className="text-[9px] text-zinc-300">·</span>
                <span className="text-[9px] font-medium uppercase text-zinc-400">{activeHeading.settings.resolution}</span>
                <div className="flex -space-x-0.5 ml-0.5">
                  {Object.values(activeHeading.settings.palette).map((color, i) => (
                    <div
                      key={i}
                      className="w-2 h-2 rounded-full ring-1 ring-white"
                      style={{ backgroundColor: color, zIndex: 5 - i }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* ─── Footer: annotation toolbar (with zoom) ─── */}
      <div className="px-3 pt-2 h-[48px] flex items-center justify-center shrink-0 relative z-30">
        {/* Annotation toolbar (includes zoom controls) */}
        <div className="flex justify-center">
          {hasImage && toolbarState && (
            <AnnotationToolbar
              activeTool={toolbarState.activeTool}
              onToolChange={toolbarState.onToolChange}
              annotationCount={toolbarState.annotationCount}
              onDiscardMarks={toolbarState.onDiscardMarks}
              onModify={toolbarState.onModify}
              isModifying={toolbarState.isModifying}
              activeColor={toolbarState.activeColor}
              onColorChange={toolbarState.onColorChange}
              palette={toolbarState.palette}
              contentDirty={toolbarState.contentDirty}
              hasSelection={toolbarState.hasSelection}
              onDeleteSelected={toolbarState.onDeleteSelected}
              inline
              zoomScale={toolbarState.zoomScale}
              onZoomIn={toolbarState.onZoomIn}
              onZoomOut={toolbarState.onZoomOut}
              onZoomReset={toolbarState.onZoomReset}
              onRequestFullscreen={toolbarState.onRequestFullscreen}
              globalInstruction={toolbarState.globalInstruction}
              onGlobalInstructionChange={toolbarState.onGlobalInstructionChange}
            />
          )}
        </div>

      </div>

      {/* Mismatch dialog — positioned within cardlab */}
      {mismatchDialog && (
        <ReferenceMismatchDialog
          onDisableReference={() => { mismatchDialog.resolve('disable'); onDismissMismatch?.(); }}
          onSkipOnce={() => { mismatchDialog.resolve('skip'); onDismissMismatch?.(); }}
          onCancel={() => { mismatchDialog.resolve('cancel'); onDismissMismatch?.(); }}
        />
      )}

      {/* Manifest batch confirmation — positioned within cardlab */}
      {manifestHeadings && onExecuteBatch && onCloseManifest && (
        <ManifestModal manifestHeadings={manifestHeadings} onExecute={onExecuteBatch} onClose={onCloseManifest} />
      )}
    </section>
  );
};

export default AssetLab;
