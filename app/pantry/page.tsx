'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import BottomNav from '@/components/ui/BottomNav';
import Card from '@/components/ui/Card';
import { ChevronDown, ChevronUp, ExternalLink, Database, Sparkles, ShieldCheck, ShoppingBasket, Receipt as ReceiptIcon, AlertTriangle, Trash2 } from 'lucide-react';
import type { ReceiptGroup, ReceiptItem } from '@/lib/db';

const SOURCE_BADGE: Record<string, { label: string; tone: string; icon: React.ReactNode }> = {
  off:      { label: 'Open Food Facts', tone: 'bg-green-50 text-green-700 border-green-200',     icon: <Database className="w-3 h-3" /> },
  web:      { label: 'Web',              tone: 'bg-blue-50 text-blue-700 border-blue-200',         icon: <Sparkles className="w-3 h-3" /> },
  estimate: { label: 'Estimate',         tone: 'bg-amber-50 text-amber-700 border-amber-200',     icon: <ShieldCheck className="w-3 h-3" /> },
  manual:   { label: 'Manual',           tone: 'bg-gray-50 text-text-secondary border-border-light', icon: <ShoppingBasket className="w-3 h-3" /> },
};

export default function PantryPage() {
  const { data: session } = useSession();
  const [groups, setGroups] = useState<ReceiptGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [openIdx, setOpenIdx] = useState<number | null>(0); // most recent open by default
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!session?.user) return;
    let cancelled = false;
    fetch('/api/pantry/receipts')
      .then((r) => (r.ok ? r.json() : { groups: [] }))
      .then((data) => {
        if (cancelled) return;
        setGroups(data.groups || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
    return () => { cancelled = true; };
  }, [session]);

  const handleDelete = async (itemId: string) => {
    const prev = groups;
    // optimistic: drop the item, drop empty groups
    setGroups((gs) =>
      gs
        .map((g) => ({ ...g, items: g.items.filter((it) => it.id !== itemId) }))
        .map((g) => ({
          ...g,
          itemCount: g.items.reduce((s, it) => s + it.qty, 0),
          totalKcal: g.items.reduce((s, it) => s + (it.kcalPerUnit != null ? it.kcalPerUnit * it.qty : 0), 0),
        }))
        .filter((g) => g.items.length > 0)
    );
    try {
      const r = await fetch(`/api/pantry/items/${itemId}`, { method: 'DELETE' });
      if (!r.ok) throw new Error('delete failed');
    } catch {
      setGroups(prev);
    }
  };

  return (
    <main className="min-h-screen pb-24">
      <header
        className="bg-white px-4 pb-3 sticky top-0 z-40 shadow-sm"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
      >
        <h1 className="text-2xl font-bold text-text-primary">Pantry</h1>
        <p className="text-xs text-text-secondary mt-0.5">Past receipts · scan a new one from the + tab</p>
      </header>

      <div className="px-4 py-4 space-y-4 page-transition">
        {!mounted || loading ? (
          <PantrySkeleton />
        ) : groups.length === 0 ? (
          <Card>
            <div className="py-8 flex flex-col items-center text-center">
              <ReceiptIcon className="w-8 h-8 text-text-secondary mb-2" />
              <p className="text-sm text-text-secondary">No receipts yet.</p>
              <p className="text-xs text-text-secondary mt-1">Tap the <span className="font-semibold">+</span> tab → Scan a receipt to import one.</p>
            </div>
          </Card>
        ) : (
          groups.map((g, idx) => (
            <ReceiptCard
              key={`${g.store ?? '_'}-${g.purchasedAt}-${idx}`}
              group={g}
              isOpen={openIdx === idx}
              onToggle={() => setOpenIdx(openIdx === idx ? null : idx)}
              onDeleteItem={handleDelete}
            />
          ))
        )}
      </div>

      <BottomNav />
    </main>
  );
}

