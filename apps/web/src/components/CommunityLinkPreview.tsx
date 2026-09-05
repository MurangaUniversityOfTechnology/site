import type { LinkPreview } from "@/lib/api";

export function CommunityLinkPreview({ link, compact = false }: { link: LinkPreview; compact?: boolean }) {
  let host = link.site_name;
  if (!host) {
    try {
      host = new URL(link.url).hostname.replace(/^www\./, "");
    } catch {
      host = link.url;
    }
  }

  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="mt-3 flex overflow-hidden rounded-lg border border-border bg-background hover:border-accent-dim"
    >
      {link.image_url && (
        // Arbitrary external origins — deliberately a plain <img>, not
        // next/image, since we can't pre-allowlist every domain a post
        // might link to (and routing it through Next's own image proxy
        // would just move the SSRF surface there instead).
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={link.image_url}
          alt=""
          className={`flex-none border-r border-border object-cover ${compact ? "h-16 w-16" : "h-28 w-40 sm:h-32 sm:w-48"}`}
        />
      )}
      <div className="min-w-0 flex-1 px-3.5 py-2.5">
        <div className="truncate font-mono text-[10px] uppercase tracking-[0.1em] text-faint">{host}</div>
        {link.title && <div className="mt-1 line-clamp-2 text-[14px] leading-[1.4]">{link.title}</div>}
        {!compact && link.description && (
          <p className="mt-1 line-clamp-2 text-[12.5px] leading-[1.4] text-muted">{link.description}</p>
        )}
      </div>
    </a>
  );
}
