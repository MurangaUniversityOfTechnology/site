import type { CSSProperties } from "react";
import { difficultyLabel } from "@/components/DifficultyLevel";

// Same navy/gold/cream family the rest of the site uses — difficulty reads
// through shape and richness (plainer → more ornate, cream → deep navy-and-
// gold foil), never through an invented hue-per-level scheme. Each tier's
// ring/fill are 3-stop bevels (light source top-left) rather than flat
// tints, so the badge reads as a struck medal, not a flat sticker.
type Tier = {
  shape: "circle" | "squircle" | "polygon";
  clipPath?: string;
  ring: string;
  fill: string;
  text: string;
  textShadow: string;
  glow?: string;
};

// Regular hexagon, point at top/bottom.
const HEXAGON = "polygon(50% 0%, 93.3% 25%, 93.3% 75%, 50% 100%, 6.7% 75%, 6.7% 25%)";
// Crest/shield: flat top, tapered sides, pointed base.
const SHIELD = "polygon(15% 0%, 85% 0%, 100% 20%, 100% 55%, 50% 100%, 0% 55%, 0% 20%)";
// Scalloped medallion — 10 gentle points, computed once so the coordinates
// don't need to be hand-typed (and stay easy to retune).
function medallionPath(points: number, outerR: number, innerR: number): string {
  const step = Math.PI / points;
  const coords: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = i * step - Math.PI / 2;
    const x = (50 + r * Math.cos(angle)).toFixed(2);
    const y = (50 + r * Math.sin(angle)).toFixed(2);
    coords.push(`${x}% ${y}%`);
  }
  return `polygon(${coords.join(", ")})`;
}
const MEDALLION = medallionPath(10, 49, 41.5);

// Dark engraving on light fills, soft light-catch on dark fills — sells the
// monogram as struck into the metal rather than printed on top of it.
const ENGRAVED_DARK = "0 1px 0 rgba(255,255,255,0.4), 0 -1px 1px rgba(10,16,30,0.2)";
const ENGRAVED_LIGHT = "0 1px 1px rgba(0,0,0,0.45)";

const TIERS: Record<number, Tier> = {
  1: {
    shape: "circle",
    ring: "linear-gradient(145deg,#fdf6e3 0%,#e8d9ad 55%,#c2a968 100%)",
    fill: "linear-gradient(155deg,#fffaf0 0%,#fbf3df 45%,#f0dfae 100%)",
    text: "#1a2744",
    textShadow: ENGRAVED_DARK,
  },
  2: {
    shape: "squircle",
    ring: "linear-gradient(145deg,#f6e7bf 0%,#d9c48a 55%,#a98a44 100%)",
    fill: "linear-gradient(155deg,#faf0d6 0%,#f5e6bf 45%,#e3cd94 100%)",
    text: "#1a2744",
    textShadow: ENGRAVED_DARK,
  },
  3: {
    shape: "polygon",
    clipPath: HEXAGON,
    ring: "linear-gradient(145deg,#e9cf87 0%,#c9a84c 50%,#8a6c28 100%)",
    fill: "linear-gradient(155deg,#2c3a63 0%,#243057 45%,#16223e 100%)",
    text: "#f5e6bf",
    textShadow: ENGRAVED_LIGHT,
  },
  4: {
    shape: "polygon",
    clipPath: SHIELD,
    ring: "conic-gradient(from 210deg,#f3dfa0,#c9a84c,#8a6c28,#c9a84c,#f3dfa0)",
    fill: "linear-gradient(155deg,#202e52 0%,#1a2744 45%,#0c1526 100%)",
    text: "#f5e6bf",
    textShadow: ENGRAVED_LIGHT,
    glow: "0 0 14px rgba(201,168,76,0.4)",
  },
  5: {
    shape: "polygon",
    clipPath: MEDALLION,
    ring: "conic-gradient(from 200deg,#fbe7ae,#f0d68f,#a9822f,#7a5f24,#a9822f,#f0d68f,#fbe7ae)",
    fill: "linear-gradient(155deg,#141f38 0%,#0f1a30 45%,#060a14 100%)",
    text: "#ffe3a3",
    textShadow: ENGRAVED_LIGHT,
    glow: "0 0 22px rgba(201,168,76,0.6)",
  },
};

