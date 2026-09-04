import type { Metadata } from "next";
import { ArticleClient } from "./ArticleClient";
import { ogImageUrl } from "@/lib/og";
import { excerptOf, fetchPublic } from "@/lib/serverFetch";
import type { ContentItem } from "@/lib/api";

export async function generateMetadata(props: PageProps<"/community/articles/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const article = await fetchPublic<ContentItem>(`/content/published/${id}`);
  if (!article) return {};

  const description = excerptOf(article.body);
  const image = ogImageUrl({ eyebrow: "Community", title: article.title });

  return {
    title: article.title,
    description,
    openGraph: { title: article.title, description, images: [image] },
    twitter: { title: article.title, description, images: [image] },
  };
}

export default async function ArticlePage(props: PageProps<"/community/articles/[id]">) {
  const { id } = await props.params;
  return <ArticleClient id={id} />;
}
