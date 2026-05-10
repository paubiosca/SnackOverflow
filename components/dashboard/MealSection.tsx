'use client';

import { useMemo } from 'react';
import { FoodEntry, MealType, MEAL_LABELS } from '@/lib/types';
import Card from '@/components/ui/Card';
import { Sunrise, Sun, Moon, Cookie, Trash2, ChevronDown, ChevronUp, Loader2, AlertCircle, XCircle, Utensils } from 'lucide-react';
import { ReactNode, useState } from 'react';

// Sentinel value the add-food page writes into `notes` for "Just curious"
// entries. Used here to render the row visually distinct (dashed/faded) and
// expose Eat-it / Discard inline actions. We piggy-back on `notes` because
// the schema has no separate enum value for this state.
const CONSIDERING_MARKER = '__considering__';
const isConsidering = (e: FoodEntry) => e.notes === CONSIDERING_MARKER;

// Visual indicator for the async lifecycle of an entry. The "where" is
// deliberate: the dot lives on the food card itself (Apple/iMessage-style),
// not as a global toast.
function StatusDot({ entry }: { entry: FoodEntry }) {
  const status = entry.status ?? 'resolved';
  if (status === 'pending') {
    return <Loader2 className="w-4 h-4 text-text-secondary animate-spin shrink-0" aria-label="Analyzing" />;
  }
  if (status === 'needs_clarification') {
    return <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" aria-label="Needs clarification" />;
  }
  if (status === 'failed') {
    return <XCircle className="w-4 h-4 text-accent-red shrink-0" aria-label="Failed" />;
  }
  return null;
}

const MEAL_ICONS: Record<MealType, ReactNode> = {
  breakfast: <Sunrise className="w-5 h-5 text-amber-500" />,
  lunch: <Sun className="w-5 h-5 text-yellow-500" />,
  dinner: <Moon className="w-5 h-5 text-indigo-500" />,
  snack: <Cookie className="w-5 h-5 text-orange-400" />,
};

interface MealSectionProps {
  mealType: MealType;
  entries: FoodEntry[];
  onDelete: (id: string) => void;
  onEdit?: (entry: FoodEntry) => void;
  onClarify?: (entry: FoodEntry) => void;
  onUpdate?: (id: string, updates: Partial<FoodEntry>) => void;
}

// Group entries that were logged within 30 minutes of each other
const groupEntriesByTime = (entries: FoodEntry[]): FoodEntry[][] => {
  if (entries.length === 0) return [];
  if (entries.length === 1) return [[entries[0]]];

  // Sort by createdAt (most recent first)
  const sorted = [...entries].sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bTime - aTime;
  });

  const groups: FoodEntry[][] = [];
  let currentGroup: FoodEntry[] = [sorted[0]];

  const TIME_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

  for (let i = 1; i < sorted.length; i++) {
    const prevTime = sorted[i - 1].createdAt ? new Date(sorted[i - 1].createdAt!).getTime() : 0;
    const currTime = sorted[i].createdAt ? new Date(sorted[i].createdAt!).getTime() : 0;

    // If entries are within 30 minutes, group them together
    if (prevTime && currTime && Math.abs(prevTime - currTime) <= TIME_WINDOW_MS) {
      currentGroup.push(sorted[i]);
    } else {
      groups.push(currentGroup);
      currentGroup = [sorted[i]];
    }
  }

  // Don't forget the last group
  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
};

interface MealGroupProps {
  entries: FoodEntry[];
  onDelete: (id: string) => void;
  onEdit?: (entry: FoodEntry) => void;
  onClarify?: (entry: FoodEntry) => void;
  onUpdate?: (id: string, updates: Partial<FoodEntry>) => void;
  isExpanded: boolean;
  onToggle: () => void;
}

// Tap routing: pending → no-op (the row is updating itself); needs_clarification →
// clarify sheet; resolved/failed → edit modal. Keeps a single tap target per card.
function handleEntryTap(
  entry: FoodEntry,
  onEdit?: (e: FoodEntry) => void,
  onClarify?: (e: FoodEntry) => void,
) {
  const status = entry.status ?? 'resolved';
  if (status === 'pending') return;
  if (status === 'needs_clarification') {
    onClarify?.(entry);
    return;
  }
  onEdit?.(entry);
}

