/**
 * src/core/usecases/postAuthRoute.ts
 *
 * A4: "-> new user: A5 | returning: the app".
 *
 * What makes a user "new": 0001_init.sql creates no profile row on signup,
 * and `profiles.full_name` is NOT NULL, so a row cannot exist until the user
 * has been through A5/A6. No row therefore means "has not finished signing
 * up" — that is the whole test, no extra column needed.
 *
 * Pure — takes a profile (or null) and returns where to go. The screen turns
 * the answer into a route.
 */
import type { ProfileRow, UserRole } from '@/data/supabase/types';

export type PostAuthDestination =
  /** A5 — pick client or owner */
  | { kind: 'role' }
  /** the app, by role */
  | { kind: 'app'; role: UserRole }
  /** the account is blocked; sign them straight back out */
  | { kind: 'blocked' };

export function resolvePostAuthDestination(
  profile: Pick<ProfileRow, 'role' | 'is_blocked'> | null,
): PostAuthDestination {
  if (profile === null) return { kind: 'role' };
  if (profile.is_blocked) return { kind: 'blocked' };
  return { kind: 'app', role: profile.role };
}
