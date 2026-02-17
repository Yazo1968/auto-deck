
import React, { useState, useEffect, useCallback } from 'react';

interface LandingPageProps {
  onLaunch: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onLaunch }) => {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  const handleLaunch = useCallback(() => {
    setExiting(true);
    setTimeout(() => onLaunch(), 400);
  }, [onLaunch]);

  const transition = 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)';

  const stagger = (delay: number): React.CSSProperties => ({
    opacity: visible && !exiting ? 1 : 0,
    transform: visible && !exiting ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.98)',
    transition,
    transitionDelay: exiting ? '0ms' : `${delay}ms`,
  });

  return (
    <div
      className="relative h-screen w-full flex flex-col items-center justify-center overflow-hidden"
      style={{ backgroundColor: '#0a0a0a' }}
    >
      {/* Dot grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{
          backgroundImage: 'radial-gradient(rgba(204,255,0,0.5) 0.5px, transparent 0.5px)',
          backgroundSize: '32px 32px',
        }}
      />
      {/* Center spotlight */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(204,255,0,0.03) 0%, transparent 60%)',
        }}
      />

      {/* Hero */}
      <div className="relative z-10 flex flex-col items-center text-center px-6">
        {/* Logo */}
        <div style={stagger(0)} className="mb-8">
          <div className="relative">
            <div
              className="absolute inset-0 rounded-full animate-pulse"
              style={{ boxShadow: '0 0 60px 20px rgba(204, 255, 0, 0.12)' }}
            />
            <div className="w-20 h-20 bg-acid-lime rounded-full flex items-center justify-center shadow-2xl relative z-10">
              <div className="w-7 h-7 bg-white rounded-md rotate-45" />
            </div>
          </div>
        </div>

        {/* Wordmark */}
        <h1 style={stagger(200)} className="text-6xl tracking-tighter mb-4">
          <span className="font-light italic text-zinc-400">info</span>
          <span className="font-semibold not-italic text-white">nugget</span>
        </h1>

        {/* Tagline */}
        <p style={stagger(400)} className="text-lg font-light text-zinc-500 max-w-sm">
          Condense knowledge into digestible insights.
        </p>

        {/* CTA */}
        <div style={stagger(600)}>
          <button
            onClick={handleLaunch}
            className="mt-12 px-10 py-4 rounded-full bg-acid-lime text-black text-xs font-black uppercase tracking-[0.2em] shadow-xl hover:shadow-[0_0_40px_rgba(204,255,0,0.3)] hover:scale-105 active:scale-95 transition-all duration-300"
          >
            Launch Workspace
          </button>
        </div>

        {/* Feature pills */}
        <div style={stagger(800)} className="flex items-center gap-8 mt-16">
          <div className="flex items-center gap-2 text-zinc-600">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            <span className="text-[10px] font-bold uppercase tracking-widest">MD / PDF / DOCX</span>
          </div>
          <div className="flex items-center gap-2 text-zinc-600">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3Z"/>
            </svg>
            <span className="text-[10px] font-bold uppercase tracking-widest">AI Synthesis</span>
          </div>
          <div className="flex items-center gap-2 text-zinc-600">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
            <span className="text-[10px] font-bold uppercase tracking-widest">Infographic Cards</span>
          </div>
        </div>
      </div>

      {/* Version */}
      <div style={stagger(1000)} className="absolute bottom-6">
        <p className="text-[10px] text-zinc-700 font-light tracking-wide">v3.0</p>
      </div>
    </div>
  );
};

export default LandingPage;
