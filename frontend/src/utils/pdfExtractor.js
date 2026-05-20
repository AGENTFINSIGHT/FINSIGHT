import * as pdfjsLib from 'pdfjs-dist';

// Use the bundled worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

// Approx character count that's safe to send in one AI call (~50K chars ≈ ~12K tokens)
const CHUNK_CHAR_LIMIT = 48_000;

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

/**
 * Split a large PDF text into chunks that the AI can handle.
 * Each chunk stays within CHUNK_CHAR_LIMIT characters.
 * Splits are always made at page boundaries (--- Page N ---).
 *
 * @param {string} fullText  The complete extracted PDF text
 * @returns {string[]}       Array of text chunks, each ≤ CHUNK_CHAR_LIMIT chars
 */
export function splitIntoChunks(fullText) {
  // If small enough, no splitting needed
  if (fullText.length <= CHUNK_CHAR_LIMIT) return [fullText];

  // Split on page markers so we never cut in the middle of a page
  const pages = fullText.split(/(?=--- Page \d+ ---)/);
  const chunks = [];
  let current = '';

  for (const page of pages) {
    if (current.length + page.length > CHUNK_CHAR_LIMIT && current.length > 0) {
      chunks.push(current.trim());
      current = page;
    } else {
      current += (current ? '\n\n' : '') + page;
    }
  }

  if (current.trim()) chunks.push(current.trim());

  return chunks;
}

/**
 * Merge multiple AI analysis results (from chunked calls) into one combined result.
 * Transactions are combined, totals recalculated, and insights/suggestions deduplicated.
 *
 * @param {object[]} results  Array of parsed AI result objects
 * @returns {object}          Single merged result
 */
export function mergeChunkResults(results) {
  if (results.length === 0) throw new Error('No chunk results to merge');
  if (results.length === 1) return results[0];

  const merged = {
    card_number: results[0].card_number || 'Unknown Card',
    currency: results[0].currency || '$',
    transactions: [],
    category_summary: {
      Food: 0, Fuel: 0, Travel: 0, Shopping: 0,
      Bills: 0, Entertainment: 0, Healthcare: 0, Others: 0,
    },
    total_debit: 0,
    total_credit: 0,
    insights: [],
    unnecessary_spending: [],
    suggestions: [],
  };

  const seenTxns = new Set(); // deduplicate by date+description+amount

  for (const r of results) {
    // Card number — prefer a more specific value over "Unknown Card"
    if (r.card_number && r.card_number !== 'Unknown Card') {
      merged.card_number = r.card_number;
    }

    // Currency — take first non-default
    if (r.currency && r.currency !== '$') merged.currency = r.currency;

    // Transactions — deduplicate
    for (const t of (r.transactions || [])) {
      const key = `${t.date}|${t.description}|${t.amount}|${t.type}`;
      if (!seenTxns.has(key)) {
        seenTxns.add(key);
        merged.transactions.push(t);

        // Accumulate totals
        const amt = Number(t.amount) || 0;
        if (t.type === 'debit')  merged.total_debit  += amt;
        if (t.type === 'credit') merged.total_credit += amt;

        // Accumulate category summary
        const cat = t.category || 'Others';
        if (cat in merged.category_summary) {
          merged.category_summary[cat] += amt;
        } else {
          merged.category_summary['Others'] += amt;
        }
      }
    }

    // Unnecessary spending — deduplicate by description
    for (const u of (r.unnecessary_spending || [])) {
      const exists = merged.unnecessary_spending.some(x => x.description === u.description);
      if (!exists) merged.unnecessary_spending.push(u);
    }

    // Insights / suggestions — simple dedup by string value
    for (const s of (r.insights || [])) {
      if (!merged.insights.includes(s)) merged.insights.push(s);
    }
    for (const s of (r.suggestions || [])) {
      if (!merged.suggestions.includes(s)) merged.suggestions.push(s);
    }
  }

  // Round totals
  merged.total_debit  = Math.round(merged.total_debit  * 100) / 100;
  merged.total_credit = Math.round(merged.total_credit * 100) / 100;

  // Round category sums
  for (const cat of Object.keys(merged.category_summary)) {
    merged.category_summary[cat] = Math.round(merged.category_summary[cat] * 100) / 100;
  }

  return merged;
}
