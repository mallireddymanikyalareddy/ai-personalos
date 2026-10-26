"use client";

import * as React from "react";

import { CheckCircle2, XCircle } from "lucide-react";

import { cn } from "@/lib/cn";

interface ToastItem {
  id: number;
  message: string;
  tone: "default" | "success" | "danger";
  action?: { label: string; onClick: () => void };
}

interface ToastContextValue {
  toast: (
    message: string,
    options?: { tone?: ToastItem["tone"]; action?: ToastItem["action"] },
  ) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

let toastCounter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);

  const dismiss = React.useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = React.useCallback<ToastContextValue["toast"]>(
    (message, options) => {
      const id = ++toastCounter;
      setItems((current) => [
        ...current.slice(-2),
        { id, message, tone: options?.tone ?? "default", action: options?.action },
      ]);
      window.setTimeout(() => dismiss(id), options?.action ? 6000 : 3500);
    },
    [dismiss],
  );

  const contextValue = React.useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6"
      >
        {items.map((item) => (
          <div
            key={item.id}
            role="status"
            className={cn(
              "pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-xl border bg-surface px-4 py-3 text-sm shadow-float animate-toast-in",
              item.tone === "danger" ? "border-danger/30" : "border-line",
            )}
          >
            {item.tone === "success" && (
              <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden="true" />
            )}
            {item.tone === "danger" && (
              <XCircle className="size-4 shrink-0 text-danger" aria-hidden="true" />
            )}
            <span className="min-w-0 flex-1 text-ink">{item.message}</span>
            {item.action && (
              <button
                type="button"
                onClick={() => {
                  item.action?.onClick();
                  dismiss(item.id);
                }}
                className="shrink-0 text-sm font-medium text-accent-ink hover:underline"
              >
                {item.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = React.useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider");
  return context;
}
