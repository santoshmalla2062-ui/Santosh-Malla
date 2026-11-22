import React from 'react';
import { LucideIcon, Loader2 } from 'lucide-react';

// ==========================================
// 1. STANDARD BUTTON STYLES & ACCESSIBILITY
// ==========================================
export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'success' | 'ghost' | 'foodmandu';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: LucideIcon;
  rightIcon?: LucideIcon;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon: LeftIcon,
  rightIcon: RightIcon,
  fullWidth = false,
  disabled,
  className = '',
  ...props
}) => {
  const baseClasses = 'inline-flex items-center justify-center font-bold rounded-xl transition-all duration-150 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-[0.98]';

  const sizeClasses: Record<ButtonSize, string> = {
    xs: 'text-[11px] px-2.5 py-1 gap-1 min-h-[28px]',
    sm: 'text-xs px-3 py-1.5 gap-1.5 min-h-[34px]',
    md: 'text-xs sm:text-sm px-4 py-2 gap-2 min-h-[40px]',
    lg: 'text-sm sm:text-base px-5 py-2.5 gap-2.5 min-h-[46px]'
  };

  const variantClasses: Record<ButtonVariant, string> = {
    primary: 'bg-slate-900 hover:bg-slate-800 text-white shadow-2xs focus-visible:ring-slate-900',
    foodmandu: 'bg-orange-600 hover:bg-orange-700 text-white shadow-2xs focus-visible:ring-orange-600',
    secondary: 'bg-slate-100 hover:bg-slate-200 text-slate-800 focus-visible:ring-slate-300',
    outline: 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 shadow-2xs focus-visible:ring-slate-400',
    danger: 'bg-rose-600 hover:bg-rose-700 text-white shadow-2xs focus-visible:ring-rose-600',
    success: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs focus-visible:ring-emerald-600',
    ghost: 'bg-transparent hover:bg-slate-100 text-slate-600 hover:text-slate-900 focus-visible:ring-slate-300'
  };

  return (
    <button
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin shrink-0" />
      ) : LeftIcon ? (
        <LeftIcon className="h-4 w-4 shrink-0" />
      ) : null}
      <span>{children}</span>
      {!isLoading && RightIcon && (
        <RightIcon className="h-4 w-4 shrink-0" />
      )}
    </button>
  );
};

// ==========================================
// 2. STANDARD FORM FIELD & INPUT STYLES
// ==========================================
export interface FormFieldProps {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  error,
  hint,
  required,
  htmlFor,
  children,
  className = ''
}) => {
  return (
    <div className={`space-y-1.5 text-left ${className}`}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="block text-xs font-bold text-slate-700 select-none"
        >
          {label}
          {required && <span className="text-rose-500 ml-1">*</span>}
        </label>
      )}
      {children}
      {error && (
        <p className="text-[11px] font-semibold text-rose-600 flex items-center gap-1 animate-in fade-in">
          <span>●</span>
          <span>{error}</span>
        </p>
      )}
      {!error && hint && (
        <p className="text-[11px] text-slate-500">{hint}</p>
      )}
    </div>
  );
};

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
  leftIcon?: LucideIcon;
  rightElement?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  hasError,
  leftIcon: LeftIcon,
  rightElement,
  className = '',
  ...props
}) => {
  return (
    <div className="relative flex items-center">
      {LeftIcon && (
        <div className="absolute left-3 text-slate-400 pointer-events-none">
          <LeftIcon className="h-4 w-4" />
        </div>
      )}
      <input
        className={`w-full rounded-xl border bg-white px-3 py-2 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 transition-colors shadow-2xs focus-visible:outline-none focus-visible:ring-2 disabled:bg-slate-50 disabled:text-slate-400 ${
          LeftIcon ? 'pl-9' : ''
        } ${rightElement ? 'pr-9' : ''} ${
          hasError
            ? 'border-rose-400 focus-visible:ring-rose-500 focus-visible:border-rose-500'
            : 'border-slate-300 focus-visible:ring-orange-500 focus-visible:border-orange-500'
        } ${className}`}
        {...props}
      />
      {rightElement && (
        <div className="absolute right-3 flex items-center">
          {rightElement}
        </div>
      )}
    </div>
  );
};

// ==========================================
// 3. STATUS BADGES
// ==========================================
export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'orange' | 'purple';

export interface StatusBadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  dot?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  children,
  variant = 'neutral',
  dot = true,
  size = 'md',
  className = ''
}) => {
  const variantStyles: Record<BadgeVariant, { bg: string; text: string; border: string; dotColor: string }> = {
    success: { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200', dotColor: 'bg-emerald-500' },
    warning: { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200', dotColor: 'bg-amber-500' },
    danger: { bg: 'bg-rose-50', text: 'text-rose-800', border: 'border-rose-200', dotColor: 'bg-rose-500' },
    info: { bg: 'bg-indigo-50', text: 'text-indigo-800', border: 'border-indigo-200', dotColor: 'bg-indigo-500' },
    neutral: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200', dotColor: 'bg-slate-400' },
    orange: { bg: 'bg-orange-50', text: 'text-orange-800', border: 'border-orange-200', dotColor: 'bg-orange-500' },
    purple: { bg: 'bg-purple-50', text: 'text-purple-800', border: 'border-purple-200', dotColor: 'bg-purple-500' }
  };

  const style = variantStyles[variant];
  const sizeClasses = size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2.5 py-0.5';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-bold rounded-md border ${style.bg} ${style.text} ${style.border} ${sizeClasses} ${className}`}
    >
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${style.dotColor} shrink-0`} />}
      <span>{children}</span>
    </span>
  );
};

// ==========================================
// 4. EMPTY STATES
// ==========================================
export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionText,
  onAction,
  className = ''
}) => {
  return (
    <div className={`flex flex-col items-center justify-center p-8 sm:p-12 text-center bg-white rounded-2xl border border-dashed border-slate-300 ${className}`}>
      <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-500 mb-3 shadow-2xs">
        <Icon className="h-7 w-7 text-slate-400" />
      </div>
      <h4 className="text-base font-bold text-slate-800">{title}</h4>
      <p className="text-xs text-slate-500 mt-1 max-w-sm">{description}</p>
      {actionText && onAction && (
        <div className="mt-4">
          <Button variant="foodmandu" size="sm" onClick={onAction}>
            {actionText}
          </Button>
        </div>
      )}
    </div>
  );
};

// ==========================================
// 5. STANDARD CARD CONTAINER
// ==========================================
export interface CardProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  headerAction?: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({
  children,
  title,
  subtitle,
  headerAction,
  className = ''
}) => {
  return (
    <div className={`bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden ${className}`}>
      {(title || headerAction) && (
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
          <div>
            {title && <h3 className="font-bold text-sm text-slate-900">{title}</h3>}
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          {headerAction && <div>{headerAction}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
};
