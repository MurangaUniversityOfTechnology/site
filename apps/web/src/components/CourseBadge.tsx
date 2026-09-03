const VARIANTS = [
  { bg: "linear-gradient(150deg,#fbf3df,#f5e6bf)", ring: "#e8d9ad", text: "#1a2744" },
  { bg: "linear-gradient(150deg,#1a2744,#243057)", ring: "#3a4a74", text: "#f5e6bf" },
  { bg: "linear-gradient(150deg,#243057,#0f1a30)", ring: "#c9a84c", text: "#f5e6bf" },
  { bg: "linear-gradient(150deg,#f5e6bf,#e8d9ad)", ring: "#ad8a45", text: "#1a2744" },
];

const SIZES = {
  sm: { box: 40, font: 13 },
  md: { box: 56, font: 17 },
  lg: { box: 76, font: 22 },
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

export function CourseBadge({ slug, title, size = "md" }: { slug: string; title: string; size?: "sm" | "md" | "lg" }) {
  const variant = VARIANTS[hashString(slug) % VARIANTS.length];
  const { box, font } = SIZES[size];

  return (
    <div
      title={title}
      className="grid shrink-0 place-items-center rounded-full border font-mono font-semibold"
      style={{
        width: box,
        height: box,
        fontSize: font,
        background: variant.bg,
        borderColor: variant.ring,
        color: variant.text,
      }}
    >
      {monogram(title)}
    </div>
  );
}
