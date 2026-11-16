"use client";

import { useState, useRef, useEffect, useId, useMemo } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
  badge?: string;
  description?: string;
  dotColor?: string;
}

interface SelectProps {
  name?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  icon?: React.ReactNode;
  className?: string;
  size?: "sm" | "md";
  align?: "left" | "right";
  disabled?: boolean;
}

export function Select({
  name,
  value,
  onChange,
  options,
  placeholder = "Selecione...",
  searchable,
  searchPlaceholder = "Buscar opção...",
  icon,
  className = "",
  size = "md",
  align = "left",
  disabled = false,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  const showSearch = searchable ?? options.length > 6;

  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value),
    [options, value]
  );

  const filteredOptions = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        opt.badge?.toLowerCase().includes(q) ||
        opt.description?.toLowerCase().includes(q)
    );
  }, [options, query]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    const idx = filteredOptions.findIndex((o) => o.value === value);
    setHighlightedIndex(idx >= 0 ? idx : 0);
    if (showSearch) {
      requestAnimationFrame(() => searchInputRef.current?.focus());
    }
  }, [open, showSearch]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIndex((prev) =>
          filteredOptions.length > 0 ? (prev + 1) % filteredOptions.length : 0
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIndex((prev) =>
          filteredOptions.length > 0
            ? (prev - 1 + filteredOptions.length) % filteredOptions.length
            : 0
        );
      } else if (e.key === "Enter" && filteredOptions[highlightedIndex]) {
        e.preventDefault();
        onChange(filteredOptions[highlightedIndex].value);
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, filteredOptions, highlightedIndex, onChange]);

  const sizeClasses =
    size === "sm"
      ? "h-9 px-3 text-xs rounded-lg"
      : "h-10 px-3.5 text-xs rounded-xl";

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {name && <input type="hidden" name={name} value={value} />}

      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => setOpen((prev) => !prev)}
        className={`group w-full inline-flex items-center justify-between gap-2 border bg-white text-left font-medium transition-all cursor-pointer select-none ${sizeClasses} ${
          open
            ? "border-zinc-900 ring-2 ring-zinc-950/10 text-zinc-950"
            : "border-zinc-200/90 text-zinc-800 hover:border-zinc-300 hover:bg-zinc-50/60"
        } disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs`}
      >
        <span className="flex items-center gap-2 min-w-0 truncate">
          {icon && <span className="text-zinc-400 shrink-0">{icon}</span>}
          {selectedOption?.dotColor && (
            <span
              className={`h-2 w-2 rounded-full shrink-0 ${selectedOption.dotColor}`}
            />
          )}
          {selectedOption ? (
            <span className="flex items-center gap-1.5 truncate">
              {selectedOption.badge && (
                <span className="font-mono text-[10px] font-semibold uppercase tracking-tight px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-700 shrink-0">
                  {selectedOption.badge}
                </span>
              )}
              <span className="truncate text-zinc-900">
                {selectedOption.label}
              </span>
            </span>
          ) : (
            <span className="text-zinc-400 truncate">{placeholder}</span>
          )}
        </span>

        <ChevronDown
          className={`h-3.5 w-3.5 text-zinc-400 shrink-0 transition-transform duration-150 group-hover:text-zinc-600 ${
            open ? "rotate-180 text-zinc-900" : ""
          }`}
        />
      </button>

      {open && (
        <div
          id={listboxId}
          role="listbox"
          className={`absolute z-50 mt-1.5 min-w-[220px] w-full rounded-xl border border-zinc-200/90 bg-white p-1.5 shadow-xl shadow-zinc-950/10 ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-100 ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {showSearch && (
            <div className="relative mb-1.5 px-1 pt-0.5">
              <Search className="h-3.5 w-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setHighlightedIndex(0);
                }}
                placeholder={searchPlaceholder}
                className="w-full h-8 rounded-lg border border-zinc-200 bg-zinc-50/70 pl-8 pr-7 text-xs text-zinc-900 placeholder:text-zinc-400 focus:bg-white focus:border-zinc-900 focus:outline-none"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          )}

          <div className="max-h-64 overflow-y-auto space-y-0.5 pr-0.5">
            {filteredOptions.length === 0 ? (
              <div className="py-6 px-3 text-center text-xs text-zinc-400">
                Nenhum resultado encontrado.
              </div>
            ) : (
              filteredOptions.map((option, idx) => {
                const isSelected = option.value === value;
                const isHighlighted = idx === highlightedIndex;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    className={`w-full flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-zinc-950 text-white font-medium"
                        : isHighlighted
                        ? "bg-zinc-100 text-zinc-950"
                        : "text-zinc-700 hover:bg-zinc-100/80"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {option.dotColor && (
                        <span
                          className={`h-2 w-2 rounded-full shrink-0 ${
                            isSelected ? "ring-2 ring-white/40" : ""
                          } ${option.dotColor}`}
                        />
                      )}
                      {option.badge && (
                        <span
                          className={`font-mono text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded shrink-0 ${
                            isSelected
                              ? "bg-white/15 text-white"
                              : "bg-zinc-100 text-zinc-600"
                          }`}
                        >
                          {option.badge}
                        </span>
                      )}
                      <div className="truncate">
                        <span className="block truncate">{option.label}</span>
                        {option.description && (
                          <span
                            className={`block text-[10px] truncate ${
                              isSelected ? "text-zinc-300" : "text-zinc-400"
                            }`}
                          >
                            {option.description}
                          </span>
                        )}
                      </div>
                    </div>

                    {isSelected && (
                      <Check className="h-3.5 w-3.5 shrink-0 text-white" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
