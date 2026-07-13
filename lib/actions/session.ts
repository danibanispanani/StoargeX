"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { auth, signOut, updateSession } from "@/auth";
import { bypassDb } from "@/lib/prisma";

export async function switchOrganizationAction(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const organizationId = z.string().min(1).parse(formData.get("organizationId"));
  const membership = await bypassDb().membership.findUnique({
    where: {
      organizationId_userId: {
        organizationId,
        userId: session.user.id,
      },
    },
    select: { organizationId: true },
  });

  if (!membership) throw new Error("Keine Berechtigung für diese Organisation.");

  await updateSession({ activeOrgId: membership.organizationId });
  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}
