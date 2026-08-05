import type { PhotoFileInfo } from "@/lib/photos/validation";

export const UPLOAD_BATCH_COMPLETED_EVENT = "upload/batch.completed" as const;

export type CompletedUploadEventFile = PhotoFileInfo & {
  photoId: string;
  storagePath: string;
  thumbnailStoragePath?: string;
};

export type UploadNotificationPayload = {
  totalCount: number;
  imageCount: number;
  videoCount: number;
};

export type UploadBatchCompletedEventData = {
  batchId: string;
  eventId: string;
  slug: string;
  guestId: string;
  eventTitle: string;
  galleryUrl: string;
  uploads: CompletedUploadEventFile[];
  notification: UploadNotificationPayload | null;
};
