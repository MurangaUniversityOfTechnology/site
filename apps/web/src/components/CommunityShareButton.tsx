"use client";

import { useState } from "react";

export function CommunityShareButton({ postId, title }: { postId: string; title: string }) {
  const [copied, setCopied] = useState(false);

  async function share(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}/community/board/${postId}`;

    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        // User cancelled the share sheet — nothing to do.
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API can be unavailable (e.g. non-secure context) — the
      // link is still visible in the address bar once they open the post.
    }
  }

  return (
    <button type="button" onClick={share} className="hover:text-muted">
      {copied ? "Copied!" : "Share"}
    </button>
  );
}
