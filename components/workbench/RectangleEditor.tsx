import React, { useState, useRef, useEffect } from 'react';

interface RectangleEditorProps {
  instruction: string;
  position: { x: number; y: number }; // screen coordinates near top edge of rectangle
  onSave: (instruction: string) => void;
  onDelete: () => void;
  onClose: () => void;
}

const RectangleEditor: React.FC<RectangleEditorProps> = ({ instruction, position, onSave, onDelete, onClose }) => {
  const [text, setText] = useState(instruction);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, []);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        handleSave();
      }
    };
    const timer = setTimeout(() => {
      window.addEventListener('mousedown', handleClickOutside);
    }, 100);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, [text]);

  const handleSave = () => {
    if (text.trim() === '') {
      onDelete();
    } else {
      onSave(text);
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      onClose();
    }
    e.stopPropagation();
  };

  // Position the popover above the rectangle's top edge
  const popoverStyle: React.CSSProperties = {
    position: 'fixed',
    left: Math.max(10, Math.min(position.x - 140, window.innerWidth - 300)),
    top: Math.max(10, position.y - 170),
    zIndex: 120,
  };

  return (
    <div ref={popoverRef} style={popoverStyle} className="animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
      <div className="w-72 bg-white rounded-[6px] border border-black overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-50 flex items-center justify-between">
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-black">Area Instruction</span>
          <button
            onClick={onDelete}
            className="text-zinc-400 hover:text-red-500 transition-colors"
            title="Delete Rectangle"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </div>
        <div className="p-4">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g., Redesign this chart area with updated data"
            rows={3}
            className="w-full bg-zinc-50 border border-black rounded-xl px-3 py-2 text-sm resize-none focus:outline-none transition-colors placeholder:text-zinc-300"
          />
        </div>
        <div className="px-4 pb-3 flex items-center justify-end space-x-2">
          <button
            onClick={handleSave}
            className="px-4 py-1.5 rounded-full bg-white text-black border border-black text-[9px] font-black uppercase tracking-widest hover:scale-105 transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default RectangleEditor;
