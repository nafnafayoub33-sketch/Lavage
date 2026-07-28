/**
 * src/core/usecases/postAuthRoute.ts
 *
 * Where a signed-in user belongs. Used by A1's decision and by A4 once a code
 * checks out.
 *
 * What makes a user "new": 0001_init.sql creates no profile row on signup,
 * and `profiles.full_name` is NOT NULL, so a row cannot exist until the user
 * has been through A6. No row therefore means "has not finished signing up".
 *
 * An owner needs a second question answered. Since A5 now routes owners
 * through A6 and A7 like everyone else, an owner can hold a finished profile
 * and still have no car wash — someone who closed the app on O1. Sending them
 * to a queue board that assumes a wash exists is a crash, so the wash status
 * is part of the decision.
 *
 * Pure — the caller does the reads and the navigating.
 */
import type { ProfileRow, UserRole, WashStatus } from '@/data/supabase/types';

export type PostAuthDestination =
  /** A5 — pick client or owner */
  | { kind: 'role' }
  /** A6 — the role is chosen but the profile row does not exist yet */
  | { kind: 'profileSetup' }
  /** O1 — owner with no car wash registered */
  | { kind: 'registerWash' }
  /** O2 — the wash is registered and waiting on an admin */
  | { kind: 'washPending' }
  /** the app, by role */
  | { kind: 'app'; role: UserRole }
  /** the account is blocked; sign them straight back out */
  | { kind: 'blocked' };

export type PostAuthInput = {
  profile: Pick<ProfileRow, 'role' | 'is_blocked'> | null;
  /**
   * A5's answer, still on the device because A6 has not run yet. Only
   * consulted when there is no profile row.
   */
  pendingRole: 'client' | 'owner' | null;
  /**
   * The owner's wash, or null if they have none. Undefined means "not looked
   * up" — correct for clients and admins, who never need it.
   */
  washStatus?: WashStatus | null;
};

export function resolvePostAuthDestination(input: PostAuthInput): PostAuthDestination {
  const { profile, pendingRole, washStatus } = input;

  // No profile row: somewhere between A5 and A6.
  if (profile === null) {
    return pendingRole === null ? { kind: 'role' } : { kind: 'profileSetup' };
  }

  if (profile.is_blocked) return { kind: 'blocked' };

  if (profile.role === 'owner') {
    // Not looked up yet — the caller has to fetch it before we can answer.
    if (washStatus === undefined) return { kind: 'registerWash' };
    if (washStatus === null) return { kind: 'registerWash' };
    // 'rejected' goes to the same screen: O2 is where the admin's reason is
    // shown and where "Submit again" lives, so the two states share a
    // destination even though they read very differently once there.
    if (washStatus === 'pending' || washStatus === 'rejected') {
      return { kind: 'washPending' };
    }
    // approved, suspended and closed all belong on the queue board; the board
    // is what explains a suspension to its owner.
  }

  return { kind: 'app', role: profile.role };
}

/** True when the caller still needs to fetch the wash before deciding. */
export function needsWashLookup(profile: Pick<ProfileRow, 'role'> | null): boolean {
  return profile?.role === 'owner';
}
