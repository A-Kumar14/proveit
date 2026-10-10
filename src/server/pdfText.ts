import "server-only";
import { extractText, getDocumentProxy } from "unpdf";

/** Fewer characters per page than this means the PDF is scanned or image-only, and text extraction found nothing useful. */
export const MIN_CHARS_PER_PAGE = 80;

/**
 * Reads the text layer of a PDF on this machine, in about a second. Lecture decks and typeset notes have one.
 * Scanned pages don't, so the caller falls back to the model when `usable` is false.
 */
export async function pdfText(data: Uint8Array): Promise<{ text: string; pages: number; usable: boolean }> {
  const pdf = await getDocumentProxy(new Uint8Array(data));
  const { text, totalPages } = await extractText(pdf, { mergePages: true });
  const clean = String(text).replace(/\u0000/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return { text: clean, pages: totalPages, usable: totalPages > 0 && clean.length / totalPages >= MIN_CHARS_PER_PAGE };
}
