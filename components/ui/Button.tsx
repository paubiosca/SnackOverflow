'use client';

import { ButtonHTMLAttributes, forwardRef } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'primary', size = 'md', fullWidth = false, children, disabled, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center font-semibold rounded-apple transition-all duration-200 btn-press disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation select-none';

    const variants = {
      primary: 'bg-accent-blue text-white hover:bg-blue-600 active:bg-blue-700 active:scale-[0.98]',
      secondary: 'bg-secondary-bg text-text-primary border border-border-light hover:bg-gray-100 active:bg-gray-200 active:scale-[0.98]',
      ghost: 'bg-transparent text-accent-blue hover:bg-blue-50 active:bg-blue-100 active:scale-[0.98]',
      danger: 'bg-accent-red text-white hover:bg-red-600 active:bg-red-700 active:scale-[0.98]',
    };

    const sizes = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2.5 text-base',
      lg: 'px-6 py-3 text-lg',
    };

    return (
      <button
        ref={ref}
        className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
        disabled={disabled}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
