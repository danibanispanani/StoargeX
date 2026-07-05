"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { saveThemeAction } from "@/lib/actions/theme";
import { Button } from "@/components/ui/button";

const OPTIONS = [
  { value: "light", label: "Hell" },
  { value: "dark", label: "Dunkel" },
  { value: "system", label: "System" },
] as const;

/** Dreifach-Auswahl für die Einstellungen (wird am Account gespeichert). */
export function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <div className="flex rounded-md border p-0.5">
      {OPTIONS.map((option) => (
        <Button
          key={option.value}
          variant={mounted && theme === option.value ? "secondary" : "ghost"}
          size="sm"
          onClick={() => {
            setTheme(option.value);
            void saveThemeAction(option.value);
          }}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
