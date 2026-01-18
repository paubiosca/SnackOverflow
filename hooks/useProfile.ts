'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { UserProfile } from '@/lib/types';
import { calculateDailyCalorieGoal, calculateMacroTargets } from '@/lib/calories';

export function useProfile() {
  const { data: session, status } = useSession();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnboarded, setIsOnboarded] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      if (status === 'loading') return;

      if (!session?.user) {
        setIsLoading(false);
        return;
      }

      try {
        const res = await fetch('/api/profile');
        if (res.ok) {
          const { profile: loadedProfile } = await res.json();
          setProfile(loadedProfile);
          setIsOnboarded(!!loadedProfile);
        }
      } catch (error) {
        console.error('Error loading profile:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadProfile();
  }, [session, status]);

  const updateProfile = useCallback(async (updates: Partial<UserProfile>) => {
    if (!profile) return;

    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (res.ok) {
        const { profile: updatedProfile } = await res.json();
        setProfile(updatedProfile);
      }
    } catch (error) {
      console.error('Error updating profile:', error);
    }
  }, [profile]);

  const createProfile = useCallback(async (newProfile: Omit<UserProfile, 'id' | 'createdAt'>) => {
    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProfile),
      });

      if (res.ok) {
        const { profile: createdProfile } = await res.json();
        setProfile(createdProfile);
        setIsOnboarded(true);
        return createdProfile;
      }
    } catch (error) {
      console.error('Error creating profile:', error);
    }
    return null;
  }, []);

  const calorieGoal = profile ? calculateDailyCalorieGoal(profile) : 2000;
  const macroTargets = calculateMacroTargets(calorieGoal);

  return {
    profile,
    isLoading: isLoading || status === 'loading',
    isOnboarded,
    isAuthenticated: !!session?.user,
    updateProfile,
    createProfile,
    calorieGoal,
    macroTargets,
  };
}