function ReceiptCard({ group, isOpen, onToggle, onDeleteItem }: { group: ReceiptGroup; isOpen: boolean; onToggle: () => void; onDeleteItem: (id: string) => void }) {
  const date = new Date(group.purchasedAt);
  const dateLabel = isFinite(date.getTime())
    ? date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
    : 'Unknown date';

  return (
    <Card>
      <button onClick={onToggle} className="w-full flex items-center justify-between text-left">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <ReceiptIcon className="w-4 h-4 text-accent-blue shrink-0" />
            <h3 className="font-semibold text-text-primary truncate">{group.store ?? 'Receipt'}</h3>
          </div>
          <p className="text-xs text-text-secondary mt-0.5">
            {dateLabel} · {group.itemCount} item{group.itemCount === 1 ? '' : 's'}
            {group.totalKcal > 0 ? ` · ~${Math.round(group.totalKcal)} kcal total` : ''}
          </p>
        </div>
        {isOpen ? <ChevronUp className="w-5 h-5 text-text-secondary" /> : <ChevronDown className="w-5 h-5 text-text-secondary" />}
      </button>

      {isOpen && (
        <div className="mt-3 -mx-1">
          <ul className="divide-y divide-border-light">
            {group.items.map((it) => (
              <ItemRow key={it.id} item={it} onDelete={() => onDeleteItem(it.id)} />
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function ItemRow({ item, onDelete }: { item: ReceiptItem; onDelete: () => void }) {
  const meta = SOURCE_BADGE[item.nutritionSource ?? 'manual'] ?? SOURCE_BADGE.manual;
  const totalKcal =
    item.kcalPerUnit != null ? Math.round(item.kcalPerUnit * item.qty) : null;
  const stale = item.qtyRemaining <= 0;
  const [confirming, setConfirming] = useState(false);
  return (
    <li className="py-2.5 px-1">
      <div className="flex items-start gap-2.5">
        {item.productImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.productImageUrl} alt="" className="w-10 h-10 rounded-md object-cover bg-secondary-bg shrink-0" />
        ) : (
          <div className="w-10 h-10 rounded-md bg-secondary-bg shrink-0 flex items-center justify-center">
            <ShoppingBasket className="w-4 h-4 text-text-secondary" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <p className={`text-sm font-medium truncate ${stale ? 'text-text-secondary line-through' : 'text-text-primary'}`}>
              {item.normalizedName}
            </p>
            {totalKcal != null && (
              <span className="text-sm font-semibold text-text-primary shrink-0">{totalKcal} kcal</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-[11px] text-text-secondary">
              {item.qty}× {item.unit}
              {item.kcalPerUnit != null ? ` · ${Math.round(item.kcalPerUnit)} kcal${item.unit === 'g' ? '/100g' : item.unit === 'ml' ? '/100ml' : ''}` : ''}
            </span>
            <span className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-full border ${meta.tone}`}>
              {meta.icon}
              {meta.label}
              {item.nutritionConfidence ? <span className="opacity-60">· {item.nutritionConfidence}</span> : null}
            </span>
            {item.nutritionCitation && (
              <a
                href={item.nutritionCitation}
                target="_blank"
                rel="noreferrer"
                className="text-[10px] text-accent-blue inline-flex items-center gap-0.5 truncate max-w-[160px]"
              >
                source <ExternalLink className="w-2.5 h-2.5 shrink-0" />
              </a>
            )}
            {item.nutritionSource === 'estimate' && (
              <span className="inline-flex items-center gap-1 text-[10px] text-amber-700">
                <AlertTriangle className="w-3 h-3" />
                low confidence
              </span>
            )}
          </div>
        </div>
        {confirming ? (
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={onDelete}
              className="text-[11px] font-semibold text-red-600 px-2 py-1 rounded-md bg-red-50 hover:bg-red-100"
              aria-label={`Confirm delete ${item.normalizedName}`}
            >
              Delete
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="text-[11px] text-text-secondary px-2 py-1 rounded-md hover:bg-secondary-bg"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="shrink-0 p-1.5 rounded-md text-text-secondary hover:text-red-600 hover:bg-red-50"
            aria-label={`Delete ${item.normalizedName}`}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </li>
  );
}

function PantrySkeleton() {
  return (
    <>
      {[0, 1].map((i) => (
        <Card key={i}>
          <div className="skeleton h-5 w-40 rounded-md mb-2" />
          <div className="skeleton h-3 w-56 rounded-md" />
          <div className="mt-3 space-y-2">
            {[0, 1, 2].map((j) => <div key={j} className="skeleton h-12 rounded-apple" />)}
          </div>
        </Card>
      ))}
    </>
  );
}
