"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { FloatingPanel } from "@/components/ui/floating-panel";

const MONTHS_PT = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const MONTHS_SHORT_PT = [
  "jan.",
  "fev.",
  "mar.",
  "abr.",
  "mai.",
  "jun.",
  "jul.",
  "ago.",
  "set.",
  "out.",
  "nov.",
  "dez.",
];

const WEEKDAYS_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function formatIsoDatePtBr(isoDate: string): string {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate;
  const [y, m, d] = isoDate.split("-").map(Number);
  const monthLabel = MONTHS_SHORT_PT[(m ?? 1) - 1] ?? "";
  return `${String(d).padStart(2, "0")} de ${monthLabel} ${y}`;
}

function toIsoString(year: number, monthIndex: number, day: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(
    day
  ).padStart(2, "0")}`;
}

interface DatePickerProps {
  name?: string;
  value: string;
  onChange: (isoDate: string) => void;
  placeholder?: string;
  allowClear?: boolean;
  highlightedDates?: string[];
  size?: "sm" | "md";
  align?: "left" | "right";
  className?: string;
}

export function DatePicker({
  name,
  value,
  onChange,
  placeholder = "Selecionar data",
  allowClear = false,
  highlightedDates = [],
  size = "md",
  align = "left",
  className = "",
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const todayIso = useMemo(() => {
    const now = new Date();
    return toIsoString(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);

  const initialView = useMemo(() => {
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m] = value.split("-").map(Number);
      return { year: y, month: m - 1 };
    }
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  }, [value]);

  const [viewYear, setViewYear] = useState(initialView.year);
  const [viewMonth, setViewMonth] = useState(initialView.month);

  useEffect(() => {
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m] = value.split("-").map(Number);
      setViewYear(y);
      setViewMonth(m - 1);
    }
  }, [value]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        !containerRef.current?.contains(target) &&
        !panelRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [open]);

  const highlightedSet = useMemo(
    () => new Set(highlightedDates),
    [highlightedDates]
  );

  const calendarCells = useMemo(() => {
    const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
    const daysInCurrentMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const cells: {
      iso: string;
      day: number;
      inCurrentMonth: boolean;
    }[] = [];

    // Previous month trailing days
    const prevMonthYear = viewMonth === 0 ? viewYear - 1 : viewYear;
    const prevMonthIdx = viewMonth === 0 ? 11 : viewMonth - 1;
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      cells.push({
        iso: toIsoString(prevMonthYear, prevMonthIdx, d),
        day: d,
        inCurrentMonth: false,
      });
    }

    // Current month days
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      cells.push({
        iso: toIsoString(viewYear, viewMonth, d),
        day: d,
        inCurrentMonth: true,
      });
    }

    // Next month leading days to complete 42 cells (6 rows x 7 cols)
    const nextMonthYear = viewMonth === 11 ? viewYear + 1 : viewYear;
    const nextMonthIdx = viewMonth === 11 ? 0 : viewMonth + 1;
    const remaining = 42 - cells.length;
    for (let d = 1; d <= remaining; d++) {
      cells.push({
        iso: toIsoString(nextMonthYear, nextMonthIdx, d),
        day: d,
        inCurrentMonth: false,
      });
    }

    return cells;
  }, [viewYear, viewMonth]);

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  function selectQuickDate(offsetDays: number) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const iso = toIsoString(d.getFullYear(), d.getMonth(), d.getDate());
    onChange(iso);
    setOpen(false);
  }

  const sizeClasses =
    size === "sm"
      ? "h-9 px-3 text-xs rounded-lg"
      : "h-10 px-3.5 text-xs rounded-xl";

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {name && <input type="hidden" name={name} value={value} />}

      <div className="relative flex items-center">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className={`w-full inline-flex items-center justify-between gap-2 border backdrop-blur-md text-left font-medium transition-all cursor-pointer select-none ${sizeClasses} ${
            open
              ? "border-cyan-400/60 bg-white/[0.08] ring-2 ring-cyan-400/15 text-white"
              : "border-white/12 bg-white/[0.04] text-slate-100 hover:border-white/25 hover:bg-white/[0.07] focus-visible:border-cyan-400/50"
          } ${allowClear && value ? "pr-8" : ""}`}
        >
          <span className="flex items-center gap-2 truncate">
            <CalendarIcon
              className={`h-3.5 w-3.5 shrink-0 ${
                value ? "text-cyan-300" : "text-slate-400"
              }`}
            />
            {value ? (
              <span className="text-slate-100 font-medium">
                {formatIsoDatePtBr(value)}
              </span>
            ) : (
              <span className="text-slate-400">{placeholder}</span>
            )}
          </span>
        </button>

        {allowClear && value && (
          <button
            type="button"
            title="Limpar data"
            aria-label="Limpar data"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
            className="absolute right-2 p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <FloatingPanel
        open={open}
        anchorRef={containerRef}
        panelRef={panelRef}
        align={align}
        fixedWidth={292}
        className="rounded-2xl border border-white/15 bg-[#0c1428]/95 backdrop-blur-2xl p-4 shadow-[0_20px_60px_-10px_rgba(0,0,0,0.85)] ring-1 ring-white/5 select-none max-h-[calc(100dvh-16px)] overflow-y-auto"
      >
          {/* Header: Month + Year & Nav */}
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={prevMonth}
              className="h-7 w-7 inline-flex items-center justify-center rounded-lg border border-white/12 bg-white/[0.05] text-slate-300 hover:bg-white/[0.1] hover:text-white transition-colors cursor-pointer"
              aria-label="Mês anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="text-xs font-semibold text-white tracking-tight">
              {MONTHS_PT[viewMonth]} {viewYear}
            </div>

            <button
              type="button"
              onClick={nextMonth}
              className="h-7 w-7 inline-flex items-center justify-center rounded-lg border border-white/12 bg-white/[0.05] text-slate-300 hover:bg-white/[0.1] hover:text-white transition-colors cursor-pointer"
              aria-label="Próximo mês"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAYS_PT.map((day) => (
              <div
                key={day}
                className="h-7 flex items-center justify-center text-[10px] font-mono uppercase tracking-wider text-slate-400"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarCells.map((cell) => {
              const isSelected = cell.iso === value;
              const isToday = cell.iso === todayIso;
              const hasClass = highlightedSet.has(cell.iso);

              return (
                <button
                  key={cell.iso}
                  type="button"
                  onClick={() => {
                    onChange(cell.iso);
                    setOpen(false);
                  }}
                  className={`relative h-8 w-full rounded-lg text-xs font-mono flex flex-col items-center justify-center transition-all cursor-pointer ${
                    isSelected
                      ? "bg-gradient-to-br from-cyan-400 to-emerald-400 text-slate-950 font-semibold shadow-[0_0_16px_-2px_rgba(34,211,238,0.6)]"
                      : isToday
                      ? "bg-cyan-400/10 text-cyan-200 font-semibold ring-1 ring-inset ring-cyan-400/50"
                      : cell.inCurrentMonth
                      ? "text-slate-200 hover:bg-white/[0.08] hover:text-white"
                      : "text-slate-600 hover:bg-white/[0.04] hover:text-slate-400"
                  }`}
                >
                  <span>{cell.day}</span>
                  {hasClass && (
                    <span
                      className={`h-1 w-1 rounded-full mt-0.5 ${
                        isSelected
                          ? "bg-slate-950"
                          : "bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.8)]"
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Quick Shortcuts Footer */}
          <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => selectQuickDate(0)}
                className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-white/[0.06] border border-white/10 text-slate-200 hover:bg-cyan-400/20 hover:border-cyan-400/35 hover:text-cyan-200 transition-colors cursor-pointer"
              >
                Hoje
              </button>
              <button
                type="button"
                onClick={() => selectQuickDate(1)}
                className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-white/[0.06] border border-white/10 text-slate-200 hover:bg-cyan-400/20 hover:border-cyan-400/35 hover:text-cyan-200 transition-colors cursor-pointer"
              >
                Amanhã
              </button>
            </div>

            {allowClear && value && (
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
                className="px-2 py-1 rounded-md text-[11px] font-medium text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors cursor-pointer"
              >
                Limpar
              </button>
            )}
          </div>
      </FloatingPanel>
    </div>
  );
}
