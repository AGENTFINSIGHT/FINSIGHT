// Shared utilities for Dashboard components

/** Normalize a raw card number/label to a canonical form.
 *  Extracts the last 4 digits and builds "XXXX-NNNN" so that
 *  different masking lengths (XXXXXXXXXXXX8805 vs XXXXXXXXXX8805)
 *  collapse to the same column key. */
function normalizeCardLabel(raw) {
  if (!raw || raw === 'Unknown Card') return 'Unknown Card';
  // Extract trailing digits (up to 4)
  const digits = raw.replace(/\s/g, '').match(/(\d{4})\D*$/);
  if (digits) return `XXXX-${digits[1]}`;
  // No trailing digits found — return cleaned-up raw value
  return raw.replace(/X+/g, 'XXXX').trim();
}

/** Extract card label from an analysis object.
 *  Priority: result_json.card_number → filename fallback */
export function extractCardLabel(analysis) {
  // 1. Use card_number from AI-extracted result if available
  const cardNum = analysis?.result_json?.card_number;
  if (cardNum && cardNum !== 'Unknown Card' && cardNum.trim()) {
    return normalizeCardLabel(cardNum.trim());
  }
  // 2. Fallback: derive from filename
  const fileName = analysis?.file_name || '';
  const noExt = fileName.replace(/\.[^.]+$/, '');
  const cleaned = noExt.replace(/_[a-z]{3,9}\d{4}$/i, '').replace(/_\d{6}$/i, '');
  const raw = cleaned.toUpperCase().replace(/_/g, ' ') || 'Unknown Card';
  return normalizeCardLabel(raw);
}

/** Get "YYYY-MM" key from a date string */
export function getMonthKey(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Detect FY start year from all analyses */
export function detectFYStartYear(analyses) {
  const times = analyses
    .flatMap(a => (a.result_json?.transactions || []).map(t => new Date(t.date).getTime()))
    .filter(t => !isNaN(t));

  if (!times.length) {
    const now = new Date();
    return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  }
  const minDate = new Date(Math.min(...times));
  return minDate.getMonth() >= 3 ? minDate.getFullYear() : minDate.getFullYear() - 1;
}

/** Detect FY end year (inclusive) from all analyses */
export function detectFYEndYear(analyses) {
  const times = analyses
    .flatMap(a => (a.result_json?.transactions || []).map(t => new Date(t.date).getTime()))
    .filter(t => !isNaN(t));

  if (!times.length) {
    const now = new Date();
    return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  }
  const maxDate = new Date(Math.max(...times));
  return maxDate.getMonth() >= 3 ? maxDate.getFullYear() : maxDate.getFullYear() - 1;
}

/** Generate 12 FY months Apr→Mar for a single FY */
export function getFYMonths(startYear) {
  return Array.from({ length: 12 }, (_, i) => {
    const monthIndex = (3 + i) % 12; // 3=Apr,4=May,...11=Dec,0=Jan,1=Feb,2=Mar
    const year = monthIndex >= 3 ? startYear : startYear + 1;
    const label = `${String(monthIndex + 1).padStart(2, '0')}-${year}`;
    const key = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
    return { monthIndex, year, label, key };
  });
}

/** Generate all FY months across multiple fiscal years, sorted Apr→Mar per FY.
 *  Only includes months that actually have transaction data. */
export function getAllFYMonths(analyses) {
  const startYear = detectFYStartYear(analyses);
  const endYear = detectFYEndYear(analyses);

  // Collect all month keys that have at least one transaction
  const activeKeys = new Set();
  analyses.forEach(a =>
    (a.result_json?.transactions || []).forEach(t => {
      const mk = getMonthKey(t.date);
      if (mk) activeKeys.add(mk);
    })
  );

  const months = [];
  for (let fy = startYear; fy <= endYear; fy++) {
    getFYMonths(fy).forEach(mo => {
      if (activeKeys.has(mo.key)) months.push({ ...mo, fyLabel: `FY${String(fy).slice(2)}-${String(fy + 1).slice(2)}` });
    });
  }
  // Deduplicate (same key could appear from overlapping FY ranges)
  const seen = new Set();
  return months.filter(mo => {
    if (seen.has(mo.key)) return false;
    seen.add(mo.key);
    return true;
  });
}

/** Format a number as Indian locale */
export function fmtINR(n) {
  const num = Number(n) || 0;
  if (num === 0) return '-';
  return num.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

/** Get unique card labels from analyses array */
export function getUniqueCards(analyses) {
  const seen = new Set();
  const result = [];
  analyses.forEach(a => {
    const label = extractCardLabel(a);
    if (!seen.has(label)) { seen.add(label); result.push(label); }
  });
  return result;
}

/** Sanitize and correct credit/debit transaction types in-memory to fix legacy/AI parsing errors. */
export function sanitizeAnalyses(analyses) {
  if (!Array.isArray(analyses)) return [];

  const creditKeywords = [
    'payment received', 
    'thank you', 
    'payment thank you', 
    'cc payment received',
    'cc payment thank you',
    'autopay payment',
    'clearance', 
    'refund', 
    'cashback', 
    'reversal', 
    'waiver', 
    'credit received', 
    'cr received', 
    'pymt received', 
    'payment rec'
  ];

  return analyses.map(analysis => {
    if (!analysis?.result_json) return analysis;
    
    // Deep clone the result_json to avoid side-effects
    const resultJson = JSON.parse(JSON.stringify(analysis.result_json));
    const txns = resultJson.transactions || [];
    
    let hasChanges = false;
    let debit = 0;
    let credit = 0;

    txns.forEach(t => {
      const desc = String(t.description || '').toLowerCase();
      let isCredit = creditKeywords.some(keyword => desc.includes(keyword));
      
      if (!isCredit) {
        if (desc.endsWith(' cr') || desc.includes(' cr ') || desc.includes('(cr)')) {
          isCredit = true;
        }
      }

      if (isCredit) {
        const debitExclusions = ['gst payment', 'tax payment', 'interest payment', 'convenience fee on payment'];
        const hasExclusion = debitExclusions.some(ex => desc.includes(ex));
        if (hasExclusion) {
          isCredit = false;
        }
      }

      const originalType = t.type;
      const targetType = isCredit ? 'credit' : 'debit';
      if (originalType !== targetType) {
        t.type = targetType;
        hasChanges = true;
      }

      const amt = Number(t.amount) || 0;
      if (t.type === 'debit') {
        debit += amt;
      } else if (t.type === 'credit') {
        credit += amt;
      }
    });

    if (hasChanges) {
      resultJson.total_debit = Math.round(debit * 100) / 100;
      resultJson.total_credit = Math.round(credit * 100) / 100;
      console.log(`🔧 [Frontend] In-memory corrected transaction types for: "${analysis.file_name}"`);
    }

    // Always correct total_amount_due if it was hallucinated as the sum of all transactions (debit + credit)
    const sumAll = Math.round((debit + credit) * 100) / 100;
    if (resultJson.total_amount_due && Math.abs(resultJson.total_amount_due - sumAll) < 1) {
      resultJson.total_amount_due = Math.round(debit * 100) / 100;
      console.log(`🔧 [Frontend] Corrected total_amount_due from ${sumAll} to ${debit} for "${analysis.file_name}"`);
    }

    return {
      ...analysis,
      result_json: resultJson
    };
  });
}
