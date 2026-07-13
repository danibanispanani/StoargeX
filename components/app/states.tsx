import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Inbox, LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

function StateFrame({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("border-y bg-muted/15 px-4 py-8 text-center", className)}>
      <Icon className="mx-auto size-5 text-muted-foreground" aria-hidden="true" />
      <h2 className="mt-3 font-display text-base font-semibold">{title}</h2>
      <p className="mx-auto mt-1 max-w-xl text-sm text-muted-foreground">{description}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </section>
  );
}

export function EmptyState(props: Omit<React.ComponentProps<typeof StateFrame>, "icon">) {
  return <StateFrame icon={Inbox} {...props} />;
}

export function ErrorState({
  className,
  ...props
}: Omit<React.ComponentProps<typeof StateFrame>, "icon">) {
  return (
    <StateFrame
      icon={AlertTriangle}
      className={cn("border-destructive/30 bg-destructive/5", className)}
      {...props}
    />
  );
}

export function LoadingState({ label = "Daten werden geladen" }: { label?: string }) {
  return (
    <div className="flex min-h-32 items-center justify-center gap-2 border-y bg-muted/15 text-sm text-muted-foreground" role="status">
      <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
