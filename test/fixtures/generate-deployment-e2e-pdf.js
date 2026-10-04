import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const fixtureDirectory = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.join(fixtureDirectory, "synthetic-aircraft-lease.txt");
const outputPath = process.argv[2];

if (!outputPath) throw new Error("Provide an output path for the generated PDF");

function escapePdfText(value) {
  return value.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

function wrapLine(value, maxLength = 92) {
  const words = value.trim().split(/\s+/);
  const lines = [];
  let line = "";

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxLength && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

const source = await fs.readFile(sourcePath, "utf8");
const lines = source.split(/\r?\n/).flatMap(wrapLine).filter(Boolean);
const textCommands = [
  "BT",
  "/F1 10 Tf",
  "50 760 Td",
  ...lines.flatMap((line, index) => [
    index ? "0 -14 Td" : "",
    `(${escapePdfText(line)}) Tj`,
  ]).filter(Boolean),
  "ET",
].join("\n");
const streamLength = Buffer.byteLength(textCommands, "ascii");
const objects = [
  "<< /Type /Catalog /Pages 2 0 R >>",
  "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
  "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
  "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  `<< /Length ${streamLength} >>\nstream\n${textCommands}\nendstream`,
];

let pdf = "%PDF-1.4\n";
const offsets = [0];
for (const [index, object] of objects.entries()) {
  offsets.push(Buffer.byteLength(pdf, "ascii"));
  pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
}

const xrefOffset = Buffer.byteLength(pdf, "ascii");
pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
pdf += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

const pdfBuffer = Buffer.from(pdf, "ascii");
const parserCompatibleBuffer = Buffer.concat([
  pdfBuffer,
  Buffer.alloc(Math.max(0, 40_000 - pdfBuffer.length), 0x20),
]);

await fs.writeFile(outputPath, parserCompatibleBuffer);
console.log(outputPath);
