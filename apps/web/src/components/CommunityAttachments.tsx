function isVideo(url: string): boolean {
  return url.includes("/video/upload/");
}

export function CommunityAttachments({ urls, compact = false }: { urls: string[]; compact?: boolean }) {
  if (urls.length === 0) return null;

  return (
    <div className={`mt-3 grid gap-2 ${urls.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
      {urls.map((url) =>
        isVideo(url) ? (
          <video
            key={url}
            src={url}
            controls
            className={`w-full rounded-lg border border-border bg-background object-cover ${compact ? "max-h-48" : "max-h-96"}`}
          />
        ) : (
          // Our own Cloudinary URLs (validated server-side), not arbitrary
          // hotlinks — see services/community._validate_attachments.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={url}
            src={url}
            alt=""
            className={`w-full rounded-lg border border-border bg-background object-cover ${compact ? "max-h-48" : "max-h-96"}`}
          />
        )
      )}
    </div>
  );
}
