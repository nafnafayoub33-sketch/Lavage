import { type FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useLocation } from 'react-router-dom'

import { useLogin, useSession } from '@/data/auth'
import { useErrorMessage } from '@/hooks/useErrorMessage'
import { Alert } from '@/ui/Alert'
import { Button } from '@/ui/Button'
import { Field } from '@/ui/Field'

/** P4 — phone and password. */
export function LoginPage() {
  const { t } = useTranslation()
  const location = useLocation()
  const { data: user } = useSession()
  const login = useLogin()
  const message = useErrorMessage()

  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')

  if (user) {
    const from = (location.state as { from?: string } | null)?.from
    return <Navigate to={from ?? user.home_path} replace />
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    login.mutate({ phone, password })
  }

  return (
    <div className="mx-auto w-full max-w-sm px-4 py-14">
      <h1 className="mb-6 text-2xl font-semibold text-fg">{t('auth.loginTitle')}</h1>

      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        {login.isError && <Alert tone="danger">{message(login.error)}</Alert>}

        <Field
          label={t('auth.phone')}
          prefix="+212"
          numeric
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          required
        />
        <Field
          label={t('auth.password')}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />

        <Button type="submit" fullWidth loading={login.isPending}>
          {t('auth.loginCta')}
        </Button>
      </form>

      <p className="mt-6 text-sm text-fg-muted">
        {t('auth.noAccount')}{' '}
        <Link to="/register" className="font-medium text-primary underline-offset-4 hover:underline">
          {t('common.signUp')}
        </Link>
      </p>
      <p className="mt-2 text-sm">
        <Link to="/forgot" className="text-fg-subtle underline-offset-4 hover:underline">
          {t('auth.forgot')}
        </Link>
      </p>
    </div>
  )
}
