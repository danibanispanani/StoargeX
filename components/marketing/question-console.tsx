"use client";

import { useState } from "react";
import { ArrowUpRight, MessageSquareText } from "lucide-react";
import { Button } from "@/components/ui/button";

export function QuestionConsole() {
  const [question, setQuestion] = useState("");
  const [saved, setSaved] = useState(false);

  return (
    <form
      className="landing-question-console"
      onSubmit={(event) => {
        event.preventDefault();
        if (!question.trim()) return;
        setSaved(true);
      }}
    >
      <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.14em] text-transit-teal">
        <MessageSquareText className="size-4" aria-hidden="true" />
        Fragekanal / Vorschau
      </div>
      <label htmlFor="landing-question" className="mt-5 block font-display text-xl font-semibold">
        Was muss StorageX für euren Handel abbilden?
      </label>
      <textarea
        id="landing-question"
        value={question}
        onChange={(event) => {
          setQuestion(event.target.value);
          setSaved(false);
        }}
        placeholder="Zum Beispiel: Wie bleibt Konsignationsware vom eigenen Bestand getrennt?"
        className="mt-4 min-h-32 w-full resize-y border-0 border-b border-rail/25 bg-transparent px-0 py-3 text-base leading-7 outline-none placeholder:text-muted-foreground/70 focus:border-transit-teal focus:ring-0"
      />
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-6 text-muted-foreground" aria-live="polite">
          {saved
            ? "Notiert. Der echte Kontaktkanal wird in einer späteren Phase angebunden."
            : "Diese Vorschau speichert nichts und sendet keine Daten."}
        </p>
        <Button type="submit" disabled={!question.trim()} className="shrink-0 rounded-md">
          Frage vormerken
          <ArrowUpRight className="ml-1 size-4" aria-hidden="true" />
        </Button>
      </div>
    </form>
  );
}
