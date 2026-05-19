import pdfParse from "pdf-parse";

export async function extractPdfText(buffer) {
  try {
    const pdfData = await pdfParse(buffer);

    return pdfData.text || "";
  } catch (error) {
    console.error("PDF extraction failed:", error);

    return "";
  }
}
