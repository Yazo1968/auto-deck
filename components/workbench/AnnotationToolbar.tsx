import React, { useState, useRef, useEffect } from 'react';
import { AnnotationTool, Palette } from '../../types';

interface AnnotationToolbarProps {
  activeTool: AnnotationTool;
  onToolChange: (tool: AnnotationTool) => void;
  annotationCount: number;
  onDiscardMarks: () => void;
  onModify?: () => void;
  isModifying?: boolean;
  activeColor?: string;
  onColorChange?: (color: string) => void;
  palette?: Palette;
  disabled?: boolean;
  contentDirty?: boolean;
  hasSelection?: boolean;
  onDeleteSelected?: () => void;
  inline?: boolean;
  zoomScale?: number;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onZoomReset?: () => void;
  onRequestFullscreen?: () => void;
  globalInstruction?: string;
  onGlobalInstructionChange?: (text: string) => void;
}

const tools: { id: AnnotationTool; label: string; icon: React.ReactNode; enabled: boolean }[] = [
  {
    id: 'select',
    label: 'Select',
    enabled: true,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z"/>
      </svg>
    ),
  },
  {
    id: 'pin',
    label: 'Pin',
    enabled: true,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>
      </svg>
    ),
  },
  {
    id: 'arrow',
    label: 'Arrow',
    enabled: true,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 17V7h10"/><path d="M17 17 7 7"/>
      </svg>
    ),
  },
  {
    id: 'rectangle',
    label: 'Rectangle',
    enabled: true,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 3a2 2 0 0 0-2 2"/><path d="M19 3a2 2 0 0 1 2 2"/><path d="M21 19a2 2 0 0 1-2 2"/><path d="M5 21a2 2 0 0 1-2-2"/><path d="M9 3h1"/><path d="M9 21h1"/><path d="M14 3h1"/><path d="M14 21h1"/><path d="M3 9v1"/><path d="M21 9v1"/><path d="M3 14v1"/><path d="M21 14v1"/>
      </svg>
    ),
  },
  {
    id: 'sketch',
    label: 'Sketch',
    enabled: true,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 3.5c5-2 7 2.5 3 4C1.5 10 2 15 5 16c5 2 9-10 14-7s.5 13.5-4 12c-5-2.5.5-11 6-2"/>
      </svg>
    ),
  },
];

