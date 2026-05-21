import fs from "fs";
import pdfParse from "pdf-parse";

export async function extractTextFromPDF(filePath) {
  try {
    const dataBuffer = fs.readFileSync(filePath);

    const pdfData = await pdfParse(dataBuffer);

    return pdfData.text || "";
  } catch (error) {
    console.error("PDF extraction failed:", error);

    throw new Error("Failed to extract PDF text");
  }
}
