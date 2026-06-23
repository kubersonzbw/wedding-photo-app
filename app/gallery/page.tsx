import GalleryClient from "@/components/GalleryClient";
import { DEFAULT_EVENT_SLUG } from "@/lib/events/config";

export default async function GalleryPage({ searchParams }: { searchParams: Promise<{ code?: string | string[] }> }) {
  const codeParam = (await searchParams).code;
  const code = Array.isArray(codeParam) ? codeParam[0] ?? "" : codeParam ?? "";
  return <GalleryClient initialSlug={DEFAULT_EVENT_SLUG} initialCode={code} />;
}
