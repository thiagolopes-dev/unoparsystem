"use client";

import { useState, useRef, useEffect } from "react";
import { Clock, ChevronDown } from "lucide-react";

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
  className?: string;
}

export function TimePicker({
  name,
  value,
  onChange,
  className = "",
}: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const [currentHour = "19", currentMinute = "00"] = (value || "19:00").split(
    ":"
  );

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
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {name && <input type="hidden" name={name} value={value} />}

      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`h-10 w-full inline-flex items-center justify-between gap-1.5 rounded-xl border bg-white px-3 text-xs font-mono font-medium transition-all cursor-pointer select-none shadow-2xs ${
          open
            ? "border-zinc-900 ring-2 ring-zinc-950/10 text-zinc-950"
            : "border-zinc-200/90 text-zinc-900 hover:border-zinc-300 hover:bg-zinc-50/60"
        }`}
      >
        <span className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
          <span>{value || "00:00"}</span>
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-zinc-400 transition-transform duration-150 ${
            open ? "rotate-180 text-zinc-900" : ""
          }`}
        />
      </button>

      {open && (
        <div className="absolute left-0 z-50 mt-1.5 w-[248px] rounded-2xl border border-zinc-200/90 bg-white p-3 shadow-xl shadow-zinc-950/10 ring-1 ring-black/5 select-none">
          <div className="mb-2">
            <span className="block font-mono text-[10px] uppercase tracking-wider text-zinc-400 mb-1.5">
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
                        ? "bg-zinc-950 text-white font-semibold"
                        : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200/80"
                    }`}
                  >
                    {slot}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-2.5 border-t border-zinc-100 grid grid-cols-2 gap-2">
            <div>
              <span className="block font-mono text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                Hora
              </span>
              <div className="max-h-32 overflow-y-auto space-y-0.5 pr-1">
                {HOURS.map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => onChange(`${h}:${currentMinute}`)}
                    className={`w-full text-left px-2 py-1 rounded-md font-mono text-xs cursor-pointer ${
                      h === currentHour
                        ? "bg-zinc-950 text-white font-semibold"
                        : "text-zinc-700 hover:bg-zinc-100"
                    }`}
                  >
                    {h}h
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="block font-mono text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
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
                    className={`w-full text-left px-2 py-1 rounded-md font-mono text-xs cursor-pointer ${
                      m === currentMinute
                        ? "bg-zinc-950 text-white font-semibold"
                        : "text-zinc-700 hover:bg-zinc-100"
                    }`}
                  >
                    :{m}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
