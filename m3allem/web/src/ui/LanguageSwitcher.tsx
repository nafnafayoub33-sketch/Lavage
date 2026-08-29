import { useTranslation } from 'react-i18next'

import { LANGUAGES, LANGUAGE_LABELS, setLanguage, type Language } from '@/lib/i18n'
import { cn } from '@/ui/cn'

/**
 * Three languages, always reachable. Changing it flips `dir` on <html>, so the
 * whole layout mirrors without a reload.
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const { i18n, t } = useTranslation()
  const current = i18n.language as Language

  return (
    <div
      role="group"
      aria-label={t('common.language')}
      className={cn('inline-flex rounded-md border border-border bg-surface p-0.5', className)}
    >
      {LANGUAGES.map((language) => (
        <button
          key={language}
          type="button"
          aria-pressed={current === language}
          onClick={() => void setLanguage(language)}
          className={cn(
            'rounded-sm px-2.5 py-1.5 text-xs font-medium transition-colors duration-(--duration-fast)',
            current === language
              ? 'bg-primary text-primary-fg'
              : 'text-fg-muted hover:bg-surface-2 hover:text-fg',
          )}
        >
          {LANGUAGE_LABELS[language]}
        </button>
      ))}
    </div>
  )
}
