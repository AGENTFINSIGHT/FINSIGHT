import * as pdfjsLib from 'pdfjs-dist';

// Use the bundled worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

/**
 * Extract all text from a PDF File object.
 * Handles scanned/image-based PDFs gracefully.
 * @param {File} file
 * @returns {Promise<string>}
 */
export async function extractTextFromPDF(file) {
  let pdf;
  try {
    const arrayBuffer = await file.arrayBuffer();
    pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  } catch (err) {
    throw new Error(`Cannot open "${file.name}": ${err.message}. It may be password-protected.`);
  }

  const textPages = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    try {
      const page    = await pdf.getPage(i);
      const content = await page.getTextContent();

      // Filter out image-ref items that have no .str (common in scanned PDFs)
      const pageText = (content?.items ?? [])
        .filter(item => item && typeof item.str === 'string')
        .map(item => item.str)
        .join(' ')
        .trim();

      if (pageText) {
        textPages.push(`--- Page ${i} ---\n${pageText}`);
      }
    } catch {
      // Skip unreadable pages silently — don't crash the whole extraction
      textPages.push(`--- Page ${i} --- [unreadable]`);
    }
  }

  const combined = textPages.join('\n\n').trim();

  if (!combined || combined.replace(/---.*---/g, '').trim().length < 20) {
    throw new Error(
      `"${file.name}" is a scanned/image-based PDF with no extractable text. ` +
      `Please use the Snapshot tab on the main page to upload it as an image.`
    );
  }

  return combined;
}
