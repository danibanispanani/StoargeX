"use client";

import { EyeIcon } from "lucide-react";
import { ActionIconButton } from "@/components/ui/action-icon-button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function DetailDrawer({
  title,
  description,
  triggerLabel = "Details anzeigen",
  onOpenChange,
  children,
}: {
  title: string;
  description?: string;
  triggerLabel?: string;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <Sheet onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <ActionIconButton label={triggerLabel} icon={EyeIcon} />
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-2xl">
        <SheetHeader className="sticky top-0 z-10 border-b bg-background px-5 py-4 text-left">
          <SheetTitle>{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        <div className="divide-y px-5 text-sm">{children}</div>
      </SheetContent>
    </Sheet>
  );
}

export function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2 py-4">
      <h3 className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-foreground">{title}</h3>
      <div className="space-y-1 text-muted-foreground">{children}</div>
    </section>
  );
}

export function DetailGrid({
  items,
}: {
  items: Array<{ label: string; value: React.ReactNode }>;
}) {
  return (
    <dl className="grid gap-2 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            {item.label}
          </dt>
          <dd className="break-words text-foreground">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
