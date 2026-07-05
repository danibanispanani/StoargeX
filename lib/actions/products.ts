"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOrg } from "@/lib/org";
import { writeAuditLog } from "@/lib/audit";
import { euroToCents } from "@/lib/calculations";
import { saveImage } from "@/lib/uploads";
import type { ActionState } from "@/lib/actions/team";

const productSchema = z.object({
  name: z.string().min(1, "Name fehlt.").max(300),
  variant: z.string().max(200).optional().or(z.literal("")),
  category: z.string().max(100).optional().or(z.literal("")),
  ean: z.string().max(20).regex(/^\d*$/, "EAN darf nur Ziffern enthalten.").optional().or(z.literal("")),
  defaultPrice: z.string().optional().or(z.literal("")),
});

function parseProductForm(formData: FormData) {
  const parsed = productSchema.safeParse({
    name: formData.get("name"),
    variant: formData.get("variant"),
    category: formData.get("category"),
    ean: formData.get("ean"),
    defaultPrice: formData.get("defaultPrice"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingaben." } as const;
  }
  let defaultPriceCents: number | null = null;
  if (parsed.data.defaultPrice?.trim()) {
    try {
      defaultPriceCents = euroToCents(parsed.data.defaultPrice);
    } catch {
      return { error: "Ungültiger Standard-EK." } as const;
    }
  }
  return { data: parsed.data, defaultPriceCents } as const;
}

/** Katalogprodukt anlegen. */
export async function createProductAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { db, organization, userId } = await requireOrg("MEMBER");

  const result = parseProductForm(formData);
  if ("error" in result) return { error: result.error };
  const { data, defaultPriceCents } = result;

  let imageUrls: string[] = [];
  const image = formData.get("image");
  if (image instanceof File && image.size > 0) {
    try {
      imageUrls = [await saveImage(image, organization.id)];
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Bild-Upload fehlgeschlagen." };
    }
  }

  const existing = await db.product.findFirst({
    where: { name: data.name, variant: data.variant || null },
  });
  if (existing) return { error: "Dieses Produkt existiert bereits im Katalog." };

  const product = await db.product.create({
    data: {
      organizationId: organization.id,
      name: data.name,
      variant: data.variant || null,
      category: data.category || null,
      ean: data.ean || null,
      defaultPriceCents,
      imageUrls,
    },
  });

  await writeAuditLog({
    organizationId: organization.id,
    userId,
    action: "product.create",
    entityType: "Product",
    entityId: product.id,
    after: { name: product.name, variant: product.variant },
  });

  revalidatePath("/produkte");
  return { success: `Produkt "${product.name}" angelegt ✓` };
}

/** Katalogprodukt bearbeiten. */
export async function updateProductAction(
  productId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { db, organization, userId } = await requireOrg("MEMBER");

  const existing = await db.product.findFirst({ where: { id: productId } });
  if (!existing) return { error: "Produkt nicht gefunden." };

  const result = parseProductForm(formData);
  if ("error" in result) return { error: result.error };
  const { data, defaultPriceCents } = result;

  let imageUrls = existing.imageUrls;
  const image = formData.get("image");
  if (image instanceof File && image.size > 0) {
    try {
      imageUrls = [await saveImage(image, organization.id)];
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Bild-Upload fehlgeschlagen." };
    }
  }

  await db.product.update({
    where: { id: productId },
    data: {
      name: data.name,
      variant: data.variant || null,
      category: data.category || null,
      ean: data.ean || null,
      defaultPriceCents,
      imageUrls,
    },
  });

  await writeAuditLog({
    organizationId: organization.id,
    userId,
    action: "product.update",
    entityType: "Product",
    entityId: productId,
    before: { name: existing.name },
    after: { name: data.name },
  });

  revalidatePath("/produkte");
  return { success: `Produkt "${data.name}" gespeichert ✓` };
}

/** Katalogprodukt löschen (Lager-/Verkaufsdaten bleiben unberührt). */
export async function deleteProductAction(productId: string): Promise<ActionState> {
  const { db, organization, userId } = await requireOrg("MEMBER");

  const existing = await db.product.findFirst({ where: { id: productId } });
  if (!existing) return { error: "Produkt nicht gefunden." };

  await db.product.delete({ where: { id: productId } });

  await writeAuditLog({
    organizationId: organization.id,
    userId,
    action: "product.delete",
    entityType: "Product",
    entityId: productId,
    before: { name: existing.name },
  });

  revalidatePath("/produkte");
  return { success: `Produkt "${existing.name}" gelöscht ✓` };
}
