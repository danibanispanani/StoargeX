import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";

export default async function HomePage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-bold tracking-tight">StoargeX</h1>
      <p className="max-w-md text-center text-muted-foreground">
        Warenwirtschaft für Handels-GbRs: Einkauf, Verkauf und Retouren über
        eBay, Vinted, Kleinanzeigen &amp; Co. – gemeinsam im Team verwalten.
      </p>
      <div className="flex gap-3">
        <Button asChild>
          <Link href="/registrieren">Organisation gründen</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/login">Anmelden</Link>
        </Button>
      </div>
    </main>
  );
}
