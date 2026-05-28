import PDFDocument from "pdfkit";
import fs from "fs";

const doc = new PDFDocument();

doc.pipe(fs.createWriteStream("real-contract.pdf"));

doc.fontSize(16).text("Aircraft Lease Agreement", { underline: true });

doc.moveDown();

doc.fontSize(12).text(`
Clause 1: Maintenance responsibility is with lessee.
Clause 2: Insurance must be maintained at all times.
Clause 3: Aircraft must be returned in airworthy condition.
Clause 4: Termination requires 60 days notice.
`);

doc.end();

console.log("PDF created: real-contract.pdf");
