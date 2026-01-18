'use client';

import { useState } from 'react';
import { AIFoodAnalysis, ClarifyingQuestion } from '@/lib/types';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';

interface AIAnalysisProps {
  imageData: string;
  analysis: AIFoodAnalysis;
  onConfirm: (analysis: AIFoodAnalysis) => void;
  onRetry: () => void;
  onCancel: () => void;
  isRefining?: boolean;
  onAnswerQuestion?: (questionId: string, answer: string) => void;
}

export default function AIAnalysis({
  imageData,
  analysis,
  onConfirm,
  onRetry,
  onCancel,
  isRefining,
  onAnswerQuestion,
}: AIAnalysisProps) {
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});

  const handleAnswer = (questionId: string, answer: string) => {
    setSelectedAnswers(prev => ({ ...prev, [questionId]: answer }));
    onAnswerQuestion?.(questionId, answer);
  };

  const hasUnansweredQuestions = analysis.clarifyingQuestions?.some(
    q => !selectedAnswers[q.id]
  );

  return (
    <div className="space-y-4">
      {/* Image preview */}
      <div className="rounded-apple-lg overflow-hidden">
        <img
          src={imageData}
          alt="Food"
          className="w-full aspect-[4/3] object-cover"
        />
      </div>

      {/* Confidence indicator */}
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${
          analysis.confidence >= 80 ? 'bg-accent-green' :
          analysis.confidence >= 50 ? 'bg-accent-orange' : 'bg-accent-red'
        }`} />
        <span className="text-sm text-text-secondary">
          {analysis.confidence}% confident
        </span>
      </div>

      {/* Food name */}
      <Card>
        <h3 className="text-xl font-semibold text-text-primary mb-3">
          {analysis.foodName}
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="text-center p-3 bg-secondary-bg rounded-apple">
            <div className="text-2xl font-bold text-accent-blue">
              {analysis.nutrition.calories}
            </div>
            <div className="text-xs text-text-secondary">Calories</div>
          </div>
          <div className="text-center p-3 bg-secondary-bg rounded-apple">
            <div className="text-lg font-semibold text-accent-orange">
              {analysis.nutrition.protein}g
            </div>
            <div className="text-xs text-text-secondary">Protein</div>
          </div>
          <div className="text-center p-3 bg-secondary-bg rounded-apple">
            <div className="text-lg font-semibold text-accent-green">
              {analysis.nutrition.carbs}g
            </div>
            <div className="text-xs text-text-secondary">Carbs</div>
          </div>
          <div className="text-center p-3 bg-secondary-bg rounded-apple">
            <div className="text-lg font-semibold text-accent-purple">
              {analysis.nutrition.fat}g
            </div>
            <div className="text-xs text-text-secondary">Fat</div>
          </div>
        </div>
      </Card>

      {/* Clarifying Questions */}
      {analysis.needsClarification && analysis.clarifyingQuestions && (
        <Card className="border-2 border-accent-orange/30 bg-orange-50">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">🤔</span>
            <h4 className="font-semibold text-text-primary">Help us be more accurate</h4>
          </div>

          <div className="space-y-4">
            {analysis.clarifyingQuestions.map((question) => (
              <div key={question.id} className="space-y-2">
                <p className="text-sm font-medium text-text-primary">
                  {question.question}
                </p>
                <p className="text-xs text-text-secondary">{question.impact}</p>
                <div className="flex flex-wrap gap-2">
                  {question.options.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleAnswer(question.id, option.value)}
                      disabled={isRefining}
                      className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                        selectedAnswers[question.id] === option.value
                          ? 'bg-accent-blue text-white'
                          : 'bg-white border border-border-light text-text-primary hover:border-accent-blue'
                      } ${isRefining ? 'opacity-50' : ''}`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {isRefining && (
            <div className="mt-4 flex items-center gap-2 text-text-secondary">
              <div className="w-4 h-4 border-2 border-accent-blue border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Updating estimates...</span>
            </div>
          )}
        </Card>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="ghost" onClick={onRetry}>
          Retake
        </Button>
        <Button
          onClick={() => onConfirm(analysis)}
          disabled={hasUnansweredQuestions && analysis.needsClarification}
          className="flex-1"
        >
          Add to Log
        </Button>
      </div>
    </div>
  );
}
