import { Router } from 'express';
import multer from 'multer';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

// ── Supabase admin ───────────────────────────────────────────────
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ── OpenRouter client ────────────────────────────────────────────
const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': 'https://finsight-ai.app',
    'X-Title': 'FinSight AI',
  },
});

// ── Free text models (quota-optimized: only the 5 most reliable) ──
// Keeping this short saves OpenRouter daily-quota when models are down.
// Add more back once you have credits (1000 req/day).
const TEXT_MODELS = [
  'deepseek/deepseek-v4-flash:free',            // 1M  ctx · huge window, fast & accurate
  'google/gemma-4-31b-it:free',                // 262K ctx · highly robust gemma 4 model
  'google/gemma-4-26b-a4b-it:free',           // 262K ctx · excellent mix-of-experts fallback
  'openai/gpt-oss-20b:free',                    // 131K ctx · fast and lightweight
  'openai/gpt-oss-120b:free',                   // 131K ctx · high quality fallback
  'openrouter/free',                            // Auto-routes to any healthy free model
];

// Vision-capable models (image/snapshot analysis)
const VISION_MODELS = [
  'google/gemma-4-31b-it:free',                // 262K ctx + vision
  'google/gemma-4-26b-a4b-it:free',           // 262K ctx + vision
  'openrouter/free',                           // Auto-routes vision-capable free models
  'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free', // 256K ctx + vision/audio/video
  'nvidia/nemotron-nano-12b-v2-vl:free',       // 128K ctx + vision
];

// ── System prompt ────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are an advanced AI financial assistant. Analyze the bank/credit card statement and return ONLY valid JSON — no markdown, no code fences, no explanation, no thinking tags.

CURRENCY DETECTION — CRITICAL:
- If the statement mentions ₹, Rs., INR, paise, or is from an Indian bank (HDFC, ICICI, SBI, Axis, Kotak, Yes Bank, IDFC, PNB, BOI, Canara, UCO, RBL, IndusInd, Federal, Standard Chartered India), set currency = "₹".
- If amounts are clearly in Indian Rupees (lakhs, crores, paise), set currency = "₹".
- ONLY use "$" if the statement explicitly shows USD amounts from a non-Indian bank.
- Default for all Indian credit card statements is "₹", NOT "$".

Return EXACTLY this JSON schema:
{
  "card_number": "XXXXXXXXXXXX1234",
  "currency": "$",
  "transactions": [{ "date": "YYYY-MM-DD", "description": "merchant name", "amount": 0.00, "type": "credit|debit", "category": "Food|Fuel|Travel|Shopping|Bills|Entertainment|Healthcare|Others" }],
  "category_summary": { "Food":0,"Fuel":0,"Travel":0,"Shopping":0,"Bills":0,"Entertainment":0,"Healthcare":0,"Others":0 },
  "total_debit": 0.00,
  "total_credit": 0.00,
  "insights": ["string"],
  "unnecessary_spending": [{ "description": "string", "amount": 0, "reason": "string" }],
  "suggestions": ["string"]
}

Rules:
- card_number: Extract the credit/debit card number shown in the statement header or transaction rows (e.g. "6528XXXXXXXX5003"). If not found, use "Unknown Card".
- Normalize merchant names, remove duplicates, infer categories semantically.
- Return raw JSON only — start with { and end with }.

CRITICAL — Transaction type classification (read this carefully):
type = "debit"  means ACTUAL SPENDING — purchases, EMIs, fees, utilities charged TO the card.
type = "credit" means money RECEIVED BY or PAID TO the card account — this reduces the outstanding balance.

ALWAYS mark as type = "credit" (NOT debit):
  - Credit card bill payments / outstanding payments: any transaction with keywords like "CC PAYMENT", "CARD PAYMENT", "BILL PAYMENT", "BPPY", "PAYMENT IC", "PAYMENT RECEIVED", "PAYMENT THANK YOU", "AUTOPAY", "CLEARANCE"
  - NEFT / IMPS / UPI payments sent to clear the credit card dues
  - Refunds, cashbacks, reversals, charge waivers
  - Opening balance adjustments credited to the account
  - Any transaction explicitly labelled as a payment toward the card balance