function tierFor(difficulty: number): Tier {
  return TIERS[difficulty] ?? TIERS[1];
}

const SIZES = {
  sm: { box: 40, font: 13, ring: 3 },
  md: { box: 56, font: 17, ring: 4 },
  lg: { box: 76, font: 22, ring: 5 },
};

const STOP_WORDS = new Set(["a", "an", "the", "to", "of", "and", "your", "for", "with"]);

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function monogram(title: string): string {
  const words = title.split(/\s+/).filter((w) => w && !STOP_WORDS.has(w.toLowerCase()));
  const source = words.length > 0 ? words : title.split(/\s+/);
  return source
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

// Slight per-course variety within a tier — same shape/finish (difficulty is
// still legible at a glance), just a nudge in the gradient/sweep angle so a
// shelf of same-level badges isn't perfectly identical.
const ANGLE_JITTER = [140, 150, 160, 170];

function withJitter(background: string, angle: number): string {
  return background
    .replace(/^linear-gradient\(\d+deg/, `linear-gradient(${angle}deg`)
    .replace(/^conic-gradient\(from \d+deg/, `conic-gradient(from ${angle}deg`);
}

// Domed-metal relief on the fill: a light catch near the top, a soft shadow
// pooling at the bottom. box-shadow is clipped along with everything else by
// the shape's clip-path/border-radius, so this follows hexagons and shields
// too, not just circles.
const FILL_BEVEL = "inset 0 1.5px 1.5px rgba(255,255,255,0.3), inset 0 -2px 3px rgba(10,16,30,0.35)";

export function CourseBadge({
  slug,
  title,
  difficulty = 1,
  size = "md",
}: {
  slug: string;
  title: string;
  difficulty?: number;
  size?: "sm" | "md" | "lg";
}) {
  const tier = tierFor(difficulty);
  const { box, font, ring } = SIZES[size];
  const angle = ANGLE_JITTER[hashString(slug) % ANGLE_JITTER.length];
  const fill = withJitter(tier.fill, angle);
  const ringBg = withJitter(tier.ring, angle);

  const shapeStyle: CSSProperties =
    tier.shape === "circle"
      ? { borderRadius: "50%" }
      : tier.shape === "squircle"
        ? { borderRadius: "26%" }
        : { clipPath: tier.clipPath };

  const elevation = "0 2px 4px rgba(15,26,48,0.22)";
  const filter = tier.glow ? `drop-shadow(${elevation}) drop-shadow(${tier.glow})` : `drop-shadow(${elevation})`;

  return (
    <div
      title={`${title} — Level ${difficulty} · ${difficultyLabel(difficulty)}`}
      className="relative shrink-0"
      style={{ width: box, height: box, filter }}
    >
      <div className="absolute inset-0" style={{ background: ringBg, ...shapeStyle }} />
      <div
        className="absolute grid place-items-center font-mono font-semibold"
        style={{
          inset: ring,
          background: fill,
          color: tier.text,
          textShadow: tier.textShadow,
          fontSize: font,
          letterSpacing: "0.02em",
          boxShadow: FILL_BEVEL,
          ...shapeStyle,
        }}
      >
        {monogram(title)}
      </div>
      {/* Glossy highlight sweep — same shape, blended on top for a struck-
          medal sheen rather than a flat-printed fill. */}
      <div
        className="pointer-events-none absolute"
        style={{
          inset: ring,
          background: "radial-gradient(circle at 32% 22%, rgba(255,255,255,0.65), transparent 55%)",
          mixBlendMode: "overlay",
          ...shapeStyle,
        }}
      />
    </div>
  );
}
