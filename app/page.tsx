'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useProfile } from '@/hooks/useProfile';
import DashboardSkeleton from '@/components/dashboard/DashboardSkeleton';

// The app's landing route. Send authenticated users straight to Add Food so the
// fastest action — log a meal — is one tap away. The dashboard summary lives at
// /today and is reachable from the bottom nav.
export default function Home() {
  const router = useRouter();
  const { status } = useSession();
  const { isLoading: profileLoading, isOnboarded, isAuthenticated } = useProfile();

  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated') {
      router.replace('/login');
      return;
    }
    if (profileLoading) return;
    if (isAuthenticated && !isOnboarded) {
      router.replace('/onboarding');
      return;
    }
    router.replace('/add-food');
  }, [status, profileLoading, isOnboarded, isAuthenticated, router]);

  return <DashboardSkeleton />;
}
