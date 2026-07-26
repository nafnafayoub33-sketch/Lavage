# Lavage

A car wash marketplace for Morocco — client, owner and admin in one app.
Android and iOS from one codebase.

Read [`CLAUDE.md`](CLAUDE.md) before writing code. The specs live in
[`docs/SCREENS.md`](docs/SCREENS.md) and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Setup

```bash
npm install
cp .env.example .env    # then fill in your Supabase project URL and anon key
npm start
```

Then press `a` for Android or `i` for iOS.

`.env` is gitignored. Never commit real keys — and never put the `service_role`
key in this repo at all; the client only ever uses the anon key, with row level
security doing the actual access control.

## Scripts

| Command | What it does |
|---|---|
| `npm start` | Expo dev server |
| `npm run android` / `npm run ios` | dev server, opening that platform |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | `expo lint` |

## Where things go

Layout follows `docs/ARCHITECTURE.md`:

- `app/` — expo-router routes only, no business logic, no Supabase calls
- `src/core/` — framework-free domain, usecases and queue math
- `src/data/` — Supabase client, repositories, realtime channels
- `src/features/` — one folder per feature; features never import each other
- `src/ui/` — the design system, including `theme.ts`
- `src/lib/` — i18n, formatters, the query client
- `tests/` — queue math and usecases

## What is built

**A3 · phone**, **A4 · SMS code** and **A5 · account type**, with Supabase phone
auth. `app/index.tsx` carries A1's routing decision (signed in → the app by role,
otherwise → A3) without A1's logo screen.

Everything else is a placeholder that names the screen it stands in for — A6, O1,
C1, O3, D1. A2 (language) is not built, so the language follows the device locale
for now, and appearance follows the system setting until C14 lands.

**Phone auth needs an SMS provider** (Twilio, Vonage or MessageBird) configured in
the Supabase dashboard under Authentication → Providers. Without it the code never
arrives and A3 shows a generic error.

There is no test runner yet — it gets added with the first queue usecase. The pure
usecases under `src/core/usecases/` are written to be unit-tested the moment it does.
