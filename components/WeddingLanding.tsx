import Link from "next/link";

function WeddingRingsIcon() {
  return <svg className="landing-rings" viewBox="0 0 54 34" aria-hidden="true">
    <path d="M29.3 13.2c0-4.7-5.7-6.9-9-3.3-3.3-3.6-9-1.4-9 3.3 0 6 9 12.1 9 12.1s9-6.1 9-12.1Z" />
    <path d="M43.1 13.2c0-4.7-5.7-6.9-9-3.3-3.3-3.6-9-1.4-9 3.3 0 6 9 12.1 9 12.1s9-6.1 9-12.1Z" />
  </svg>;
}

function CameraIcon() {
  return <svg className="landing-button-icon landing-camera-svg" viewBox="0 0 198.931 198.931" aria-hidden="true">
    <path d="M99.469 69.561c-25.423 0-46.104 20.683-46.104 46.104s20.683 46.104 46.104 46.104c25.421 0 46.104-20.683 46.104-46.104S124.89 69.561 99.469 69.561Zm0 77.349c-17.229 0-31.245-14.017-31.245-31.245 0-17.228 14.017-31.245 31.245-31.245 17.228 0 31.245 14.017 31.245 31.245 0 17.227-14.016 31.245-31.245 31.245Z" />
    <path d="M175.499 44.681h-76.03V27.956c0-9.393-7.64-17.036-17.033-17.036H44.247c-9.393 0-17.033 7.642-17.033 17.036v16.726h-3.777C10.515 44.681 0 55.194 0 68.116v96.465c0 12.92 10.515 23.43 23.437 23.43h152.059c12.925 0 23.435-10.51 23.435-23.43V68.116c.003-12.922-10.51-23.435-23.432-23.435ZM42.07 27.956c0-1.201.976-2.176 2.177-2.176h38.189c1.199 0 2.174.976 2.174 2.177v16.726H42.07V27.956Zm133.429 145.196H23.437c-4.73 0-8.578-3.846-8.578-8.571V68.116c0-4.73 3.848-8.576 8.578-8.576h152.059c4.73 0 8.576 3.846 8.576 8.576v96.465h.003c0 4.725-3.846 8.571-8.576 8.571Z" />
    <rect x="156.012" y="71.816" width="18.989" height="14.859" />
  </svg>;
}

function ImagesIcon() {
  return <svg className="landing-button-icon landing-gallery-svg" viewBox="0 0 100 100" aria-hidden="true">
    <path d="m23.078 10.816c-4.1719 0-7.5781 3.4062-7.5781 7.5781v4.9922h-4.9805c-4.1719 0-7.5781 3.4023-7.5781 7.5781v50.633c0 4.1758 3.4023 7.5898 7.5781 7.5898l66.391-0.003906c4.1719 0 7.5781-3.4141 7.5781-7.5898v-4.9844h4.9961c4.1719 0 7.5781-3.4141 7.5781-7.5898l-0.003906-50.625c0-4.1758-3.4023-7.5781-7.5781-7.5781zm0 2.9453 66.402-0.003907c2.5938 0 4.6367 2.0391 4.6367 4.6367v38.559l-15.945-19.422c-1.5-1.8281-3.6641-2.7461-5.832-2.7461-2.168 0-4.3398 0.91797-5.8398 2.7461l-15.535 18.926c-0.67578 0.82422-1.8594 0.82812-2.5391 0.011719l-6.2227-7.4922c-3.0312-3.6484-8.707-3.6484-11.734 0l-12.027 14.469v-45.051c0-2.5977 2.043-4.6367 4.6367-4.6367zm24.52 7.6641c-5.4336 0-9.8672 4.4414-9.8672 9.8789 0 5.4336 4.4336 9.8672 9.8672 9.8672s9.8672-4.4336 9.8672-9.8672c0-5.4336-4.4336-9.8789-9.8672-9.8789zm0 2.9414c3.8438 0 6.9297 3.0898 6.9297 6.9375 0 3.8477-3.0859 6.9297-6.9297 6.9297s-6.9258-3.082-6.9258-6.9297c0-3.8477 3.082-6.9375 6.9258-6.9375zm-37.082 1.9648h4.9805v42.695c0 4.1758 3.4062 7.5898 7.5781 7.5898l58.473-0.003907v4.9844c0 2.5977-2.043 4.6484-4.6367 4.6484l-66.391-0.003906c-2.5938 0-4.6367-2.0508-4.6367-4.6484v-50.629c0-2.5977 2.043-4.6367 4.6367-4.6367zm61.816 11.367c1.3164 0 2.6367 0.56641 3.5664 1.7031l18.215 22.184v7.4414c0 2.5977-2.043 4.6484-4.6367 4.6484l-6.4531-0.003906h-59.945c-2.5938 0-4.6367-2.0508-4.6367-4.6484v-0.98047l14.297-17.191c1.8945-2.2773 5.3047-2.2773 7.1992 0l6.2344 7.4922c1.8203 2.1914 5.2578 2.1836 7.0664-0.023438l15.531-18.922c0.93359-1.1367 2.2461-1.7031 3.5625-1.7031z" />
  </svg>;
}

export default function WeddingLanding({ uploadHref, galleryHref }: { uploadHref: string; galleryHref: string }) {
  return <main className="landing-screen">
    <div className="landing-frame">
      <section className="landing-content" aria-label="Natalia i Robert - wspólna galeria weselna">
        <div className="landing-rings-wrap"><WeddingRingsIcon /></div>
        <p className="landing-overline">Natalia &amp; Robert</p>
        <h1 className="landing-title">Natalia &amp;<br />Robert</h1>
        <p className="landing-subtitle">Wspólna galeria weselna</p>
        <p className="landing-description">Podziel się wspomnieniami z naszego dnia<br />i twórzmy razem wspólną galerię.</p>

        <div className="landing-actions">
          <Link className="landing-button landing-button-primary" href={uploadHref} aria-label="Dodaj wspomnienia">
            <CameraIcon />
            <span className="landing-primary-label">Dodaj wspomnienia</span>
          </Link>
          <Link className="landing-button landing-button-secondary" href={galleryHref} aria-label="Zobacz galerię">
            <ImagesIcon />
            <span className="landing-secondary-label">Zobacz galerię</span>
          </Link>
        </div>
      </section>
    </div>
  </main>;
}
