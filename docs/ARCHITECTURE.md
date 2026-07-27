# Lavajna Platform — Architecture

One codebase → Android + iOS.

## Stack

| Layer | Choice | Why |
|---|---|---|
| App | **React Native + Expo (SDK 57)** | one code base for both stores, OTA updates, no Mac needed for most of the dev cycle |
| Language | **TypeScript (strict)** | required for a 3-role app of this size |
| Navigation | expo-router | file-based, role-based route groups |
| State / data | TanStack Query + Zustand | server cache separated from UI state |
| Backend | **Supabase** (Postgres + Auth + Realtime + Storage + Edge Functions) | the queue needs realtime; RLS enforces the 3 roles at the DB level, not in the client |
| Maps | react-native-maps | native map on both platforms |
| Push | Expo Notifications | one API for FCM + APNs |
| Auth | **Phone + SMS OTP** (Supabase phone auth) | everyone in Morocco has a number; no password to forget. Needs an SMS provider configured in the Supabase dashboard |
| Payments | Phase 2 — CMI / PayZone / Naps wrapped behind `PaymentGateway` interface | never call a provider SDK directly from a screen |

The whole data layer sits behind repositories (`src/data/repositories`). If Supabase is ever
swapped out, screens don't change.

## Folder structure

```
lavajna/
├─ app/                          # expo-router (routes only, no logic)
│  ├─ (auth)/                    # login, otp, role picker
│  ├─ (client)/                  # map, wash detail, booking, my queue, history
│  ├─ (owner)/                   # dashboard, live queue, services, credit, stats
│  ├─ (admin)/                   # approvals, washes, disputes, settings
│  └─ _layout.tsx                # role gate: redirects by profile.role
│
├─ src/
│  ├─ core/                      # framework-free
│  │  ├─ domain/                 # entities + enums (Booking, CarWash, Service)
│  │  ├─ usecases/               # bookWash, cancelBooking, confirmWash, chargeCredit
│  │  └─ queue/                  # queue math — pure, unit-tested
│  │
│  ├─ data/
│  │  ├─ supabase/               # client, generated DB types
│  │  ├─ repositories/           # BookingRepository, WashRepository, CreditRepository
│  │  └─ realtime/               # queue subscription channel
│  │
│  ├─ features/                  # one folder per feature, UI + hooks together
│  │  ├─ auth/  booking/  queue/  wash/  credit/  reviews/  notifications/
│  │
│  ├─ ui/                        # design system: Button, Card, Sheet, Badge, theme
│  ├─ hooks/                     # useLocation, useSession, useRealtimeQueue
│  └─ lib/                       # formatters (money in centimes), date, i18n
│
├─ supabase/
│  ├─ migrations/                # schema.sql lives here, versioned
│  └─ functions/                 # edge functions: auto-confirm cron, push sender
│
└─ tests/                        # queue math, usecases
```

Rules: routes contain no business logic, features never import each other,
money is always `int` centimes and only formatted at render time.

## Key flows

**Sign-in (A3 → A4 → A5)**
1. A3 takes the national number behind a fixed `+212`, and calls
   `is_phone_blocked()` (0002) before spending an SMS on a blocked number
2. `signInWithOtp` sends the code; A4 verifies it
3. three wrong codes → 15-minute lockout, held on the device per number. This is
   a UX guard — Supabase's own rate limiting is the actual brute-force defence
4. after verification the profile is re-read: **no row = new user** (0001 creates
   none, and `full_name` is NOT NULL) → A5, otherwise straight to the app by role
5. A5's answer waits in `pendingRole` until A6/O1 can insert the profile row

**Booking**
1. client picks service → `bookWash` usecase → insert `bookings` (status `pending`)
2. DB trigger assigns the daily `ticket_no`
3. `queue_state()` returns cars ahead + ETA, pushed live over Supabase Realtime
4. edge function watches positions → sends push at **2 cars left** then **1 car left**

**Completion & billing**
1. owner taps *Start* → `in_progress`, then *Finished* → `done`
2. client gets a push: confirm + rate
3. client confirms **or** 2h pass (`auto_confirm_stale_bookings` cron) → `confirmed`
4. trigger deducts **1 DH** from the wash's credit (or 1 from the free 100)
5. balance hits 0 → the wash disappears from `nearby_car_washes` automatically

**Owner cancellation**
Reason is mandatory. `refresh_cancel_rates()` runs nightly:
≥20% → warning, ≥40% → auto `suspended`. "Closed today" toggle exists so a
legitimate closure never counts as a cancellation.

**No-show**
Owner has a *client didn't come* button → `no_show`, no credit charged,
client's `no_show_count` +1. At 3, booking is blocked for 48h.

## Build order

| Phase | Content | Est. |
|---|---|---|
| 0 | Supabase project, schema, auth + roles, design system | 1 week |
| 1 | Client: map, wash detail, booking, live queue, push | 2 weeks |
| 2 | Owner: live queue board, start/finish, services, credit top-up | 2 weeks |
| 3 | Admin: approvals, disputes, settings, stats | 1 week |
| 4 | Reviews, history, no-show rules, cancel-rate engine | 1 week |
| 5 | Store release (Play Console + App Store) | 1 week |
| 6 | Mobile wash + escrow, loyalty points, referrals | later |

## Before writing screens — decisions still open

1. Credit top-up in phase 1: manual (bank transfer, admin credits the account) or
   card gateway right away? Manual is faster to ship and legally simpler.
2. Brand colors. The app name is settled: **Lavajna** / `lavajna` /
   `com.lavajna.app`. The bundle ID is permanent after the first store
   submission, so it should not move again.
