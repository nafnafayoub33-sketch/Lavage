import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { useTrades } from '@/data/catalog'
import { localisedName } from '@/data/types'
import type { Language } from '@/lib/i18n'
import { Button } from '@/ui/Button'
import { EmptyState } from '@/ui/EmptyState'
import { ErrorState } from '@/ui/ErrorState'
import { SkeletonGrid } from '@/ui/Skeleton'

/** P1 — explain the thing in five seconds, and start a request. */
export function LandingPage() {
  const { t, i18n } = useTranslation()
  const language = i18n.language as Language
  const trades = useTrades()

  return (
    <div className="mx-auto max-w-6xl px-4">
      <section className="py-14 sm:py-20">
        <h1 className="max-w-3xl text-3xl font-semibold text-balance text-fg sm:text-4xl">
          {t('landing.title')}
        </h1>
        <p className="mt-3 max-w-2xl text-base text-fg-muted">{t('landing.subtitle')}</p>

        <div className="mt-7 flex flex-wrap gap-3">
          <Link to="/client/requests/new">
            <Button size="lg">{t('landing.ctaClient')}</Button>
          </Link>
          <Link to="/register">
            <Button size="lg" variant="secondary">
              {t('landing.ctaProvider')}
            </Button>
          </Link>
        </div>
      </section>

      <section aria-labelledby="trades-heading" className="pb-14">
        <h2 id="trades-heading" className="mb-4 text-lg font-semibold text-fg">
          {t('landing.tradesTitle')}
        </h2>

        {/* The four states every list owes the reader. */}
        {trades.isPending && <SkeletonGrid />}
        {trades.isError && <ErrorState error={trades.error} onRetry={() => void trades.refetch()} />}
        {trades.isSuccess && trades.data.length === 0 && (
          <EmptyState title={t('landing.tradesEmpty')} />
        )}
        {trades.isSuccess && trades.data.length > 0 && (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {trades.data.map((trade) => (
              <li key={trade.id}>
                <Link
                  to={`/services/${trade.slug}`}
                  className="flex min-h-24 flex-col justify-end rounded-lg border border-border bg-surface p-4 transition-colors duration-(--duration-fast) hover:border-primary/40 hover:bg-primary-soft"
                >
                  <span className="text-sm font-medium text-fg">
                    {localisedName(trade, language)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="how-heading" className="border-t border-border py-14">
        <h2 id="how-heading" className="mb-6 text-lg font-semibold text-fg">
          {t('landing.howTitle')}
        </h2>
        <ol className="grid gap-6 sm:grid-cols-3">
          {(['how1', 'how2', 'how3'] as const).map((step, index) => (
            <li key={step} className="flex flex-col gap-2">
              <span className="numeric flex size-8 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary">
                {index + 1}
              </span>
              <h3 className="font-medium text-fg">{t(`landing.${step}Title`)}</h3>
              <p className="text-sm text-fg-muted">{t(`landing.${step}Body`)}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mb-14 rounded-lg border border-border bg-surface-2 p-6">
        <h2 className="font-semibold text-fg">{t('landing.forProsTitle')}</h2>
        <p className="mt-2 max-w-2xl text-sm text-fg-muted">{t('landing.forProsBody')}</p>
        <Link to="/register" className="mt-4 inline-block">
          <Button variant="secondary">{t('landing.ctaProvider')}</Button>
        </Link>
      </section>
    </div>
  )
}
