/**
 * src/data/repositories/AuthRepository.ts
 *
 * Phone OTP sign-in (A3, A4) and the profile read that decides where the
 * user lands afterwards.
 *
 * Screens never touch the Supabase client. They also never read error
 * strings: everything here comes back as a typed reason, because Supabase's
 * messages are English, user-hostile, and not a stable API.
 */
import { supabase } from '@/data/supabase/client';
import type { ProfileRow } from '@/data/supabase/types';

/** Every way sending or checking a code can fail, as far as a screen cares. */
export type AuthFailure =
  /** the number is on profiles.is_blocked */
  | 'blocked'
  /** wrong code */
  | 'invalid_code'
  /** the code aged out before it was used */
  | 'expired_code'
  /** Supabase's own SMS rate limit, not our lockout */
  | 'sms_rate_limit'
  /** the request never reached the server */
  | 'offline'
  /** anything else — show the generic message, log the detail */
  | 'unknown';

export type AuthResult<T> = { ok: true; value: T } | { ok: false; reason: AuthFailure };

const ok = <T>(value: T): AuthResult<T> => ({ ok: true, value });
const fail = <T>(reason: AuthFailure): AuthResult<T> => ({ ok: false, reason });

/**
 * Supabase surfaces a stable `code` on AuthApiError for the cases we care
 * about; `status` covers the transport. Message text is only ever a last
 * resort, and never shown to the user.
 */
function classify(error: { code?: string; status?: number; message?: string }): AuthFailure {
  switch (error.code) {
    case 'otp_expired':
      return 'expired_code';
    case 'otp_disabled':
    case 'validation_failed':
      return 'unknown';
    case 'over_sms_send_rate_limit':
    case 'over_request_rate_limit':
      return 'sms_rate_limit';
    case 'user_banned':
      return 'blocked';
  }

  // 429 without a specific code is still rate limiting.
  if (error.status === 429) return 'sms_rate_limit';

  // supabase-js reports a failed fetch with status 0 / no status.
  if (error.status === undefined || error.status === 0) return 'offline';

  // A rejected code comes back as a 403 with a generic message.
  if (error.status === 403 || error.status === 401) return 'invalid_code';

  return 'unknown';
}

/**
 * A3 pre-flight. Saves an SMS on a number an admin has already blocked.
 *
 * See supabase/migrations/0002_is_phone_blocked.sql — the function answers
 * only "is this blocked", never "does this exist". A failure here is not
 * fatal: we let the user through and rely on the post-verification check.
 */
export async function isPhoneBlocked(phoneE164: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_phone_blocked', { p_phone: phoneE164 });
  if (error) return false;
  return data === true;
}

/** A3 — send the SMS. */
export async function sendOtp(phoneE164: string): Promise<AuthResult<void>> {
  if (await isPhoneBlocked(phoneE164)) return fail('blocked');

  const { error } = await supabase.auth.signInWithOtp({ phone: phoneE164 });
  if (error) return fail(classify(error));

  return ok(undefined);
}

/** A4 — resend after the countdown. Same call, named for the screen that uses it. */
export const resendOtp = sendOtp;

/**
 * A4 — check the code. On success the session exists, so the profile read
 * below is authenticated and RLS lets it through.
 */
export async function verifyOtp(
  phoneE164: string,
  token: string,
): Promise<AuthResult<{ userId: string }>> {
  const { data, error } = await supabase.auth.verifyOtp({
    phone: phoneE164,
    token,
    type: 'sms',
  });

  if (error) return fail(classify(error));
  if (!data.user) return fail('unknown');

  return ok({ userId: data.user.id });
}

/**
 * The signed-in user's profile, or null when they have not finished signing
 * up — 0001_init.sql creates no row automatically, so "no row" is the
 * new-user signal A4 branches on.
 */
export async function getMyProfile(): Promise<AuthResult<ProfileRow | null>> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .maybeSingle();

  if (error) return fail(classify(error));
  return ok(data);
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

export async function getSessionUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}
