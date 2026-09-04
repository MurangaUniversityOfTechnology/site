import type { Metadata } from "next";
import { FillFormClient } from "./FillFormClient";
import { ogImageUrl } from "@/lib/og";
import { fetchPublic } from "@/lib/serverFetch";
import type { FormPublic } from "@/lib/api";

export async function generateMetadata(props: PageProps<"/forms/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const form = await fetchPublic<FormPublic>(`/forms/${slug}`);
  if (!form) return {};

  const description = form.description || undefined;
  const image = ogImageUrl({ eyebrow: "Form", title: form.title });

  return {
    title: form.title,
    description,
    openGraph: { title: form.title, description, images: [image] },
    twitter: { title: form.title, description, images: [image] },
  };
}

export default async function FillFormPage(props: PageProps<"/forms/[slug]">) {
  const { slug } = await props.params;
  return <FillFormClient slug={slug} />;
}
