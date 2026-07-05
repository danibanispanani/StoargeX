"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";

/**
 * Wendet die in der DB gespeicherte Nutzer-Präferenz einmalig an
 * (z.B. auf einem neuen Gerät, wo localStorage noch leer ist).
 */
export function ThemeSync({ dbTheme }: { dbTheme: string | null }) {
  const { setTheme } = useTheme();
  const applied = useRef(false);

  useEffect(() => {
    if (applied.current || !dbTheme) return;
    applied.current = true;
    setTheme(dbTheme);
  }, [dbTheme, setTheme]);

  return null;
}
