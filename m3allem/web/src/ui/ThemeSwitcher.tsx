import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { readStoredTheme, storeTheme, type ThemeChoice } from '@/ui/theme'
import { cn } from '@/ui/cn'

const CHOICES: ThemeChoice[] = ['system', 'light', 'dark']

export function ThemeSwitcher({ className }: { className?: string }) {
  const { t } = useTranslation()
  const [choice, setChoice] = useState<ThemeChoice>(() => readStoredTheme())

  const labels: Record<ThemeChoice, string> = {
    system: t('common.themeSystem'),
    light: t('common.themeLight'),
    dark: t('common.themeDark'),
  }

  return (
    <div
      role="group"
      aria-label={t('common.theme')}
      className={cn('inline-flex rounded-md border border-border bg-surface p-0.5', className)}
    >
      {CHOICES.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={choice === option}
          onClick={() => {
            storeTheme(option)
            setChoice(option)
          }}
          className={cn(
            'rounded-sm px-2.5 py-1.5 text-xs font-medium transition-colors duration-(--duration-fast)',
            choice === option
              ? 'bg-surface-inset text-fg'
              : 'text-fg-muted hover:bg-surface-2 hover:text-fg',
          )}
        >
          {labels[option]}
        </button>
      ))}
    </div>
  )
}
