import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { PublicAuthShell } from "@/components/marketing/marketing-shell";

export default function LoginPage() {
  return (
    <PublicAuthShell
      title="Zurück in euren Warenfluss."
      description="Melde dich an, um Bewegungen, Verkäufe, Retouren und Auszahlungen im gemeinsamen Arbeitsstand weiterzuführen."
      switchHref="/registrieren"
      switchLabel="Noch kein Konto? Organisation gründen"
    >
      <div className="space-y-5">
        <div>
          <p className="public-section-kicker">Login</p>
          <h2 className="mt-2 font-display text-2xl font-semibold">Anmelden</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Melde dich bei deiner Organisation an oder{" "}
            <Link href="/" className="public-focus-link underline decoration-transparent">
              gehe zurück zur Startseite
            </Link>
            .
          </p>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </PublicAuthShell>
  );
}
