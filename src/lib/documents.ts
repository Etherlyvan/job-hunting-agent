import { PDFDocument, StandardFonts } from "pdf-lib";
import { PublicError } from "./security";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pythonCheck } from "./python";
// ASCII-compatible output avoids silently missing glyphs in standard PDF fonts.
// Indonesian and English are supported; unsupported alphabets fail explicitly.
export function pdfText(text: string) {
  return text
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u2022/g, "-")
    .replace(/\u00a0/g, " ");
}
export async function createPdf(source: string, pages: 1 | 2) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const lines: string[] = [];
  try {
    for (const paragraph of pdfText(source).split("\n")) {
      let line = "";
      for (const word of paragraph.split(/\s+/)) {
        if (font.widthOfTextAtSize(word, 11) > 475)
          throw new PublicError("An unbroken word is too wide for the PDF.");
        if (font.widthOfTextAtSize(`${line} ${word}`, 11) > 475) {
          lines.push(line);
          line = word;
        } else line = line ? `${line} ${word}` : word;
      }
      lines.push(line);
    }
  } catch (e) {
    if (e instanceof PublicError) throw e;
    throw new PublicError(
      "PDF font cannot encode this text. Use English/Indonesian Latin text or the original LaTeX workflow.",
    );
  }
  const capacity = 46;
  if (lines.length > capacity * pages)
    throw new PublicError(
      `Document exceeds ${pages} page limit. Shorten the source before export.`,
      422,
    );
  // Split at a paragraph boundary, keeping headings with their following text.
  let split = lines.length;
  if (pages === 2) {
    const heading = (line: string) =>
      line === "Skills" || /^[A-Z ]{3,}$/.test(line);
    const candidates = lines
      .map((_, i) => i)
      .filter(
        (i) =>
          i >= 4 &&
          i <= capacity &&
          lines.length - i <= capacity &&
          !heading(lines[i - 1]) &&
          lines[i - 1] !== "",
      );
    if (!candidates.length)
      throw new PublicError(
        "Cannot lay out this source across two pages safely. Use one page or adjust the content.",
        422,
      );
    split = candidates.sort(
      (a, b) => Math.abs(a - lines.length / 2) - Math.abs(b - lines.length / 2),
    )[0];
  }
  const pageLines =
    pages === 1 ? [lines] : [lines.slice(0, split), lines.slice(split)];
  for (let i = 0; i < pages; i++) {
    const page = doc.addPage([595.28, 841.89]);
    pageLines[i].forEach((line, n) => {
      if (line) page.drawText(line, { x: 60, y: 780 - n * 15, size: 11, font });
    });
  }
  const bytes = await doc.save();
  const verified = await PDFDocument.load(bytes);
  if (verified.getPageCount() !== pages)
    throw new PublicError("PDF page verification failed.", 500);
  return bytes;
}
export async function verifiedPdf(source: string, pages: 1 | 2) {
  const bytes = await createPdf(source, pages);
  const dir = await mkdtemp(join(tmpdir(), "job-agent-pdf-"));
  try {
    const path = join(dir, "document.pdf");
    await writeFile(path, bytes, { mode: 0o600 });
    await pythonCheck("pdf", { path, pages, source: pdfText(source) });
    return bytes;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
