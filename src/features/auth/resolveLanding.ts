/**
 * src/features/auth/resolveLanding.ts
 *
 * The reads behind postAuthRoute's pure decision, in one place because both
 * A1 (app/index.tsx) and A4 need exactly the same answer and must not drift.
 *
 * The owner's wash is only fetched when the profile says owner — clients and
 * admins never pay for a query they cannot use.
 */
import type { Href } from 'expo-router';

import {
  needsWashLookup,
  resolvePostAuthDestination,
  type PostAuthDestination,
} from '@/core/usecases/postAuthRoute';
import { getMyProfile } from '@/data/repositories/AuthRepository';
import { getMyWashStatus } from '@/data/repositories/WashRepository';
import type { WashStatus } from '@/data/supabase/types';

import { usePendingRole } from './pendingRole';

/**
 * `null` means the profile could not be read at all — the caller decides
 * whether that is a retry or a trip back through sign-in.
 */
export async function resolveLanding(): Promise<PostAuthDestination | null> {
  const profile = await getMyProfile();
  if (!profile.ok) return null;

  // A5's answer only matters while there is no row yet.
  let pendingRole = usePendingRole.getState().role;
  if (profile.value === null && pendingRole === null) {
    await usePendingRole.getState().hydrate();
    pendingRole = usePendingRole.getState().role;
  }

  let washStatus: WashStatus | null | undefined;
  if (needsWashLookup(profile.value)) {
    const wash = await getMyWashStatus();
    if (!wash.ok) return null;
    washStatus = wash.value;
  }

  return resolvePostAuthDestination({ profile: profile.value, pendingRole, washStatus });
}

/**
 * The one place a destination becomes a route.
 *
 * 'blocked' lands back on A3, but the caller must sign the user out first —
 * leaving a blocked session alive would walk them straight back in.
 */
export function landingHref(destination: PostAuthDestination): Href {
  switch (destination.kind) {
    case 'role':
      return '/(auth)/role';
    case 'profileSetup':
      return '/(auth)/profile-setup';
    case 'registerWash':
      return '/(owner)/register';
    case 'washPending':
      return '/(owner)/pending';
    case 'blocked':
      return '/(auth)/phone';
    case 'app':
      switch (destination.role) {
        case 'owner':
          return '/(owner)/queue';
        case 'admin':
          return '/(admin)';
        case 'client':
          return '/(client)/home';
      }
  }
}
