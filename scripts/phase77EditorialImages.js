import { randomUUID } from "node:crypto";
import { createCanvas, loadImage } from "@napi-rs/canvas";

const diagrams = [
  { heading: "From document storage to accountable obligations", nodes: ["SOURCE EVIDENCE", "OBLIGATION", "OWNER", "REVIEW"], note: "Aviation contract review: provenance before conclusions" },
  { heading: "A lease is more than its headline rental", nodes: ["RENT", "MAINTENANCE", "RETURN TERMS", "TOTAL EXPOSURE"], note: "Illustrative lease obligations, not a financial valuation" },
  { heading: "Fuel markets and contract terms are different risks", nodes: ["MARKET PRICE", "PRICE BASIS", "CLAUSE", "INVOICE"], note: "Illustrative exposure chain, not a price forecast" },
  { heading: "Make the indexation formula explicit", nodes: ["BASE RENT", "DEFINED INDEX", "REVIEW DATE", "CHECKED RENT"], note: "Contract wording determines the calculation; no live index data" },
  { heading: "Read the boundaries of MRO coverage", nodes: ["SERVICE SCOPE", "EXCLUSIONS", "APPROVALS", "REMEDIES"], note: "Illustrative maintenance agreement review" },
  { heading: "A signal is not a validated prediction", nodes: ["OBSERVATION", "EVIDENCE", "VALIDATION", "HUMAN ACTION"], note: "Predictive capability requires independent validation" },
  { heading: "Negotiate an operable contract", nodes: ["TRIGGER", "DUTY", "EVIDENCE", "REMEDY"], note: "Illustrative clause design, not legal advice" },
  { heading: "Connect obligations across the supplier ecosystem", nodes: ["AIRLINE", "LESSOR + MRO", "FUEL + HANDLING", "AIRPORT"], note: "Illustrative relationships, not customer or flight data" },
  { heading: "The path from evidence to future scenarios", nodes: ["EVIDENCE NOW", "GOVERNANCE", "VALIDATION", "FUTURE SCENARIOS"], note: "Roadmap illustration: no calibrated forecast is available" },
  { heading: "AI assists; accountable people decide", nodes: ["AI SUGGESTION", "SOURCE REVIEW", "HUMAN DECISION", "AUDIT RECORD"], note: "Illustrative governed decision-support workflow" },
];
function wrap(context, value, x, y, maxWidth, lineHeight) {
  let line = "";
  for (const word of value.split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width > maxWidth && line) {
      context.fillText(line, x, y); y += lineHeight; line = word;
    } else line = candidate;
  }
  if (line) context.fillText(line, x, y);
}
export async function createPhase77FeaturedImage(article, index) {
  const diagram = diagrams[index];
  if (!diagram) throw new RangeError("No topic-specific editorial diagram is defined for this article.");
  const canvas = createCanvas(1200, 630);
  const c = canvas.getContext("2d");
  c.fillStyle = "#071b2c"; c.fillRect(0, 0, 1200, 630);
  c.fillStyle = "#0e3344"; c.fillRect(0, 470, 1200, 160);
  c.fillStyle = "#6fe0cc"; c.font = "bold 22px Arial";
  c.fillText("OPERION  /  AVIATION CONTRACT INTELLIGENCE", 60, 62);
  c.fillStyle = "#ffffff"; c.font = "bold 43px Arial";
  wrap(c, diagram.heading, 60, 133, 1060, 54);
  c.strokeStyle = "#6fe0cc"; c.lineWidth = 3;
  c.beginPath(); c.moveTo(60, 284); c.lineTo(1140, 284); c.stroke();
  for (let n = 0; n < diagram.nodes.length; n++) {
    const x = 60 + n * 280;
    c.fillStyle = n === index % 4 ? "#144e62" : "#102f45";
    c.fillRect(x, 330, 240, 100);
    c.strokeStyle = "#6fe0cc"; c.strokeRect(x, 330, 240, 100);
    c.fillStyle = "#d1b877"; c.font = "bold 16px Arial"; c.fillText(`0${n + 1}`, x + 17, 356);
    c.fillStyle = "#ffffff"; c.font = "bold 18px Arial";
    wrap(c, diagram.nodes[n], x + 17, 387, 208, 23);
    if (n < 3) {
      c.strokeStyle = "#d1b877"; c.beginPath();
      c.moveTo(x + 247, 380); c.lineTo(x + 271, 380);
      c.moveTo(x + 264, 373); c.lineTo(x + 271, 380); c.lineTo(x + 264, 387); c.stroke();
    }
  }
  c.fillStyle = "#d6ecef"; c.font = "23px Arial";
  wrap(c, diagram.note, 60, 523, 1070, 30);
  c.fillStyle = "#9bb6c5"; c.font = "17px Arial";
  c.fillText("Original editorial diagram  |  Meelis Paloson  |  Draft for review", 60, 592);
  return {
    id: randomUUID(), bytes: canvas.toBuffer("image/webp", 85),
    caption: `Original Operion editorial diagram: ${diagram.note}. Created for this article; no third-party imagery or founder portrait.`,
  };
}
export async function preparePhase77AuthorPhotograph(source) {
  const image = await loadImage(source);
  if (!image.width || !image.height || image.width * image.height > 24000000) {
    throw new RangeError("Approved author photograph exceeds the existing media dimension limit.");
  }
  const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
  const canvas = createCanvas(Math.max(1, Math.round(image.width * scale)), Math.max(1, Math.round(image.height * scale)));
  canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
  const bytes = canvas.toBuffer("image/webp", 82);
  if (bytes.length > 3145728) throw new RangeError("Approved author photograph exceeds the existing media byte limit.");
  return { id: randomUUID(), bytes, caption: "Meelis Paloson. Existing website photograph confirmed genuine and approved by the owner for local Blog reuse." };
}
