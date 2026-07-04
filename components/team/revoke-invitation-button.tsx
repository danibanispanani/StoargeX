"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { revokeInvitationAction } from "@/lib/actions/team";
import { Button } from "@/components/ui/button";

export function RevokeInvitationButton({
  invitationId,
}: {
  invitationId: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await revokeInvitationAction(invitationId);
          if (result?.error) toast.error(result.error);
          else if (result?.success) toast.success(result.success);
        })
      }
    >
      Zurückziehen
    </Button>
  );
}
