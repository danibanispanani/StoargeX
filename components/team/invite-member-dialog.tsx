"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { inviteMemberAction, type ActionState } from "@/lib/actions/team";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function InviteMemberDialog({ isOwner }: { isOwner: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    inviteMemberAction,
    null
  );

  useEffect(() => {
    if (state?.success) {
      toast.success(state.success);
      setOpen(false);
    }
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Mitglied einladen</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mitglied einladen</DialogTitle>
          <DialogDescription>
            Die Person erhält eine E-Mail mit einem Einladungslink (7 Tage
            gültig).
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          {state?.error && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="invite-email">E-Mail</Label>
            <Input id="invite-email" name="email" type="email" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-role">Rolle</Label>
            <select
              id="invite-role"
              name="role"
              defaultValue="MEMBER"
              className="border-input h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs"
            >
              {isOwner && <option value="OWNER">Inhaber</option>}
              <option value="ADMIN">Administrator</option>
              <option value="MEMBER">Mitglied</option>
              <option value="READONLY">Nur Lesen</option>
            </select>
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Wird versendet…" : "Einladung senden"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
