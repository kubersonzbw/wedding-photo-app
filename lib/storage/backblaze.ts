import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const bucket = process.env.B2_BUCKET_NAME;
const endpoint = process.env.B2_ENDPOINT;
const region = process.env.B2_REGION;
const accessKeyId = process.env.B2_ACCESS_KEY_ID;
const secretAccessKey = process.env.B2_SECRET_ACCESS_KEY;

export const DERIVATIVE_CACHE_CONTROL = "private, max-age=86400, immutable";

type PutObjectOptions = {
  cacheControl?: string;
};

function assertBackblazeEnv() {
  if (!bucket || !endpoint || !region || !accessKeyId || !secretAccessKey) {
    throw new Error("Missing Backblaze B2 environment variables.");
  }

  return { bucket, endpoint, region, accessKeyId, secretAccessKey };
}

function createBackblazeClient() {
  const env = assertBackblazeEnv();

  return new S3Client({
    endpoint: env.endpoint,
    region: env.region,
    forcePathStyle: true,
    credentials: {
      accessKeyId: env.accessKeyId,
      secretAccessKey: env.secretAccessKey,
    },
  });
}

export async function createSignedUploadUrl(path: string, contentType: string, expiresIn = 600, options: PutObjectOptions = {}) {
  const env = assertBackblazeEnv();
  const client = createBackblazeClient();
  const command = new PutObjectCommand({
    Bucket: env.bucket,
    Key: path,
    ContentType: contentType,
    CacheControl: options.cacheControl,
  });

  return {
    signedUrl: await getSignedUrl(client, command, { expiresIn }),
    path,
  };
}

export async function createMultipartUpload(path: string, contentType: string) {
  const env = assertBackblazeEnv();
  const client = createBackblazeClient();
  const response = await client.send(new CreateMultipartUploadCommand({
    Bucket: env.bucket,
    Key: path,
    ContentType: contentType,
  }));

  if (!response.UploadId) throw new Error("Nie udało się rozpocząć uploadu wieloczęściowego.");

  return {
    path,
    uploadId: response.UploadId,
  };
}

export async function createSignedMultipartPartUrls(path: string, uploadId: string, partCount: number, expiresIn = 3600) {
  const env = assertBackblazeEnv();
  const client = createBackblazeClient();

  return Promise.all(Array.from({ length: partCount }, async (_, index) => {
    const partNumber = index + 1;
    const command = new UploadPartCommand({
      Bucket: env.bucket,
      Key: path,
      UploadId: uploadId,
      PartNumber: partNumber,
    });

    return {
      partNumber,
      signedUrl: await getSignedUrl(client, command, { expiresIn }),
    };
  }));
}

export async function completeMultipartUpload(path: string, uploadId: string, parts: Array<{ partNumber: number; etag: string }>) {
  const env = assertBackblazeEnv();
  const client = createBackblazeClient();
  await client.send(new CompleteMultipartUploadCommand({
    Bucket: env.bucket,
    Key: path,
    UploadId: uploadId,
    MultipartUpload: {
      Parts: parts
        .slice()
        .sort((a, b) => a.partNumber - b.partNumber)
        .map((part) => ({ PartNumber: part.partNumber, ETag: part.etag })),
    },
  }));
}

export async function abortMultipartUpload(path: string, uploadId: string) {
  const env = assertBackblazeEnv();
  const client = createBackblazeClient();
  await client.send(new AbortMultipartUploadCommand({
    Bucket: env.bucket,
    Key: path,
    UploadId: uploadId,
  }));
}

export async function objectExists(path: string) {
  const env = assertBackblazeEnv();
  const client = createBackblazeClient();

  try {
    await client.send(new HeadObjectCommand({ Bucket: env.bucket, Key: path }));
    return true;
  } catch (error) {
    if (error instanceof S3ServiceException && error.$metadata.httpStatusCode === 404) return false;
    throw error;
  }
}

export async function removeObject(path: string) {
  const env = assertBackblazeEnv();
  const client = createBackblazeClient();
  await client.send(new DeleteObjectCommand({ Bucket: env.bucket, Key: path }));
}

export async function removeObjects(paths: string[]) {
  if (paths.length === 0) return;

  const env = assertBackblazeEnv();
  const client = createBackblazeClient();
  await client.send(new DeleteObjectsCommand({
    Bucket: env.bucket,
    Delete: {
      Objects: paths.map((path) => ({ Key: path })),
      Quiet: true,
    },
  }));
}

export async function getObjectBytes(path: string) {
  const env = assertBackblazeEnv();
  const client = createBackblazeClient();
  const response = await client.send(new GetObjectCommand({ Bucket: env.bucket, Key: path }));
  const bytes = await response.Body?.transformToByteArray();
  if (!bytes) throw new Error("Missing Backblaze object body.");
  return Buffer.from(bytes);
}

export async function putObject(path: string, body: Buffer, contentType: string, options: PutObjectOptions = {}) {
  const env = assertBackblazeEnv();
  const client = createBackblazeClient();
  await client.send(new PutObjectCommand({
    Bucket: env.bucket,
    Key: path,
    Body: body,
    ContentType: contentType,
    CacheControl: options.cacheControl,
  }));
}

export async function signedUrl(path: string, expiresIn = 300) {
  const env = assertBackblazeEnv();
  const client = createBackblazeClient();
  return getSignedUrl(client, new GetObjectCommand({ Bucket: env.bucket, Key: path }), { expiresIn });
}

export async function signedDownloadUrl(path: string, filename: string, expiresIn = 120) {
  const env = assertBackblazeEnv();
  const client = createBackblazeClient();
  return getSignedUrl(client, new GetObjectCommand({
    Bucket: env.bucket,
    Key: path,
    ResponseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
  }), { expiresIn });
}
