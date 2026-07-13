import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const bucket = process.env.B2_BUCKET_NAME;
const endpoint = process.env.B2_ENDPOINT;
const region = process.env.B2_REGION;
const accessKeyId = process.env.B2_ACCESS_KEY_ID;
const secretAccessKey = process.env.B2_SECRET_ACCESS_KEY;

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

export async function createSignedUploadUrl(path: string, contentType: string, expiresIn = 600) {
  const env = assertBackblazeEnv();
  const client = createBackblazeClient();
  const command = new PutObjectCommand({
    Bucket: env.bucket,
    Key: path,
    ContentType: contentType,
  });

  return {
    signedUrl: await getSignedUrl(client, command, { expiresIn }),
    path,
  };
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

export async function putObject(path: string, body: Buffer, contentType: string) {
  const env = assertBackblazeEnv();
  const client = createBackblazeClient();
  await client.send(new PutObjectCommand({
    Bucket: env.bucket,
    Key: path,
    Body: body,
    ContentType: contentType,
  }));
}

export async function signedUrl(path: string, expiresIn = 300) {
  const env = assertBackblazeEnv();
  const client = createBackblazeClient();
  return getSignedUrl(client, new GetObjectCommand({ Bucket: env.bucket, Key: path }), { expiresIn });
}
