"use client";

import { useTransition } from "react";
import { MailXIcon } from "lucide-react";
import { toast } from "sonner";
import { revokeInvitationAction } from "@/lib/actions/team";
import { ActionIconButton } from "@/components/ui/action-icon-button";

export function RevokeInvitationButton({
  invitationId,
}: {
  invitationId: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <ActionIconButton
      label="Einladung zurückziehen"
      icon={MailXIcon}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await revokeInvitationAction(invitationId);
          if (result?.error) toast.error(result.error);
          else if (result?.success) toast.success(result.success);
        })
      }
    />
  );
}
