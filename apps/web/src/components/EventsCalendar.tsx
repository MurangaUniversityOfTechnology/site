"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { EventSummary } from "@/lib/api";
import { eventDateKey } from "@/lib/eventFormat";

const WEEKDAY_LABELS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MAX_VISIBLE_PER_DAY = 2;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function dateKey(year: number, month: number, day: number): string {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

type Cell = { year: number; month: number; day: number; inMonth: boolean; key: string };

function buildMonthGrid(year: number, month: number): Cell[] {
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const cells: Cell[] = [];

  for (let i = 0; i < firstWeekday; i++) {
    const day = daysInPrevMonth - firstWeekday + 1 + i;
    const m = month === 0 ? 11 : month - 1;
    const y = month === 0 ? year - 1 : year;
    cells.push({ year: y, month: m, day, inMonth: false, key: dateKey(y, m, day) });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ year, month, day, inMonth: true, key: dateKey(year, month, day) });
  }

  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1];
    const next = new Date(last.year, last.month, last.day + 1);
    const y = next.getFullYear();
    const m = next.getMonth();
    const day = next.getDate();
    cells.push({ year: y, month: m, day, inMonth: false, key: dateKey(y, m, day) });
  }

  return cells;
}

export function EventsCalendar({ events }: { events: EventSummary[] }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const todayKey = dateKey(now.getFullYear(), now.getMonth(), now.getDate());

  const eventsByDate = useMemo(() => {
    const map = new Map<string, EventSummary[]>();
    for (const e of events) {
      const key = eventDateKey(e.starts_at);
      const list = map.get(key) ?? [];
      list.push(e);
      map.set(key, list);
    }
    return map;
  }, [events]);

  const cells = useMemo(() => buildMonthGrid(year, month), [year, month]);

  const monthLabel = new Date(year, month, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  function goPrevMonth() {
    setSelectedKey(null);
    if (month === 0) {
      setYear((y) => y - 1);
      setMonth(11);
    } else {
      setMonth((m) => m - 1);
    }
  }

  function goNextMonth() {
    setSelectedKey(null);
    if (month === 11) {
      setYear((y) => y + 1);
      setMonth(0);
    } else {
      setMonth((m) => m + 1);
    }
  }

  function goToday() {
    setYear(now.getFullYear());
    setMonth(now.getMonth());
    setSelectedKey(todayKey);
  }

  const selectedEvents = selectedKey ? (eventsByDate.get(selectedKey) ?? []) : [];

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between gap-3">
        <div className="text-lg font-semibold tracking-[-0.01em]">{monthLabel}</div>
        <div className="flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.1em]">
          <button
            type="button"
            onClick={goPrevMonth}
            aria-label="Previous month"
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border-strong text-muted hover:bg-surface-raised"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={goToday}
            className="rounded-md border border-border-strong px-3 py-2 text-muted hover:bg-surface-raised"
          >
            Today
          </button>
          <button
            type="button"
            onClick={goNextMonth}
            aria-label="Next month"
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border-strong text-muted hover:bg-surface-raised"
          >
            ›
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-border bg-border">
        {WEEKDAY_LABELS.map((w) => (
          <div
            key={w}
            className="bg-surface-raised py-2 text-center font-mono text-[9px] uppercase tracking-[0.14em] text-faint sm:text-[9.5px]"
          >
            {w}
          </div>
        ))}

        {cells.map((cell) => {
          const dayEvents = eventsByDate.get(cell.key) ?? [];
          const isToday = cell.key === todayKey;
          const isSelected = cell.key === selectedKey;
          const overflow = dayEvents.length - MAX_VISIBLE_PER_DAY;

          return (
            <button
              key={cell.key}
              type="button"
              onClick={() => setSelectedKey(dayEvents.length ? cell.key : null)}
              className={`min-h-[76px] bg-surface p-1.5 text-left align-top sm:min-h-[104px] sm:p-2 ${
                cell.inMonth ? "" : "opacity-40"
              } ${isSelected ? "ring-2 ring-inset ring-accent" : ""} ${dayEvents.length ? "cursor-pointer hover:bg-surface-raised" : "cursor-default"}`}
            >
              <span
                className={`inline-flex h-5 w-5 items-center justify-center rounded-full font-mono text-[10.5px] ${
                  isToday ? "bg-accent text-navy" : "text-muted"
                }`}
              >
                {cell.day}
              </span>
              {/* Below sm: dots only — narrow columns can't fit legible title text. */}
              <div className="mt-1.5 flex flex-wrap gap-1 sm:hidden">
                {dayEvents.slice(0, 4).map((e) => (
                  <span key={e.slug} className="h-1.5 w-1.5 rounded-full bg-accent" />
                ))}
                {dayEvents.length > 4 && <span className="font-mono text-[8px] text-faint">+{dayEvents.length - 4}</span>}
              </div>
              <div className="mt-1 hidden flex-col gap-1 sm:flex">
                {dayEvents.slice(0, MAX_VISIBLE_PER_DAY).map((e) => (
                  <span
                    key={e.slug}
                    className="truncate rounded border border-accent-dim/60 bg-accent/10 px-1 py-0.5 text-[10px] text-navy"
                  >
                    {e.title}
                  </span>
                ))}
                {overflow > 0 && <span className="font-mono text-[9px] text-faint">+{overflow} more</span>}
              </div>
            </button>
          );
        })}
      </div>

      {selectedKey && (
        <div className="mt-4 rounded-xl border border-border bg-surface p-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
            {new Date(`${selectedKey}T00:00:00`).toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </div>
          {selectedEvents.length === 0 ? (
            <p className="mt-2.5 text-[14px] text-muted">No events on this day.</p>
          ) : (
            <div className="mt-3 flex flex-col gap-2">
              {selectedEvents.map((e) => (
                <Link
                  key={e.slug}
                  href={`/events/${e.slug}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3.5 py-2.5 hover:border-accent-dim"
                >
                  <span className="text-[14.5px] font-medium">{e.title}</span>
                  <span className="font-mono text-[10.5px] text-muted">{e.venue}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
