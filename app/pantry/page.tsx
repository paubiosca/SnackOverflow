'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import BottomNav from '@/components/ui/BottomNav';
import Card from '@/components/ui/Card';
import ReceiptCapture from '@/components/pantry/ReceiptCapture';
import ReceiptReview, { ReviewItem } from '@/components/pantry/ReceiptReview';
import { Loader2, Receipt, ShoppingBasket } from 'lucide-react';
import type { PantryItem } from '@/lib/types';
import type { BulkPantryInput } from '@/lib/db';

type Stage = 'list' | 'capture' | 'parsing' | 'review';

export default function PantryPage() {
  const { data: session } = useSession();
  const [stage, setStage] = useState<Stage>('list');
  const [pantry, setPantry] = useState<PantryItem[]>([]);
  const [parsedItems, setParsedItems] = useState<ReviewItem[]>([]);
  const [parsedStore, setParsedStore] = useState<string | null>(null);
  const [parsedDate, setParsedDate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const loadPantry = async () => {
    const r = await fetch('/api/pantry/items');
    if (r.ok) {
      const { items } = await r.json();
      setPantry(items || []);
    }
  };
  useEffect(() => { if (session?.user) loadPantry(); }, [session]);

  const handleScan = async (dataUrl: string) => {
    setStage('parsing');
    setError(null);
    try {
      const r = await fetch('/api/pantry/import-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoDataUrl: dataUrl }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e?.error ?? `Scan failed: ${r.status}`);
      }
      const { items, store, purchasedAt } = await r.json();
      setParsedItems(items);
      setParsedStore(store);
      setParsedDate(purchasedAt);
      setStage('review');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Scan failed');
      setStage('capture');
    }
  };

  const handleConfirm = async (items: ReviewItem[]) => {
    const payload: BulkPantryInput[] = items.map((it) => ({
      rawText: it.rawText,
      normalizedName: it.normalizedName,
      qtyTotal: it.qty,
      unit: it.unit,
      estCaloriesPerUnit: it.kcal,
      estProteinPerUnit: it.protein,
      estCarbsPerUnit: it.carbs,
      estFatPerUnit: it.fat,
      store: it.store,
      source: 'receipt',
      purchasedAt: parsedDate,
      nutritionSource: it.nutritionSource,
      nutritionConfidence: it.nutritionConfidence,
    }));
    const r = await fetch('/api/pantry/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: payload }),
    });
    if (r.ok) {
      await loadPantry();
      setParsedItems([]);
      setStage('list');
    } else {
      setError('Failed to save items');
    }
  };

  return (
    <main className="min-h-screen pb-24">
      <header
        className="bg-white px-4 pb-3 sticky top-0 z-40 shadow-sm"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
      >
        <h1 className="text-2xl font-bold text-text-primary">Pantry</h1>
      </header>

      <div className="px-4 py-4 space-y-4 page-transition">
        {error && (
          <Card className="bg-accent-red/10 border border-accent-red/30">
            <p className="text-sm text-accent-red">{error}</p>
          </Card>
        )}

        {stage === 'list' && (
          <>
            <Card>
              <button
                onClick={() => { setError(null); setStage('capture'); }}
                className="w-full flex items-center justify-between p-2 active:bg-secondary-bg rounded-apple"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-accent-blue/10 flex items-center justify-center">
                    <Receipt className="w-5 h-5 text-accent-blue" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-text-primary">Scan a receipt</h3>
                    <p className="text-xs text-text-secondary">Adds items to your pantry. Free Open Food Facts lookup + GPT-5.5 with web search.</p>
                  </div>
                </div>
              </button>
            </Card>

            <Card>
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-semibold text-text-primary">In stock</h2>
                <span className="text-xs text-text-secondary">{pantry.length} items</span>
              </div>
              {!mounted ? (
                <PantryListSkeleton />
              ) : pantry.length === 0 ? (
                <div className="py-8 flex flex-col items-center text-center">
                  <ShoppingBasket className="w-8 h-8 text-text-secondary mb-2" />
                  <p className="text-sm text-text-secondary">Your pantry is empty.</p>
                  <p className="text-xs text-text-secondary">Scan a receipt to populate it.</p>
                </div>
              ) : (
                <ul className="divide-y divide-border-light -mx-1">
                  {pantry.map((it) => (
                    <li key={it.id} className="flex items-center gap-3 py-2 px-1">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">{it.normalizedName}</p>
                        <p className="text-xs text-text-secondary">
                          {it.qtyRemaining}× {it.unit}
                          {it.store ? ` · ${it.store}` : ''}
                          {typeof it.estCaloriesPerUnit === 'number'
                            ? ` · ${Math.round(it.estCaloriesPerUnit)} kcal${it.unit === 'g' ? '/100g' : ''}`
                            : ''}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </>
        )}

        {stage === 'capture' && (
          <Card>
            <h2 className="font-semibold text-text-primary mb-2">Scan a receipt</h2>
            <p className="text-xs text-text-secondary mb-3">
              Lay it flat under good light. Vertical orientation works best.
            </p>
            <ReceiptCapture onCapture={handleScan} onCancel={() => setStage('list')} />
          </Card>
        )}

        {stage === 'parsing' && (
          <Card>
            <div className="flex flex-col items-center py-8">
              <Loader2 className="w-8 h-8 text-accent-blue animate-spin mb-3" />
              <h3 className="font-semibold text-text-primary">Reading receipt…</h3>
              <p className="text-xs text-text-secondary mt-1 text-center max-w-xs">
                Extracting items, looking up nutrition on Open Food Facts, and falling back to web search for anything missing. Takes ~10-30 seconds.
              </p>
            </div>
          </Card>
        )}

        {stage === 'review' && (
          <Card>
            <ReceiptReview
              initial={parsedItems}
              store={parsedStore}
              purchasedAt={parsedDate}
              onConfirm={handleConfirm}
              onCancel={() => { setParsedItems([]); setStage('list'); }}
            />
          </Card>
        )}
      </div>

      <BottomNav />
    </main>
  );
}

function PantryListSkeleton() {
  return (
    <ul className="space-y-2">
      {[0, 1, 2, 3].map((i) => (
        <li key={i} className="skeleton h-12 rounded-apple" />
      ))}
    </ul>
  );
}
