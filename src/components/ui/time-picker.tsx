"use client";

import { useState, useRef, useEffect } from "react";
import { Clock, ChevronDown } from "lucide-react";
import { FloatingPanel } from "@/components/ui/floating-panel";

const ACADEMIC_SLOTS = [
  "07:30",
  "08:00",
  "09:40",
  "10:00",
  "11:40",
  "13:30",
  "14:00",
  "15:40",
  "17:20",
  "19:00",
  "20:40",
  "20:55",
  "22:30",
];

const HOURS = Array.from({ length: 17 }, (_, i) =>
  String(i + 7).padStart(2, "0")
); // 07..23
const MINUTES = ["00", "10", "15", "20", "30", "40", "45", "50", "55"];

interface TimePickerProps {
  name?: string;
  value: string;
  onChange: (time: string) => void;
  align?: "left" | "right";
  className?: string;
}

export function TimePicker({
  name,
  value,
  onChange,
  align = "left",
  className = "",
}: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const [currentHour = "19", currentMinute = "00"] = (value || "19:00").split(
    ":"
  );

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

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {name && <input type="hidden" name={name} value={value} />}

      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`h-10 w-full inline-flex items-center justify-between gap-1.5 rounded-xl border backdrop-blur-md px-3 text-xs font-mono font-medium transition-all cursor-pointer select-none ${
          open
            ? "border-cyan-400/60 bg-white/[0.08] ring-2 ring-cyan-400/15 text-white"
            : "border-white/12 bg-white/[0.04] text-slate-100 hover:border-white/25 hover:bg-white/[0.07] focus-visible:border-cyan-400/50"
        }`}
      >
        <span className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-cyan-300 shrink-0" />
          <span>{value || "00:00"}</span>
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-150 ${
            open ? "rotate-180 text-cyan-300" : ""
          }`}
        />
      </button>

      <FloatingPanel
        open={open}
        anchorRef={containerRef}
        panelRef={panelRef}
        align={align}
        fixedWidth={248}
        className="rounded-2xl border border-white/15 bg-[#0c1428]/95 backdrop-blur-2xl p-3 shadow-[0_20px_60px_-10px_rgba(0,0,0,0.85)] ring-1 ring-white/5 select-none max-h-[calc(100dvh-16px)] overflow-y-auto"
      >
          <div className="mb-2">
            <span className="block font-mono text-[10px] uppercase tracking-wider text-slate-400 mb-1.5">
              Horários Acadêmicos Rápidos
            </span>
            <div className="flex flex-wrap gap-1">
              {ACADEMIC_SLOTS.map((slot) => {
                const active = slot === value;
                return (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => {
                      onChange(slot);
                      setOpen(false);
                    }}
                    className={`px-2 py-1 rounded-md font-mono text-[11px] transition-colors cursor-pointer ${
                      active
                        ? "bg-gradient-to-r from-cyan-400 to-emerald-400 text-slate-950 font-semibold shadow-[0_0_14px_-2px_rgba(34,211,238,0.5)]"
                        : "bg-white/[0.06] border border-white/10 text-slate-300 hover:bg-white/[0.12] hover:text-white"
                    }`}
                  >
                    {slot}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-2.5 border-t border-white/10 grid grid-cols-2 gap-2">
            <div>
              <span className="block font-mono text-[10px] uppercase tracking-wider text-slate-400 mb-1">
                Hora
              </span>
              <div className="max-h-32 overflow-y-auto space-y-0.5 pr-1">
                {HOURS.map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => onChange(`${h}:${currentMinute}`)}
                    className={`w-full text-left px-2 py-1 rounded-md font-mono text-xs transition-colors cursor-pointer ${
                      h === currentHour
                        ? "bg-gradient-to-r from-cyan-400 to-emerald-400 text-slate-950 font-semibold shadow-[0_0_12px_-2px_rgba(34,211,238,0.45)]"
                        : "text-slate-300 hover:bg-white/[0.08] hover:text-white"
                    }`}
                  >
                    {h}h
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="block font-mono text-[10px] uppercase tracking-wider text-slate-400 mb-1">
                Minuto
              </span>
              <div className="max-h-32 overflow-y-auto space-y-0.5 pr-1">
                {MINUTES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      onChange(`${currentHour}:${m}`);
                      setOpen(false);
                    }}
                    className={`w-full text-left px-2 py-1 rounded-md font-mono text-xs transition-colors cursor-pointer ${
                      m === currentMinute
                        ? "bg-gradient-to-r from-cyan-400 to-emerald-400 text-slate-950 font-semibold shadow-[0_0_12px_-2px_rgba(34,211,238,0.45)]"
                        : "text-slate-300 hover:bg-white/[0.08] hover:text-white"
                    }`}
                  >
                    :{m}
                  </button>
                ))}
              </div>
            </div>
          </div>
      </FloatingPanel>
    </div>
  );
}
