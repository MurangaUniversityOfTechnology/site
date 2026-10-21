import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { isHalloween } from "@/lib/season";

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

/** Relative URL for the /og route handler — resolved against metadataBase
 * when dropped into a page's generateMetadata() openGraph.images. */
export function ogImageUrl({ eyebrow, title }: { eyebrow?: string; title: string }): string {
  const params = new URLSearchParams({ title });
  if (eyebrow) params.set("eyebrow", eyebrow);
  return `/og?${params.toString()}`;
}

// Read once per server process, not once per request — the file never
// changes at runtime.
let logoDataUrl: string | null = null;
async function getLogoDataUrl(): Promise<string> {
  if (!logoDataUrl) {
    const buf = await readFile(join(process.cwd(), "public/images/logo.png"));
    logoDataUrl = `data:image/png;base64,${buf.toString("base64")}`;
  }
  return logoDataUrl;
}

/**
 * The branded fallback preview card shown when a shared page has no photo
 * of its own (events, projects, articles, challenges, members, forms) —
 * same navy/gold identity as the static site-wide opengraph-image.png,
 * just with the page's own eyebrow + title dropped in.
 */
// Keeps the title to at most ~2-3 lines at this card's fixed height,
// regardless of how long the source title (course/event/article/...) is.
const MAX_TITLE_LENGTH = 80;

function clampTitle(title: string): string {
  return title.length > MAX_TITLE_LENGTH ? `${title.slice(0, MAX_TITLE_LENGTH - 1).trimEnd()}…` : title;
}

// What the bundled server calls "today" in Nairobi, not UTC, so the Halloween
// card switches on/off at the same moment as the on-site theme.
function nairobiNow(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Africa/Nairobi" }));
}

type Palette = { bg: string; glow: string; brand: string; eyebrow: string; title: string; rule: string; tagline: string };

const NORMAL: Palette = {
  bg: "#0f1a30",
  glow: "rgba(201,168,76,0.16)",
  brand: "#f5e6bf",
  eyebrow: "#c9a84c",
  title: "#fbf3df",
  rule: "rgba(245,230,191,0.18)",
  tagline: "#8892a6",
};

const SPOOKY: Palette = {
  bg: "#190b2a",
  glow: "rgba(255,122,26,0.28)",
  brand: "#ffd9b0",
  eyebrow: "#ff7a1a",
  title: "#fff3e0",
  rule: "rgba(255,217,176,0.2)",
  tagline: "#a58bc4",
};

// A lit jack-o'-lantern. Passed as an <img> data URI: Satori renders those
// reliably. (Satori also ignores `bottom:` on absolute elements; use `top:`.)
const PUMPKIN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
<path d="M96 38c0-14 6-24 18-28l4 10c-7 3-9 9-9 18z" fill="#5c8a2e"/>
<ellipse cx="62" cy="116" rx="42" ry="58" fill="#e8650d"/>
<ellipse cx="138" cy="116" rx="42" ry="58" fill="#e8650d"/>
<ellipse cx="100" cy="116" rx="46" ry="62" fill="#ff7a1a"/>
<polygon points="70,106 92,106 81,82" fill="#ffd24a"/>
<polygon points="108,106 130,106 119,82" fill="#ffd24a"/>
<polygon points="100,114 91,130 109,130" fill="#ffd24a"/>
<path d="M64 138L78 154L90 142L100 156L110 142L122 154L136 138Q100 176 64 138Z" fill="#ffd24a"/>
</svg>`;
const PUMPKIN_URL = `data:image/svg+xml;base64,${Buffer.from(PUMPKIN_SVG).toString("base64")}`;

function Pumpkin({ size, style }: { size: number; style: Record<string, string | number> }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={PUMPKIN_URL} alt="" width={size} height={size} style={{ position: "absolute", ...style }} />
  );
}

function Bat({ width, style }: { width: number; style: Record<string, string | number> }) {
  return (
    <svg width={width} height={width / 2} viewBox="0 0 64 32" style={{ position: "absolute", ...style }}>
      <path
        d="M32 10c-2-5-6-8-10-8 2 3 2 6 0 9-4-3-10-4-14-2 3 1 5 3 6 6-3-1-7-1-10 1 5 1 9 5 11 10 3-3 6-4 9-4 1 4 3 7 8 7s7-3 8-7c3 0 6 1 9 4 2-5 6-9 11-10-3-2-7-2-10-1 1-3 3-5 6-6-4-2-10-1-14 2-2-3-2-6 0-9-4 0-8 3-10 8z"
        fill="#0b0414"
      />
    </svg>
  );
}

export async function renderBrandedOgImage({
  eyebrow,
  title,
  season,
}: {
  eyebrow?: string;
  title: string;
  /** "halloween" / "off" force the look (handy for previewing); otherwise it follows the calendar. */
  season?: string;
}) {
  const logo = await getLogoDataUrl();
  title = clampTitle(title);
  const spooky = season === "halloween" || (season !== "off" && isHalloween(nairobiNow()));
  const c = spooky ? SPOOKY : NORMAL;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: c.bg,
          backgroundImage: `radial-gradient(circle at ${spooky ? "82% 70%" : "88% 8%"}, ${c.glow}, transparent 55%)`,
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {spooky && (
          <>
            <Pumpkin size={290} style={{ right: 70, top: 196 }} />
            <Bat width={84} style={{ right: 330, top: 70 }} />
            <Bat width={54} style={{ right: 210, top: 130 }} />
            <Bat width={64} style={{ right: 96, top: 54 }} />
          </>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} alt="" width={64} height={64} style={{ borderRadius: 999 }} />
          <div style={{ display: "flex", fontSize: 20, fontWeight: 700, color: c.brand, letterSpacing: 1 }}>
            MUT TECH COMMUNITY
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: spooky ? 720 : 1000 }}>
          {eyebrow && (
            <div
              style={{
                display: "flex",
                fontSize: 24,
                fontFamily: "monospace",
                textTransform: "uppercase",
                letterSpacing: 4,
                color: c.eyebrow,
              }}
            >
              {eyebrow}
            </div>
          )}
          <div
            style={{
              display: "flex",
              fontSize: title.length > 40 ? 58 : 72,
              fontWeight: 700,
              lineHeight: 1.08,
              letterSpacing: -1.5,
              color: c.title,
            }}
          >
            {title}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", height: 1, width: "100%", background: c.rule }} />
          <div style={{ display: "flex", fontSize: 20, fontFamily: "monospace", color: c.tagline }}>
            {spooky ? "happy halloween · dream · create · code" : "dream · create · code"}
          </div>
        </div>
      </div>
    ),
    OG_SIZE
  );
}
