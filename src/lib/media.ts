import { GridFSBucket, ObjectId, type Db } from "mongodb";
import type { Readable } from "node:stream";
import { getDb } from "./mongo";

export const MEDIA_MAX_BYTES = 8 * 1024 * 1024;
export const ALLOWED_MEDIA_TYPES: ReadonlySet<string> = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const BUCKET_NAME = "media";

function bucket(db: Db): GridFSBucket {
  return new GridFSBucket(db, { bucketName: BUCKET_NAME });
}

function extensionFor(contentType: string): string {
  switch (contentType) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      return "jpg";
  }
}

export async function saveMedia(
  bytes: Buffer,
  contentType: string,
  uploadedBy: string,
): Promise<string> {
  const db = await getDb();
  const uploadStream = bucket(db).openUploadStream(
    `upload.${extensionFor(contentType)}`,
    { contentType, metadata: { uploadedBy } },
  );
  await new Promise<void>((resolve, reject) => {
    uploadStream.on("finish", () => resolve());
    uploadStream.on("error", reject);
    uploadStream.end(bytes);
  });
  return (uploadStream.id as ObjectId).toHexString();
}

export async function getMedia(
  id: string,
): Promise<
  { stream: Readable; contentType: string; length: number } | null
> {
  if (!ObjectId.isValid(id)) {
    return null;
  }
  const db = await getDb();
  const oid = new ObjectId(id);
  const file = await db
    .collection<{ contentType?: string; length: number }>(`${BUCKET_NAME}.files`)
    .findOne({ _id: oid });
  if (!file) {
    return null;
  }
  return {
    stream: bucket(db).openDownloadStream(oid),
    contentType: file.contentType ?? "application/octet-stream",
    length: file.length,
  };
}

export async function mediaExists(ids: ObjectId[]): Promise<boolean> {
  if (ids.length === 0) {
    return true;
  }
  const db = await getDb();
  const found = await db
    .collection(`${BUCKET_NAME}.files`)
    .countDocuments({ _id: { $in: ids } });
  return found === ids.length;
}
