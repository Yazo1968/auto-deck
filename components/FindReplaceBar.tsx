import React from 'react';

interface FindReplaceBarProps {
  findInputRef: React.RefObject<HTMLInputElement | null>;
  findQuery: string;
  setFindQuery: (q: string) => void;
  replaceQuery: string;
  setReplaceQuery: (q: string) => void;
  findMatchCount: number;
  findActiveIndex: number;
  setFindActiveIndex: (i: number) => void;
  findMatchCase: boolean;
  setFindMatchCase: React.Dispatch<React.SetStateAction<boolean>>;
  findNext: () => void;
  findPrev: () => void;
  closeFindBar: () => void;
  handleReplace: () => void;
  handleReplaceAll: () => void;
}

export const FindReplaceBar: React.FC<FindReplaceBarProps> = ({
  findInputRef,
  findQuery,
  setFindQuery,
  replaceQuery,
  setReplaceQuery,
  findMatchCount,
  findActiveIndex,
  setFindActiveIndex,
  findMatchCase,
  setFindMatchCase,
  findNext,
  findPrev,
  closeFindBar,
  handleReplace,
  handleReplaceAll,
}) => {
  return (
    <div
      data-find-bar
      className="z-30 px-6 lg:px-8 pb-3 pt-3 bg-white dark:bg-zinc-900 border-b border-zinc-100/60 dark:border-zinc-600/60 animate-in fade-in slide-in-from-top-2 duration-200"
    >
      <div className="max-w-2xl mx-auto">
        <div className="bg-white/80 dark:bg-zinc-800/80 backdrop-blur-xl border border-zinc-100/80 dark:border-zinc-600/80 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] p-3 space-y-2">
          {/* Find row */}
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <input
                ref={findInputRef}
                type="text"
                value={findQuery}
                onChange={(e) => {
                  setFindQuery(e.target.value);
                  setFindActiveIndex(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.shiftKey ? findPrev() : findNext();
                  }
                  if (e.key === 'Escape') closeFindBar();
                }}
                placeholder="Find..."
                aria-label="Find text"
                className="w-full pl-3 pr-16 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-600 text-xs text-zinc-600 dark:text-zinc-300 placeholder:text-zinc-500 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-400/50 dark:focus:ring-zinc-500/50 focus:border-zinc-300 dark:focus:border-zinc-600 transition-colors"
              />
              {findQuery && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-medium uppercase text-zinc-500 dark:text-zinc-400">
                  {findMatchCount > 0 ? `${findActiveIndex + 1} of ${findMatchCount}` : 'No matches'}
                </span>
              )}
            </div>
            <button
              onClick={() => {
                setFindMatchCase((prev) => !prev);
                setFindActiveIndex(0);
              }}
              className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-medium uppercase transition-all ${findMatchCase ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200' : 'hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-800 dark:hover:text-zinc-200 text-zinc-600 dark:text-zinc-400'}`}
              title="Match case"
              aria-label="Match case"
            >
              Aa
            </button>
            <button
              onClick={findPrev}
              disabled={findMatchCount === 0}
              className="w-7 h-7 rounded-full flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-800 dark:hover:text-zinc-200 disabled:opacity-40 disabled:pointer-events-none transition-all"
              title="Previous match"
              aria-label="Previous match"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m18 15-6-6-6 6" />
              </svg>
            </button>
            <button
              onClick={findNext}
              disabled={findMatchCount === 0}
              className="w-7 h-7 rounded-full flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-800 dark:hover:text-zinc-200 disabled:opacity-40 disabled:pointer-events-none transition-all"
              title="Next match"
              aria-label="Next match"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
            <button
              onClick={closeFindBar}
              className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-800 dark:hover:text-zinc-200 text-zinc-600 dark:text-zinc-400 transition-all"
              title="Close"
              aria-label="Close find bar"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>

          {/* Replace row */}
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <input
                type="text"
                value={replaceQuery}
                onChange={(e) => setReplaceQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') closeFindBar();
                }}
                placeholder="Replace..."
                aria-label="Replace text"
                className="w-full pl-3 pr-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-600 text-xs text-zinc-600 dark:text-zinc-300 placeholder:text-zinc-500 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-400/50 dark:focus:ring-zinc-500/50 focus:border-zinc-300 dark:focus:border-zinc-600 transition-colors"
              />
            </div>
            <button
              onClick={handleReplace}
              disabled={findMatchCount === 0}
              className="h-7 px-2.5 rounded-full text-[10px] font-medium uppercase tracking-wider text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-800 dark:hover:text-zinc-200 disabled:opacity-40 disabled:pointer-events-none transition-all"
              title="Replace"
            >
              Replace
            </button>
            <button
              onClick={handleReplaceAll}
              disabled={findMatchCount === 0}
              className="h-7 px-2.5 rounded-full text-[10px] font-medium uppercase tracking-wider text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-800 dark:hover:text-zinc-200 disabled:opacity-40 disabled:pointer-events-none transition-all"
              title="Replace all"
            >
              All
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
