import Link from "next/link";
import { LogOut, Settings2, ShieldCheck } from "lucide-react";
import { logoutAction } from "@/lib/actions/session";
import { SignOutCacheResetForm } from "@/components/providers/sign-out-cache-reset-form";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function initials(name: string | null | undefined, email: string | null | undefined) {
  const value = name?.trim() || email?.trim() || "SX";
  return value
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function UserMenu({
  user,
  roleLabel,
}: {
  user: { name?: string | null; email?: string | null; image?: string | null };
  roleLabel: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="rounded-full"
          aria-label={`${initials(user.name, user.email)}: Benutzermenü öffnen`}
        >
          <Avatar size="sm">
            {user.image ? <AvatarImage src={user.image} alt="" /> : null}
            <AvatarFallback>{initials(user.name, user.email)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>
          <span className="block truncate text-sm font-medium">{user.name || "StorageX Benutzer"}</span>
          <span className="mt-0.5 block truncate text-xs font-normal text-muted-foreground">{user.email}</span>
          <span className="mt-1 block font-mono text-[9px] uppercase tracking-[0.14em] text-transit-teal">{roleLabel}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/einstellungen"><Settings2 aria-hidden="true" /> Einstellungen</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/einstellungen/sicherheit"><ShieldCheck aria-hidden="true" /> Sicherheit</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <SignOutCacheResetForm action={logoutAction}>
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full"><LogOut aria-hidden="true" /> Abmelden</button>
          </DropdownMenuItem>
        </SignOutCacheResetForm>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
