import sharp from "sharp";
import { ALLOWED_IMAGE_TYPES } from "@/lib/photos/validation";
import { DERIVATIVE_CACHE_CONTROL, getObjectBytes, putObject } from "@/lib/storage/backblaze";

const THUMBNAIL_WIDTH = 640;
const THUMBNAIL_QUALITY = 72;
const PREVIEW_WIDTH = 1600;
const PREVIEW_QUALITY = 82;

type ImageDerivativeOptions = {
  thumbnail?: boolean;
  preview?: boolean;
};

export function thumbnailPathForStoragePath(path: string) {
  const dotIndex = path.lastIndexOf(".");
  const basePath = dotIndex > -1 ? path.slice(0, dotIndex) : path;
  return `thumbnails/${basePath}.jpg`;
}

export function previewPathForStoragePath(path: string) {
  const dotIndex = path.lastIndexOf(".");
  const basePath = dotIndex > -1 ? path.slice(0, dotIndex) : path;
  return `previews/${basePath}.jpg`;
}

export function isThumbnailSupported(type: string) {
  return ALLOWED_IMAGE_TYPES.includes(type as (typeof ALLOWED_IMAGE_TYPES)[number]);
}

async function createJpegVariant(source: Buffer, width: number, quality: number) {
  return sharp(source)
    .rotate()
    .resize({ width, withoutEnlargement: true })
    .jpeg({ quality, mozjpeg: true })
    .toBuffer();
}

export async function createImageThumbnail(sourcePath: string) {
  const source = await getObjectBytes(sourcePath);
  return createJpegVariant(source, THUMBNAIL_WIDTH, THUMBNAIL_QUALITY);
}

export async function createImagePreview(sourcePath: string) {
  const source = await getObjectBytes(sourcePath);
  return createJpegVariant(source, PREVIEW_WIDTH, PREVIEW_QUALITY);
}

export async function createAndStoreImageThumbnail(sourcePath: string, contentType: string) {
  if (!isThumbnailSupported(contentType)) return null;

  const thumbnailPath = thumbnailPathForStoragePath(sourcePath);
  const thumbnail = await createImageThumbnail(sourcePath);
  await putObject(thumbnailPath, thumbnail, "image/jpeg", { cacheControl: DERIVATIVE_CACHE_CONTROL });
  return thumbnailPath;
}

export async function createAndStoreImagePreview(sourcePath: string, contentType: string) {
  if (!isThumbnailSupported(contentType)) return null;

  const previewPath = previewPathForStoragePath(sourcePath);
  const preview = await createImagePreview(sourcePath);
  await putObject(previewPath, preview, "image/jpeg", { cacheControl: DERIVATIVE_CACHE_CONTROL });
  return previewPath;
}

export async function createAndStoreImageDerivatives(sourcePath: string, contentType: string, options: ImageDerivativeOptions = {}) {
  if (!isThumbnailSupported(contentType)) return null;

  const shouldCreateThumbnail = options.thumbnail ?? true;
  const shouldCreatePreview = options.preview ?? true;
  if (!shouldCreateThumbnail && !shouldCreatePreview) return [];

  const source = await getObjectBytes(sourcePath);
  const createdPaths: string[] = [];

  if (shouldCreateThumbnail) {
    const thumbnail = await createJpegVariant(source, THUMBNAIL_WIDTH, THUMBNAIL_QUALITY);
    const thumbnailPath = thumbnailPathForStoragePath(sourcePath);
    await putObject(thumbnailPath, thumbnail, "image/jpeg", { cacheControl: DERIVATIVE_CACHE_CONTROL });
    createdPaths.push(thumbnailPath);
  }

  if (shouldCreatePreview) {
    const preview = await createJpegVariant(source, PREVIEW_WIDTH, PREVIEW_QUALITY);
    const previewPath = previewPathForStoragePath(sourcePath);
    await putObject(previewPath, preview, "image/jpeg", { cacheControl: DERIVATIVE_CACHE_CONTROL });
    createdPaths.push(previewPath);
  }

  return createdPaths;
}
