// Three-stage AI pipeline for receipt → pantry. All stages use GPT-5.5.
// Stage 1: vision OCR + line-item normalization from a receipt photo.
// Stage 2: web-search-backed nutrition lookup for items OFF couldn't resolve.
// Stage 3: a "judge" pass that flags individual items whose macros look wrong.
//
// Stages 2 and 3 use OpenAI's Responses API with the built-in `web_search`
// tool. The chat completions endpoint doesn't expose tools the same way, so
// we hit /v1/responses directly.

const OPENAI = 'https://api.openai.com';

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
      model: 'gpt-5.5',
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

// We ask one item at a time so the model can cite a specific source URL per
// product. Batched calls would be cheaper but harder to attribute.
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

  const res = await fetch(`${OPENAI}/v1/responses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-5.5',
      tools: [{ type: 'web_search' }],
      input: prompt,
    }),
  });
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
      model: 'gpt-5.5',
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