ALWAYS mark as type = "debit" (actual spending):
  - Merchant purchases (restaurants, retail, online shopping, fuel)
  - EMI installments charged by the bank for purchases
  - Utility bill charges (electricity, phone, internet) debited from the card
  - Service charges, late fees, interest charges
  - ATM cash withdrawals

IMPORTANT: total_debit must equal the SUM of debit transactions ONLY.
           total_credit must equal the SUM of credit transactions ONLY.
           A credit card payment is NOT spending — it is type = "credit".

COMPLETENESS: You MUST extract EVERY single transaction from the statement — do not stop early or skip any. Include all EMIs, refunds, payments, and purchases. Missing transactions will cause incorrect totals.`;

// ── JSON parser with auto-repair ───────────────────────────────

/**
 * Close any open arrays/objects in a truncated JSON string.
 * Walks through the string tracking bracket depth, then appends
 * the missing closing tokens in reverse order.
 */
function closeOpenJSON(s) {
  const stack = [];
  let inStr = false, esc = false;
  for (const ch of s) {
    if (esc)          { esc = false; continue; }
    if (ch === '\\' && inStr) { esc = true;  continue; }
    if (ch === '"')   { inStr = !inStr; continue; }
    if (inStr)        continue;
    if (ch === '{' || ch === '[') stack.push(ch);
    if (ch === '}' || ch === ']') stack.pop();
  }
  let trimmed = s.trimEnd();
  if (trimmed.endsWith(',')) trimmed = trimmed.slice(0, -1); // strip trailing comma
  return trimmed + stack.reduceRight((acc, ch) => acc + (ch === '{' ? '}' : ']'), '');
}

/** Attempt several repair strategies on invalid JSON before giving up. */
function repairAndParse(jsonStr) {
  // Strategy 1: Remove trailing commas
  try {
    return JSON.parse(jsonStr.replace(/,\s*([}\]])/g, '$1'));
  } catch {}

  // Strategy 2: Close truncated structures
  try {
    return JSON.parse(closeOpenJSON(jsonStr));
  } catch {}

  // Strategy 3: Both repairs combined
  try {
    return JSON.parse(closeOpenJSON(jsonStr.replace(/,\s*([}\]])/g, '$1')));
  } catch {}

  // Strategy 4: Fix unquoted plain-text values (e.g. "card_number": XXXXXXXXXX)
  try {
    const fixed = jsonStr.replace(/:\s*([A-Za-z][^"\[\]{},:]*?)\s*([,}\]])/g,
      (m, val, end) => `: "${val.trim()}"${end}`);
    return JSON.parse(fixed);
  } catch {}

  // Strategy 5: Unquoted fix + truncation close
  try {
    const fixed = jsonStr.replace(/:\s*([A-Za-z][^"\[\]{},:]*?)\s*([,}\]])/g,
      (m, val, end) => `: "${val.trim()}"${end}`);
    return JSON.parse(closeOpenJSON(fixed));
  } catch {}

  throw new Error('JSON repair failed — model returned unrecoverable output');
}

/** Parse AI response: strip <think> tags, extract JSON object, repair if needed. */
function parseJSON(raw) {
  const noThink = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  const start = noThink.indexOf('{');
  const end   = noThink.lastIndexOf('}');
  if (start === -1) throw new Error('No JSON object found in AI response');
  // If the closing } is missing (truncated), use the whole rest of the string
  const jsonStr = end !== -1 ? noThink.slice(start, end + 1) : noThink.slice(start);
  try {
    return JSON.parse(jsonStr);
  } catch {
    console.warn('⚠️  JSON parse failed — attempting auto-repair…');
    return repairAndParse(jsonStr);
  }
}

/** Recalculate total_debit and total_credit by summing the extracted transactions.
 *  This prevents AI hallucinations where it reads "Previous Statement Dues" or
 *  other balance summary fields as transaction amounts, inflating the totals. */
function recalcTotals(result) {
  const txns = result.transactions || [];
  let debit = 0, credit = 0;
  txns.forEach(t => {
    const amt = Number(t.amount) || 0;
    if (t.type === 'debit')  debit  += amt;
    if (t.type === 'credit') credit += amt;
  });
  result.total_debit  = Math.round(debit  * 100) / 100;
  result.total_credit = Math.round(credit * 100) / 100;
  return result;
}

// ── Per-model timeout (ms) — prevents one slow model from hanging the request
const MODEL_TIMEOUT_MS = 90_000; // 90 seconds

/** Wrap a promise with a timeout. Rejects with TimeoutError after `ms` milliseconds. */
function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Model timed out after ${ms / 1000}s`)), ms);
    promise.then(
      val => { clearTimeout(timer); resolve(val); },
      err => { clearTimeout(timer); reject(err); }
    );
  });
}

