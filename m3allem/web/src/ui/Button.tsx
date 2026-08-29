import type { ButtonHTMLAttributes, ReactNode } from 'react'

import { cn } from '@/ui/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'md' | 'lg' | 'pro'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  fullWidth?: boolean
  children: ReactNode
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-primary text-primary-fg hover:bg-primary-hover',
  secondary: 'bg-surface text-fg border border-border-strong hover:bg-surface-2',
  ghost: 'bg-transparent text-fg-muted hover:bg-surface-2 hover:text-fg',
  danger: 'bg-danger text-white hover:opacity-90',
}

const SIZES: Record<Size, string> = {
  md: 'min-h-tap px-4 text-sm',
  lg: 'min-h-tap px-6 text-base',
  /** For the tradesman's own screens — tapped outdoors, with wet hands. */
  pro: 'min-h-tap-pro px-6 text-base',
}

/**
 * One primary button per screen. If a screen seems to need two, one of them is
 * secondary.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled ?? loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md font-medium',
        'transition-colors duration-(--duration-fast)',
        'disabled:cursor-not-allowed disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        fullWidth && 'w-full',
        className,
      )}
    >
      {loading && <Spinner />}
      {children}
    </button>
  )
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  )
}
