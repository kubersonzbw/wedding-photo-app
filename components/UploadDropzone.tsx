import type { RefObject } from "react";

export default function UploadDropzone({ fileRef, fileCount, onChange }: { fileRef: RefObject<HTMLInputElement | null>; fileCount: number; onChange: (count: number) => void }) {
  return <div>
    <label className="sr-only" htmlFor="photos">Zdjęcia</label>
    <label className="upload-dropzone" htmlFor="photos">
      <span className="camera-icon" aria-hidden="true">📷</span>
      <strong>Wybierz zdjęcia z telefonu</strong>
      <span>Maksymalnie 10 zdjęć</span>
      <small>{fileCount > 0 ? `Wybrano ${fileCount} zdjęć` : "JPG, PNG lub WebP, do 10 MB każde"}</small>
    </label>
    <input ref={fileRef} id="photos" className="sr-only" required name="photos" type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={(e) => onChange(e.target.files?.length ?? 0)} />
  </div>;
}
