import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { Alert } from '@/ui/Alert'

/** P6 — honest about what does not exist yet. SMS reset lands in Phase 4. */
export function ForgotPage() {
  const { t } = useTranslation()

  return (
    <div className="mx-auto w-full max-w-sm px-4 py-14">
      <h1 className="mb-4 text-2xl font-semibold text-fg">{t('auth.forgot')}</h1>
      <Alert tone="info">{t('auth.forgotBody')}</Alert>
      <p className="mt-6 text-sm">
        <Link to="/login" className="text-primary underline-offset-4 hover:underline">
          {t('common.back')}
        </Link>
      </p>
    </div>
  )
}
