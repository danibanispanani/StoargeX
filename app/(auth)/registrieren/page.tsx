import { auth } from "@/auth";
import { RegisterForm } from "@/components/auth/register-form";
import { CreateOrgForm } from "@/components/auth/create-org-form";
import { PublicAuthShell } from "@/components/marketing/marketing-shell";

export default async function RegisterPage() {
  const session = await auth();
  const orgOnly = Boolean(session?.user && !session.activeOrgId);

  return (
    <PublicAuthShell
      mode="register"
      title="Erste Organisation anlegen."
      description="Lege den gemeinsamen Handelsstand an, in dem Einkauf, Bestand, Verkauf, Retoure und Auszahlung zusammenlaufen."
      switchHref="/login"
      switchLabel="Bereits ein Konto? Anmelden"
    >
      <div className="auth-form-intro">
        <div className="auth-form-heading">
          <p className="public-section-kicker">
            {orgOnly ? "Arbeitsraum ergänzen" : "Zugang einrichten"}
          </p>
          <h2>Organisation gründen</h2>
          <p>
            {orgOnly
              ? "Dein Konto hat noch keine Organisation. Lege jetzt eine an – du wirst automatisch Inhaber."
              : "Richte Konto und Organisation gemeinsam ein. Du startest automatisch als Inhaber."}
          </p>
        </div>
        {orgOnly ? <CreateOrgForm /> : <RegisterForm />}
      </div>
    </PublicAuthShell>
  );
}
