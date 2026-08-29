import { useTranslation } from 'react-i18next'
import { Link, Outlet } from 'react-router-dom'

import { useSession } from '@/data/auth'
import { Button } from '@/ui/Button'
import { Logo } from '@/ui/illustrations/Logo'
import { LanguageSwitcher } from '@/ui/LanguageSwitcher'
import { ThemeSwitcher } from '@/ui/ThemeSwitcher'

export function PublicLayout() {
  const { t } = useTranslation()
  const { data: user } = useSession()

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-border bg-surface/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-5 py-3">
          <Link to="/" aria-label={t('common.appName')}>
            <Logo />
          </Link>

          <div className="ms-auto flex flex-wrap items-center gap-2">
            <ThemeSwitcher className="hidden md:inline-flex" />
            <LanguageSwitcher />
            {user ? (
              <Link to={user.home_path}>
                <Button variant="secondary" size="sm">
                  {user.full_name}
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" size="sm">
                    {t('common.signIn')}
                  </Button>
                </Link>
                <Link to="/register">
                  <Button size="sm">{t('common.signUp')}</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-border bg-surface-2">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-5 py-6">
          <Logo />
          <span className="ms-auto text-xs text-fg-subtle">{t('landing.trustNote')}</span>
        </div>
      </footer>
    </div>
  )
}
