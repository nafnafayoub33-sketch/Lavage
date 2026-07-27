/**
 * src/features/auth/pendingRole.ts
 *
 * A5 asks "client or owner", but the answer cannot be written yet.
 *
 * `profiles.full_name` is NOT NULL in 0001_init.sql and A5 has not collected
 * a name, so no profile row can exist until A6. The choice therefore waits
 * here — persisted, because an interrupted signup should not ask again.
 *
 * A6 (client) and O1 (owner) are what finally insert the profile row with
 * this role, then call `clear()`.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import type { UserRole } from '@/data/supabase/types';

/** A5 only offers these two — 'admin' is never self-assigned. */
export type SignupRole = Extract<UserRole, 'client' | 'owner'>;

const STORAGE_KEY = 'auth.pendingRole';

type PendingRoleStore = {
  role: SignupRole | null;
  choose: (role: SignupRole) => Promise<void>;
  clear: () => Promise<void>;
  hydrate: () => Promise<void>;
};

export const usePendingRole = create<PendingRoleStore>((set, get) => ({
  role: null,

  /**
   * Storage first, memory second, so the two can never disagree: a failed
   * write leaves the store exactly as it was.
   *
   * Rejects if the device refuses the write. The caller must handle that —
   * A5 cannot quietly carry on, because a choice that did not persist is a
   * signup that restarts from A5 after the next cold start.
   */
  choose: async (role) => {
    await AsyncStorage.setItem(STORAGE_KEY, role);
    set({ role });
  },

  clear: async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    set({ role: null });
  },

  /**
   * Fill in from storage, never overwrite.
   *
   * This used to assign whatever storage held, which meant a screen calling
   * hydrate() on mount could wipe a role chosen moments earlier in the same
   * session and bounce the user back to A5. Memory is the newer of the two
   * by construction — choose() writes storage before it writes memory — so
   * anything already in memory wins.
   */
  hydrate: async () => {
    if (get().role !== null) return;

    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    if (saved === 'client' || saved === 'owner') set({ role: saved });
  },
}));

export default usePendingRole;
