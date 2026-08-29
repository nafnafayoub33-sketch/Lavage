import type { ReactNode } from 'react'

import { cn } from '@/ui/cn'

type Tone = 'info' | 'success' | 'warning' | 'danger'

const TONES: Record<Tone, string> = {
  info: 'bg-accent-soft text-fg border-accent/30',
  success: 'bg-success-soft text-fg border-success/30',
  warning: 'bg-warning-soft text-fg border-warning/30',
  danger: 'bg-danger-soft text-fg border-danger/30',
}

export function Alert({
  tone = 'info',
  children,
  className,
}: {
  tone?: Tone
  children: ReactNode
  className?: string
}) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn('rounded-md border px-4 py-3 text-sm', TONES[tone], className)}
    >
      {children}
    </div>
  )
}
