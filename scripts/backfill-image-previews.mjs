import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client, S3ServiceException } from "@aws-sdk/client-s3";
import sharp from "sharp";

const PREVIEW_WIDTH = 1600;
const PREVIEW_QUALITY = 82;
const PAGE_SIZE = 200;
const DEFAULT_CONCURRENCY = 3;
const SUPPORTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    apply: false,
    force: false,
    slug: "",
    limit: 0,
    concurrency: DEFAULT_CONCURRENCY,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--apply") options.apply = true;
    else if (arg === "--force") options.force = true;
    else if (arg === "--slug") options.slug = String(args[++index] ?? "").trim();
    else if (arg.startsWith("--slug=")) options.slug = arg.slice("--slug=".length).trim();
    else if (arg === "--limit") options.limit = Math.max(Number(args[++index]) || 0, 0);
    else if (arg.startsWith("--limit=")) options.limit = Math.max(Number(arg.slice("--limit=".length)) || 0, 0);
    else if (arg === "--concurrency") options.concurrency = Math.max(Number(args[++index]) || DEFAULT_CONCURRENCY, 1);
    else if (arg.startsWith("--concurrency=")) options.concurrency = Math.max(Number(arg.slice("--concurrency=".length)) || DEFAULT_CONCURRENCY, 1);
  }

  return options;
}

function loadEnvFile(filename) {
  if (!fs.existsSync(filename)) return;

  const lines = fs.readFileSync(filename, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const normalized = trimmed.startsWith("export ") ? trimmed.slice("export ".length).trim() : trimmed;
    const equalsIndex = normalized.indexOf("=");
    if (equalsIndex < 1) continue;

    const key = normalized.slice(0, equalsIndex).trim();
    let value = normalized.slice(equalsIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] ??= value;
  }
}

function loadEnv() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const root = path.resolve(scriptDir, "..");
  loadEnvFile(path.join(root, ".env.local"));
  loadEnvFile(path.join(root, ".env"));
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}

function previewPathForStoragePath(storagePath) {
  const dotIndex = storagePath.lastIndexOf(".");
  const basePath = dotIndex > -1 ? storagePath.slice(0, dotIndex) : storagePath;
  return `previews/${basePath}.jpg`;
}

function createS3Client() {
  return new S3Client({
    endpoint: requireEnv("B2_ENDPOINT"),
    region: requireEnv("B2_REGION"),
    forcePathStyle: true,
    credentials: {
      accessKeyId: requireEnv("B2_ACCESS_KEY_ID"),
      secretAccessKey: requireEnv("B2_SECRET_ACCESS_KEY"),
    },
  });
}

async function supabaseFetch(restPath) {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const response = await fetch(`${url}${restPath}`, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
  });

  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

async function getEventIdBySlug(slug) {
  if (!slug) return "";
  const rows = await supabaseFetch(`/rest/v1/events?slug=eq.${encodeURIComponent(slug)}&select=id&limit=1`);
  const eventId = rows?.[0]?.id;
  if (!eventId) throw new Error(`Event not found for slug: ${slug}`);
  return eventId;
}

async function listApprovedImagePhotos(eventId, limit) {
  const photos = [];
  let offset = 0;

  while (!limit || photos.length < limit) {
    const remaining = limit ? Math.min(PAGE_SIZE, limit - photos.length) : PAGE_SIZE;
    const eventFilter = eventId ? `&event_id=eq.${encodeURIComponent(eventId)}` : "";
    const rows = await supabaseFetch(`/rest/v1/photos?select=id,storage_path,mime_type,status,event_id&status=eq.approved${eventFilter}&order=created_at.asc,id.asc&limit=${remaining}&offset=${offset}`);
    if (!Array.isArray(rows) || rows.length === 0) break;

    photos.push(...rows.filter((photo) => SUPPORTED_IMAGE_TYPES.has(String(photo.mime_type ?? ""))));
    offset += rows.length;
    if (rows.length < remaining) break;
  }

  return limit ? photos.slice(0, limit) : photos;
}

async function objectExists(client, bucket, key) {
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch (error) {
    if (error instanceof S3ServiceException && error.$metadata.httpStatusCode === 404) return false;
    throw error;
  }
}

async function getObjectBytes(client, bucket, key) {
  const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const bytes = await response.Body?.transformToByteArray();
  if (!bytes) throw new Error(`Missing body for ${key}.`);
  return Buffer.from(bytes);
}

async function putObject(client, bucket, key, body) {
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: "image/jpeg",
  }));
}

async function createPreview(source) {
  return sharp(source)
    .rotate()
    .resize({ width: PREVIEW_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: PREVIEW_QUALITY, mozjpeg: true })
    .toBuffer();
}

async function runWithConcurrency(items, concurrency, task) {
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      await task(items[index], index);
    }
  });
  await Promise.all(workers);
}

async function main() {
  loadEnv();
  const options = parseArgs();
  const bucket = requireEnv("B2_BUCKET_NAME");
  const client = createS3Client();
  const eventId = await getEventIdBySlug(options.slug);
  const photos = await listApprovedImagePhotos(eventId, options.limit);

  let existing = 0;
  let created = 0;
  let missing = 0;
  let failed = 0;

  await runWithConcurrency(photos, options.concurrency, async (photo) => {
    const storagePath = String(photo.storage_path ?? "");
    const previewPath = previewPathForStoragePath(storagePath);
    const hasPreview = !options.force && await objectExists(client, bucket, previewPath);

    if (hasPreview) {
      existing += 1;
      return;
    }

    missing += 1;
    if (!options.apply) return;

    try {
      const source = await getObjectBytes(client, bucket, storagePath);
      const preview = await createPreview(source);
      await putObject(client, bucket, previewPath, preview);
      created += 1;
      console.log(`created ${previewPath}`);
    } catch (error) {
      failed += 1;
      console.error(`failed ${storagePath}:`, error instanceof Error ? error.message : error);
    }
  });

  console.log(JSON.stringify({
    mode: options.apply ? "apply" : "dry-run",
    slug: options.slug || "all",
    scanned: photos.length,
    existing,
    missing,
    created,
    failed,
  }, null, 2));

  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
