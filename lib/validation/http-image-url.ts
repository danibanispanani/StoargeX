import { z } from "zod";

export const httpImageUrlSchema = z.string()
  .url("Bitte eine vollständige Bildadresse eingeben.")
  .max(20000, "Die Bildadresse ist zu lang.")
  .refine((value) => value.startsWith("https://") || value.startsWith("http://"), {
    message: "Die Bildadresse muss mit http:// oder https:// beginnen.",
  });
