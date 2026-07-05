import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Bild validieren und unter public/uploads/<org>/ speichern; liefert die URL. */
export async function saveImage(file: File, orgId: string): Promise<string> {
  const ext = IMAGE_TYPES[file.type];
  if (!ext) throw new Error("Nur JPG, PNG oder WebP erlaubt.");
  if (file.size > MAX_IMAGE_BYTES) throw new Error("Bild ist größer als 5 MB.");

  const dir = path.join(process.cwd(), "public", "uploads", orgId);
  await mkdir(dir, { recursive: true });
  const filename = `${randomUUID()}${ext}`;
  await writeFile(path.join(dir, filename), Buffer.from(await file.arrayBuffer()));
  return `/uploads/${orgId}/${filename}`;
}
