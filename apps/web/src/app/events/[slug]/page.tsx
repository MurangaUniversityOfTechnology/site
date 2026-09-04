import type { Metadata } from "next";
import { EventDetailClient } from "./EventDetailClient";
import { formatEventDateLong } from "@/lib/eventFormat";
import { ogImageUrl } from "@/lib/og";
import { fetchPublic } from "@/lib/serverFetch";
import type { EventDetail } from "@/lib/api";

export async function generateMetadata(props: PageProps<"/events/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const event = await fetchPublic<EventDetail>(`/events/${slug}`);
  if (!event) return {};

  const description = event.description || undefined;
  const eyebrow = `Event · ${formatEventDateLong(event.starts_at)}`;
  const image = ogImageUrl({ eyebrow, title: event.title });

  return {
    title: event.title,
    description,
    openGraph: { title: event.title, description, images: [image] },
    twitter: { title: event.title, description, images: [image] },
  };
}

export default async function EventDetailPage(props: PageProps<"/events/[slug]">) {
  const { slug } = await props.params;
  return <EventDetailClient slug={slug} />;
}
