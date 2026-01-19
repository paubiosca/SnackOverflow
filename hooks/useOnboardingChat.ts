'use client';

import { useState, useCallback } from 'react';
import {
  OnboardingMessage,
  OnboardingTopic,
  QuickReply,
  ExtractedProfileData,
  OnboardingCalculations,
} from '@/lib/types';

interface UseOnboardingChatOptions {
  apiKey: string;
  onComplete?: (data: ExtractedProfileData, calculations: OnboardingCalculations) => void;
}

export function useOnboardingChat({ apiKey, onComplete }: UseOnboardingChatOptions) {
  const [messages, setMessages] = useState<OnboardingMessage[]>([]);
  const [currentTopic, setCurrentTopic] = useState<OnboardingTopic>('greeting');
  const [extractedData, setExtractedData] = useState<ExtractedProfileData>({});
  const [calculations, setCalculations] = useState<OnboardingCalculations>({});
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addMessage = useCallback((role: 'user' | 'assistant', content: string, replies?: QuickReply[]) => {
    const newMessage: OnboardingMessage = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      role,
      content,
      quickReplies: replies,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, newMessage]);
    return newMessage;
  }, []);

  const startConversation = useCallback(async () => {
    if (!apiKey) {
      setError('API key is required');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/onboarding-chat?apiKey=${encodeURIComponent(apiKey)}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to start conversation');
      }

      addMessage('assistant', data.assistantMessage, data.quickReplies);
      setQuickReplies(data.quickReplies || []);
      setCurrentTopic(data.nextTopic || 'name');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start conversation');
      // Add a fallback greeting
      addMessage('assistant', "Hey! I'm excited to help you set up SnackOverflow. What should I call you?");
      setCurrentTopic('name');
    } finally {
      setIsLoading(false);
    }
  }, [apiKey, addMessage]);

  const sendMessage = useCallback(async (userMessage: string) => {
    if (!apiKey || isLoading) return;

    // Add user message
    addMessage('user', userMessage);
    setQuickReplies([]);
    setIsLoading(true);
    setError(null);

    try {
      const conversationHistory = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      const res = await fetch('/api/onboarding-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          currentTopic,
          extractedData,
          conversationHistory,
          apiKey,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to process message');
      }

      // Update state with response
      addMessage('assistant', data.assistantMessage, data.quickReplies);
      setExtractedData(data.extractedData);
      setCalculations(data.calculations);
      setQuickReplies(data.quickReplies || []);
      setCurrentTopic(data.nextTopic);

      if (data.isComplete) {
        setIsComplete(true);
        onComplete?.(data.extractedData, data.calculations);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process message');
      addMessage('assistant', "I'm sorry, I had trouble understanding that. Could you try again?");
    } finally {
      setIsLoading(false);
    }
  }, [apiKey, isLoading, messages, currentTopic, extractedData, addMessage, onComplete]);

  const handleQuickReply = useCallback((reply: QuickReply) => {
    sendMessage(reply.value);
  }, [sendMessage]);

  const resetConversation = useCallback(() => {
    setMessages([]);
    setCurrentTopic('greeting');
    setExtractedData({});
    setCalculations({});
    setQuickReplies([]);
    setIsLoading(false);
    setIsComplete(false);
    setError(null);
  }, []);

  return {
    messages,
    currentTopic,
    extractedData,
    calculations,
    quickReplies,
    isLoading,
    isComplete,
    error,
    startConversation,
    sendMessage,
    handleQuickReply,
    resetConversation,
  };
}
