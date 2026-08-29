import type { InputHTMLAttributes, ReactNode } from 'react'
import { useId } from 'react'

import { cn } from '@/ui/cn'

// `prefix` is a real HTML attribute typed as a string, so ours has to
// replace it rather than widen it.
interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'prefix'> {
  label: string
  hint?: string
  error?: string | null
  /** Rendered before the input inside the same frame — the `+212` prefix. */
  prefix?: ReactNode
  /** Latin digits, left to right, whatever the interface language. */
  numeric?: boolean
}

export function Field({
  label,
  hint,
  error,
  prefix,
  numeric = false,
  className,
  ...rest
}: FieldProps) {
  const id = useId()
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-fg">
        {label}
      </label>

      <div
        className={cn(
          'flex items-center rounded-md border bg-surface',
          'focus-within:ring-2 focus-within:ring-focus/40',
          error ? 'border-danger' : 'border-border-strong',
        )}
      >
        {prefix && (
          <span className="numeric ps-3 text-sm text-fg-muted select-none">{prefix}</span>
        )}
        <input
          {...rest}
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          className={cn(
            'min-h-tap w-full bg-transparent px-3 text-fg outline-none',
            'placeholder:text-fg-subtle',
            numeric && 'numeric',
            className,
          )}
        />
      </div>

      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-fg-subtle">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
