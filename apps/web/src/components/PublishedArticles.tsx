"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { contentApi, type ContentSummary } from "@/lib/api";

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days < 1) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export function PublishedArticles() {
  const [articles, setArticles] = useState<ContentSummary[] | null>(null);

  useEffect(() => {
    contentApi.published().then(setArticles);
  }, []);

  if (articles !== null && articles.length === 0) return null;

  return (
    <div className="mt-6 overflow-hidden rounded-xl border border-border bg-surface">
      <div className="border-b border-[#14191b] px-5 py-4 font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">
        from the community
      </div>
      {articles?.map((a) => (
        <Link
          key={a.id}
          href={`/community/articles/${a.id}`}
          className="block border-b border-[#14191b] p-5 last:border-0 hover:bg-white/[0.02]"
        >
          <div className="text-[15.5px] font-medium">{a.title}</div>
          <p className="mt-1.5 line-clamp-2 text-[14px] leading-[1.5] text-muted">{a.excerpt}</p>
          <div className="mt-2.5 font-mono text-[10.5px] text-faint">
            {a.author} · {timeAgo(a.created_at)}
          </div>
        </Link>
      ))}
    </div>
  );
}
