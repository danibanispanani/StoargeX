"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { saveThemeAction } from "@/lib/actions/theme";
import { Button } from "@/components/ui/button";

/** Hell/Dunkel-Umschalter für die Top-Navigation. */
export function ThemeToggle({ persist = false }: { persist?: boolean }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  function toggle() {
    const next = resolvedTheme === "dark" ? "light" : "dark";
    setTheme(next);
    if (persist) void saveThemeAction(next);
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggle}
      aria-label={
        mounted && resolvedTheme === "dark"
          ? "Zum hellen Design wechseln"
          : "Zum dunklen Design wechseln"
      }
      title="Design umschalten"
    >
      {mounted && resolvedTheme === "dark" ? (
        <Sun className="size-4" />
      ) : (
        <Moon className="size-4" />
      )}
    </Button>
  );
}