function MealGroup({ entries, onDelete, onEdit, onClarify, onUpdate, isExpanded, onToggle }: MealGroupProps) {
  const groupCalories = entries.reduce((sum, e) => sum + e.calories, 0);
  const groupProtein = entries.reduce((sum, e) => sum + e.protein, 0);
  const groupCarbs = entries.reduce((sum, e) => sum + e.carbs, 0);
  const groupFat = entries.reduce((sum, e) => sum + e.fat, 0);

  // Format time from first entry in group
  const formatTime = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const timeLabel = entries[0]?.createdAt ? formatTime(entries[0].createdAt) : '';

  // Single item - show directly
  if (entries.length === 1) {
    const entry = entries[0];
    const status = entry.status ?? 'resolved';
    const isPending = status === 'pending';
    const isFailed = status === 'failed';
    const considering = isConsidering(entry);
    const tapAction = status === 'needs_clarification' ? 'Tap to refine' : null;
    return (
      <div
        className={`flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors group cursor-pointer ${
          considering ? 'opacity-60 border-2 border-dashed border-border-light rounded-apple m-1' : ''
        }`}
        onClick={() => handleEntryTap(entry, onEdit, onClarify)}
      >
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <StatusDot entry={entry} />
          <div className="min-w-0">
            <p
              className={`font-medium truncate ${
                considering ? 'text-text-secondary line-through' : isPending || isFailed ? 'text-text-secondary' : 'text-text-primary'
              }`}
            >
              {entry.name}
              {considering && (
                <span className="ml-2 align-middle inline-block text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full bg-accent-purple/10 text-accent-purple no-underline">
                  Considering
                </span>
              )}
            </p>
            <p className="text-xs text-text-secondary">
              {isPending ? (
                'Analyzing…'
              ) : isFailed ? (
                'Tap to retry'
              ) : (
                <>
                  P: {entry.protein}g • C: {entry.carbs}g • F: {entry.fat}g
                  {tapAction && <span className="ml-2 text-amber-600 font-medium">• {tapAction}</span>}
                  {timeLabel && <span className="ml-2 text-gray-400">• {timeLabel}</span>}
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {considering && onUpdate && (
            <button
              onClick={(e) => { e.stopPropagation(); onUpdate(entry.id, { notes: '' }); }}
              className="text-xs font-medium text-accent-green px-2 py-1 rounded-apple hover:bg-green-50 active:bg-green-100 touch-manipulation flex items-center gap-1"
              aria-label="Eat it"
            >
              <Utensils className="w-3.5 h-3.5" />
              Eat it
            </button>
          )}
          {considering && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(entry.id); }}
              className="text-xs font-medium text-accent-red px-2 py-1 rounded-apple hover:bg-red-50 active:bg-red-100 touch-manipulation"
              aria-label="Discard"
            >
              Discard
            </button>
          )}
          {!isPending && !considering && (
            <span className={`text-sm font-semibold ${status === 'needs_clarification' ? 'text-text-secondary' : 'text-text-primary'}`}>
              {entry.calories} kcal
            </span>
          )}
          {!considering && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(entry.id); }}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-accent-red p-1 touch-manipulation"
              aria-label="Delete entry"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // Multiple items - show as collapsible group
  return (
    <div className="border-b border-border-light last:border-0">
      {/* Group header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors touch-manipulation"
      >
        <div className="flex-1 min-w-0 text-left">
          <p className="font-medium text-text-primary">
            {entries.map(e => e.name).join(' + ')}
          </p>
          <p className="text-xs text-text-secondary">
            {entries.length} items • P: {groupProtein}g • C: {groupCarbs}g • F: {groupFat}g
            {timeLabel && <span className="ml-2 text-gray-400">• {timeLabel}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-text-primary">
            {groupCalories} kcal
          </span>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-text-secondary" />
          ) : (
            <ChevronDown className="w-4 h-4 text-text-secondary" />
          )}
        </div>
      </button>

      {/* Expanded items */}
      {isExpanded && (
        <div className="bg-secondary-bg/50 divide-y divide-border-light">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between px-4 pl-8 py-2 hover:bg-gray-100 transition-colors group cursor-pointer"
              onClick={() => handleEntryTap(entry, onEdit, onClarify)}
            >
              <div className="flex-1 min-w-0 flex items-center gap-2">
                <StatusDot entry={entry} />
                <div className="min-w-0">
                  <p className="text-sm text-text-primary truncate">{entry.name}</p>
                  <p className="text-xs text-text-secondary">
                    {(entry.status ?? 'resolved') === 'pending'
                      ? 'Analyzing…'
                      : <>P: {entry.protein}g • C: {entry.carbs}g • F: {entry.fat}g</>}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-text-secondary">
                  {(entry.status ?? 'resolved') === 'pending' ? '—' : `${entry.calories} kcal`}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(entry.id); }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-accent-red p-1 touch-manipulation"
                  aria-label="Delete entry"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MealSection({ mealType, entries, onDelete, onEdit, onClarify, onUpdate }: MealSectionProps) {
  const totalCalories = entries.reduce((sum, e) => sum + e.calories, 0);
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());

  const groups = useMemo(() => groupEntriesByTime(entries), [entries]);

  const toggleGroup = (index: number) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  return (
    <Card padding="none" className="overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-secondary-bg border-b border-border-light">
        <div className="flex items-center gap-2">
          {MEAL_ICONS[mealType]}
          <span className="font-semibold text-text-primary">{MEAL_LABELS[mealType]}</span>
        </div>
        <span className="text-sm font-medium text-text-secondary">
          {totalCalories} kcal
        </span>
      </div>

      {/* Entries */}
      {entries.length === 0 ? (
        <div className="px-4 py-6 text-center text-text-secondary text-sm">
          No food logged yet
        </div>
      ) : (
        <div className="divide-y divide-border-light">
          {groups.map((group, index) => (
            <MealGroup
              key={group.map(e => e.id).join('-')}
              entries={group}
              onDelete={onDelete}
              onEdit={onEdit}
              onClarify={onClarify}
              onUpdate={onUpdate}
              isExpanded={expandedGroups.has(index)}
              onToggle={() => toggleGroup(index)}
            />
          ))}
        </div>
      )}
    </Card>
  );
}
