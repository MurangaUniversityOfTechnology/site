import type { Metadata } from "next";
import { PostDetailClient } from "./PostDetailClient";
import { fetchPublic, excerptOf } from "@/lib/serverFetch";
import { ogImageUrl } from "@/lib/og";
import type { CommunityPostDetail } from "@/lib/api";

export async function generateMetadata(props: PageProps<"/community/board/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const post = await fetchPublic<CommunityPostDetail>(`/community/posts/${id}`);
  if (!post) return {};

  const description = post.body ? excerptOf(post.body) : undefined;
  const eyebrow = post.kind === "poll" ? "Poll" : "Question";
  const image = ogImageUrl({ eyebrow, title: post.title });

  return {
    title: post.title,
    description,
    openGraph: { title: post.title, description, images: [image] },
    twitter: { title: post.title, description, images: [image] },
  };
}

export default async function CommunityPostPage(props: PageProps<"/community/board/[id]">) {
  const { id } = await props.params;
  return <PostDetailClient id={id} />;
}
