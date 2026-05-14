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

// Free models — IDs verified live from OpenRouter API
// Text-only models (PDF/paste analysis + chat)
const TEXT_MODELS = [
  'baidu/qianfan-ocr-fast:free',                 // ⚡⚡⚡⚡⚡ Medium stability - OCR
  'openai/gpt-oss-20b:free',                     // ⚡⚡⚡⚡ Excellent stability - Extraction
  'gemma-4-26b-a4b:free',                        // ⚡⚡⚡⚡ Good stability - Fast parsing
  'qwen/qwen3-next-80b-a3b-instruct:free',      // 262K ctx — user's primary
  'nvidia/nemotron-3-super-120b-a12b:free',      // 262K ctx — powerful fallback
  'google/gemma-4-31b-it:free',                  // 262K ctx
  'nousresearch/hermes-3-llama-3.1-405b:free',   // 131K ctx — huge model
  'meta-llama/llama-3.3-70b-instruct:free',      // 65K ctx — reliable last resort
];

// Vision-capable models (image/snapshot analysis)
const VISION_MODELS = [
  'google/gemma-4-31b-it:free',                  // 262K ctx + vision
  'google/gemma-4-26b-a4b-it:free',              // 262K ctx + vision
  'nvidia/nemotron-nano-12b-v2-vl:free',         // 128K ctx + vision
  'google/gemma-3-27b-it:free',                  // 131K ctx + vision
];

// ── System prompt ────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are an advanced AI financial assistant. Analyze the bank/credit card statement and return ONLY valid JSON — no markdown, no code fences, no explanation, no thinking tags.

Detect currency from context ($ USD default, ₹ INR if Indian merchants).

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
- Return raw JSON only — start with { and end with }.`;

// ── JSON parser — strips <think> tags (Qwen3 chain-of-thought) ──
function parseJSON(raw) {
  const noThink = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  // Find the first { and last } to extract pure JSON
  const start = noThink.indexOf('{');
  const end = noThink.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON object found in AI response');
  return JSON.parse(noThink.slice(start, end + 1));
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

// ── AI call with fallback chain ──────────────────────────────────
async function callAIWithFallback(messages, modelChain, validator = null) {
  let lastErr;
  for (const model of modelChain) {
    try {
      console.log(`🤖 Trying model: ${model}`);
      const resp = await openrouter.chat.completions.create({
        model,
        messages,
        temperature: 0.1,
        max_tokens: 4096,
      });
      const text = resp.choices[0]?.message?.content || '';
      if (!text.trim()) throw new Error('Empty response from model');
      
      // If a validator is provided, run it to ensure the response is well-formed
      if (validator) validator(text);

      console.log(`✅ Success with: ${model} (${text.length} chars)`);
      return text;
    } catch (err) {
      lastErr = err;
      const code = err.status || err.message || '';
      const isRateLimit = String(code).includes('429') || String(code).includes('503') ||
        err.message?.includes('429') || err.message?.includes('503') ||
        err.message?.includes('rate') || err.message?.includes('quota') ||
        err.message?.includes('Provider returned error');

      if (modelChain.indexOf(model) < modelChain.length - 1) {
        if (isRateLimit) {
          console.warn(`⚠️  ${model} rate-limited — trying next model…`);
        } else {
          console.warn(`⚠️  ${model} failed (${err.message}) — trying next model…`);
        }
        await new Promise(r => setTimeout(r, 500)); // small delay before retry
        continue;
      }
      throw err;
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

    const raw = await callAIWithFallback([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Analyze this bank statement and return the JSON:\n\n${text}` },
    ], TEXT_MODELS, parseJSON);

    const data = recalcTotals(parseJSON(raw));
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
