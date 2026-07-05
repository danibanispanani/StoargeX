import type { SaleStatus } from "@prisma/client";
import { cn } from "@/lib/utils";

// Mini-Version der Routenlinie am einzelnen Verkaufsdatensatz:
// zeigt, wie weit dieser Auftrag auf der Route ist.

const STEPS = ["Verkauft", "Bezahlt", "Versendet", "Ausgezahlt"] as const;

const STATUS_STEP: Record<SaleStatus, number> = {
  PENDING: 1,
  PAID: 2,
  SHIPPED: 3,
  COMPLETED: 4,
  CANCELLED: 0,
  REFUNDED: 0,
};

export function SaleRouteStepper({ status }: { status: SaleStatus }) {
  const reached = STATUS_STEP[status];
  const failed = status === "CANCELLED" || status === "REFUNDED";
  const title = failed
    ? status === "REFUNDED"
      ? "Erstattet"
      : "Storniert"
    : `${STEPS[reached - 1]} (${reached}/4)`;

  return (
    <div
      className="flex items-center gap-0"
      title={title}
      role="img"
      aria-label={`Auftragsstatus: ${title}`}
    >
      {STEPS.map((step, index) => {
        const done = !failed && index < reached;
        return (
          <span key={step} className="flex items-center">
            {index > 0 && (
              <span
                className={cn(
                  "h-0.5 w-3.5",
                  done ? "bg-transit-teal" : "bg-border"
                )}
              />
            )}
            <span
              className={cn(
                "size-2.5 rounded-full border-2",
                failed
                  ? "border-customs-red bg-customs-red/30"
                  : done
                    ? index === STEPS.length - 1
                      ? "border-cargo-amber bg-cargo-amber"
                      : "border-transit-teal bg-transit-teal"
                    : "border-border bg-card"
              )}
            />
          </span>
        );
      })}
    </div>
  );
}
