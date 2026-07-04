import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Anmelden</CardTitle>
          <CardDescription>
            Melde dich bei deiner Organisation an.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Suspense>
            <LoginForm />
          </Suspense>
          <p className="text-sm text-muted-foreground">
            Noch kein Konto?{" "}
            <Link href="/registrieren" className="underline">
              Organisation gründen
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