/** Exponential backoff with jitter.
 *  Attempt 0 → ~0ms, 1 → ~1s, 2 → ~2s, 3 → ~4s … max 10s
 *  The ±30% jitter prevents multiple simultaneous batch requests
 *  from all retrying the same model at the same moment. */
function backoffDelay(attempt) {
  const base = Math.min(1000 * 2 ** attempt, 10_000); // cap at 10s
  const jitter = base * (0.7 + Math.random() * 0.6);   // 70–130% of base
  return jitter;
}

// ── In-memory result cache (quota saver) ─────────────────────────────
// Keeps the last 100 AI responses in memory. If the same statement text
// is submitted again (e.g. "Retry" click), we return the cached result
// without consuming another API quota call.
const resultCache = new Map();
const CACHE_MAX = 100;

function cacheKey(text) {
  // Simple hash: first 2000 chars are enough to uniquely identify a statement
  const sample = text.slice(0, 2000);
  let h = 0;
  for (let i = 0; i < sample.length; i++) {
    h = (Math.imul(31, h) + sample.charCodeAt(i)) | 0;
  }
  return h.toString(36);
}

function cacheGet(key) {
  if (!resultCache.has(key)) return null;
  // Move to end (LRU touch)
  const val = resultCache.get(key);
  resultCache.delete(key);
  resultCache.set(key, val);
  return val;
}

function cacheSet(key, value) {
  if (resultCache.size >= CACHE_MAX) {
    // Evict oldest entry
    resultCache.delete(resultCache.keys().next().value);
  }
  resultCache.set(key, value);
}

