'use client';

import { useState, useEffect, useCallback } from 'react';
import { UserProfile } from '@/lib/types';
import { getProfile, saveProfile, hasCompletedOnboarding } from '@/lib/storage';
import { calculateDailyCalorieGoal, calculateMacroTargets } from '@/lib/calories';

export function useProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnboarded, setIsOnboarded] = useState(false);

  useEffect(() => {
    const loadedProfile = getProfile();
    setProfile(loadedProfile);
    setIsOnboarded(hasCompletedOnboarding());
    setIsLoading(false);
  }, []);

  const updateProfile = useCallback((updates: Partial<UserProfile>) => {
    if (!profile) return;
    const updatedProfile = { ...profile, ...updates };
    saveProfile(updatedProfile);
    setProfile(updatedProfile);
  }, [profile]);

  const createProfile = useCallback((newProfile: UserProfile) => {
    saveProfile(newProfile);
    setProfile(newProfile);
    setIsOnboarded(true);
  }, []);

  const calorieGoal = profile ? calculateDailyCalorieGoal(profile) : 2000;
  const macroTargets = calculateMacroTargets(calorieGoal);

  return {
    profile,
    isLoading,
    isOnboarded,
    updateProfile,
    createProfile,
    calorieGoal,
    macroTargets,
  };
}
