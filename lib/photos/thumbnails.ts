import sharp from "sharp";
import { ALLOWED_IMAGE_TYPES } from "@/lib/photos/validation";
import { getObjectBytes, putObject } from "@/lib/storage/backblaze";

const THUMBNAIL_WIDTH = 640;
const THUMBNAIL_QUALITY = 72;

export function thumbnailPathForStoragePath(path: string) {
  const dotIndex = path.lastIndexOf(".");
  const basePath = dotIndex > -1 ? path.slice(0, dotIndex) : path;
  return `thumbnails/${basePath}.jpg`;
}

export function isThumbnailSupported(type: string) {
  return ALLOWED_IMAGE_TYPES.includes(type as (typeof ALLOWED_IMAGE_TYPES)[number]);
}

export async function createImageThumbnail(sourcePath: string) {
  const source = await getObjectBytes(sourcePath);
  return sharp(source)
    .rotate()
    .resize({ width: THUMBNAIL_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: THUMBNAIL_QUALITY, mozjpeg: true })
    .toBuffer();
}

export async function createAndStoreImageThumbnail(sourcePath: string, contentType: string) {
  if (!isThumbnailSupported(contentType)) return null;

  const thumbnailPath = thumbnailPathForStoragePath(sourcePath);
  const thumbnail = await createImageThumbnail(sourcePath);
  await putObject(thumbnailPath, thumbnail, "image/jpeg");
  return thumbnailPath;
}
