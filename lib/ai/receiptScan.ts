// Three-stage AI pipeline for receipt → pantry. Cost-tuned: vision OCR and the
// judge pass both run on gpt-5.4-mini (printed text + yes/no sanity checking
// don't need a frontier model), and the web-lookup is BATCHED into a single
// /v1/responses call so one receipt costs one $0.01 web_search call instead of
// one per unmatched item.
//
// Stages 2 and 3 use OpenAI's Responses API with the built-in `web_search`
// tool. The chat completions endpoint doesn't expose tools the same way, so
// we hit /v1/responses directly.

const OPENAI = 'https://api.openai.com';

// Models — cheap-tier where quality permits. Receipt OCR is printed text and
// the judge is a pure yes/no per row, so gpt-5.4-mini is more than enough.
// The web-lookup also moves down a tier; we keep web_search for citations.
const RECEIPT_OCR_MODEL = 'gpt-5.4-mini';
const RECEIPT_LOOKUP_MODEL = 'gpt-5.4-mini';
const RECEIPT_JUDGE_MODEL = 'gpt-5.4-mini';

export interface ReceiptLineItem {
  rawText: string; // exactly as printed on the receipt (e.g. "M&S COOK SHANK HAM 220G")
  normalizedName: string; // human-friendly (e.g. "M&S cooked shank ham")
  brand: string | null;
  qty: number; // count of physical units purchased
  packSize: string | null; // free-text pack size, e.g. "220g" or "6 pack"
  packGrams: number | null; // numeric grams when extractable, else null
  store: string | null; // resolved at the receipt level, copied to each item
  totalPrice: number | null;
  category: 'produce' | 'meat' | 'dairy' | 'bakery' | 'pantry' | 'frozen' | 'drinks' | 'other';
}

const RECEIPT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    store: { type: ['string', 'null'] },
    purchasedAt: { type: ['string', 'null'], description: 'ISO date if visible on the receipt, else null' },
    currency: { type: ['string', 'null'], description: 'e.g. GBP, EUR, USD' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          rawText: { type: 'string' },
          normalizedName: { type: 'string' },
          brand: { type: ['string', 'null'] },
          qty: { type: 'number' },
          packSize: { type: ['string', 'null'] },
          packGrams: { type: ['number', 'null'] },
          totalPrice: { type: ['number', 'null'] },
          category: {
            type: 'string',
            enum: ['produce', 'meat', 'dairy', 'bakery', 'pantry', 'frozen', 'drinks', 'other'],
          },
        },
        required: ['rawText', 'normalizedName', 'brand', 'qty', 'packSize', 'packGrams', 'totalPrice', 'category'],
      },
    },
  },
  required: ['store', 'purchasedAt', 'currency', 'items'],
};

const RECEIPT_SYSTEM = `You are a careful receipt-OCR assistant. From a supermarket till receipt photo, extract each line item.
Skip totals, subtotals, savings, payment lines, store metadata, and discount codes — only food/drink items.
For each item:
- rawText: the line as printed (preserve abbreviations and capitalization)
- normalizedName: a human-friendly description, expand abbreviations (e.g. "CHX" -> "chicken", "CKD" -> "cooked")
- brand: the supermarket private label (e.g. "M&S", "Tesco Finest", "Sainsbury's") or product brand if obvious; else null
- qty: number of physical units bought (default 1)
- packSize: pack size as printed (e.g. "220g", "6 x 200g", "1L"); else null
- packGrams: total grams in the package as a number, only if you can extract it cleanly; else null
- totalPrice: price for this line if visible
- category: best-guess shelf category
Return strict JSON.`;

