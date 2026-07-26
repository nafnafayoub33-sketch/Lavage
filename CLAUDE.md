# CLAUDE.md

Project rules for this repository. Read this before writing any code.

## What this is

A car wash marketplace for Morocco. Three roles in one app:

- **Client** — sees nearby car washes with a live wait time, books a place in the queue,
  gets a push notification when their turn is close, confirms and rates afterwards.
- **Owner** — runs the live queue board, manages services and prices, tops up credit.
- **Admin** — approves car washes, handles disputes, controls platform settings.

**Business model:** the platform charges the car wash **1 DH per confirmed wash**, deducted
from a prepaid balance. New car washes get 100 free washes. Balance at zero → the car wash
stops appearing in search. There is no commission on the wash price.

## Read these first

| File | What it holds |
|---|---|
| `docs/SCREENS.md` | Every screen, its contents, its states, and the menus. Written in Moroccan Darija. |
| `docs/ARCHITECTURE.md` | Stack, folder structure, key flows, build order. |
| `supabase/migrations/0001_init.sql` | The whole database: tables, queue functions, billing triggers, RLS. |
| `src/ui/theme.ts` | Design tokens — light and dark. |
| `src/lib/i18n.ts` | Arabic, French, English. |

If a request contradicts these files, say so instead of silently doing something else.

## Stack

React Native + Expo (SDK 51+) · TypeScript strict · expo-router · TanStack Query + Zustand ·
Supabase (Postgres, Auth, Realtime, Storage, Edge Functions) · react-native-maps ·
Expo Notifications · i18next.

One codebase, Android and iOS.

## Rules

**Architecture**
- Files under `app/` are routes only. No business logic, no direct Supabase calls.
- All data access goes through `src/data/repositories/*`. Screens never import the Supabase
  client directly.
- Business rules live in `src/core/usecases/*` and are framework-free and unit-testable.
- Features never import from each other. Shared code goes to `src/ui`, `src/hooks`, `src/lib`.

**Money**
- Always integer **centimes**. `3000` is 30,00 DH. Never floats.
- Format only at render time, with `formatDH()` from `src/lib/i18n.ts`.

**Design**
- Never hardcode a colour, font size, radius or spacing value. Import from `src/ui/theme.ts`.
- Both light and dark must work. Test every new screen in both.
- One primary button per screen.
- Motion only when something real changes — see the motion budget in `theme.ts`.

**Language**
- No hardcoded user-facing strings. Every string is an i18n key in `src/lib/i18n.ts`.
- Three languages: `ar` (default, RTL), `fr`, `en`.
- Use logical properties: `marginStart` not `marginLeft`, `flex-start` not `left`.
- Numbers, prices, plate numbers and ticket numbers stay Latin digits and LTR in all
  three languages. Never build a sentence by string concatenation — use interpolation.

**Database**
- Security lives in RLS policies, not in the client. If a screen needs data it shouldn't
  see, fix the policy, don't work around it.
- Never change `0001_init.sql`. Add a new numbered migration.

**Quality**
- Every list screen handles four states: loading skeleton, empty, error with retry, and data.
- No `any`. No `// @ts-ignore`.
- Destructive actions (cancel, delete, top up) always confirm first.
- Owner-facing buttons are at least 52px tall — they are tapped with wet hands.

## Do not

- Do not add a UI library. The design system in `src/ui` is the design system.
- Do not add a state manager beyond TanStack Query + Zustand.
- Do not use `localStorage`, or any web-only API.
- Do not commit secrets. Supabase keys go in `.env` and `app.config.ts`.
- Do not scaffold screens that aren't in `docs/SCREENS.md` without asking.

## Build order

Phase 1 (current): auth (phone + SMS OTP) → client map and queue → owner queue board →
owner credit top-up → admin approvals.
Phase 2: history, reviews, points and referrals, stats.
Phase 3: mobile wash with escrow payment.

Screen IDs referenced in commits and issues (`C1`, `O3`, `D2`…) come from `docs/SCREENS.md`.

## Working style

- Small commits, one screen or one concern each.
- Before building a screen, re-read its entry in `docs/SCREENS.md` and list the states you
  will implement.
- When something in the spec is ambiguous, ask rather than guess.
