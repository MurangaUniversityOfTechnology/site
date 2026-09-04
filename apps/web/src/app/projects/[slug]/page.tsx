import type { Metadata } from "next";
import { ProjectDetailClient } from "./ProjectDetailClient";
import { ogImageUrl } from "@/lib/og";
import { fetchPublic } from "@/lib/serverFetch";
import type { ProjectDetail } from "@/lib/api";

export async function generateMetadata(props: PageProps<"/projects/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const project = await fetchPublic<ProjectDetail>(`/projects/${slug}`);
  if (!project) return {};

  const description = project.description || undefined;
  const eyebrow = project.language ? `Project · ${project.language}` : "Project";
  const image = ogImageUrl({ eyebrow, title: project.name });

  return {
    title: project.name,
    description,
    openGraph: { title: project.name, description, images: [image] },
    twitter: { title: project.name, description, images: [image] },
  };
}

export default async function ProjectDetailPage(props: PageProps<"/projects/[slug]">) {
  const { slug } = await props.params;
  return <ProjectDetailClient slug={slug} />;
}
