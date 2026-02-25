import React, { useState, useCallback, useRef, useEffect, createContext, useContext } from 'react';
import { createPortal } from 'react-dom';

// ── Toast types ──

interface Toast {
  id: string;
  type: 'error' | 'warning' | 'info' | 'success';
  message: string;
  /** Optional sub-message (e.g. retry progress) */
  detail?: string;
  /** If provided, renders a retry button that calls this */
  onRetry?: () => void;
  /** Auto-dismiss after this many ms (0 = manual dismiss only). Default: 6000 */
  duration?: number;
}

interface ToastContextValue {
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  updateToast: (id: string, updates: Partial<Omit<Toast, 'id'>>) => void;
}

const ToastContext = createContext<ToastContextValue>({
  addToast: () => '',
  removeToast: () => {},
  updateToast: () => {},
});

export const useToast = () => useContext(ToastContext);

// ── Single toast item ──

const ToastItem: React.FC<{ toast: Toast; onDismiss: () => void }> = ({ toast, onDismiss }) => {
  const [exiting, setExiting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const dismiss = useCallback(() => {
    setExiting(true);
    setTimeout(onDismiss, 250);
  }, [onDismiss]);

  useEffect(() => {
    const dur = toast.duration ?? 6000;
    if (dur > 0) {
      timerRef.current = setTimeout(dismiss, dur);
      return () => clearTimeout(timerRef.current);
    }
  }, [toast.duration, dismiss]);

  const colors = {
    error: {
      bg: 'bg-red-50 dark:bg-red-950',
      border: 'border-red-200 dark:border-red-800',
      text: 'text-red-700 dark:text-red-300',
      icon: '#E63946',
    },
    warning: {
      bg: 'bg-amber-50 dark:bg-amber-950',
      border: 'border-amber-200 dark:border-amber-800',
      text: 'text-amber-700 dark:text-amber-300',
      icon: '#D97706',
    },
    info: {
      bg: 'bg-blue-50 dark:bg-blue-950',
      border: 'border-blue-200 dark:border-blue-800',
      text: 'text-blue-700 dark:text-blue-300',
      icon: '#2563EB',
    },
    success: {
      bg: 'bg-emerald-50 dark:bg-emerald-950',
      border: 'border-emerald-200 dark:border-emerald-800',
      text: 'text-emerald-700 dark:text-emerald-300',
      icon: '#059669',
    },
  }[toast.type];

  const icons = {
    error: (
      <>
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </>
    ),
    warning: (
      <>
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </>
    ),
    info: (
      <>
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </>
    ),
    success: (
      <>
        <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </>
    ),
  }[toast.type];

  return (
    <div
      className={`
        ${colors.bg} ${colors.border} border rounded-2xl px-4 py-2.5 shadow-lg dark:shadow-black/30
        flex items-start gap-2.5 max-w-[420px] min-w-[300px]
        ${exiting ? 'animate-out fade-out slide-out-to-top-2 duration-250' : 'animate-in fade-in slide-in-from-top-2 duration-300'}
      `}
      onMouseEnter={() => timerRef.current && clearTimeout(timerRef.current)}
      onMouseLeave={() => {
        const dur = toast.duration ?? 6000;
        if (dur > 0) timerRef.current = setTimeout(dismiss, dur);
      }}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke={colors.icon}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="mt-0.5 shrink-0"
      >
        {icons}
      </svg>

      <div className="flex-1 min-w-0">
        <p className={`text-[11px] font-medium ${colors.text} leading-snug`}>{toast.message}</p>
        {toast.detail && <p className={`text-[10px] ${colors.text} opacity-70 mt-0.5`}>{toast.detail}</p>}
        {toast.onRetry && (
          <button
            onClick={toast.onRetry}
            className={`mt-1.5 text-[10px] font-bold ${colors.text} underline underline-offset-2 hover:opacity-80 transition-opacity`}
          >
            Retry Now
          </button>
        )}
      </div>

      <button
        onClick={dismiss}
        className={`${colors.text} opacity-50 hover:opacity-100 transition-opacity mt-0.5 shrink-0`}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
};

// ── Toast Provider + Container ──

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counterRef = useRef(0);

  const addToast = useCallback((toast: Omit<Toast, 'id'>): string => {
    const id = `toast-${++counterRef.current}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const updateToast = useCallback((id: string, updates: Partial<Omit<Toast, 'id'>>) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast, updateToast }}>
      {children}
      {createPortal(
        <div
          role="alert"
          aria-live="polite"
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center gap-2 pointer-events-none"
        >
          {toasts.map((toast) => (
            <div key={toast.id} className="pointer-events-auto">
              <ToastItem toast={toast} onDismiss={() => removeToast(toast.id)} />
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
};
