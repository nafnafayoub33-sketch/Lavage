/**
 * tests/pendingRole.test.ts — src/features/auth/pendingRole.ts
 *
 * Regression cover for the A5 dead end: tapping "I have a car", confirming,
 * and nothing happening.
 *
 * Two faults produced that, and both were silent. Each has a test here that
 * fails against the code as it shipped:
 *
 *  1. hydrate() assigned whatever storage held, so A6 calling it on mount
 *     could wipe a role chosen seconds earlier and bounce back to A5.
 *  2. choose() set memory before the write, so a failed write left memory
 *     claiming a role that was never persisted.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { usePendingRole } from '@/features/auth/pendingRole';

const STORAGE_KEY = 'auth.pendingRole';

/** A fresh process: nothing in memory, nothing on disk. */
beforeEach(async () => {
  jest.restoreAllMocks();
  await AsyncStorage.clear();
  usePendingRole.setState({ role: null });
});

const store = () => usePendingRole.getState();

describe('choose', () => {
  it('records the role in memory and on disk', async () => {
    await store().choose('client');

    expect(store().role).toBe('client');
    await expect(AsyncStorage.getItem(STORAGE_KEY)).resolves.toBe('client');
  });

  it('leaves the store untouched when the write fails', async () => {
    jest
      .spyOn(AsyncStorage, 'setItem')
      .mockRejectedValueOnce(new Error('device storage unavailable'));

    await expect(store().choose('owner')).rejects.toThrow('device storage unavailable');

    // The regression: memory must not run ahead of disk. A role held only in
    // memory survives until the next cold start and then vanishes.
    expect(store().role).toBeNull();
    await expect(AsyncStorage.getItem(STORAGE_KEY)).resolves.toBeNull();
  });

  it('surfaces the failure to the caller rather than swallowing it', async () => {
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('nope'));
    // A5 depends on this rejecting; it is what drives the error banner.
    await expect(store().choose('client')).rejects.toThrow();
  });
});

describe('hydrate', () => {
  it('fills in from disk on a cold start', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, 'owner');
    usePendingRole.setState({ role: null });

    await store().hydrate();

    expect(store().role).toBe('owner');
  });

  it('does not overwrite a role already in memory', async () => {
    // Exactly the A5 -> A6 handoff: chosen this session, A6 hydrates on mount.
    await store().choose('client');
    await AsyncStorage.clear(); // pretend the write never landed

    await store().hydrate();

    // Before the fix this became null, and A6 redirected back to A5 — which
    // looked like the confirm button doing nothing at all.
    expect(store().role).toBe('client');
  });

  it('leaves an empty store empty when disk is empty too', async () => {
    await store().hydrate();
    expect(store().role).toBeNull();
  });

  it('ignores a junk value on disk', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, 'superuser');
    await store().hydrate();
    expect(store().role).toBeNull();
  });

  it('never promotes anyone to admin from disk', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, 'admin');
    await store().hydrate();
    expect(store().role).toBeNull();
  });
});

describe('clear', () => {
  it('drops the role from memory and disk', async () => {
    await store().choose('owner');
    await store().clear();

    expect(store().role).toBeNull();
    await expect(AsyncStorage.getItem(STORAGE_KEY)).resolves.toBeNull();
  });

  it('keeps memory and disk consistent when the removal fails', async () => {
    await store().choose('owner');
    jest.spyOn(AsyncStorage, 'removeItem').mockRejectedValueOnce(new Error('nope'));

    await expect(store().clear()).rejects.toThrow();

    // A6 treats this as non-fatal: a stale pending role loses to a real
    // profile row everywhere it is read.
    expect(store().role).toBe('owner');
  });
});

describe('the A5 -> A6 handoff, end to end', () => {
  it('carries the choice across a working write', async () => {
    await store().choose('client'); // A5 confirm
    await store().hydrate(); // A6 mount
    expect(store().role).toBe('client'); // A6 renders instead of redirecting
  });

  it('carries the choice across a cold start', async () => {
    await store().choose('owner');
    usePendingRole.setState({ role: null }); // process restart
    await store().hydrate();
    expect(store().role).toBe('owner');
  });
});
