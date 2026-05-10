'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useProfile } from '@/hooks/useProfile';
import { useFoodEntries } from '@/hooks/useFoodEntries';
import { MealType, FoodSuggestion } from '@/lib/types';
import BottomNav from '@/components/ui/BottomNav';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import SuggestionsRail from '@/components/food/SuggestionsRail';
import ProcessingTray from '@/components/food/ProcessingTray';
import ClarifyCard from '@/components/food/ClarifyCard';
import ReceiptCapture from '@/components/pantry/ReceiptCapture';
import ReceiptReview, { ReviewItem } from '@/components/pantry/ReceiptReview';
import PortionSheet, { ScaledPortion } from '@/components/food/PortionSheet';
import { AlertTriangle, ChevronLeft, ChevronRight, Calendar, Camera, Image as ImageIcon, X, Check, Receipt, Loader2 } from 'lucide-react';
import type { BulkPantryInput } from '@/lib/db';

// Sentinel stored in `notes` to mark a "Just curious" entry. The DB schema
// has no status enum value for this, so the notes field doubles as the marker.
// MealSection reads this exact string and renders the row distinctly.
const CONSIDERING_MARKER = '__considering__';

const formatDate = (date: Date): string => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

const getDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const suggestMealType = (): MealType => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11) return 'breakfast';
  if (hour >= 11 && hour < 15) return 'lunch';
  if (hour >= 17 && hour < 21) return 'dinner';
  return 'snack';
};

type Intent = 'eating' | 'curious';

type ReceiptStage = 'idle' | 'capture' | 'parsing' | 'review';

