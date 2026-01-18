'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/', label: 'Today', icon: '📊' },
  { href: '/history', label: 'History', icon: '📅' },
  { href: '/add-food', label: 'Add', icon: '➕', isMain: true },
  { href: '/profile', label: 'Profile', icon: '👤' },
];

export default function BottomNav() {
  const pathname = usePathname();

  // Don't show nav on onboarding
  if (pathname?.startsWith('/onboarding')) {
    return null;
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-border-light safe-bottom z-50">
      <div className="max-w-lg mx-auto flex items-center justify-around py-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;

          if (item.isMain) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center justify-center -mt-6"
              >
                <div className="w-14 h-14 bg-accent-blue rounded-full flex items-center justify-center shadow-lg btn-press">
                  <span className="text-2xl">{item.icon}</span>
                </div>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center py-1 px-4 rounded-lg transition-colors ${
                isActive ? 'text-accent-blue' : 'text-text-secondary'
              }`}
            >
              <span className="text-xl mb-0.5">{item.icon}</span>
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
