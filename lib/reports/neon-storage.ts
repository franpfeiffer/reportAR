import { createHash, randomUUID } from "node:crypto";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const MAX_TELEGRAM_PHOTO_BYTES = 20 * 1024 * 1024;

const bucket = () => process.env.REPORT_IMAGES_BUCKET || "report-images";
let client: S3Client | undefined;

function storageClient() {
  if (client) return client;
  const { AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_ENDPOINT_URL_S3, AWS_REGION } = process.env;
  if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY || !AWS_ENDPOINT_URL_S3 || !AWS_REGION) {
    throw new Error("Neon Object Storage is not configured");
  }
  const endpoint = new URL(AWS_ENDPOINT_URL_S3);
  if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password) {
    throw new Error("Telegram photo storage endpoint is invalid");
  }
  client = new S3Client({
    endpoint: endpoint.toString(),
    region: AWS_REGION,
    forcePathStyle: true,
    requestChecksumCalculation: "WHEN_REQUIRED",
    credentials: { accessKeyId: AWS_ACCESS_KEY_ID, secretAccessKey: AWS_SECRET_ACCESS_KEY },
  });
  return client;
}

type ImageFormat = { contentType: string; extension: string };

function detectImageFormat(bytes: Buffer): ImageFormat | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { contentType: "image/jpeg", extension: "jpg" };
  }
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return { contentType: "image/png", extension: "png" };
  }
  if (bytes.length >= 6 && (bytes.toString("ascii", 0, 6) === "GIF87a" || bytes.toString("ascii", 0, 6) === "GIF89a")) {
    return { contentType: "image/gif", extension: "gif" };
  }
  if (bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") {
    return { contentType: "image/webp", extension: "webp" };
  }
  if (bytes.length >= 2 && bytes.toString("ascii", 0, 2) === "BM") {
    return { contentType: "image/bmp", extension: "bmp" };
  }
  if (bytes.length >= 12 && bytes.toString("ascii", 4, 8) === "ftyp") {
    const brands = bytes.toString("ascii", 8, Math.min(bytes.length, 64));
    if (brands.includes("avif") || brands.includes("avis")) return { contentType: "image/avif", extension: "avif" };
  }
  return null;
}

async function readBounded(response: Response) {
  const declaredSize = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredSize) && declaredSize > MAX_TELEGRAM_PHOTO_BYTES) {
    throw new Error("Telegram photo exceeds the download limit");
  }
  if (!response.body) throw new Error("Telegram photo response has no body");
  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_TELEGRAM_PHOTO_BYTES) {
        await reader.cancel();
        throw new Error("Telegram photo exceeds the download limit");
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, size);
}

async function downloadTelegramPhoto(fileId: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("Telegram bot token is not configured");

  const fileResponse = await fetch(`https://api.telegram.org/bot${token}/getFile`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ file_id: fileId }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
    redirect: "error",
  });
  if (!fileResponse.ok) throw new Error("Telegram getFile failed");
  const payload: unknown = await fileResponse.json();
  if (!payload || typeof payload !== "object" || !("ok" in payload) || payload.ok !== true || !("result" in payload)) {
    throw new Error("Telegram getFile returned an invalid response");
  }
  const file = payload.result;
  if (!file || typeof file !== "object" || !("file_path" in file) || typeof file.file_path !== "string") {
    throw new Error("Telegram getFile did not return a file path");
  }
  const filePath = file.file_path;
  if (!filePath || filePath.startsWith("/") || filePath.split("/").some(part => !part || part === "." || part === "..")) {
    throw new Error("Telegram returned an invalid file path");
  }
  if ("file_size" in file && typeof file.file_size === "number" && file.file_size > MAX_TELEGRAM_PHOTO_BYTES) {
    throw new Error("Telegram photo exceeds the download limit");
  }

  const encodedPath = filePath.split("/").map(encodeURIComponent).join("/");
  const imageResponse = await fetch(`https://api.telegram.org/file/bot${token}/${encodedPath}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
    redirect: "error",
  });
  if (!imageResponse.ok) throw new Error("Telegram photo download failed");
  const declaredContentType = imageResponse.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (declaredContentType && declaredContentType !== "application/octet-stream" && !declaredContentType.startsWith("image/")) {
    throw new Error("Telegram file content type is not an image");
  }
  const bytes = await readBounded(imageResponse);
  const format = detectImageFormat(bytes);
  if (!format) throw new Error("Telegram file is not a supported image");
  if (declaredContentType?.startsWith("image/") && declaredContentType !== format.contentType) {
    throw new Error("Telegram image content type does not match its format");
  }
  return { bytes, ...format };
}

export async function storeTelegramPhoto(reportId: string, fileId: string) {
  const image = await downloadTelegramPhoto(fileId);
  const fileHash = createHash("sha256").update(fileId).digest("hex").slice(0, 24);
  const key = `reports/${reportId}/telegram-${fileHash}.${image.extension}`;
  await storageClient().send(new PutObjectCommand({
    Bucket: bucket(),
    Key: key,
    Body: image.bytes,
    ContentType: image.contentType,
    CacheControl: "private, no-store",
  }));
  return { key, contentType: image.contentType, filename: `foto.${image.extension}` };
}

const REPORT_ID_PATTERN = "[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const STORAGE_KEY_PATTERN = new RegExp(
  `^reports/${REPORT_ID_PATTERN}/(?:telegram-[0-9a-f]{24}\\.(?:jpg|png|gif|webp|bmp|avif)|web-[0-9a-f-]{36}-[a-z0-9._-]{1,100})$`,
  "i",
);

export function sanitizePhotoFilename(filename: string) {
  return filename.normalize("NFKD").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100) || "foto";
}

export async function createReportPhotoUpload(reportId: string, filename: string, contentType: string, maxBytes: number) {
  const key = `reports/${reportId}/web-${randomUUID()}-${sanitizePhotoFilename(filename)}`;
  const signedPost = await createPresignedPost(storageClient(), {
    Bucket: bucket(),
    Key: key,
    Fields: { "Content-Type": contentType, "Cache-Control": "private, no-store" },
    Conditions: [
      ["eq", "$Content-Type", contentType],
      ["eq", "$Cache-Control", "private, no-store"],
      ["content-length-range", 1, maxBytes],
    ],
    Expires: 15 * 60,
  });
  return { key, url: signedPost.url, fields: signedPost.fields };
}

export async function headReportPhoto(key: string) {
  if (!STORAGE_KEY_PATTERN.test(key)) throw new Error("Invalid report photo storage key");
  return storageClient().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
}

export async function deleteReportPhoto(key: string) {
  if (!STORAGE_KEY_PATTERN.test(key)) throw new Error("Invalid report photo storage key");
  return storageClient().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}

export async function getSignedReportPhotoUrl(key: string, options: { download: boolean; filename: string }) {
  if (!STORAGE_KEY_PATTERN.test(key)) throw new Error("Invalid report photo storage key");
  const filename = sanitizePhotoFilename(options.filename);
  return getSignedUrl(storageClient(), new GetObjectCommand({
    Bucket: bucket(),
    Key: key,
    ...(options.download ? { ResponseContentDisposition: `attachment; filename="${filename}"` } : {}),
  }), { expiresIn: 15 * 60 });
}

export async function getTelegramPhoto(key: string) {
  if (!STORAGE_KEY_PATTERN.test(key)) throw new Error("Invalid report photo storage key");
  return storageClient().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
}
