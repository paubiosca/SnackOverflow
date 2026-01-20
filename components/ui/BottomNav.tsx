'use client';

import { usePathname, useRouter } from 'next/navigation';
import { BarChart3, Calendar, Plus, User } from 'lucide-react';
import { ReactNode, useCallback, useRef } from 'react';

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  isMain?: boolean;
}

const navItems: NavItem[] = [
  { href: '/', label: 'Today', icon: <BarChart3 className="w-5 h-5" /> },
  { href: '/history', label: 'History', icon: <Calendar className="w-5 h-5" /> },
  { href: '/add-food', label: 'Add', icon: <Plus className="w-6 h-6 text-white" />, isMain: true },
  { href: '/profile', label: 'Profile', icon: <User className="w-5 h-5" /> },
];

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  // Don't show nav on onboarding or login/register
  if (pathname?.startsWith('/onboarding') || pathname?.startsWith('/login') || pathname?.startsWith('/register')) {
    return null;
  }

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const handleNavigation = useCallback((href: string, e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // For touch events, check if it was a tap (not a scroll)
    if ('touches' in e && touchStartRef.current) {
      const touch = (e as React.TouchEvent).changedTouches[0];
      const deltaX = Math.abs(touch.clientX - touchStartRef.current.x);
      const deltaY = Math.abs(touch.clientY - touchStartRef.current.y);

      // If moved more than 10px, it's a scroll not a tap
      if (deltaX > 10 || deltaY > 10) {
        touchStartRef.current = null;
        return;
      }
    }

    touchStartRef.current = null;
    router.push(href);
  }, [router]);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-[60]"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div className="max-w-lg mx-auto flex items-center justify-around py-2 px-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;

          if (item.isMain) {
            return (
              <div
                key={item.href}
                role="button"
                tabIndex={0}
                onTouchStart={handleTouchStart}
                onTouchEnd={(e) => handleNavigation(item.href, e)}
                onClick={(e) => handleNavigation(item.href, e)}
                onKeyDown={(e) => e.key === 'Enter' && router.push(item.href)}
                className="flex flex-col items-center justify-center -mt-6 cursor-pointer select-none"
                style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
              >
                <div className="w-14 h-14 bg-accent-blue rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform">
                  {item.icon}
                </div>
              </div>
            );
          }

          return (
            <div
              key={item.href}
              role="button"
              tabIndex={0}
              onTouchStart={handleTouchStart}
              onTouchEnd={(e) => handleNavigation(item.href, e)}
              onClick={(e) => handleNavigation(item.href, e)}
              onKeyDown={(e) => e.key === 'Enter' && router.push(item.href)}
              className={`flex flex-col items-center justify-center py-2 px-5 rounded-xl cursor-pointer select-none ${
                isActive ? 'text-accent-blue' : 'text-gray-500'
              }`}
              style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
            >
              <span className={`mb-0.5 ${isActive ? 'scale-110' : ''}`}>
                {item.icon}
              </span>
              <span className="text-[10px] font-medium">{item.label}</span>
            </div>
          );
        })}
      </div>
    </nav>
  );
}
