import type { RefObject } from "react";

function photoCountLabel(count: number) {
  if (count === 1) return "1 zdjęcie";
  const lastTwo = count % 100;
  const last = count % 10;
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return `${count} zdjęcia`;
  return `${count} zdjęć`;
}

export default function UploadDropzone({ fileRef, fileCount, onChange }: { fileRef: RefObject<HTMLInputElement | null>; fileCount: number; onChange: (files: File[]) => void }) {
  const hasFiles = fileCount > 0;

  return <div>
    <label className="sr-only" htmlFor="photos">Zdjęcia</label>
    <label className={`upload-dropzone${hasFiles ? " upload-dropzone-selected" : ""}`} htmlFor="photos">
      <span className="upload-dropzone-icon" aria-hidden="true">
        <svg viewBox="0 0 198.931 198.931">
          <path d="M99.469 69.561c-25.423 0-46.104 20.683-46.104 46.104s20.683 46.104 46.104 46.104c25.421 0 46.104-20.683 46.104-46.104S124.89 69.561 99.469 69.561Zm0 77.349c-17.229 0-31.245-14.017-31.245-31.245 0-17.228 14.017-31.245 31.245-31.245 17.228 0 31.245 14.017 31.245 31.245 0 17.227-14.016 31.245-31.245 31.245Z" />
          <path d="M175.499 44.681h-76.03V27.956c0-9.393-7.64-17.036-17.033-17.036H44.247c-9.393 0-17.033 7.642-17.033 17.036v16.726h-3.777C10.515 44.681 0 55.194 0 68.116v96.465c0 12.92 10.515 23.43 23.437 23.43h152.059c12.925 0 23.435-10.51 23.435-23.43V68.116c.003-12.922-10.51-23.435-23.432-23.435ZM42.07 27.956c0-1.201.976-2.176 2.177-2.176h38.189c1.199 0 2.174.976 2.174 2.177v16.726H42.07V27.956Zm133.429 145.196H23.437c-4.73 0-8.578-3.846-8.578-8.571V68.116c0-4.73 3.848-8.576 8.578-8.576h152.059c4.73 0 8.576 3.846 8.576 8.576v96.465h.003c0 4.725-3.846 8.571-8.576 8.571Z" />
          <rect x="156.012" y="71.816" width="18.989" height="14.859" />
        </svg>
      </span>
      <strong>{hasFiles ? "Gotowe do wysłania" : "Wybierz zdjęcia z telefonu"}</strong>
      <span>{hasFiles ? `Wybrano ${photoCountLabel(fileCount)}` : "Maksymalnie 10 zdjęć"}</span>
      <small>{hasFiles ? "Możesz dotknąć tutaj, aby zmienić wybór" : "JPG, PNG lub WebP, do 25 MB każde"}</small>
    </label>
    <input ref={fileRef} id="photos" className="sr-only" name="photos" type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={(e) => onChange(Array.from(e.target.files ?? []))} />
  </div>;
}
