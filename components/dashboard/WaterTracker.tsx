'use client';

import { useState } from 'react';
import { useWaterLog } from '@/hooks/useWaterLog';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';

interface WaterTrackerProps {
  goalMl: number;
}

export default function WaterTracker({ goalMl }: WaterTrackerProps) {
  const { logs, total, add, remove } = useWaterLog();
  const [showModal, setShowModal] = useState(false);
  const [customAmount, setCustomAmount] = useState('');
  const [showLogs, setShowLogs] = useState(false);

  const percentage = Math.min(100, Math.round((total / goalMl) * 100));
  const glasses = Math.floor(total / 250);

  const quickAddOptions = [150, 250, 350, 500];

  const handleCustomAdd = () => {
    const amount = parseInt(customAmount);
    if (amount > 0) {
      add(amount);
      setCustomAmount('');
      setShowModal(false);
    }
  };

  return (
    <>
      <Card>
        <div
          className="flex items-center justify-between mb-3 cursor-pointer"
          onClick={() => setShowLogs(!showLogs)}
        >
          <div className="flex items-center gap-2">
            <span className="text-xl">💧</span>
            <span className="font-semibold text-text-primary">Water</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-text-secondary">
              {total} / {goalMl} ml
            </span>
            <svg
              className={`w-4 h-4 text-text-secondary transition-transform ${showLogs ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-3 bg-gray-200 rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-accent-blue rounded-full transition-all duration-500"
            style={{ width: `${percentage}%` }}
          />
        </div>

        {/* Glass icons */}
        <div className="flex items-center gap-1 mb-3">
          {[...Array(8)].map((_, i) => (
            <span
              key={i}
              className={`text-lg transition-opacity ${i < glasses ? 'opacity-100' : 'opacity-20'}`}
            >
              🥤
            </span>
          ))}
          <span className="ml-2 text-sm text-text-secondary">{glasses}/8 glasses</span>
        </div>

        {/* Quick add buttons */}
        <div className="flex gap-2 flex-wrap">
          {quickAddOptions.map((amount) => (
            <Button
              key={amount}
              variant="secondary"
              size="sm"
              onClick={() => add(amount)}
            >
              +{amount}ml
            </Button>
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowModal(true)}
          >
            Custom
          </Button>
        </div>

        {/* Expandable logs */}
        {showLogs && logs.length > 0 && (
          <div className="mt-4 pt-3 border-t border-border-light">
            <p className="text-xs text-text-secondary mb-2">Today&apos;s log (tap to remove)</p>
            <div className="flex flex-wrap gap-2">
              {logs.map((log) => (
                <button
                  key={log.id}
                  onClick={() => remove(log.id)}
                  className="px-2 py-1 bg-secondary-bg rounded-full text-xs text-text-primary hover:bg-accent-red/10 hover:text-accent-red transition-colors flex items-center gap-1"
                >
                  {log.amountMl}ml
                  <span className="text-text-secondary">×</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Custom Amount Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Add Water"
      >
        <div className="space-y-4">
          <Input
            label="Amount (ml)"
            type="number"
            value={customAmount}
            onChange={(e) => setCustomAmount(e.target.value)}
            placeholder="e.g., 330"
          />
          <div className="flex flex-wrap gap-2 mb-4">
            <p className="w-full text-xs text-text-secondary mb-1">Quick select:</p>
            {[100, 200, 330, 500, 750, 1000].map((amount) => (
              <button
                key={amount}
                onClick={() => setCustomAmount(amount.toString())}
                className={`px-3 py-1.5 rounded-full text-sm border transition-all ${
                  customAmount === amount.toString()
                    ? 'border-accent-blue bg-blue-50 text-accent-blue'
                    : 'border-border-light text-text-secondary hover:border-accent-blue'
                }`}
              >
                {amount}ml
              </button>
            ))}
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCustomAdd} fullWidth disabled={!customAmount || parseInt(customAmount) <= 0}>
              Add {customAmount || 0}ml
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
