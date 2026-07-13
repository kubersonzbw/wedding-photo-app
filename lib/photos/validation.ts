export const MAX_FILES = 100;
export const MAX_VIDEO_FILES = 10;
export const MAX_IMAGE_SIZE = 25 * 1024 * 1024;
export const MAX_VIDEO_SIZE = 500 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"] as const;
export const ALLOWED_MEDIA_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES] as const;

export type PhotoFileInfo = {
  name: string;
  type: string;
  size: number;
};

function maxFileSizeForType(type: string) {
  return ALLOWED_VIDEO_TYPES.includes(type as (typeof ALLOWED_VIDEO_TYPES)[number]) ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
}

function maxFileSizeLabel(type: string) {
  return ALLOWED_VIDEO_TYPES.includes(type as (typeof ALLOWED_VIDEO_TYPES)[number]) ? "500 MB" : "25 MB";
}

export function isVideoType(type: string) {
  return ALLOWED_VIDEO_TYPES.includes(type as (typeof ALLOWED_VIDEO_TYPES)[number]);
}

export function validateMediaFile(file: File): string | null {
  if (!ALLOWED_MEDIA_TYPES.includes(file.type as (typeof ALLOWED_MEDIA_TYPES)[number])) {
    return "Nieobsługiwany typ pliku.";
  }
  if (file.size > maxFileSizeForType(file.type)) {
    return `Ten plik jest za duży. Maksymalny rozmiar to ${maxFileSizeLabel(file.type)}.`;
  }
  return null;
}

export function validateMediaFileInfo(file: PhotoFileInfo): string | null {
  if (!ALLOWED_MEDIA_TYPES.includes(file.type as (typeof ALLOWED_MEDIA_TYPES)[number])) {
    return "Nieobsługiwany typ pliku.";
  }
  if (!Number.isFinite(file.size) || file.size <= 0) {
    return `Plik ${file.name} jest pusty albo uszkodzony.`;
  }
  if (file.size > maxFileSizeForType(file.type)) {
    return `Ten plik jest za duży. Maksymalny rozmiar to ${maxFileSizeLabel(file.type)}.`;
  }
  return null;
}

export function validatePhotoList(files: File[]): string | null {
  if (files.length === 0) return "Dodaj co najmniej jedno zdjęcie lub film.";
  if (files.length > MAX_FILES) return "Możesz dodać maksymalnie 100 plików naraz.";
  if (files.filter((file) => isVideoType(file.type)).length > MAX_VIDEO_FILES) return "Możesz dodać maksymalnie 10 filmów naraz.";
  for (const file of files) {
    const error = validateMediaFile(file);
    if (error) return error;
  }
  return null;
}

export function validatePhotoFileInfoList(files: PhotoFileInfo[]): string | null {
  if (files.length === 0) return "Dodaj co najmniej jedno zdjęcie lub film.";
  if (files.length > MAX_FILES) return "Możesz dodać maksymalnie 100 plików naraz.";
  if (files.filter((file) => isVideoType(file.type)).length > MAX_VIDEO_FILES) return "Możesz dodać maksymalnie 10 filmów naraz.";
  for (const file of files) {
    const error = validateMediaFileInfo(file);
    if (error) return error;
  }
  return null;
}
