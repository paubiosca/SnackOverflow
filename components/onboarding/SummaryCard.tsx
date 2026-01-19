'use client';

import { ExtractedProfileData, OnboardingCalculations, ACTIVITY_LABELS, ACTIVITY_APPROACH_LABELS } from '@/lib/types';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';

interface SummaryCardProps {
  data: ExtractedProfileData;
  calculations: OnboardingCalculations;
  onConfirm: () => void;
  onEdit: () => void;
  isSubmitting?: boolean;
}

export default function SummaryCard({ data, calculations, onConfirm, onEdit, isSubmitting }: SummaryCardProps) {
  return (
    <Card className="mt-4 border-2 border-accent-blue/20">
      <h3 className="text-lg font-semibold text-text-primary mb-4">Your Profile Summary</h3>

      <div className="space-y-3 mb-6">
        <div className="flex justify-between">
          <span className="text-text-secondary">Name</span>
          <span className="font-medium text-text-primary">{data.name || '-'}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-text-secondary">Age</span>
          <span className="font-medium text-text-primary">{data.age || '-'} years</span>
        </div>

        <div className="flex justify-between">
          <span className="text-text-secondary">Gender</span>
          <span className="font-medium text-text-primary capitalize">{data.gender || '-'}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-text-secondary">Height</span>
          <span className="font-medium text-text-primary">{data.heightCm || '-'} cm</span>
        </div>

        <div className="flex justify-between">
          <span className="text-text-secondary">Weight</span>
          <span className="font-medium text-text-primary">{data.weightKg || '-'} kg</span>
        </div>

        <div className="flex justify-between">
          <span className="text-text-secondary">Activity Approach</span>
          <span className="font-medium text-text-primary">
            {data.activityApproach ? ACTIVITY_APPROACH_LABELS[data.activityApproach].name : '-'}
          </span>
        </div>

        {data.activityApproach === 'static' && (
          <div className="flex justify-between">
            <span className="text-text-secondary">Activity Level</span>
            <span className="font-medium text-text-primary">
              {data.activityLevel ? ACTIVITY_LABELS[data.activityLevel].split(' (')[0] : '-'}
            </span>
          </div>
        )}

        {data.activityApproach === 'dynamic' && (
          <div className="flex justify-between">
            <span className="text-text-secondary">Active Calorie Goal</span>
            <span className="font-medium text-text-primary">{data.activeCalorieGoal || '-'} kcal</span>
          </div>
        )}

        <div className="flex justify-between">
          <span className="text-text-secondary">Daily Deficit</span>
          <span className="font-medium text-text-primary">{data.goalValue || '-'} kcal</span>
        </div>
      </div>

      <div className="bg-accent-blue/5 rounded-apple p-4 mb-6">
        <div className="text-center">
          <div className="text-sm text-text-secondary mb-1">
            {data.activityApproach === 'dynamic' ? 'Base Daily Goal (Sedentary)' : 'Daily Calorie Goal'}
          </div>
          <div className="text-3xl font-bold text-accent-blue">
            {calculations.recommendedCalories || '-'} kcal
          </div>
          {data.activityApproach === 'dynamic' && (
            <div className="text-sm text-text-secondary mt-2">
              + active calories from exercise
            </div>
          )}
        </div>

        {calculations.bmr && (
          <div className="mt-4 pt-4 border-t border-border-light grid grid-cols-2 gap-4 text-sm">
            <div className="text-center">
              <div className="text-text-secondary">BMR</div>
              <div className="font-medium text-text-primary">{calculations.bmr} kcal</div>
            </div>
            <div className="text-center">
              <div className="text-text-secondary">
                {data.activityApproach === 'dynamic' ? 'Sedentary TDEE' : 'TDEE'}
              </div>
              <div className="font-medium text-text-primary">
                {data.activityApproach === 'dynamic'
                  ? calculations.baseSedentaryCalories
                  : calculations.tdee}{' '}
                kcal
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <Button variant="secondary" onClick={onEdit} disabled={isSubmitting}>
          Edit
        </Button>
        <Button fullWidth onClick={onConfirm} disabled={isSubmitting}>
          {isSubmitting ? 'Setting up...' : 'Complete Setup'}
        </Button>
      </div>
    </Card>
  );
}
