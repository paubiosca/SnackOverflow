'use client';

import { useRef, useEffect } from 'react';
import { OnboardingMessage, QuickReply, ExtractedProfileData, OnboardingCalculations } from '@/lib/types';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import QuickRepliesPanel from './QuickRepliesPanel';
import TypingIndicator from './TypingIndicator';
import SummaryCard from './SummaryCard';

interface ChatContainerProps {
  messages: OnboardingMessage[];
  quickReplies: QuickReply[];
  isLoading: boolean;
  isComplete: boolean;
  extractedData: ExtractedProfileData;
  calculations: OnboardingCalculations;
  onSendMessage: (message: string) => void;
  onQuickReply: (reply: QuickReply) => void;
  onConfirmProfile: () => void;
  onEditProfile: () => void;
  isSubmitting?: boolean;
}

export default function ChatContainer({
  messages,
  quickReplies,
  isLoading,
  isComplete,
  extractedData,
  calculations,
  onSendMessage,
  onQuickReply,
  onConfirmProfile,
  onEditProfile,
  isSubmitting,
}: ChatContainerProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}

        {isLoading && <TypingIndicator />}

        {isComplete && (
          <SummaryCard
            data={extractedData}
            calculations={calculations}
            onConfirm={onConfirmProfile}
            onEdit={onEditProfile}
            isSubmitting={isSubmitting}
          />
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      {!isComplete && (
        <div className="px-4 py-4 bg-white border-t border-border-light">
          <QuickRepliesPanel
            quickReplies={quickReplies}
            onSelect={onQuickReply}
            disabled={isLoading}
          />
          <ChatInput onSend={onSendMessage} disabled={isLoading} />
        </div>
      )}
    </div>
  );
}
