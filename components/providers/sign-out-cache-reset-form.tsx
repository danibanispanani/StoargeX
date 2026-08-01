"use client";

import type { ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";

export function SignOutCacheResetForm({
  action,
  children,
}: {
  action: (formData: FormData) => void | Promise<void>;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();

  async function resetAndSubmit(formData: FormData) {
    try {
      await action(formData);
    } finally {
      queryClient.clear();
    }
  }

  return <form action={resetAndSubmit}>{children}</form>;
}
