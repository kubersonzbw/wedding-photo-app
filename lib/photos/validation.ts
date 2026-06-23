export const MAX_FILES = 10;
export const MAX_FILE_SIZE = 10 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export function validateImageFile(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    return `Nieobsługiwany typ pliku: ${file.name}`;
  }
  if (file.size > MAX_FILE_SIZE) {
    return `Plik ${file.name} przekracza limit 10 MB.`;
  }
  return null;
}

export function validatePhotoList(files: File[]): string | null {
  if (files.length === 0) return "Dodaj co najmniej jedno zdjęcie.";
  if (files.length > MAX_FILES) return "Możesz dodać maksymalnie 10 zdjęć naraz.";
  for (const file of files) {
    const error = validateImageFile(file);
    if (error) return error;
  }
  return null;
}
