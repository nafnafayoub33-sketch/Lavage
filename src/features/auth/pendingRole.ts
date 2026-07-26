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

export const usePendingRole = create<PendingRoleStore>((set) => ({
  role: null,

  choose: async (role) => {
    set({ role });
    await AsyncStorage.setItem(STORAGE_KEY, role);
  },

  clear: async () => {
    set({ role: null });
    await AsyncStorage.removeItem(STORAGE_KEY);
  },

  hydrate: async () => {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    set({ role: saved === 'client' || saved === 'owner' ? saved : null });
  },
}));

export default usePendingRole;
