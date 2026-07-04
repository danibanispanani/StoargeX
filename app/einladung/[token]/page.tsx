import { auth } from "@/auth";
import { getInvitation } from "@/lib/actions/invitation";
import { AcceptInvitationForm } from "@/components/auth/accept-invitation-form";
import { ROLE_LABELS } from "@/lib/roles";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function InvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invitation = await getInvitation(token);

  if (!invitation) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Einladung ungültig</CardTitle>
            <CardDescription>
              Diese Einladung existiert nicht, wurde zurückgezogen oder ist
              abgelaufen. Bitte lass dir eine neue Einladung schicken.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/" className="text-sm underline">
              Zur Startseite
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  const session = await auth();
  const emailMatchesSession =
    session?.user?.email?.toLowerCase() === invitation.email;
  const accountExists = Boolean(
    await prisma.user.findUnique({ where: { email: invitation.email } })
  );

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Einladung zu {invitation.organization.name}</CardTitle>
          <CardDescription>
            Du wurdest als <strong>{ROLE_LABELS[invitation.role]}</strong>{" "}
            eingeladen ({invitation.email}).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AcceptInvitationForm
            token={token}
            needsAccount={!accountExists && !emailMatchesSession}
            wrongAccount={Boolean(session?.user) && !emailMatchesSession}
            accountExists={accountExists && !emailMatchesSession}
            email={invitation.email}
          />
        </CardContent>
      </Card>
    </main>
  );
}
