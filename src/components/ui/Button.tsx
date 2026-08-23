import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { clsx } from 'clsx';

type Variant = 'primary' | 'secondary' | 'ghost' | 'success' | 'warning' | 'danger' | 'outline';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
}

/* Apple buttons: pill (#0071e3), instant pointer-down feedback, continuous hover.
   Feedback lives on the press (transform + brightness), not just hover. */
const base =
  'inline-flex items-center justify-center gap-2 font-semibold rounded-full border cursor-pointer select-none disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none active:scale-[0.96] tracking-[-0.01em] transition-[transform,background-color,box-shadow,border-color] duration-150 ease-out will-change-transform';

const variants: Record<Variant, string> = {
  primary: 'bg-primary text-white border-transparent hover:bg-primary-hover shadow-sm',
  secondary: 'bg-surface-2 text-text border-transparent hover:bg-surface-3',
  ghost: 'bg-transparent text-primary border-transparent hover:bg-primary-soft',
  success: 'bg-success text-on-bright border-transparent hover:brightness-105',
  warning: 'bg-warning-soft text-warning-fg border-transparent hover:bg-warning/20',
  danger: 'bg-danger text-on-bright border-transparent hover:brightness-105',
  outline: 'bg-transparent text-primary border-primary hover:bg-primary-soft',
};

const sizes: Record<Size, string> = {
  sm: 'text-xs px-4 py-1.5',
  md: 'text-sm px-5 py-2.5',
  lg: 'text-base px-7 py-3',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', leftIcon, rightIcon, fullWidth, className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={clsx(base, variants[variant], sizes[size], fullWidth && 'w-full', className)}
      {...rest}
    >
      {leftIcon}
      {children}
      {rightIcon}
    </button>
  );
});