// ── AI call with fallback chain + exponential backoff ───────────────
async function callAIWithFallback(messages, modelChain, validator = null) {
  let lastErr;
  const maxAttempts = 3;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    for (let i = 0; i < modelChain.length; i++) {
      const model = modelChain[i];
      try {
        console.log(`🤖 Trying model: ${model} (attempt ${attempt + 1}/${maxAttempts})`);
        const resp = await withTimeout(
          openrouter.chat.completions.create({
            model,
            messages,
            temperature: 0.1,
            max_tokens: 16384,
          }),
          MODEL_TIMEOUT_MS
        );
        const text = resp.choices[0]?.message?.content || '';
        if (!text.trim()) throw new Error('Empty response from model');

        if (validator) validator(text);

        console.log(`✅ Success with: ${model} (${text.length} chars)`);
        return text;
      } catch (err) {
        lastErr = err;
        const msg = String(err.status || err.message || '');
        const isRateLimit =
          msg.includes('429') || msg.includes('503') ||
          err.message?.includes('rate') || err.message?.includes('quota') ||
          err.message?.includes('Provider returned error') ||
          err.message?.includes('timed out');
        const isInvalid =
          msg.includes('404') || msg.includes('400') ||
          err.message?.includes('not a valid model') ||
          err.message?.includes('No endpoints found');

        if (isInvalid) {
          console.warn(`⛔  ${model} invalid/removed — skipping immediately…`);
          continue; // Skip to next model in the chain
        }

        if (isRateLimit) {
          const delay = Math.round(backoffDelay(i + attempt * 2));
          console.warn(`⚠️  ${model} rate-limited/timeout — waiting ${delay}ms before trying next…`);
          await new Promise(r => setTimeout(r, delay));
        } else {
          console.warn(`⚠️  ${model} failed (${err.message}) — trying next model…`);
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    }

    // If we completed the full chain but failed, wait a bit before the next full attempt
    if (attempt < maxAttempts - 1) {
      const cooldown = 3000 * (attempt + 1);
      console.warn(`🔄 Completed full chain but failed. Waiting ${cooldown}ms cooldown before full retry attempt ${attempt + 2}…`);
      await new Promise(r => setTimeout(r, cooldown));
    }
  }
  throw lastErr;
}

// ── Supabase save ────────────────────────────────────────────────
async function saveAnalysis(userId, fileName, fileType, fileUrl, result) {
  const { error } = await supabaseAdmin.from('analyses').insert({
    user_id: userId,
    file_name: fileName,
    file_type: fileType,
    file_url: fileUrl || null,
    currency: result.currency || '$',
    total_debit: result.total_debit || 0,
    total_credit: result.total_credit || 0,
    txn_count: result.transactions?.length || 0,
    result_json: result,
  });
  if (error) console.error('Supabase save error:', error.message);
}

// ════════════════════════════════════════════════════════════════
// POST /api/analyze/text
// ════════════════════════════════════════════════════════════════
router.post('/text', authMiddleware, async (req, res) => {
  try {
    const { text, fileName = 'statement.txt', fileType = 'text' } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'text is required' });

    // ── Cache lookup: avoid burning quota on identical re-submissions ──
    const ck = cacheKey(text);
    const cached = cacheGet(ck);
    if (cached) {
      console.log(`📦 Cache hit — returning stored result (no API call)`);
      return res.json(cached);
    }

    const raw = await callAIWithFallback([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Analyze this bank statement and return the JSON:\n\n${text}` },
    ], TEXT_MODELS, parseJSON);

    const data = recalcTotals(parseJSON(raw));
    cacheSet(ck, data);  // store for next retry
    await saveAnalysis(req.user.id, fileName, fileType, null, data);
    res.json(data);
  } catch (err) {
    console.error('Text analysis error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════
// POST /api/analyze/image
// ════════════════════════════════════════════════════════════════
router.post('/image', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'image file required' });
    const { fileName = req.file.originalname, fileType = 'image' } = req.body;

    // Upload to Supabase Storage
    const storagePath = `${req.user.id}/${Date.now()}_${req.file.originalname}`;
    const { error: upErr } = await supabaseAdmin.storage
      .from('snapshots')
      .upload(storagePath, req.file.buffer, { contentType: req.file.mimetype, upsert: false });
    const fileUrl = upErr ? null
      : supabaseAdmin.storage.from('snapshots').getPublicUrl(storagePath).data?.publicUrl;

    const base64DataUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    const raw = await callAIWithFallback([
      {
        role: 'user',
        content: [
          { type: 'text', text: `${SYSTEM_PROMPT}\n\nThis is a bank statement image. Extract ALL visible transactions and return ONLY the JSON.` },
          { type: 'image_url', image_url: { url: base64DataUrl } },
        ],
      },
    ], VISION_MODELS, parseJSON);

    const data = recalcTotals(parseJSON(raw));
    await saveAnalysis(req.user.id, fileName, fileType, fileUrl, data);
    res.json(data);
  } catch (err) {
    console.error('Image analysis error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════
// POST /api/analyze/chat
// ════════════════════════════════════════════════════════════════
router.post('/chat', authMiddleware, async (req, res) => {
  try {
    const { message, financialData, history = [] } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'message is required' });

    const systemCtx = `You are a helpful, friendly financial advisor. The user's bank statement data:\n${JSON.stringify(financialData, null, 2)}\n\nAnswer concisely (under 150 words). Be specific with numbers from the data.`;

    const messages = [
      { role: 'system', content: systemCtx },
      ...history.map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content })),
      { role: 'user', content: message },
    ];

    const raw = await callAIWithFallback(messages, TEXT_MODELS);
    const reply = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    res.json({ reply });
  } catch (err) {
    console.error('Chat error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
