"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { contentApi, type ContentItem } from "@/lib/api";

export function ArticleClient({ id }: { id: string }) {
  const [article, setArticle] = useState<ContentItem | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    contentApi
      .getPublished(id)
      .then((result) => {
        if (active) setArticle(result);
      })
      .catch(() => {
        if (active) setArticle(null);
      });
    return () => {
      active = false;
    };
  }, [id]);

  if (article === undefined) return null;

  if (!article) {
    return (
      <main className="grid min-h-[calc(100vh-64px)] place-items-center px-5 text-center">
        <div>
          <h1 className="text-2xl tracking-[-0.02em]">Article not found</h1>
          <Link href="/community" className="mt-3 inline-block text-navy hover:underline">
            Back to community
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-160 px-5 py-14 sm:px-8">
      <Link href="/community" className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint hover:text-foreground">
        ← community
      </Link>
      <h1 className="mt-5.5 text-[clamp(28px,4.4vw,44px)] leading-[1.05] tracking-[-0.035em]">{article.title}</h1>
      {article.tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {article.tags.map((t) => (
            <span key={t} className="rounded-full border border-border-strong px-3 py-1 font-mono text-[11px] text-muted">
              {t}
            </span>
          ))}
        </div>
      )}
      <div className="mt-8 whitespace-pre-wrap text-[16.5px] leading-[1.75] text-[#33302b]">{article.body}</div>
    </main>
  );
}
