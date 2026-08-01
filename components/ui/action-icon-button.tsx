import type { ComponentProps } from "react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

type ActionIconButtonProps = Omit<
  ComponentProps<typeof Button>,
  "children" | "size" | "aria-label" | "title"
> & {
  label: string;
  icon: LucideIcon;
};

export function ActionIconButton({
  label,
  icon: Icon,
  type = "button",
  variant = "ghost",
  ...props
}: ActionIconButtonProps) {
  return (
    <Button
      {...props}
      type={type}
      variant={variant}
      size="icon-sm"
      aria-label={label}
      title={label}
    >
      <Icon aria-hidden="true" />
    </Button>
  );
}
