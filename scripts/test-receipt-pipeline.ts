import { config as loadEnv } from 'dotenv';
import path from 'path';
loadEnv({ path: path.join(__dirname, '../.env.local') });
import fs from 'fs';
import { sql } from '@vercel/postgres';
import { extractReceiptItems, lookupNutritionWithBrowsing, judgeNutrition } from '../lib/ai/receiptScan';
import { lookupOpenFoodFacts } from '../lib/nutrition/openFoodFacts';

const IMAGE_PATH = process.argv[2] || '/tmp/receipt-small.jpg';

(async () => {
  console.log('Reading', IMAGE_PATH);
  const buf = fs.readFileSync(IMAGE_PATH);
  const dataUrl = `data:image/jpeg;base64,${buf.toString('base64')}`;
  console.log('Image size:', (buf.length / 1024).toFixed(1), 'KB');

  const u = await sql`SELECT openai_api_key FROM profiles WHERE openai_api_key IS NOT NULL LIMIT 1`;
  const apiKey = u.rows[0]?.openai_api_key as string | undefined;
  if (!apiKey) { console.log('No OpenAI API key in DB.'); return; }

  // Stage 1: vision OCR
  console.log('\n[1/4] Vision OCR (gpt-5.5)...');
  const t1 = Date.now();
  const extracted = await extractReceiptItems(apiKey, dataUrl);
  console.log(`  done in ${((Date.now() - t1) / 1000).toFixed(1)}s — store=${extracted.store ?? '-'}, items=${extracted.items.length}`);
  for (const it of extracted.items.slice(0, 8)) {
    console.log(`   • ${it.rawText} → ${it.normalizedName} (${it.brand ?? '-'}, ${it.qty}× ${it.packSize ?? '-'}, ${it.category})`);
  }
  if (extracted.items.length > 8) console.log(`   ... and ${extracted.items.length - 8} more`);

  // Stage 2: OFF lookup
  console.log('\n[2/4] Open Food Facts lookup (parallel)...');
  const t2 = Date.now();
  const offResults = await Promise.all(
    extracted.items.map((it) => lookupOpenFoodFacts([it.brand, it.normalizedName].filter(Boolean).join(' ')))
  );
  console.log(`  done in ${((Date.now() - t2) / 1000).toFixed(1)}s`);
  let hits = 0;
  offResults.forEach((r, i) => {
    if (r) {
      hits++;
      console.log(`   ✓ ${extracted.items[i].normalizedName} → ${r.productName} (${r.kcal} kcal/${r.unit}, score=${r.matchScore})`);
    } else {
      console.log(`   - ${extracted.items[i].normalizedName} (no match)`);
    }
  });
  console.log(`  ${hits}/${offResults.length} OFF hits`);

  // Stage 3: web search fallback for misses
  console.log('\n[3/4] Web search fallback for misses...');
  const t3 = Date.now();
  const enriched: Array<{ name: string; kcal: number; protein: number; carbs: number; fat: number; unit: string; packGrams: number | null; brand: string | null; source: string; confidence: string; citation: string | null }> = [];
  for (let i = 0; i < extracted.items.length; i++) {
    const it = extracted.items[i];
    const off = offResults[i];
    if (off) {
      enriched.push({ name: it.normalizedName, brand: off.brand, kcal: off.kcal, protein: off.protein, carbs: off.carbs, fat: off.fat, unit: off.unit, packGrams: off.packGrams ?? null, source: 'off', confidence: off.matchScore >= 0.7 ? 'high' : 'medium', citation: off.productCode ? `https://world.openfoodfacts.org/product/${off.productCode}` : null });
      continue;
    }
    const ti = Date.now();
    const web = await lookupNutritionWithBrowsing(apiKey, { brand: it.brand, name: it.normalizedName, packSize: it.packSize, store: it.store });
    if (web) {
      console.log(`   web ${((Date.now() - ti) / 1000).toFixed(1)}s ${it.normalizedName} → ${web.kcal}/${web.unit} (${web.confidence})`);
      enriched.push({ name: it.normalizedName, brand: it.brand, kcal: web.kcal, protein: web.protein, carbs: web.carbs, fat: web.fat, unit: web.unit, packGrams: web.packGrams, source: web.confidence === 'low' ? 'estimate' : 'web', confidence: web.confidence, citation: web.citation });
    } else {
      console.log(`   web ${((Date.now() - ti) / 1000).toFixed(1)}s ${it.normalizedName} → null`);
      enriched.push({ name: it.normalizedName, brand: it.brand, kcal: 0, protein: 0, carbs: 0, fat: 0, unit: 'g', packGrams: null, source: 'estimate', confidence: 'low', citation: null });
    }
  }
  console.log(`  total ${((Date.now() - t3) / 1000).toFixed(1)}s`);

  // Stage 4: judge
  console.log('\n[4/4] Judge...');
  const t4 = Date.now();
  const verdicts = await judgeNutrition(
    apiKey,
    enriched.map((e) => ({ name: e.name, brand: e.brand, kcal: e.kcal, protein: e.protein, carbs: e.carbs, fat: e.fat, unit: e.unit, packGrams: e.packGrams }))
  );
  console.log(`  done in ${((Date.now() - t4) / 1000).toFixed(1)}s`);
  for (const v of verdicts) {
    if (!v.ok) console.log(`   ⚠ #${v.index} ${enriched[v.index].name}: ${v.reason}`);
  }

  console.log('\n=== ITEMS WITH CITATIONS ===');
  enriched.forEach((e, i) => {
    console.log(`${(i+1).toString().padStart(2)}. ${e.name.padEnd(34)} ${String(e.kcal).padStart(4)} kcal/${e.unit.padEnd(4)} P${e.protein} C${e.carbs} F${e.fat}  [${e.source}/${e.confidence}]${e.citation ? '  ' + e.citation : ''}`);
  });

  console.log('\n=== SUMMARY ===');
  console.log(`items: ${enriched.length}`);
  const counts = enriched.reduce((acc, e) => { acc[e.source] = (acc[e.source] || 0) + 1; return acc; }, {} as Record<string, number>);
  console.log('sources:', counts);
})().catch((e) => { console.error('FAILED:', e); process.exit(1); });
