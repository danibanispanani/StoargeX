"use client";

import { Button } from "@/components/ui/button";
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
  triggerLabel = "Details",
  children,
}: {
  title: string;
  description?: string;
  triggerLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm">
          {triggerLabel}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        <div className="space-y-5 text-sm">{children}</div>
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
    <section className="space-y-2 rounded-lg border bg-card/60 p-3">
      <h3 className="text-sm font-semibold">{title}</h3>
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
