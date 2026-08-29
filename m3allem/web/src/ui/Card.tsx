import type { ReactNode } from 'react'

import { cn } from '@/ui/cn'

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-lg border border-border bg-surface p-5', className)}>
      {children}
    </div>
  )
}
