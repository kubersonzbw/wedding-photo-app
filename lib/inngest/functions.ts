import { inngest } from "@/lib/inngest/client";
import { UPLOAD_BATCH_COMPLETED_EVENT, type CompletedUploadEventFile, type UploadBatchCompletedEventData } from "@/lib/inngest/events";
import { createAndStoreImageDerivatives, isThumbnailSupported, previewPathForStoragePath, thumbnailPathForStoragePath } from "@/lib/photos/thumbnails";
import { sendUploadNotificationEmail } from "@/lib/notifications/upload-email";
import { objectExists } from "@/lib/storage/backblaze";
import { getGuestById, updatePendingPhotoStatus } from "@/lib/supabase/admin";

const UPLOAD_PROCESSING_CONCURRENCY = Number(process.env.INNGEST_UPLOAD_PROCESSING_CONCURRENCY ?? process.env.UPLOAD_DERIVATIVE_CONCURRENCY ?? 1);

function uploadBatchData(value: unknown) {
  return value as UploadBatchCompletedEventData;
}

async function ensureImageDerivatives(upload: CompletedUploadEventFile) {
  if (!isThumbnailSupported(upload.type)) return;

  const thumbnailPath = thumbnailPathForStoragePath(upload.storagePath);
  const previewPath = previewPathForStoragePath(upload.storagePath);
  const [hasThumbnail, hasPreview] = await Promise.all([
    objectExists(thumbnailPath).catch(() => false),
    objectExists(previewPath).catch(() => false),
  ]);

  if (!hasThumbnail || !hasPreview) {
    await createAndStoreImageDerivatives(upload.storagePath, upload.type, {
      thumbnail: !hasThumbnail,
      preview: !hasPreview,
    });
  }
}

export const processUploadBatch = inngest.createFunction(
  {
    id: "process-upload-batch",
    name: "Process upload batch",
    triggers: { event: UPLOAD_BATCH_COMPLETED_EVENT },
    idempotency: "event.data.batchId",
    retries: 4,
    concurrency: {
      limit: UPLOAD_PROCESSING_CONCURRENCY,
      scope: "fn",
    },
    onFailure: async ({ event, step, error }) => {
      const data = uploadBatchData(event.data.event.data);
      await step.run("mark-pending-uploads-failed", async () => {
        await Promise.all(data.uploads.map((upload) => updatePendingPhotoStatus(upload.photoId, "failed")));
      });

      console.error("Upload batch processing failed after retries", {
        batchId: data.batchId,
        slug: data.slug,
        guestId: data.guestId,
        message: error.message,
      });
    },
  },
  async ({ event, step, logger }) => {
    const data = uploadBatchData(event.data);
    const approvedPhotoIds: string[] = [];

    for (const upload of data.uploads) {
      const approvedPhotoId = await step.run(`process-upload-${upload.photoId}`, async () => {
        await ensureImageDerivatives(upload);
        await updatePendingPhotoStatus(upload.photoId, "approved");
        return upload.photoId;
      });
      approvedPhotoIds.push(approvedPhotoId);
    }

    if (data.notification && approvedPhotoIds.length > 0) {
      await step.run("send-upload-notification-email", async () => {
        const guest = await getGuestById(data.eventId, data.guestId);
        await sendUploadNotificationEmail({
          eventTitle: data.eventTitle,
          guestName: String(guest?.name ?? "Gość"),
          totalCount: data.notification?.totalCount ?? approvedPhotoIds.length,
          imageCount: data.notification?.imageCount ?? 0,
          videoCount: data.notification?.videoCount ?? 0,
          galleryUrl: data.galleryUrl,
        });
      });
    }

    logger.info("Upload batch processed", {
      batchId: data.batchId,
      slug: data.slug,
      approvedCount: approvedPhotoIds.length,
    });

    return {
      batchId: data.batchId,
      approvedCount: approvedPhotoIds.length,
    };
  },
);

export const functions = [processUploadBatch];
