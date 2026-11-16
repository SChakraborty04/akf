import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

const ToastContext = createContext();

const VARIANT_STYLES = {
  success: {
    container: 'bg-emerald-900/95 border-emerald-500/60 text-white shadow-emerald-950/30',
    iconWrap: 'bg-emerald-500/20 text-emerald-300',
    Icon: CheckCircle2,
  },
  error: {
    container: 'bg-rose-900/95 border-rose-500/60 text-white shadow-rose-950/30',
    iconWrap: 'bg-rose-500/20 text-rose-200',
    Icon: AlertCircle,
  },
  warning: {
    container: 'bg-amber-900/95 border-amber-500/60 text-white shadow-amber-950/30',
    iconWrap: 'bg-amber-500/20 text-amber-200',
    Icon: AlertTriangle,
  },
  info: {
    container: 'bg-slate-900/95 border-slate-600/60 text-white shadow-slate-950/30',
    iconWrap: 'bg-slate-500/20 text-slate-200',
    Icon: Info,
  },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());

  const removeToast = useCallback((id) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  const showToast = useCallback(
    ({ type = 'success', message, title, duration = 3000 }) => {
      if (!message) return;
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      setToasts((prev) => {
        const next = [...prev, { id, type, message, title }];
        return next.slice(-3);
      });

      const timer = setTimeout(() => {
        removeToast(id);
      }, duration);
      timersRef.current.set(id, timer);

      return id;
    },
    [removeToast]
  );

  const toast = {
    show: showToast,
    success: (message, title) => showToast({ type: 'success', message, title }),
    error: (message, title) => showToast({ type: 'error', message, title, duration: 3800 }),
    warning: (message, title) => showToast({ type: 'warning', message, title, duration: 3500 }),
    info: (message, title) => showToast({ type: 'info', message, title }),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}

      {/* Global Toast Container */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="fixed top-2.5 left-0 right-0 z-[100] max-w-md mx-auto px-3 pointer-events-none flex flex-col gap-2"
      >
        {toasts.map((item) => {
          const variant = VARIANT_STYLES[item.type] || VARIANT_STYLES.info;
          const IconComponent = variant.Icon;
          return (
            <div
              key={item.id}
              role="status"
              className={`pointer-events-auto flex items-center space-x-2.5 px-3.5 py-2.5 rounded-2xl border backdrop-blur-md shadow-xl animate-fadeIn ${variant.container}`}
            >
              <div className={`p-1.5 rounded-xl shrink-0 ${variant.iconWrap}`}>
                <IconComponent className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                {item.title && (
                  <div className="text-[11px] font-extrabold tracking-tight leading-tight">
                    {item.title}
                  </div>
                )}
                <div className="text-xs font-semibold leading-snug break-words">
                  {item.message}
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeToast(item.id)}
                aria-label="Dismiss notification"
                className="p-1 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}

