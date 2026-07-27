/**
 * tests/postAuthRoute.test.ts — src/core/usecases/postAuthRoute.ts
 *
 * Where a signed-in user belongs, including every half-finished signup.
 */
import {
  needsWashLookup,
  resolvePostAuthDestination,
  type PostAuthInput,
} from '@/core/usecases/postAuthRoute';

const client = { role: 'client' as const, is_blocked: false };
const owner = { role: 'owner' as const, is_blocked: false };
const admin = { role: 'admin' as const, is_blocked: false };

const resolve = (input: PostAuthInput) => resolvePostAuthDestination(input);

describe('signup not finished', () => {
  it('sends a user with no profile and no role to A5', () => {
    expect(resolve({ profile: null, pendingRole: null })).toEqual({ kind: 'role' });
  });

  it('sends a user who picked a role but has no profile to A6', () => {
    expect(resolve({ profile: null, pendingRole: 'client' })).toEqual({ kind: 'profileSetup' });
  });

  it('sends an owner-to-be to A6 as well, not straight to O1', () => {
    // The bug this replaced: O1 inserts a car_wash referencing profiles(id),
    // and the profile row cannot exist before A6.
    expect(resolve({ profile: null, pendingRole: 'owner' })).toEqual({ kind: 'profileSetup' });
  });
});

describe('blocked accounts', () => {
  it('beats every other consideration', () => {
    expect(resolve({ profile: { role: 'client', is_blocked: true }, pendingRole: null })).toEqual({
      kind: 'blocked',
    });
    expect(
      resolve({
        profile: { role: 'owner', is_blocked: true },
        pendingRole: null,
        washStatus: 'approved',
      }),
    ).toEqual({ kind: 'blocked' });
  });
});

describe('finished accounts', () => {
  it('sends a client to the app', () => {
    expect(resolve({ profile: client, pendingRole: null })).toEqual({
      kind: 'app',
      role: 'client',
    });
  });

  it('sends an admin to the app', () => {
    expect(resolve({ profile: admin, pendingRole: null })).toEqual({ kind: 'app', role: 'admin' });
  });

  it('ignores a stale pending role once a real profile exists', () => {
    expect(resolve({ profile: client, pendingRole: 'owner' })).toEqual({
      kind: 'app',
      role: 'client',
    });
  });
});

describe('owners, by the state of their car wash', () => {
  it('sends an owner with no wash to O1', () => {
    expect(resolve({ profile: owner, pendingRole: null, washStatus: null })).toEqual({
      kind: 'registerWash',
    });
  });

  it('sends an owner waiting on an admin to O2', () => {
    expect(resolve({ profile: owner, pendingRole: null, washStatus: 'pending' })).toEqual({
      kind: 'washPending',
    });
  });

  it.each(['approved', 'suspended', 'closed'] as const)(
    'sends an owner with a %s wash to the queue board',
    (washStatus) => {
      // Suspended and closed belong there too — the board is what explains a
      // suspension to its owner.
      expect(resolve({ profile: owner, pendingRole: null, washStatus })).toEqual({
        kind: 'app',
        role: 'owner',
      });
    },
  );

  it('never lands an owner on a queue board when the wash was not looked up', () => {
    expect(resolve({ profile: owner, pendingRole: null })).toEqual({ kind: 'registerWash' });
  });
});

describe('needsWashLookup', () => {
  it('is true only for owners', () => {
    expect(needsWashLookup(owner)).toBe(true);
    expect(needsWashLookup(client)).toBe(false);
    expect(needsWashLookup(admin)).toBe(false);
    expect(needsWashLookup(null)).toBe(false);
  });
});
