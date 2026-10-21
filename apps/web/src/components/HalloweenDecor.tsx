"use client";

import { usePathname } from "next/navigation";
import { useHalloween } from "@/lib/useHalloween";
import { isFullScreenGame } from "@/lib/gameRoutes";

// Bats drift across the viewport at different heights and speeds. Purely
// decorative: pointer-events-none, hidden from assistive tech, and the global
// reduced-motion rule freezes them.
const BATS = [
  { top: "14vh", size: 34, duration: 46, delay: 2, flip: false },
  { top: "34vh", size: 24, duration: 62, delay: 14, flip: true },
  { top: "58vh", size: 28, duration: 54, delay: 28, flip: false },
];

export function HalloweenDecor() {
  const active = useHalloween();
  const pathname = usePathname();

  if (!active || pathname?.startsWith("/admin") || isFullScreenGame(pathname)) return null;

  return (
    <div aria-hidden="true" className="pointer-events-none">
      <svg
        viewBox="0 0 120 120"
        className="absolute left-0 top-16 z-30 h-24 w-24 text-[#b9a3da] opacity-45 sm:h-32 sm:w-32"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      >
        <path d="M0 0L120 0M0 0L0 120M0 0L100 100M0 0L110 55M0 0L55 110" />
        <path d="M30 0Q26 26 0 30M60 0Q52 52 0 60M90 0Q78 78 0 90M118 0Q104 104 0 118" />
        <circle cx="62" cy="62" r="1.8" fill="currentColor" />
      </svg>

      <div className="fixed inset-0 z-20 overflow-hidden">
        {BATS.map((bat, i) => (
          <svg
            key={i}
            viewBox="0 0 64 32"
            width={bat.size}
            height={bat.size / 2}
            className="halloween-bat absolute left-0 text-navy-3 opacity-75"
            style={{
              top: bat.top,
              animationDuration: `${bat.duration}s`,
              animationDelay: `${bat.delay}s`,
              scale: bat.flip ? "-1 1" : undefined,
            }}
            fill="currentColor"
            stroke="#b9a3da"
            strokeWidth="1"
          >
            <path d="M32 10c-2-5-6-8-10-8 2 3 2 6 0 9-4-3-10-4-14-2 3 1 5 3 6 6-3-1-7-1-10 1 5 1 9 5 11 10 3-3 6-4 9-4 1 4 3 7 8 7s7-3 8-7c3 0 6 1 9 4 2-5 6-9 11-10-3-2-7-2-10-1 1-3 3-5 6-6-4-2-10-1-14 2-2-3-2-6 0-9-4 0-8 3-10 8z" />
          </svg>
        ))}
      </div>
    </div>
  );
}
