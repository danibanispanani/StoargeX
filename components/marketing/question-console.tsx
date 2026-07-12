"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  MessageSquareText,
  PencilLine,
  SendHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const TOPICS = ["Warenfluss", "Konsignation", "Retoure", "Auszahlung"] as const;

const EXAMPLES = [
  "Wie bleibt Konsignationsware vom eigenen Bestand getrennt?",
  "Wie wird eine Retoure wieder mit dem Verkauf verbunden?",
] as const;

export function QuestionConsole() {
  const [topic, setTopic] = useState<(typeof TOPICS)[number]>("Warenfluss");
  const [question, setQuestion] = useState("");
  const [preparedQuestion, setPreparedQuestion] = useState<string | null>(null);
  const trimmedQuestion = question.trim();

  return (
    <form
      className="landing-question-console"
      onSubmit={(event) => {
        event.preventDefault();
        if (!trimmedQuestion) return;
        setPreparedQuestion(trimmedQuestion);
      }}
    >
      <div className="landing-question-console-head">
        <div>
          <MessageSquareText className="size-4" aria-hidden="true" />
          Fragekanal / Vorschau
        </div>
        <span><i /> lokal, nicht gesendet</span>
      </div>

      {preparedQuestion ? (
        <div className="landing-question-receipt" aria-live="polite">
          <span className="landing-question-check" aria-hidden="true">
            <CheckCircle2 className="size-5" />
          </span>
          <p className="landing-question-receipt-meta">Kontrollpunkt vorbereitet / {topic}</p>
          <h3>Die Frage hat jetzt einen Kontext.</h3>
          <blockquote>{preparedQuestion}</blockquote>
          <p>
            Es wurden keine Daten gesendet. In der Produktvorschau zeigt dieser Schritt,
            wie eine Frage später mit dem passenden Prozesskontext ankommen kann.
          </p>
          <div className="landing-question-receipt-actions">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPreparedQuestion(null)}
            >
              <PencilLine className="size-4" aria-hidden="true" />
              Frage bearbeiten
            </Button>
            <Button asChild>
              <Link href="/registrieren">
                Organisation gründen
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
      ) : (
        <>
          <fieldset className="landing-question-topics">
            <legend>Worum geht es?</legend>
            <div>
              {TOPICS.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={topic === item ? "is-active" : undefined}
                  aria-pressed={topic === item}
                  onClick={() => setTopic(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </fieldset>

          <label htmlFor="landing-question" className="landing-question-label">
            Was muss StoargeX für euren Handel abbilden?
          </label>
          <textarea
            id="landing-question"
            value={question}
            maxLength={320}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Beschreibt den Sonderfall so, wie er im Alltag auftaucht."
          />

          <div className="landing-question-examples" aria-label="Beispielfragen">
            {EXAMPLES.map((example) => (
              <button key={example} type="button" onClick={() => setQuestion(example)}>
                {example}
              </button>
            ))}
          </div>

          <div className="landing-question-submit-row">
            <p>
              Vorschau ohne Speicherung
              <span aria-hidden="true"> · </span>
              {question.length}/320
            </p>
            <Button type="submit" disabled={!trimmedQuestion}>
              Frage vorbereiten
              <SendHorizontal className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </>
      )}
    </form>
  );
}
