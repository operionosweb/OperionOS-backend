import React from "react";
import { Section } from "../ui/Layout";
import Reveal from "../ui/Reveal";

const QUESTIONS = [
  "Which contracts could be affected if this flight is delayed by three hours?",
  "What penalties could apply?",
  "Which obligations are due in the next 30 days?",
  "Which contracts expose us to the highest financial risk?",
  "Compare the termination clauses across these agreements.",
  "What happens if fuel prices increase by 20%?",
];

export default function AskOperionSection() {
  return (
    <Section id="assistant">
      <div className="op-grid op-grid-2" style={{ alignItems: "start" }}>
        <Reveal>
          <span className="op-badge op-badge-future" style={{ marginBottom: "var(--op-space-4)" }}>
            AI Assistant — In Development
          </span>
          <h2 className="op-heading-lg" style={{ marginBottom: "var(--op-space-4)" }}>
            Ask Operion in natural language.
          </h2>
          <p className="op-body-lg">
            Instead of searching through contracts manually, ask questions in
            the way you naturally think about the problem. The assistant is
            being developed as a way to connect contractual language with the
            operational questions teams need to answer.
          </p>
        </Reveal>

        <Reveal>
          <div className="op-home-question-list" aria-label="Example questions for Operion">
            {QUESTIONS.map((question) => (
              <p key={question} className="op-home-question">“{question}”</p>
            ))}
          </div>
        </Reveal>
      </div>
    </Section>
  );
}
