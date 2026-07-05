"use server";

import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const themeSchema = z.enum(["light", "dark", "system"]);

/**
 * Dark-Mode-Präferenz am Nutzer-Account speichern ("system" = null).
 * Der erste Besuch folgt der Systemeinstellung (next-themes), danach gilt
 * der gespeicherte Wert auf allen Geräten (ThemeSync im App-Layout).
 */
export async function saveThemeAction(theme: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) return; // nicht eingeloggt: nur lokal (localStorage)

  const parsed = themeSchema.safeParse(theme);
  if (!parsed.success) return;

  await prisma.user.update({
    where: { id: session.user.id },
    data: { theme: parsed.data === "system" ? null : parsed.data },
  });
}
