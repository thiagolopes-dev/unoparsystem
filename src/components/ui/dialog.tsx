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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-[#02040a]/75 backdrop-blur-md transition-opacity"
      />

      {/* Dialog Panel */}
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-white/15 bg-[#0b1224]/90 backdrop-blur-2xl p-6 text-slate-100 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.85),0_0_45px_-16px_rgba(34,211,238,0.2)] ring-1 ring-white/5 my-auto">
        {/* Top specular cyan glass edge */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/60 to-transparent"
        />

        <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4 mb-5">
          <div>
            {eyebrow && (
              <span className="block font-mono text-[10px] uppercase tracking-widest text-cyan-400 mb-0.5">
                {eyebrow}
              </span>
            )}
            <h2
              id="dialog-title"
              className="text-base font-semibold tracking-tight text-white"
            >
              {title}
            </h2>
            {description && (
              <p className="text-xs text-slate-400 mt-0.5">{description}</p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar janela"
            className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-transparent text-slate-400 hover:border-white/15 hover:bg-white/[0.08] hover:text-white focus-visible:border-cyan-400/50 focus-visible:text-white transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}
