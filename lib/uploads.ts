import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function validateImage(file: File) {
  const ext = IMAGE_TYPES[file.type];
  if (!ext) throw new Error("Nur JPG, PNG oder WebP erlaubt.");
  if (file.size > MAX_IMAGE_BYTES) throw new Error("Bild ist groesser als 5 MB.");
  return ext;
}

async function saveImageToSupabase(file: File, orgId: string, ext: string) {
  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "stock-images";

  if (!supabaseUrl || !serviceRoleKey) return null;

  const objectPath = `${orgId}/${randomUUID()}${ext}`;
  const uploadUrl = `${supabaseUrl}/storage/v1/object/${bucket}/${objectPath}`;
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": file.type,
      "x-upsert": "false",
    },
    body: Buffer.from(await file.arrayBuffer()),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(
      `Supabase-Upload fehlgeschlagen (${response.status}). ${details}`.trim()
    );
  }

  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${objectPath}`;
}

async function saveImageLocally(file: File, orgId: string, ext: string) {
  const dir = path.join(process.cwd(), "public", "uploads", orgId);
  await mkdir(dir, { recursive: true });
  const filename = `${randomUUID()}${ext}`;
  await writeFile(path.join(dir, filename), Buffer.from(await file.arrayBuffer()));
  return `/uploads/${orgId}/${filename}`;
}

export async function saveImage(file: File, orgId: string): Promise<string> {
  const ext = validateImage(file);
  const supabaseUrl = await saveImageToSupabase(file, orgId, ext);
  if (supabaseUrl) return supabaseUrl;

  return saveImageLocally(file, orgId, ext);
}
