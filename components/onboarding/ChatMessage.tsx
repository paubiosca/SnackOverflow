'use client';

import { OnboardingMessage } from '@/lib/types';

interface ChatMessageProps {
  message: OnboardingMessage;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isAssistant = message.role === 'assistant';

  return (
    <div className={`flex ${isAssistant ? 'justify-start' : 'justify-end'} mb-3`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 ${
          isAssistant
            ? 'bg-secondary-bg text-text-primary rounded-tl-md'
            : 'bg-accent-blue text-white rounded-tr-md'
        }`}
      >
        <div className="text-sm whitespace-pre-wrap">{message.content}</div>
      </div>
    </div>
  );
}
