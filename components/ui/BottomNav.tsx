'use client';

import { usePathname, useRouter } from 'next/navigation';
import { BarChart3, Calendar, Plus, User } from 'lucide-react';
import { ReactNode } from 'react';

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

  // Don't show nav on onboarding or login/register
  if (pathname?.startsWith('/onboarding') || pathname?.startsWith('/login') || pathname?.startsWith('/register')) {
    return null;
  }

  const handleNavClick = (href: string) => {
    router.push(href);
  };

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
              <button
                key={item.href}
                type="button"
                onClick={() => handleNavClick(item.href)}
                className="flex flex-col items-center justify-center -mt-6 cursor-pointer"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <div className="w-14 h-14 bg-accent-blue rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform">
                  {item.icon}
                </div>
              </button>
            );
          }

          return (
            <button
              key={item.href}
              type="button"
              onClick={() => handleNavClick(item.href)}
              className={`flex flex-col items-center justify-center py-2 px-5 rounded-xl cursor-pointer ${
                isActive ? 'text-accent-blue' : 'text-gray-500'
              }`}
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <span className={`mb-0.5 ${isActive ? 'scale-110' : ''}`}>
                {item.icon}
              </span>
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
