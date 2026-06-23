import GalleryClient from "@/components/GalleryClient";

export default async function EventGalleryPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ code?: string | string[] }> }) {
  const { slug } = await params;
  const codeParam = (await searchParams).code;
  const code = Array.isArray(codeParam) ? codeParam[0] ?? "" : codeParam ?? "";
  return <GalleryClient initialSlug={slug} initialCode={code} />;
}
