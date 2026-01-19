'use client';

import { useState, useEffect } from 'react';
import { getActiveCaloriesForDate, addActiveCalorieLog } from '@/lib/storage';
import { ActiveCalorieLog } from '@/lib/types';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import { Flame, Target, Plus, Check } from 'lucide-react';

interface ActiveCaloriesTrackerProps {
  goal: number; // Daily active calorie goal (e.g., 450)
  onActiveCaloriesChange?: (calories: number) => void;
}

const getLocalDateString = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function ActiveCaloriesTracker({ goal, onActiveCaloriesChange }: ActiveCaloriesTrackerProps) {
  const [burned, setBurned] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [calorieInput, setCalorieInput] = useState('');

  const today = getLocalDateString();

  useEffect(() => {
    const todayCalories = getActiveCaloriesForDate(today);
    setBurned(todayCalories);
  }, [today]);

  useEffect(() => {
    onActiveCaloriesChange?.(burned);
  }, [burned, onActiveCaloriesChange]);

  const handleLogCalories = () => {
    const calories = parseInt(calorieInput);
    if (isNaN(calories) || calories < 0) return;

    const log: ActiveCalorieLog = {
      id: Date.now().toString(),
      date: today,
      calories,
      source: 'manual',
    };

    addActiveCalorieLog(log);
    setBurned(calories);
    setShowModal(false);
    setCalorieInput('');
  };

  const percentage = goal > 0 ? Math.min(100, Math.round((burned / goal) * 100)) : 0;
  const remaining = Math.max(0, goal - burned);
  const isComplete = burned >= goal;

  // Calculate bonus calories earned (you can eat more if you're active!)
  const bonusCalories = burned;

  return (
    <>
      <Card>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              isComplete ? 'bg-accent-green/10' : 'bg-accent-orange/10'
            }`}>
              <Flame className={`w-4 h-4 ${isComplete ? 'text-accent-green' : 'text-accent-orange'}`} />
            </div>
            <div>
              <h3 className="font-semibold text-text-primary text-sm">Active Calories</h3>
              <p className="text-xs text-text-secondary">From exercise & movement</p>
            </div>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="p-2 hover:bg-secondary-bg rounded-apple transition-colors"
          >
            <Plus className="w-5 h-5 text-accent-blue" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="mb-3">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-text-secondary">{burned} / {goal} kcal</span>
            <span className={`font-medium ${isComplete ? 'text-accent-green' : 'text-accent-orange'}`}>
              {percentage}%
            </span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                isComplete ? 'bg-accent-green' : 'bg-accent-orange'
              }`}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>

        {/* Status message */}
        <div className={`p-3 rounded-apple ${
          isComplete ? 'bg-accent-green/10' : 'bg-secondary-bg'
        }`}>
          {isComplete ? (
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-accent-green" />
              <div>
                <p className="text-sm font-medium text-accent-green">Goal reached!</p>
                <p className="text-xs text-text-secondary">
                  You earned <span className="font-semibold text-accent-green">+{bonusCalories}</span> bonus calories today
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-text-secondary" />
              <div>
                <p className="text-sm text-text-primary">
                  <span className="font-semibold">{remaining}</span> kcal to go
                </p>
                <p className="text-xs text-text-secondary">
                  {burned > 0
                    ? `Already earned +${burned} bonus calories!`
                    : 'Log your active calories from Apple Watch'
                  }
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Bonus explanation */}
        {burned > 0 && (
          <p className="text-xs text-text-secondary mt-3 text-center">
            Active calories are added to your daily budget
          </p>
        )}
      </Card>

      {/* Log modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Log Active Calories"
      >
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            Enter your active calories from Apple Watch or your workout
          </p>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              placeholder={String(goal)}
              value={calorieInput}
              onChange={(e) => setCalorieInput(e.target.value)}
              autoFocus
            />
            <span className="text-text-secondary">kcal</span>
          </div>

          {/* Quick buttons */}
          <div className="flex gap-2">
            {[150, 300, 450, 600].map((val) => (
              <button
                key={val}
                onClick={() => setCalorieInput(String(val))}
                className={`flex-1 py-2 text-sm rounded-apple border transition-colors ${
                  calorieInput === String(val)
                    ? 'border-accent-orange bg-accent-orange/10 text-accent-orange'
                    : 'border-border-light text-text-secondary hover:border-accent-orange'
                }`}
              >
                {val}
              </button>
            ))}
          </div>

          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleLogCalories} fullWidth disabled={!calorieInput}>
              Save
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
