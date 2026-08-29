import { useTranslation } from 'react-i18next'
import { Link, Outlet } from 'react-router-dom'

import { useSession } from '@/data/auth'
import { LanguageSwitcher } from '@/ui/LanguageSwitcher'
import { ThemeSwitcher } from '@/ui/ThemeSwitcher'

export function PublicLayout() {
  const { t } = useTranslation()
  const { data: user } = useSession()

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <Link to="/" className="text-lg font-semibold text-fg">
            {t('common.appName')}
          </Link>

          <div className="ms-auto flex flex-wrap items-center gap-2">
            <ThemeSwitcher className="hidden sm:inline-flex" />
            <LanguageSwitcher />
            {user ? (
              <Link
                to={user.home_path}
                className="min-h-tap rounded-md px-3 py-2 text-sm font-medium text-fg hover:bg-surface-2"
              >
                {user.full_name}
              </Link>
            ) : (
              <Link
                to="/login"
                className="min-h-tap rounded-md px-3 py-2 text-sm font-medium text-fg hover:bg-surface-2"
              >
                {t('common.signIn')}
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-border px-4 py-6 text-center text-xs text-fg-subtle">
        {t('common.appName')}
      </footer>
    </div>
  )
}
