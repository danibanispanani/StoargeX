"use server";

import argon2 from "argon2";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { auth, signIn, updateSession } from "@/auth";
import { LegalForm } from "@prisma/client";
import { redirect } from "next/navigation";

const registerSchema = z.object({
  name: z.string().min(2, "Name ist zu kurz.").max(100),
  email: z.string().email("Ungültige E-Mail-Adresse."),
  password: z
    .string()
    .min(12, "Das Passwort muss mindestens 12 Zeichen lang sein.")
    .max(200),
  organizationName: z.string().min(2, "Firmenname ist zu kurz.").max(200),
  legalForm: z.nativeEnum(LegalForm),
  vatId: z.string().max(20).optional().or(z.literal("")),
});

export type RegisterState = { error?: string } | null;

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[äöüß]/g, (c) => ({ ä: "ae", ö: "oe", ü: "ue", ß: "ss" })[c] ?? c)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50) || "organisation";
}

/**
 * Legt Organisation + Mitgliedschaft (OWNER) an und seedet Stammdaten.
 * Läuft in einer Transaktion mit RLS-Bypass, weil es vor dem ersten
 * Org-Kontext keine Tenant-Session geben kann.
 */
async function createOrganizationWithOwner(params: {
  userId: string;
  organizationName: string;
  legalForm: LegalForm;
  vatId?: string;
}): Promise<string> {
  const baseSlug = slugify(params.organizationName);

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.bypass_rls', 'on', TRUE)`;

    let slug = baseSlug;
    for (let i = 2; await tx.organization.findUnique({ where: { slug } }); i++) {
      slug = `${baseSlug}-${i}`;
    }

    const org = await tx.organization.create({
      data: {
        name: params.organizationName,
        slug,
        legalForm: params.legalForm,
        vatId: params.vatId || null,
      },
    });

    await tx.membership.create({
      data: { organizationId: org.id, userId: params.userId, role: "OWNER" },
    });

    // Sinnvolle Stammdaten für den Start (Plattform-Accounts wie im Original)
    await tx.platform.createMany({
      data: [
        { organizationId: org.id, name: "eBay R", url: "https://www.ebay.de", defaultFeePercent: 11 },
        { organizationId: org.id, name: "eBay D", url: "https://www.ebay.de", defaultFeePercent: 11 },
        { organizationId: org.id, name: "Vinted", url: "https://www.vinted.de", defaultFeePercent: 0 },
        { organizationId: org.id, name: "KA", url: "https://www.kleinanzeigen.de", defaultFeePercent: 0 },
        { organizationId: org.id, name: "StockX", url: "https://stockx.com", defaultFeePercent: 9 },
        { organizationId: org.id, name: "Discord", defaultFeePercent: 0 },
        { organizationId: org.id, name: "Sonstiges", defaultFeePercent: 0 },
      ],
    });
    // Konfigurierbare Auswahllisten: ZM & Auszahlungsempfänger
    await tx.selectOption.createMany({
      data: [
        ...["Firma", "Firma D", "Firma R", "Richard", "Daniel"].map((label, i) => ({
          organizationId: org.id,
          kind: "PAYMENT_METHOD" as const,
          label,
          sortOrder: i,
        })),
        ...["Firma", "Richard", "Daniel", "PayPal R", "Bar D", "Bar R"].map(
          (label, i) => ({
            organizationId: org.id,
            kind: "PAYOUT_RECIPIENT" as const,
            label,
            sortOrder: i,
          })
        ),
      ],
    });
    await tx.carrier.createMany({
      data: [
        { organizationId: org.id, name: "DHL", trackingUrlTemplate: "https://www.dhl.de/de/privatkunden/pakete-empfangen/verfolgen.html?piececode={tracking}" },
        { organizationId: org.id, name: "Hermes", trackingUrlTemplate: "https://www.myhermes.de/empfangen/sendungsverfolgung/sendungsinformation#{tracking}" },
        { organizationId: org.id, name: "DPD", trackingUrlTemplate: "https://tracking.dpd.de/status/de_DE/parcel/{tracking}" },
      ],
    });
    await tx.taxRate.createMany({
      data: [
        { organizationId: org.id, name: "Differenzbesteuerung §25a UStG", ratePercent: 0, isDefault: true },
        { organizationId: org.id, name: "Regelsteuersatz 19%", ratePercent: 19 },
        { organizationId: org.id, name: "Ermäßigter Steuersatz 7%", ratePercent: 7 },
      ],
    });

    return org.id;
  });
}

/** Registrierung: neuer User gründet eine Organization und wird OWNER. */
export async function registerAction(
  _prev: RegisterState,
  formData: FormData
): Promise<RegisterState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    organizationName: formData.get("organizationName"),
    legalForm: formData.get("legalForm"),
    vatId: formData.get("vatId"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingaben." };
  }
  const data = parsed.data;
  const email = data.email.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "Für diese E-Mail-Adresse existiert bereits ein Konto." };
  }

  const passwordHash = await argon2.hash(data.password, {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MiB
    timeCost: 3,
    parallelism: 4,
  });

  const user = await prisma.user.create({
    data: { name: data.name, email, passwordHash },
  });

  const orgId = await createOrganizationWithOwner({
    userId: user.id,
    organizationName: data.organizationName,
    legalForm: data.legalForm,
    vatId: data.vatId,
  });

  await writeAuditLog({
    organizationId: orgId,
    userId: user.id,
    action: "organization.create",
    entityType: "Organization",
    entityId: orgId,
  });

  // Direkt einloggen und ins Dashboard
  await signIn("credentials", {
    email,
    password: data.password,
    redirectTo: "/dashboard",
  });
  return null;
}

/** Bereits eingeloggter User (z.B. via Google) gründet nachträglich eine Organisation. */
export async function createOrganizationAction(
  _prev: RegisterState,
  formData: FormData
): Promise<RegisterState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Nicht eingeloggt." };

  const parsed = registerSchema
    .pick({ organizationName: true, legalForm: true, vatId: true })
    .safeParse({
      organizationName: formData.get("organizationName"),
      legalForm: formData.get("legalForm"),
      vatId: formData.get("vatId"),
    });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingaben." };
  }

  const orgId = await createOrganizationWithOwner({
    userId: session.user.id,
    ...parsed.data,
  });

  await writeAuditLog({
    organizationId: orgId,
    userId: session.user.id,
    action: "organization.create",
    entityType: "Organization",
    entityId: orgId,
  });

  // JWT-Claims (Memberships) serverseitig auffrischen, dann ins Dashboard
  await updateSession({ activeOrgId: orgId });
  redirect("/dashboard");
}
