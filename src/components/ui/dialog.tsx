"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  eyebrow?: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function Dialog({
  open,
  onClose,
  eyebrow,
  title,
  description,
  children,
}: DialogProps) {
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-zinc-950/35 backdrop-blur-[2px] transition-opacity"
      />

      {/* Dialog Panel */}
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-zinc-200/90 bg-white p-6 shadow-2xl shadow-zinc-950/15 ring-1 ring-black/5">
        <div className="flex items-start justify-between gap-4 border-b border-zinc-100 pb-4 mb-5">
          <div>
            {eyebrow && (
              <span className="block font-mono text-[10px] uppercase tracking-widest text-zinc-400 mb-0.5">
                {eyebrow}
              </span>
            )}
            <h2
              id="dialog-title"
              className="text-base font-semibold tracking-tight text-zinc-950"
            >
              {title}
            </h2>
            {description && (
              <p className="text-xs text-zinc-500 mt-0.5">{description}</p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar janela"
            className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-transparent text-zinc-400 hover:border-zinc-200 hover:bg-zinc-100 hover:text-zinc-900 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}
