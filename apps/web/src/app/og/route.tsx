import type { NextRequest } from "next/server";
import { renderBrandedOgImage } from "@/lib/og";

// One shared branded-card generator, driven by query params, used by every
// route's generateMetadata() that doesn't have a real photo to point at
// (events, projects, articles, challenges, members, forms — see og.tsx).
// Kept as a query-param route rather than N per-route opengraph-image.tsx
// files so there's exactly one place that owns the visual design, and so a
// route with a real photo (courses) can freely choose between this and the
// real image without the two mechanisms fighting over which og:image wins.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const title = searchParams.get("title") ?? "MUT Tech Community";
  const eyebrow = searchParams.get("eyebrow") ?? undefined;
  return renderBrandedOgImage({ eyebrow, title });
}
