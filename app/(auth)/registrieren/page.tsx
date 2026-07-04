import Link from "next/link";
import { auth } from "@/auth";
import { RegisterForm } from "@/components/auth/register-form";
import { CreateOrgForm } from "@/components/auth/create-org-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function RegisterPage() {
  const session = await auth();
  const orgOnly = Boolean(session?.user && !session.activeOrgId);

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>
            {orgOnly ? "Organisation gründen" : "Registrieren"}
          </CardTitle>
          <CardDescription>
            {orgOnly
              ? "Dein Konto hat noch keine Organisation. Lege jetzt eine an – du wirst automatisch Inhaber."
              : "Gründe deine Organisation und werde automatisch Inhaber (OWNER)."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {orgOnly ? <CreateOrgForm /> : <RegisterForm />}
          {!orgOnly && (
            <p className="text-sm text-muted-foreground">
              Bereits ein Konto?{" "}
              <Link href="/login" className="underline">
                Anmelden
              </Link>
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