export async function extractReceiptItems(
  apiKey: string,
  photoDataUrl: string
): Promise<{ store: string | null; purchasedAt: string | null; currency: string | null; items: ReceiptLineItem[] }> {
  const res = await fetch(`${OPENAI}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: RECEIPT_OCR_MODEL,
      messages: [
        { role: 'system', content: RECEIPT_SYSTEM },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Extract the line items from this receipt.' },
            { type: 'image_url', image_url: { url: photoDataUrl, detail: 'high' } },
          ],
        },
      ],
      response_format: { type: 'json_schema', json_schema: { name: 'receipt', strict: true, schema: RECEIPT_SCHEMA } },
    }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e?.error?.message ?? `OpenAI vision call failed: ${res.status}`);
  }
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty response from model');
  const parsed = JSON.parse(content);
  const store = parsed.store ?? null;
  const items: ReceiptLineItem[] = (parsed.items as Omit<ReceiptLineItem, 'store'>[]).map((it) => ({
    ...it,
    store,
  }));
  return { store, purchasedAt: parsed.purchasedAt ?? null, currency: parsed.currency ?? null, items };
}

// ---------- Stage 2: web-search-backed nutrition lookup ----------

export interface WebNutrition {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  unit: 'item' | 'g' | 'ml';
  packGrams: number | null;
  source: 'web';
  citation: string | null; // url the model cited
  confidence: 'high' | 'medium' | 'low';
}

// Batched variant: one /v1/responses + web_search call for ALL unmatched items.
// Saves $0.01 × (N-1) per scan where N is the unmatched-items count, and the
// model can amortize the search content across queries. Per-item attribution
// is preserved because we ask the model to return a keyed object.
export async function lookupNutritionWithBrowsingBatch(
  apiKey: string,
  queries: Array<{ index: number; brand: string | null; name: string; packSize: string | null; store: string | null }>
): Promise<Record<number, WebNutrition | null>> {
  if (queries.length === 0) return {};
  const lines = queries.map((q) =>
    `[${q.index}] ${q.brand ?? 'unknown'} — ${q.name} (${q.packSize ?? 'unknown size'}) at ${q.store ?? 'unknown store'}`
  );
  const prompt = [
    `Find nutrition information for the following supermarket products. Use web search (prefer the official store/product pages) and return ONLY strict JSON.`,
    ``,
    `Products:`,
    ...lines,
    ``,
    `Return shape:`,
    `{`,
    `  "results": [`,
    `    {`,
    `      "index": <number from the list above>,`,
    `      "kcal": <number>,           // per 100g for packaged food; per item only when sold as a count (eggs)`,
    `      "protein": <number>,         // grams, same basis as kcal`,
    `      "carbs": <number>,`,
    `      "fat": <number>,`,
    `      "unit": "g" | "item" | "ml",`,
    `      "packGrams": <number | null>,`,
    `      "citation": <string | null>, // url you used`,
    `      "confidence": "high" | "medium" | "low"`,
    `    }, ...`,
    `  ]`,
    `}`,
    ``,
    `Include one entry per index. If you cannot find reliable info, set confidence="low" and your best estimate. JSON only — no commentary or markdown.`,
  ].join('\n');

  // Receipt scans of 30+ items can take a while when web_search is iterating.
  // 60s gives the tool enough room without holding the request open forever.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60000);
  let res: Response;
  try {
    res = await fetch(`${OPENAI}/v1/responses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: RECEIPT_LOOKUP_MODEL,
        tools: [{ type: 'web_search' }],
        input: prompt,
      }),
      signal: ctrl.signal,
    });
  } catch {
    clearTimeout(timer);
    return {};
  }
  clearTimeout(timer);
  if (!res.ok) return {};
  const data = await res.json();
  const text =
    typeof data.output_text === 'string'
      ? data.output_text
      : (data.output ?? [])
          .flatMap((o: { content?: Array<{ text?: string }> }) => o.content ?? [])
          .map((c: { text?: string }) => c?.text)
          .filter(Boolean)
          .join('\n');
  if (!text) return {};
  const json = extractJson(text);
  if (!json) return {};
  try {
    const parsed = JSON.parse(json) as { results: Array<Record<string, unknown>> };
    const out: Record<number, WebNutrition | null> = {};
    for (const r of parsed.results ?? []) {
      const idx = Number(r.index);
      if (!Number.isFinite(idx)) continue;
      out[idx] = {
        kcal: Number(r.kcal ?? 0),
        protein: Number(r.protein ?? 0),
        carbs: Number(r.carbs ?? 0),
        fat: Number(r.fat ?? 0),
        unit: ((r.unit as string) === 'item' || r.unit === 'ml' || r.unit === 'g' ? r.unit : 'g') as 'g' | 'item' | 'ml',
        packGrams: r.packGrams != null ? Number(r.packGrams) : null,
        source: 'web',
        citation: (r.citation as string | null) ?? null,
        confidence: ((r.confidence as string) === 'high' || r.confidence === 'medium' ? r.confidence : 'low') as 'high' | 'medium' | 'low',
      };
    }
    return out;
  } catch {
    return {};
  }
}

// Single-item variant — kept for callers that want per-item attribution and
// are OK paying $0.01 per call. New code should prefer the batch version.
export async function lookupNutritionWithBrowsing(
  apiKey: string,
  query: { brand: string | null; name: string; packSize: string | null; store: string | null }
): Promise<WebNutrition | null> {
  const prompt = [
    `Find the nutrition information for this supermarket product:`,
    `- Brand: ${query.brand ?? 'unknown'}`,
    `- Product: ${query.name}`,
    `- Pack size: ${query.packSize ?? 'unknown'}`,
    `- Store: ${query.store ?? 'unknown'}`,
    ``,
    `Search the web (prefer the official store/product page) and return strict JSON only:`,
    `{`,
    `  "kcal": number,           // per 100g if a packaged food; per item only if it is sold as a count (e.g. eggs)`,
    `  "protein": number,         // grams, same basis as kcal`,
    `  "carbs": number,`,
    `  "fat": number,`,
    `  "unit": "g" | "item" | "ml",`,
    `  "packGrams": number | null,`,
    `  "citation": string | null, // the URL you used`,
    `  "confidence": "high" | "medium" | "low"`,
    `}`,
    `If you cannot find reliable nutrition info, return {"confidence":"low","citation":null,...} with your best estimate.`,
    `Do not include any commentary or markdown — JSON only.`,
  ].join('\n');

  // Hard 22s timeout. Some items in testing took 100+s; we'd rather fall
  // through to estimate than hang the whole pipeline on one slow query.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 22000);
  let res: Response;
  try {
    res = await fetch(`${OPENAI}/v1/responses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: RECEIPT_LOOKUP_MODEL,
        tools: [{ type: 'web_search' }],
        input: prompt,
      }),
      signal: ctrl.signal,
    });
  } catch {
    clearTimeout(timer);
    return null;
  }
  clearTimeout(timer);
  if (!res.ok) return null;
  const data = await res.json();
  // Responses API: pull the final assistant text out of `output_text` if
  // present, else walk `output[].content[].text`.
  const text =
    typeof data.output_text === 'string'
      ? data.output_text
      : (data.output ?? [])
          .flatMap((o: { content?: Array<{ text?: string }> }) => o.content ?? [])
          .map((c: { text?: string }) => c?.text)
          .filter(Boolean)
          .join('\n');
  if (!text) return null;
  const json = extractJson(text);
  if (!json) return null;
  try {
    const parsed = JSON.parse(json);
    return {
      kcal: Number(parsed.kcal ?? 0),
      protein: Number(parsed.protein ?? 0),
      carbs: Number(parsed.carbs ?? 0),
      fat: Number(parsed.fat ?? 0),
      unit: (parsed.unit as 'g' | 'item' | 'ml') ?? 'g',
      packGrams: parsed.packGrams != null ? Number(parsed.packGrams) : null,
      source: 'web',
      citation: parsed.citation ?? null,
      confidence: (parsed.confidence as 'high' | 'medium' | 'low') ?? 'low',
    };
  } catch {
    return null;
  }
}

// ---------- Stage 3: judge ----------

export interface JudgedItem {
  index: number;
  ok: boolean;
  reason: string | null; // why it's wrong, if not ok
}

const JUDGE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    verdicts: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          index: { type: 'integer' },
          ok: { type: 'boolean' },
          reason: { type: ['string', 'null'] },
        },
        required: ['index', 'ok', 'reason'],
      },
    },
  },
  required: ['verdicts'],
};

const JUDGE_SYSTEM = `You are a calorie/macro sanity checker. Given a list of supermarket products with their estimated nutrition, flag any whose values look implausible for the product type and pack size. Examples of bad: 0 kcal for a butter pack, 1500 kcal/100g for a vegetable, protein > carbs+fat for sugar, fat in plain water. If you would not eat from this estimate without a second opinion, mark it not ok and give a short reason. Otherwise mark ok with reason null.`;

export async function judgeNutrition(
  apiKey: string,
  items: Array<{ name: string; brand: string | null; kcal: number; protein: number; carbs: number; fat: number; unit: string; packGrams: number | null }>
): Promise<JudgedItem[]> {
  if (items.length === 0) return [];
  const enumerated = items.map((it, i) => ({ index: i, ...it }));
  const res = await fetch(`${OPENAI}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: RECEIPT_JUDGE_MODEL,
      messages: [
        { role: 'system', content: JUDGE_SYSTEM },
        { role: 'user', content: JSON.stringify(enumerated) },
      ],
      response_format: { type: 'json_schema', json_schema: { name: 'judge', strict: true, schema: JUDGE_SCHEMA } },
    }),
  });
  if (!res.ok) return items.map((_, i) => ({ index: i, ok: true, reason: null }));
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) return items.map((_, i) => ({ index: i, ok: true, reason: null }));
  try {
    const parsed = JSON.parse(content) as { verdicts: JudgedItem[] };
    return parsed.verdicts;
  } catch {
    return items.map((_, i) => ({ index: i, ok: true, reason: null }));
  }
}

// ---------- helpers ----------

// Strip code fences and isolate the first JSON object in a string. The
// /v1/responses output usually arrives clean, but the web_search tool sometimes
// wraps it in markdown.
function extractJson(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) return text.slice(start, end + 1);
  return null;
}
