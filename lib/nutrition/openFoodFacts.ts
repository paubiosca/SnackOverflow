// Open Food Facts is a free crowd-sourced product database with strong UK
// coverage. We hit the legacy CGI search API because it's the only one that
// doesn't require an API key and supports text search across brand+product.
// Docs: https://openfoodfacts.github.io/openfoodfacts-server/api/

const OFF_BASE = 'https://world.openfoodfacts.org';

export interface OffMatch {
  productName: string;
  brand: string | null;
  // kcal/macros per unit (typically per item or per the full pack — see `unit`).
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  unit: 'item' | 'g' | 'ml';
  packGrams?: number; // total grams in the package, if known
  packServings?: number; // number of servings the package contains
  imageUrl?: string;
  source: 'openfoodfacts';
  matchScore: number; // 0..1; higher = more confident the product matches the query
  productCode?: string;
}

interface OffProduct {
  code?: string;
  product_name?: string;
  product_name_en?: string;
  brands?: string;
  countries_tags?: string[];
  image_front_thumb_url?: string;
  serving_size?: string; // free-text, e.g. "100 g" or "1 slice (28 g)"
  serving_quantity?: number; // grams per serving when known
  product_quantity?: number; // total pack grams
  nutriments?: {
    'energy-kcal_100g'?: number;
    'energy-kcal_serving'?: number;
    proteins_100g?: number;
    proteins_serving?: number;
    carbohydrates_100g?: number;
    carbohydrates_serving?: number;
    fat_100g?: number;
    fat_serving?: number;
  };
}

// Token-overlap match score weighted toward brand presence. We don't try too
// hard here — if it's ambiguous we'd rather fall through to the GPT path than
// pick the wrong brand and quietly mislead the user.
function scoreMatch(query: string, product: OffProduct): number {
  const q = query.toLowerCase().trim();
  const name = (product.product_name_en || product.product_name || '').toLowerCase();
  const brand = (product.brands || '').toLowerCase();

  if (!name && !brand) return 0;

  const qTokens = new Set(q.split(/\s+/).filter((t) => t.length > 1));
  const nameTokens = new Set(name.split(/\s+/).filter((t) => t.length > 1));
  const brandTokens = new Set(brand.split(/[,\s]+/).filter((t) => t.length > 1));

  let nameMatches = 0;
  Array.from(qTokens).forEach((t) => { if (nameTokens.has(t)) nameMatches++; });
  let brandMatches = 0;
  Array.from(qTokens).forEach((t) => { if (brandTokens.has(t)) brandMatches++; });

  const nameScore = qTokens.size === 0 ? 0 : nameMatches / qTokens.size;
  const brandBoost = brandMatches > 0 ? 0.25 : 0;
  // Prefer UK products since that's where the user shops.
  const ukBoost = product.countries_tags?.includes('en:united-kingdom') ? 0.05 : 0;
  return Math.min(1, nameScore + brandBoost + ukBoost);
}

function pickNutritionUnit(product: OffProduct): {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  unit: OffMatch['unit'];
  packGrams?: number;
  packServings?: number;
} | null {
  const n = product.nutriments;
  if (!n) return null;

  // Prefer per-100g (more reliably populated). We'll express the pantry item
  // in grams and let the consumer scale to whatever portion the user logs.
  const kcal100 = n['energy-kcal_100g'];
  const protein100 = n.proteins_100g;
  const carbs100 = n.carbohydrates_100g;
  const fat100 = n.fat_100g;

  if (kcal100 != null && (protein100 != null || carbs100 != null || fat100 != null)) {
    return {
      kcal: kcal100,
      protein: protein100 ?? 0,
      carbs: carbs100 ?? 0,
      fat: fat100 ?? 0,
      unit: 'g',
      packGrams: product.product_quantity ?? undefined,
      packServings:
        product.product_quantity && product.serving_quantity
          ? Math.max(1, Math.round(product.product_quantity / product.serving_quantity))
          : undefined,
    };
  }

  // Fall back to per-serving if 100g wasn't recorded.
  const kcalS = n['energy-kcal_serving'];
  if (kcalS != null) {
    return {
      kcal: kcalS,
      protein: n.proteins_serving ?? 0,
      carbs: n.carbohydrates_serving ?? 0,
      fat: n.fat_serving ?? 0,
      unit: 'item',
      packGrams: product.product_quantity ?? undefined,
    };
  }

  return null;
}

export async function lookupOpenFoodFacts(query: string, opts?: { country?: string }): Promise<OffMatch | null> {
  const country = opts?.country ?? 'united-kingdom';
  const params = new URLSearchParams({
    search_terms: query,
    search_simple: '1',
    action: 'process',
    json: '1',
    page_size: '5',
    fields:
      'code,product_name,product_name_en,brands,countries_tags,image_front_thumb_url,serving_size,serving_quantity,product_quantity,nutriments',
  });
  // OFF supports filtering by tag via `tagtype_X` / `tag_contains_X` / `tag_X`.
  // Use the simpler `countries_tags_en` filter via search_terms is unreliable,
  // so we apply the country boost in `scoreMatch` instead and pass through.
  // (Server-side filtering can over-restrict when products lack country tags.)

  const url = `${OFF_BASE}/cgi/search.pl?${params.toString()}`;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        // OFF asks API users to identify themselves so they can rate-limit
        // abuse separately from the public website.
        'User-Agent': 'SnackOverflow/0.1 (+https://github.com/paubiosca/SnackOverflow)',
      },
      // Fail fast — if OFF is slow we'll fall through to the GPT path.
      signal: AbortSignal.timeout(4000),
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;

  let data: { products?: OffProduct[] };
  try {
    data = (await res.json()) as { products?: OffProduct[] };
  } catch {
    return null;
  }
  const products = data.products ?? [];
  if (products.length === 0) return null;

  let best: { product: OffProduct; score: number } | null = null;
  for (const p of products) {
    const score = scoreMatch(query, p);
    if (!best || score > best.score) best = { product: p, score };
  }
  // Reject weak matches outright. 0.4 is empirical: random products on UK
  // shelves rarely overlap that many tokens with a typed query unless they're
  // genuinely the same SKU or close.
  if (!best || best.score < 0.4) return null;

  const nut = pickNutritionUnit(best.product);
  if (!nut) return null;

  void country; // currently unused at the request level; reserved for future server-side filter

  return {
    productName: best.product.product_name_en || best.product.product_name || query,
    brand: best.product.brands ?? null,
    kcal: round1(nut.kcal),
    protein: round1(nut.protein),
    carbs: round1(nut.carbs),
    fat: round1(nut.fat),
    unit: nut.unit,
    packGrams: nut.packGrams,
    packServings: nut.packServings,
    imageUrl: best.product.image_front_thumb_url,
    productCode: best.product.code,
    source: 'openfoodfacts',
    matchScore: round2(best.score),
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
