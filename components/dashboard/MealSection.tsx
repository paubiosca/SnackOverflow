'use client';

import { useMemo } from 'react';
import { FoodEntry, MealType, MEAL_LABELS } from '@/lib/types';
import Card from '@/components/ui/Card';
import { Sunrise, Sun, Moon, Cookie, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { ReactNode, useState } from 'react';

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
  isExpanded: boolean;
  onToggle: () => void;
}

function MealGroup({ entries, onDelete, onEdit, isExpanded, onToggle }: MealGroupProps) {
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
    return (
      <div
        className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors group cursor-pointer"
        onClick={() => onEdit?.(entry)}
      >
        <div className="flex-1 min-w-0">
          <p className="font-medium text-text-primary truncate">{entry.name}</p>
          <p className="text-xs text-text-secondary">
            P: {entry.protein}g • C: {entry.carbs}g • F: {entry.fat}g
            {timeLabel && <span className="ml-2 text-gray-400">• {timeLabel}</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-text-primary">
            {entry.calories} kcal
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(entry.id); }}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-accent-red p-1 touch-manipulation"
            aria-label="Delete entry"
          >
            <Trash2 className="w-5 h-5" />
          </button>
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
              onClick={() => onEdit?.(entry)}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-text-primary truncate">{entry.name}</p>
                <p className="text-xs text-text-secondary">
                  P: {entry.protein}g • C: {entry.carbs}g • F: {entry.fat}g
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-text-secondary">
                  {entry.calories} kcal
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

export default function MealSection({ mealType, entries, onDelete, onEdit }: MealSectionProps) {
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
              isExpanded={expandedGroups.has(index)}
              onToggle={() => toggleGroup(index)}
            />
          ))}
        </div>
      )}
    </Card>
  );
}
