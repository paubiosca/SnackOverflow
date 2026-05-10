import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getProfile } from '@/lib/db';
import { extractReceiptItems, lookupNutritionWithBrowsing, judgeNutrition } from '@/lib/ai/receiptScan';
import { lookupOpenFoodFacts } from '@/lib/nutrition/openFoodFacts';

// Receipt → enriched line items, ready for the user to review and confirm.
// Pipeline:
//   1. GPT-5.5 vision extracts line items from the receipt photo.
//   2. For each item, try Open Food Facts. If it returns a reasonable match
//      with nutrition, that's the source of truth.
//   3. For items OFF couldn't resolve, ask GPT-5.5 with web_search to fetch
//      nutrition from the official store/product page (cited).
//   4. Pure-LLM estimate fallback for the rest.
//   5. GPT-5.5 judge: review the whole list and flag suspicious values so the
//      user knows what to double-check.
//
// We don't write to the DB here — the user reviews the result on the next
// screen and confirms via POST /api/pantry/items.

// Long-running orchestrator. Locally there's no enforced ceiling; on Vercel
// Pro this is the cap. We aim to complete in ~30-60s thanks to parallelism +
// per-call timeouts, but allow headroom for tail latencies.
export const maxDuration = 300;

export interface EnrichedItem {
  rawText: string;
  normalizedName: string;
  brand: string | null;
  qty: number;
  packSize: string | null;
  packGrams: number | null;
  category: string;
  store: string | null;
  // Per-unit nutrition for what one purchased unit represents. If `unit === 'g'`
  // the per-unit numbers are per 100g (consumer scales when logging). If
  // `unit === 'item'` the numbers are for one packaged item.
  unit: 'g' | 'item' | 'ml';
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  // Provenance + confidence for the review UI.
  nutritionSource: 'off' | 'web' | 'estimate';
  nutritionConfidence: 'high' | 'medium' | 'low';
  citation: string | null;
  productImageUrl: string | null;
  // Judge verdict — null means no concern flagged.
  judgeReason: string | null;
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const profile = await getProfile(session.user.id);
  if (!profile?.openaiApiKey) {
    return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const photoDataUrl = body?.photoDataUrl as string | undefined;
  if (!photoDataUrl) {
    return NextResponse.json({ error: 'photoDataUrl is required' }, { status: 400 });
  }

  // Stage 1: vision OCR.
  const extracted = await extractReceiptItems(profile.openaiApiKey, photoDataUrl);
  const items = extracted.items;

  // Stage 2: Open Food Facts lookup, parallel.
  const offResults = await Promise.all(
    items.map((it) => lookupOpenFoodFacts([it.brand, it.normalizedName].filter(Boolean).join(' ')))
  );

  // Stage 3: GPT browsing for items OFF missed. Parallel with a concurrency
  // cap so we don't hammer OpenAI; per-call timeout in `lookupNutritionWithBrowsing`
  // means a single slow item can't stall the whole pipeline.
  const CONCURRENCY = 6;
  const missingIdx = items.map((_, i) => i).filter((i) => !offResults[i]);
  const webResults: Record<number, Awaited<ReturnType<typeof lookupNutritionWithBrowsing>>> = {};
  for (let start = 0; start < missingIdx.length; start += CONCURRENCY) {
    const slice = missingIdx.slice(start, start + CONCURRENCY);
    await Promise.all(
      slice.map(async (i) => {
        const item = items[i];
        webResults[i] = await lookupNutritionWithBrowsing(profile.openaiApiKey!, {
          brand: item.brand,
          name: item.normalizedName,
          packSize: item.packSize,
          store: item.store,
        });
      })
    );
  }

  const enriched: EnrichedItem[] = items.map((item, i) => {
    const off = offResults[i];
    if (off) {
      return {
        rawText: item.rawText,
        normalizedName: item.normalizedName,
        brand: item.brand ?? off.brand,
        qty: item.qty,
        packSize: item.packSize,
        packGrams: item.packGrams ?? off.packGrams ?? null,
        category: item.category,
        store: item.store,
        unit: off.unit,
        kcal: off.kcal,
        protein: off.protein,
        carbs: off.carbs,
        fat: off.fat,
        nutritionSource: 'off',
        nutritionConfidence: off.matchScore >= 0.7 ? 'high' : 'medium',
        citation: off.productCode ? `https://world.openfoodfacts.org/product/${off.productCode}` : null,
        productImageUrl: off.imageUrl ?? null,
        judgeReason: null,
      };
    }
    const web = webResults[i];
    if (web) {
      return {
        rawText: item.rawText,
        normalizedName: item.normalizedName,
        brand: item.brand,
        qty: item.qty,
        packSize: item.packSize,
        packGrams: item.packGrams ?? web.packGrams ?? null,
        category: item.category,
        store: item.store,
        unit: web.unit,
        kcal: web.kcal,
        protein: web.protein,
        carbs: web.carbs,
        fat: web.fat,
        nutritionSource: web.confidence === 'low' ? 'estimate' : 'web',
        nutritionConfidence: web.confidence,
        citation: web.citation,
        productImageUrl: null,
        judgeReason: null,
      };
    }
    // Estimate fallback (web call timed out or failed entirely).
    return {
      rawText: item.rawText,
      normalizedName: item.normalizedName,
      brand: item.brand,
      qty: item.qty,
      packSize: item.packSize,
      packGrams: item.packGrams,
      category: item.category,
      store: item.store,
      unit: 'g',
      kcal: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      nutritionSource: 'estimate',
      nutritionConfidence: 'low',
      citation: null,
      productImageUrl: null,
      judgeReason: 'Web lookup timed out — please fill in or remove.',
    };
  });

  // Stage 4: judge.
  if (enriched.length > 0) {
    const verdicts = await judgeNutrition(
      profile.openaiApiKey,
      enriched.map((e) => ({
        name: e.normalizedName,
        brand: e.brand,
        kcal: e.kcal,
        protein: e.protein,
        carbs: e.carbs,
        fat: e.fat,
        unit: e.unit,
        packGrams: e.packGrams,
      }))
    );
    for (const v of verdicts) {
      if (enriched[v.index] && !v.ok) {
        enriched[v.index].judgeReason = v.reason ?? 'Looks suspicious — please review.';
        // Demote confidence so the UI surfaces it visually.
        if (enriched[v.index].nutritionConfidence === 'high') {
          enriched[v.index].nutritionConfidence = 'medium';
        } else if (enriched[v.index].nutritionConfidence === 'medium') {
          enriched[v.index].nutritionConfidence = 'low';
        }
      }
    }
  }

  return NextResponse.json({
    store: extracted.store,
    purchasedAt: extracted.purchasedAt,
    currency: extracted.currency,
    items: enriched,
  });
}