export default function AddFood() {
  const { profile } = useProfile();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const { entries, logAsync, add, remove, update, answerClarification } = useFoodEntries(getDateString(selectedDate));

  const [error, setError] = useState<string | null>(null);
  const [selectedMealType, setSelectedMealType] = useState<MealType>(suggestMealType());
  const [description, setDescription] = useState('');
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [intent, setIntent] = useState<Intent>('eating');
  const [confirmation, setConfirmation] = useState<string | null>(null);
  // Tracks quick-added entries (suggestion chip taps) so the user can spot a
  // mistake and remove it without hunting through the day's full list.
  // Persists for the lifetime of this page view; clears on date change.
  const [recentlyAdded, setRecentlyAdded] = useState<Array<{ id: string; name: string; calories: number; pending?: boolean; failed?: boolean }>>([]);

  useEffect(() => {
    setRecentlyAdded([]);
  }, [selectedDate]);

  // Keep the strip in sync with entry status: a pending logAsync row gets its
  // real name/calories once the worker resolves it, and falls into a failed
  // state if the worker errors. We match by id so reordering doesn't matter.
  useEffect(() => {
    setRecentlyAdded((prev) => {
      if (prev.length === 0) return prev;
      let changed = false;
      const next = prev.map((r) => {
        const e = entries.find((x) => x.id === r.id);
        if (!e) return r;
        const status = e.status ?? 'resolved';
        if (status === 'resolved' && (r.pending || r.name !== e.name || r.calories !== (e.calories ?? 0))) {
          changed = true;
          return { id: r.id, name: e.name || r.name, calories: e.calories ?? 0, pending: false };
        }
        if (status === 'failed' && !r.failed) {
          changed = true;
          return { ...r, failed: true, pending: false };
        }
        return r;
      });
      return changed ? next : prev;
    });
  }, [entries]);

  // Receipt-scan state lives inside this page so the entire flow stays in /add-food.
  const [receiptStage, setReceiptStage] = useState<ReceiptStage>('idle');
  const [receiptItems, setReceiptItems] = useState<ReviewItem[]>([]);
  const [receiptStore, setReceiptStore] = useState<string | null>(null);
  const [receiptDate, setReceiptDate] = useState<string | null>(null);
  // Pantry chip portion picker. Opens the bottom-sheet when a pantry chip
  // is tapped so the user can pick "half / whole / 100g / etc.".
  const [portionItem, setPortionItem] = useState<FoodSuggestion | null>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSelectedMealType(suggestMealType());
  }, []);

  const goToPreviousDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 1);
    setSelectedDate(newDate);
  };

  const goToNextDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 1);
    if (newDate <= new Date()) setSelectedDate(newDate);
  };

  const isToday = selectedDate.toDateString() === new Date().toDateString();

  const flashConfirmation = useCallback((msg: string) => {
    setConfirmation(msg);
    setTimeout(() => setConfirmation(null), 2200);
  }, []);

  const processFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Image is too large. Please select an image under 10MB.');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const img = new Image();
      img.onload = () => {
        const maxDimension = 1920;
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = (height / width) * maxDimension;
            width = maxDimension;
          } else {
            width = (width / height) * maxDimension;
            height = maxDimension;
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            setPhotoDataUrl(canvas.toDataURL('image/jpeg', 0.85));
            return;
          }
        }
        setPhotoDataUrl(result);
      };
      img.onerror = () => setError('Failed to process image. Please try another file.');
      img.src = result;
    };
    reader.onerror = () => setError('Failed to read file. Please try again.');
    reader.readAsDataURL(file);
  }, []);

  const onCameraChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  };

  const onGalleryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  };

  // One-tap log from a suggestion chip — full nutrition is already known, so this
  // is a synchronous insert (no LLM call). Fastest path in the app.
  const handlePickSuggestion = async (s: FoodSuggestion) => {
    // Pantry chips open the portion sheet instead of logging immediately, so
    // the user can pick "half this pack" etc. The sheet's onConfirm completes
    // the actual log + decrement.
    if (s.source === 'pantry') {
      setPortionItem(s);
      return;
    }
    const created = await add({
      name: s.name,
      mealType: s.mealType,
      calories: s.calories,
      protein: s.protein,
      carbs: s.carbs,
      fat: s.fat,
      isManualEntry: false,
      date: getDateString(selectedDate),
      pantryItemId: s.pantryItemId,
      source: 'recent',
    });
    if (created?.id) {
      setRecentlyAdded((prev) => [
        { id: created.id, name: s.name, calories: s.calories },
        ...prev.filter((r) => r.id !== created.id),
      ]);
    }
    flashConfirmation(`Added ${s.name}`);
  };

  const handleUndoQuickAdd = async (id: string) => {
    setRecentlyAdded((prev) => prev.filter((r) => r.id !== id));
    await remove(id);
  };

  const canSubmit = (description.trim().length > 0 || photoDataUrl !== null);

  const handleAdd = async () => {
    if (!canSubmit) return;
    setError(null);

    const placeholder = description.trim() || (photoDataUrl ? 'Photo entry' : 'New entry');

    const pending = await logAsync({
      description: description.trim() || undefined,
      photoDataUrl: photoDataUrl || undefined,
      mealType: selectedMealType,
      date: getDateString(selectedDate),
    });

    // For "Just curious", flag the row right after creation. We can't pass a
    // status through logAsync (no enum value), so the notes sentinel is what
    // MealSection uses to render the row as considered-but-not-committed.
    if (pending && intent === 'curious') {
      await update(pending.id, { notes: CONSIDERING_MARKER });
    }

    if (pending?.id) {
      setRecentlyAdded((prev) => [
        { id: pending.id, name: placeholder, calories: 0, pending: true },
        ...prev.filter((r) => r.id !== pending.id),
      ]);
    }

    setDescription('');
    setPhotoDataUrl(null);
    flashConfirmation(intent === 'curious' ? 'Saved for review' : 'Added — processing…');
  };

  // Receipt scan flow ----------------------------------------------------------
  const handleReceiptCapture = async (dataUrl: string) => {
    setReceiptStage('parsing');
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
      setReceiptItems(items);
      setReceiptStore(store);
      setReceiptDate(purchasedAt);
      setReceiptStage('review');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Scan failed');
      setReceiptStage('capture');
    }
  };

  const handleReceiptConfirm = async (items: ReviewItem[]) => {
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
      purchasedAt: receiptDate,
      nutritionSource: it.nutritionSource,
      nutritionConfidence: it.nutritionConfidence,
      nutritionCitation: it.citation,
      productImageUrl: it.productImageUrl,
      packGrams: it.packGrams,
    }));
    const r = await fetch('/api/pantry/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: payload }),
    });
    if (r.ok) {
      flashConfirmation(`Added ${items.length} pantry items`);
      setReceiptItems([]);
      setReceiptStage('idle');
    } else {
      setError('Failed to save items');
    }
  };

  return (
    <main className="min-h-screen pb-32">
      <header
        className="bg-white px-4 pb-4 sticky top-0 z-40 shadow-sm"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
      >
        <h1 className="text-2xl font-bold text-text-primary mb-3">Add Food</h1>

        <div className="flex items-center justify-center gap-2 bg-secondary-bg rounded-apple p-2">
          <button onClick={goToPreviousDay} className="p-2 hover:bg-white rounded-full transition-colors">
            <ChevronLeft className="w-5 h-5 text-text-secondary" />
          </button>
          <div className="flex items-center gap-2 px-3">
            <Calendar className="w-4 h-4 text-accent-blue" />
            <span className={`font-medium ${isToday ? 'text-accent-blue' : 'text-text-primary'}`}>
              {formatDate(selectedDate)}
            </span>
          </div>
          <button
            onClick={goToNextDay}
            disabled={isToday}
            className={`p-2 rounded-full transition-colors ${isToday ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white'}`}
          >
            <ChevronRight className="w-5 h-5 text-text-secondary" />
          </button>
        </div>
      </header>

      <div className="px-4 py-4 page-transition space-y-4">
        {error && (
          <Card className="bg-accent-red/10 border border-accent-red/30">
            <p className="text-accent-red">{error}</p>
          </Card>
        )}

        {!profile?.openaiApiKey && (
          <Card className="bg-amber-50 border border-amber-200">
            <div className="flex gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-amber-800 font-medium">AI not configured</p>
                <p className="text-xs text-amber-700 mt-1">
                  Add your OpenAI API key in Profile to enable AI-powered logging.
                </p>
              </div>
            </div>
          </Card>
        )}

        <SuggestionsRail mealType={selectedMealType} onPick={handlePickSuggestion} />

        {recentlyAdded.length > 0 && (
          <Card className="bg-green-50/60 border border-green-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-text-primary">Just added</h3>
              <button
                onClick={() => setRecentlyAdded([])}
                className="text-xs text-text-secondary hover:text-text-primary"
              >
                Clear
              </button>
            </div>
            <ul className="space-y-1.5">
              {recentlyAdded.map((r) => (
                <li
                  key={r.id}
                  className={`flex items-center gap-2 px-3 py-2 bg-white rounded-apple border ${
                    r.failed ? 'border-red-200' : r.pending ? 'border-blue-100' : 'border-green-100'
                  }`}
                >
                  {r.failed ? (
                    <AlertTriangle className="w-4 h-4 text-accent-red shrink-0" />
                  ) : r.pending ? (
                    <Loader2 className="w-4 h-4 text-accent-blue animate-spin shrink-0" />
                  ) : (
                    <Check className="w-4 h-4 text-accent-green shrink-0" />
                  )}
                  <span className="flex-1 min-w-0 text-sm text-text-primary truncate">
                    {r.name}
                    {r.failed && <span className="text-xs text-accent-red ml-2">failed</span>}
                  </span>
                  {!r.pending && !r.failed && (
                    <span className="text-xs text-text-secondary shrink-0">{r.calories} kcal</span>
                  )}
                  {r.pending && (
                    <span className="text-xs text-text-secondary shrink-0">analyzing…</span>
                  )}
                  <button
                    onClick={() => handleUndoQuickAdd(r.id)}
                    className="ml-1 p-1.5 rounded-full text-accent-red hover:bg-red-50 active:bg-red-100 touch-manipulation"
                    aria-label={`Remove ${r.name}`}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-text-secondary mt-2">
              Tap × to undo. This list clears when you change the day.
            </p>
          </Card>
        )}

        {/* Receipt scan — entire flow stays inside /add-food. */}
        {receiptStage === 'idle' && (
          <div className="space-y-2">
            <button
              onClick={() => { setError(null); setReceiptStage('capture'); }}
              className="w-full p-3 bg-white rounded-apple-lg shadow-apple active:bg-secondary-bg flex items-center gap-3 touch-manipulation"
            >
              <div className="w-10 h-10 rounded-full bg-accent-green/10 flex items-center justify-center shrink-0">
                <Receipt className="w-5 h-5 text-accent-green" />
              </div>
              <div className="text-left flex-1 min-w-0">
                <h3 className="font-semibold text-text-primary text-sm">Scan a receipt</h3>
                <p className="text-xs text-text-secondary">Adds items to your pantry, then they show up here as quick chips.</p>
              </div>
              <ChevronRight className="w-4 h-4 text-text-secondary shrink-0" />
            </button>
            <a
              href="/pantry"
              className="block text-xs text-accent-blue text-center py-1 active:opacity-60"
            >
              View past receipts →
            </a>
          </div>
        )}

        {receiptStage === 'capture' && (
          <Card>
            <h2 className="font-semibold text-text-primary mb-1">Scan a receipt</h2>
            <p className="text-xs text-text-secondary mb-3">Lay it flat under good light. Vertical orientation works best.</p>
            <ReceiptCapture
              onCapture={handleReceiptCapture}
              onCancel={() => setReceiptStage('idle')}
            />
          </Card>
        )}

        {receiptStage === 'parsing' && (
          <Card>
            <div className="flex flex-col items-center py-8">
              <Loader2 className="w-8 h-8 text-accent-blue animate-spin mb-3" />
              <h3 className="font-semibold text-text-primary">Reading receipt…</h3>
              <p className="text-xs text-text-secondary mt-1 text-center max-w-xs">
                Extracting items, looking up nutrition on Open Food Facts, and falling back to web search for anything missing. Takes ~10-30s.
              </p>
            </div>
          </Card>
        )}

        {receiptStage === 'review' && (
          <Card>
            <ReceiptReview
              initial={receiptItems}
              store={receiptStore}
              purchasedAt={receiptDate}
              onConfirm={handleReceiptConfirm}
              onCancel={() => { setReceiptItems([]); setReceiptStage('idle'); }}
            />
          </Card>
        )}

        <Card>
          {/* Meal type selector */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            {(['breakfast', 'lunch', 'dinner', 'snack'] as MealType[]).map((type) => (
              <button
                key={type}
                onClick={() => setSelectedMealType(type)}
                className={`py-2 px-2 text-xs rounded-apple border-2 transition-all capitalize ${
                  selectedMealType === type
                    ? 'border-accent-blue bg-blue-50 text-accent-blue'
                    : 'border-border-light text-text-secondary'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          {/* Capture affordances */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <button
              onClick={() => cameraInputRef.current?.click()}
              className="flex flex-col items-center justify-center p-4 bg-secondary-bg rounded-apple-lg border-2 border-dashed border-border-light hover:border-accent-blue active:bg-gray-100 transition-all touch-manipulation"
            >
              <Camera className="w-7 h-7 mb-1 text-accent-blue" />
              <span className="text-sm font-medium text-text-primary">Take Photo</span>
            </button>
            <button
              onClick={() => galleryInputRef.current?.click()}
              className="flex flex-col items-center justify-center p-4 bg-secondary-bg rounded-apple-lg border-2 border-dashed border-border-light hover:border-accent-blue active:bg-gray-100 transition-all touch-manipulation"
            >
              <ImageIcon className="w-7 h-7 mb-1 text-accent-purple" />
              <span className="text-sm font-medium text-text-primary">Choose Photo</span>
            </button>
          </div>

          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={onCameraChange}
            className="hidden"
          />
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            onChange={onGalleryChange}
            className="hidden"
          />

          {photoDataUrl && (
            <div className="relative mb-3 rounded-apple-lg overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoDataUrl} alt="Selected food" className="w-full h-48 object-cover" />
              <button
                onClick={() => setPhotoDataUrl(null)}
                className="absolute top-2 right-2 p-1.5 bg-black/50 rounded-full text-white hover:bg-black/70"
                aria-label="Remove photo"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what you ate (optional if you added a photo)"
            className="w-full px-4 py-3 bg-secondary-bg border border-border-light rounded-apple text-text-primary placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-accent-blue min-h-[88px] resize-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleAdd();
              }
            }}
          />

          {/* Intent toggle */}
          <div className="mt-4">
            <div className="grid grid-cols-2 gap-2 p-1 bg-secondary-bg rounded-apple">
              <button
                onClick={() => setIntent('eating')}
                className={`py-2 text-sm font-medium rounded-apple transition-all ${
                  intent === 'eating' ? 'bg-white text-accent-blue shadow-sm' : 'text-text-secondary'
                }`}
              >
                Eating it
              </button>
              <button
                onClick={() => setIntent('curious')}
                className={`py-2 text-sm font-medium rounded-apple transition-all ${
                  intent === 'curious' ? 'bg-white text-accent-purple shadow-sm' : 'text-text-secondary'
                }`}
              >
                Just curious
              </button>
            </div>
            <p className="text-xs text-text-secondary mt-2 text-center">
              {intent === 'eating'
                ? 'Logs this entry for the day.'
                : 'Saves a greyed-out preview without committing the calories.'}
            </p>
          </div>

          <div className="flex gap-3 mt-4">
            <Button onClick={handleAdd} fullWidth disabled={!canSubmit} className="flex items-center justify-center gap-2">
              <Check className="w-4 h-4" />
              Add it
            </Button>
          </div>

          {confirmation && (
            <div className="mt-3 text-center text-sm text-accent-green">{confirmation}</div>
          )}
        </Card>

        {/* Inline clarifications: any entry the worker came back with a
            follow-up question for shows up here so the user can answer it
            without leaving /add-food. The dashboard still mirrors these via
            ClarifySheet. */}
        {entries
          .filter((e) => e.status === 'needs_clarification' && !!e.clarifyingQuestion)
          .map((e) => (
            <ClarifyCard
              key={e.id}
              entry={e}
              onAnswer={(ans) => answerClarification(e.id, ans)}
              onDismiss={() => remove(e.id)}
            />
          ))}
      </div>

      <ProcessingTray
        entries={entries}
        onRemove={(id) => {
          remove(id);
        }}
      />

      {portionItem && (
        <PortionSheet
          item={portionItem}
          onClose={() => setPortionItem(null)}
          onConfirm={async (portion: ScaledPortion) => {
            const created = await add({
              name: `${portionItem.name} (${portion.label})`,
              mealType: portionItem.mealType,
              calories: portion.calories,
              protein: portion.protein,
              carbs: portion.carbs,
              fat: portion.fat,
              isManualEntry: false,
              date: getDateString(selectedDate),
              pantryItemId: portionItem.pantryItemId,
              source: 'pantry',
              // Server reads this off the body and decrements pantry stock
              // by exactly this much; not stored on the entry row itself.
              pantryConsumeUnits: portion.units,
            } as Parameters<typeof add>[0] & { pantryConsumeUnits?: number });
            if (created?.id) {
              setRecentlyAdded((prev) => [
                { id: created.id, name: portionItem.name, calories: portion.calories },
                ...prev.filter((r) => r.id !== created.id),
              ]);
            }
            flashConfirmation(`Added ${portionItem.name} (${portion.label}) — ${portion.calories} kcal`);
            setPortionItem(null);
          }}
        />
      )}

      <BottomNav />
    </main>
  );
}
