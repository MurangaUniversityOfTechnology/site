import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

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

export async function renderBrandedOgImage({ eyebrow, title }: { eyebrow?: string; title: string }) {
  const logo = await getLogoDataUrl();
  title = clampTitle(title);

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
          background: "#0f1a30",
          backgroundImage: "radial-gradient(circle at 88% 8%, rgba(201,168,76,0.16), transparent 55%)",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} alt="" width={64} height={64} style={{ borderRadius: 999 }} />
          <div style={{ display: "flex", fontSize: 20, fontWeight: 700, color: "#f5e6bf", letterSpacing: 1 }}>
            MUT TECH COMMUNITY
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 1000 }}>
          {eyebrow && (
            <div
              style={{
                display: "flex",
                fontSize: 24,
                fontFamily: "monospace",
                textTransform: "uppercase",
                letterSpacing: 4,
                color: "#c9a84c",
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
              color: "#fbf3df",
            }}
          >
            {title}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", height: 1, width: "100%", background: "rgba(245,230,191,0.18)" }} />
          <div style={{ display: "flex", fontSize: 20, fontFamily: "monospace", color: "#8892a6" }}>
            dream · create · code
          </div>
        </div>
      </div>
    ),
    OG_SIZE
  );
}
