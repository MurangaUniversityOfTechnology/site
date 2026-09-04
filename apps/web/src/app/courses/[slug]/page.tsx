import type { Metadata } from "next";
import { CourseDetailClient } from "./CourseDetailClient";
import { ogImageUrl } from "@/lib/og";
import { fetchPublic } from "@/lib/serverFetch";
import type { CourseDetail } from "@/lib/api";

export async function generateMetadata(props: PageProps<"/courses/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const course = await fetchPublic<CourseDetail>(`/courses/${slug}`);
  if (!course) return {};

  const description = course.short_description || undefined;
  const image = course.cover_image_url ?? ogImageUrl({ eyebrow: "Course", title: course.title });

  return {
    title: course.title,
    description,
    openGraph: { title: course.title, description, images: [image] },
    twitter: { title: course.title, description, images: [image] },
  };
}

export default async function CourseDetailPage(props: PageProps<"/courses/[slug]">) {
  const { slug } = await props.params;
  return <CourseDetailClient slug={slug} />;
}
