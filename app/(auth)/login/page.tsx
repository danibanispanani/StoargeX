import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { PublicAuthShell } from "@/components/marketing/marketing-shell";

export default function LoginPage() {
  return (
    <PublicAuthShell
      mode="login"
      title="Zurück in euren Warenfluss."
      description="Melde dich an, um Bewegungen, Verkäufe, Retouren und Auszahlungen im gemeinsamen Arbeitsstand weiterzuführen."
      switchHref="/registrieren"
      switchLabel="Noch kein Konto? Organisation gründen"
    >
      <div className="auth-form-intro">
        <div className="auth-form-heading">
          <p className="public-section-kicker">Identität prüfen</p>
          <h2>Anmelden</h2>
          <p>
            Setze deine operative Arbeit dort fort, wo dein Team aufgehört hat.
          </p>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </PublicAuthShell>
  );
}
