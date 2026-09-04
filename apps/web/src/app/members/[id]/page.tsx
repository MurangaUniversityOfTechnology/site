import type { Metadata } from "next";
import { MemberProfileClient } from "./MemberProfileClient";
import { ogImageUrl } from "@/lib/og";
import { fetchPublic } from "@/lib/serverFetch";
import type { MemberProfile } from "@/lib/api";

export async function generateMetadata(props: PageProps<"/members/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const profile = await fetchPublic<MemberProfile>(`/members/${id}`);
  if (!profile) return {};

  const description = profile.bio || undefined;
  const image = profile.photo_url ?? ogImageUrl({ eyebrow: "Member", title: profile.display_name });

  return {
    title: profile.display_name,
    description,
    openGraph: { title: profile.display_name, description, images: [image] },
    twitter: { title: profile.display_name, description, images: [image] },
  };
}

export default async function MemberProfilePage(props: PageProps<"/members/[id]">) {
  const { id } = await props.params;
  return <MemberProfileClient id={id} />;
}