const AnnotationToolbar: React.FC<AnnotationToolbarProps> = ({
  activeTool,
  onToolChange,
  annotationCount,
  onDiscardMarks,
  onModify,
  isModifying,
  activeColor,
  onColorChange,
  palette,
  disabled,
  contentDirty,
  hasSelection,
  onDeleteSelected,
  inline,
  zoomScale,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onRequestFullscreen,
  globalInstruction,
  onGlobalInstructionChange,
}) => {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showTextPanel, setShowTextPanel] = useState(false);
  const [showDeleteMenu, setShowDeleteMenu] = useState(false);
  const deleteMenuRef = useRef<HTMLDivElement>(null);
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);
  const textPanelRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const hasGlobalText = !!(globalInstruction && globalInstruction.trim());
  const canModify = annotationCount > 0 || !!contentDirty || hasGlobalText;

  // Close color picker on click outside
  useEffect(() => {
    if (!showColorPicker) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) {
        setShowColorPicker(false);
      }
    };
    const timer = setTimeout(() => {
      window.addEventListener('mousedown', handleClickOutside);
    }, 50);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showColorPicker]);

  // Close text panel on click outside
  useEffect(() => {
    if (!showTextPanel) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (textPanelRef.current && !textPanelRef.current.contains(e.target as Node)) {
        setShowTextPanel(false);
      }
    };
    const timer = setTimeout(() => {
      window.addEventListener('mousedown', handleClickOutside);
    }, 50);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showTextPanel]);

  // Close delete menu on click outside
  useEffect(() => {
    if (!showDeleteMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (deleteMenuRef.current && !deleteMenuRef.current.contains(e.target as Node)) {
        setShowDeleteMenu(false);
      }
    };
    const timer = setTimeout(() => {
      window.addEventListener('mousedown', handleClickOutside);
    }, 50);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDeleteMenu]);

  // Auto-focus textarea when panel opens
  useEffect(() => {
    if (showTextPanel && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [showTextPanel]);

  // Build palette colors array
  const paletteColors: string[] = [];
  if (palette) {
    const vals = [palette.primary, palette.secondary, palette.accent, palette.text, palette.background];
    for (const c of vals) {
      if (c && !paletteColors.includes(c)) paletteColors.push(c);
    }
  }
  // Always include some defaults if palette is sparse
  const defaultColors = ['#E63946', '#457B9D', '#2A9D8F', '#E9C46A', '#264653'];
  for (const c of defaultColors) {
    if (!paletteColors.includes(c) && paletteColors.length < 5) {
      paletteColors.push(c);
    }
  }

  return (
    <div className={`${inline ? '' : 'absolute bottom-6 left-1/2 -translate-x-1/2 z-[115] '} px-1.5 h-9 flex items-center space-x-1 animate-in fade-in slide-in-from-bottom-2 duration-300`}>
      {/* Zoom controls: - % + */}
      {onZoomOut && onZoomIn && zoomScale !== undefined && (
        <>
          <button
            onClick={onZoomOut}
            title="Zoom Out"
            className="w-7 h-7 rounded-full flex items-center justify-center transition-all text-black hover:bg-zinc-100"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
          <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-black min-w-[32px] text-center select-none">{Math.round(zoomScale * 100)}%</span>
          <button
            onClick={onZoomIn}
            title="Zoom In"
            className="w-7 h-7 rounded-full flex items-center justify-center transition-all text-black hover:bg-zinc-100"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
          {onZoomReset && (
            <button
              onClick={onZoomReset}
              title="Reset Zoom & Recenter"
              className="w-7 h-7 rounded-full flex items-center justify-center transition-all text-black hover:bg-zinc-100"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><rect width="10" height="8" x="7" y="8" rx="1"/>
              </svg>
            </button>
          )}
          <div className="w-px h-3.5 bg-zinc-200 mx-0.5" />
        </>
      )}

      {/* Tool Buttons */}
      {tools.map((tool) => (
        <button
          key={tool.id}
          onClick={() => tool.enabled && !disabled && onToolChange(tool.id)}
          disabled={!tool.enabled || disabled}
          title={tool.label}
          className={`
            w-7 h-7 rounded-full flex items-center justify-center transition-all
            ${activeTool === tool.id
              ? 'bg-zinc-900 text-white shadow-md scale-105'
              : 'text-black hover:bg-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent'
            }
          `}
        >
          {tool.icon}
        </button>
      ))}

      {/* Text Instruction Button */}
      {onGlobalInstructionChange && (
        <div className="relative" ref={textPanelRef}>
          <button
            onClick={() => setShowTextPanel(!showTextPanel)}
            title="Text Instruction"
            className={`
              w-7 h-7 rounded-full flex items-center justify-center transition-all relative
              ${showTextPanel
                ? 'bg-zinc-900 text-white shadow-md scale-105'
                : hasGlobalText
                  ? 'text-black bg-zinc-100'
                  : 'text-black hover:bg-zinc-100'
              }
            `}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z"/>
            </svg>
            {/* Dot indicator when instruction text exists */}
            {hasGlobalText && !showTextPanel && (
              <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-zinc-900 border-2 border-white" />
            )}
          </button>

          {/* Text instruction popover */}
          {showTextPanel && (
            <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 bg-white rounded-2xl shadow-2xl border border-zinc-100 p-3 animate-in fade-in zoom-in-95 duration-200 w-[280px]">
              <div className="flex items-center justify-between mb-2 px-1">
                <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-400">Instruction</div>
                {hasGlobalText && (
                  <button
                    onClick={() => onGlobalInstructionChange('')}
                    className="text-[9px] font-medium uppercase text-zinc-400 hover:text-red-500 transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
              <textarea
                ref={textareaRef}
                value={globalInstruction || ''}
                onChange={(e) => onGlobalInstructionChange(e.target.value)}
                placeholder="Describe changes to apply globally..."
                rows={3}
                className="w-full text-xs text-zinc-700 bg-zinc-50 rounded-xl px-3 py-2 border border-zinc-200 focus:outline-none focus:border-zinc-400 resize-none placeholder:text-zinc-300"
                onKeyDown={(e) => {
                  // Prevent Escape from bubbling to annotation workbench
                  if (e.key === 'Escape') {
                    e.stopPropagation();
                    setShowTextPanel(false);
                  }
                }}
              />
              <p className="text-[9px] text-zinc-300 mt-1.5 px-1">
                Non-spatial directives sent before annotations
              </p>
            </div>
          )}
        </div>
      )}

      {/* Delete annotations — dropdown */}
      <div className="relative" ref={deleteMenuRef}>
        <button
          onClick={() => setShowDeleteMenu(!showDeleteMenu)}
          disabled={annotationCount === 0 && !hasSelection}
          title="Delete annotations"
          className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${showDeleteMenu ? 'bg-zinc-900 text-white shadow-md scale-105' : 'text-black hover:text-red-500 hover:bg-red-50'} disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-black`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
          </svg>
        </button>
        {showDeleteMenu && (
          <div
            className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-white rounded-lg border border-zinc-200 py-1 min-w-[180px] z-[140] animate-in fade-in zoom-in-95 duration-150"
            style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)' }}
          >
            <button
              onClick={() => { onDeleteSelected?.(); setShowDeleteMenu(false); }}
              disabled={!hasSelection}
              className="w-full text-left px-3 py-1.5 text-[11px] text-zinc-700 hover:bg-zinc-50 transition-colors flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400">
                <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
              </svg>
              Delete Selected
            </button>
            <button
              onClick={() => { onDiscardMarks(); setShowDeleteMenu(false); }}
              disabled={annotationCount === 0}
              className="w-full text-left px-3 py-1.5 text-[11px] text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
              </svg>
              Delete All Annotations
            </button>
          </div>
        )}
      </div>

      {/* Separator */}
      <div className="w-px h-3.5 bg-zinc-200 mx-0.5" />

      {/* Color Picker */}
      {onColorChange && (
        <div className="relative" ref={colorPickerRef}>
          <button
            onClick={() => setShowColorPicker(!showColorPicker)}
            title="Annotation Color"
            className="w-7 h-7 rounded-full flex items-center justify-center transition-all hover:scale-110"
          >
            <div
              className="w-4 h-4 rounded-full border-2 border-white shadow-md transition-transform"
              style={{ backgroundColor: activeColor || '#E63946' }}
            />
          </button>

          {/* Color picker popover */}
          {showColorPicker && (
            <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 bg-white rounded-2xl shadow-2xl border border-zinc-100 p-3 animate-in fade-in zoom-in-95 duration-200">
              <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-400 mb-2 px-1">Color</div>
              <div className="flex items-center space-x-2">
                {paletteColors.map((color) => (
                  <button
                    key={color}
                    onClick={() => {
                      onColorChange(color);
                      setShowColorPicker(false);
                    }}
                    className="relative w-7 h-7 rounded-full transition-all hover:scale-110"
                    style={{ backgroundColor: color }}
                    title={color}
                  >
                    {activeColor === color && (
                      <div className="absolute inset-0 rounded-full border-[2.5px] border-[#ccff00] shadow-[0_0_0_2px_rgba(0,0,0,0.1)]" />
                    )}
                  </button>
                ))}

                {/* Custom color button */}
                <button
                  onClick={() => colorInputRef.current?.click()}
                  className="w-7 h-7 rounded-full border-2 border-dashed border-zinc-200 flex items-center justify-center text-zinc-400 hover:border-zinc-400 hover:text-zinc-600 transition-colors"
                  title="Custom color"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                </button>
                <input
                  ref={colorInputRef}
                  type="color"
                  value={activeColor || '#E63946'}
                  onChange={(e) => {
                    onColorChange(e.target.value);
                    setShowColorPicker(false);
                  }}
                  className="sr-only"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Fullscreen */}
      {onRequestFullscreen && (
        <>
          <div className="w-px h-3.5 bg-zinc-200 mx-0.5" />
          <button
            onClick={onRequestFullscreen}
            title="Open Fullscreen"
            className="w-7 h-7 rounded-full flex items-center justify-center transition-all text-black hover:bg-zinc-100"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
            </svg>
          </button>
        </>
      )}

      {/* Separator */}
      <div className="w-px h-3.5 bg-zinc-200 mx-0.5" />

      {/* Apply Changes */}
      <button
        onClick={onModify}
        disabled={!canModify || isModifying}
        title={contentDirty && annotationCount === 0 && !hasGlobalText ? 'Re-render with updated content' : 'Apply Changes'}
        className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${isModifying ? 'animate-spin text-black' : 'text-black hover:bg-zinc-100'} disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent`}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="-rotate-90">
          <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>
        </svg>
      </button>
    </div>
  );
};

export default AnnotationToolbar;
