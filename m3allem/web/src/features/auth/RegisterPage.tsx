import { type FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate } from 'react-router-dom'

import { useRegister, useSession } from '@/data/auth'
import { useErrorMessage } from '@/hooks/useErrorMessage'
import type { Language } from '@/lib/i18n'
import { Alert } from '@/ui/Alert'
import { Button } from '@/ui/Button'
import { Field } from '@/ui/Field'
import { cn } from '@/ui/cn'

type SelfRegisterableRole = 'client' | 'provider'

/**
 * P5 — the two cards, then the account.
 *
 * Only `client` and `provider` are offered, and the API refuses anything else
 * regardless of what is posted: hiding a radio button is not a control.
 */
export function RegisterPage() {
  const { t, i18n } = useTranslation()
  const { data: user } = useSession()
  const register = useRegister()
  const message = useErrorMessage()

  const [role, setRole] = useState<SelfRegisterableRole>('client')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')

  if (user) return <Navigate to={user.home_path} replace />

  function submit(event: FormEvent) {
    event.preventDefault()
    register.mutate({
      phone,
      full_name: fullName,
      password,
      role,
      language: i18n.language as Language,
    })
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 py-14">
      <h1 className="mb-6 text-2xl font-semibold text-fg">{t('auth.registerTitle')}</h1>

      <fieldset className="mb-6">
        <legend className="mb-3 text-sm font-medium text-fg">{t('auth.chooseRole')}</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {(['client', 'provider'] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={role === option}
              onClick={() => setRole(option)}
              className={cn(
                'flex flex-col gap-1 rounded-lg border p-4 text-start transition-colors duration-(--duration-fast)',
                role === option
                  ? 'border-primary bg-primary-soft'
                  : 'border-border bg-surface hover:bg-surface-2',
              )}
            >
              <span className="font-medium text-fg">
                {t(option === 'client' ? 'auth.roleClientTitle' : 'auth.roleProviderTitle')}
              </span>
              <span className="text-xs text-fg-muted">
                {t(option === 'client' ? 'auth.roleClientBody' : 'auth.roleProviderBody')}
              </span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-fg-subtle">{t('auth.roleLockedNote')}</p>
      </fieldset>

      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        {register.isError && <Alert tone="danger">{message(register.error)}</Alert>}

        <Field
          label={t('auth.fullName')}
          autoComplete="name"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          required
        />
        <Field
          label={t('auth.phone')}
          hint={t('auth.phoneHint')}
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
          hint={t('auth.passwordHint')}
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />

        <Button type="submit" fullWidth loading={register.isPending}>
          {t('auth.registerCta')}
        </Button>
      </form>

      <p className="mt-6 text-sm text-fg-muted">
        {t('auth.haveAccount')}{' '}
        <Link to="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          {t('common.signIn')}
        </Link>
      </p>
    </div>
  )
}
