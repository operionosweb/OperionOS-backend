import fs from "fs";
import pdfParse from "pdf-parse";

export async function extractTextFromPDF(filePath) {
  try {
    const dataBuffer = fs.readFileSync(filePath);

    const data = await pdfParse(dataBuffer);

    return data.text || "";
  } catch (error) {
    console.error("PDF extraction failed:", error);
    throw error;
  }
}
