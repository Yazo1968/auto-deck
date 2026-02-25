import React from 'react';
import { useNuggetContext } from '../context/NuggetContext';
import { useSelectionContext } from '../context/SelectionContext';

// ── Requirement levels by panel ──
// sources / chat / auto-deck → Project, Nugget, Document
// cards                      → Project, Nugget, Document, Card
// assets                     → Project, Nugget, Document, Card, Image

type RequirementLevel = 'sources' | 'cards' | 'assets';

type Requirement = 'Project' | 'Nugget' | 'Document' | 'Card' | 'Image';

interface PanelRequirementsProps {
  level: RequirementLevel;
  /** For assets level: whether the active card has a generated image. */
  hasImage?: boolean;
}

const LEVEL_ITEMS: Record<RequirementLevel, Requirement[]> = {
  sources: ['Project', 'Nugget', 'Document'],
  cards: ['Project', 'Nugget', 'Document', 'Card'],
  assets: ['Project', 'Nugget', 'Document', 'Card', 'Image'],
};

const HINTS: Record<Requirement, string> = {
  Project: 'Create a project from the Projects panel.',
  Nugget: 'Add a nugget using the + button in the Projects panel.',
  Document: 'Upload documents via the \u22EF menu on the nugget.',
  Card: 'Generate cards from the Sources panel or Chat.',
  Image: 'Select a card and click Generate in the toolbar.',
};

const CheckIcon: React.FC = () => (
  <svg
    className="w-3 h-3 text-emerald-500 shrink-0"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={3}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

const CrossIcon: React.FC = () => (
  <svg
    className="w-3 h-3 text-zinc-300 dark:text-zinc-600 shrink-0"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={3}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const PanelRequirements: React.FC<PanelRequirementsProps> = ({ level, hasImage = false }) => {
  const { selectedNugget } = useNuggetContext();
  const { selectedProjectId, activeCard: _activeCard } = useSelectionContext();

  const flags: Record<Requirement, boolean> = {
    Project: !!selectedProjectId,
    Nugget: !!selectedNugget,
    Document: (selectedNugget?.documents.filter((d) => d.enabled !== false).length ?? 0) > 0,
    Card: (selectedNugget?.cards.length ?? 0) > 0,
    Image: hasImage,
  };

  const items = LEVEL_ITEMS[level];
  const firstMissing = items.find((r) => !flags[r]);

  // All requirements met — nothing to show
  if (!firstMissing) return null;

  return (
    <div className="flex flex-col items-center gap-2.5 py-4">
      <div className="flex items-center gap-3.5">
        {items.map((item) => {
          const met = flags[item];
          return (
            <div key={item} className="flex items-center gap-1">
              {met ? <CheckIcon /> : <CrossIcon />}
              <span
                className={`text-[11px] leading-none ${
                  met ? 'text-zinc-500 dark:text-zinc-400' : 'text-zinc-300 dark:text-zinc-600'
                }`}
              >
                {item}
              </span>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-zinc-400 dark:text-zinc-500 font-light">{HINTS[firstMissing]}</p>
    </div>
  );
};

export default PanelRequirements;
