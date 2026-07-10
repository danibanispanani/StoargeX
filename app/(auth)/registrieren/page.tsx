import Link from "next/link";
import { auth } from "@/auth";
import { RegisterForm } from "@/components/auth/register-form";
import { CreateOrgForm } from "@/components/auth/create-org-form";
import { PublicAuthShell } from "@/components/marketing/marketing-shell";

export default async function RegisterPage() {
  const session = await auth();
  const orgOnly = Boolean(session?.user && !session.activeOrgId);

  return (
    <PublicAuthShell
      title="Erste Organisation anlegen."
      description="Lege den gemeinsamen Handelsstand an, in dem Einkauf, Bestand, Verkauf, Retoure und Auszahlung zusammenlaufen."
      switchHref="/login"
      switchLabel="Bereits ein Konto? Anmelden"
    >
      <div className="space-y-5">
        <div>
          <p className="public-section-kicker">
            {orgOnly ? "Organisation" : "Registrierung"}
          </p>
          <h2 className="mt-2 font-display text-2xl font-semibold">
            {orgOnly ? "Organisation gründen" : "Organisation gründen"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {orgOnly
              ? "Dein Konto hat noch keine Organisation. Lege jetzt eine an – du wirst automatisch Inhaber."
              : "Gründe deine Organisation und werde automatisch Inhaber (OWNER)."}{" "}
            <Link href="/" className="public-focus-link underline decoration-transparent">
              Zurück zur Startseite
            </Link>
          </p>
        </div>
        {orgOnly ? <CreateOrgForm /> : <RegisterForm />}
      </div>
    </PublicAuthShell>
  );
}
