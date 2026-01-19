'use client';

import { QuickReply } from '@/lib/types';

interface QuickRepliesPanelProps {
  quickReplies: QuickReply[];
  onSelect: (reply: QuickReply) => void;
  disabled?: boolean;
}

export default function QuickRepliesPanel({ quickReplies, onSelect, disabled }: QuickRepliesPanelProps) {
  if (!quickReplies.length) return null;

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {quickReplies.map((reply, index) => (
        <button
          key={index}
          onClick={() => onSelect(reply)}
          disabled={disabled}
          className={`px-4 py-2 rounded-full border-2 text-sm font-medium transition-all ${
            disabled
              ? 'border-border-light text-text-secondary opacity-50 cursor-not-allowed'
              : 'border-accent-blue text-accent-blue hover:bg-accent-blue hover:text-white active:scale-95'
          }`}
        >
          {reply.label}
        </button>
      ))}
    </div>
  );
}
