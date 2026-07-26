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

The whole auth flow: **A2 · language** → **A3 · phone** → **A4 · SMS code** →
**A5 · account type** → **A6 · profile setup** → **A7 · permissions**, then the
app for clients and O1 for owners. `app/index.tsx` carries A1's routing decision
without A1's logo screen, including half-finished signups — a user who quit at A6
resumes at A6, an owner who quit at O1 resumes at O1.

Everything past that is a placeholder that names the screen it stands in for —
O1, O2, C1, O3, D1. Appearance follows the system setting until C14 lands.

A6's optional photo is not built: it needs a Supabase Storage bucket that does not
exist yet, so `avatar_url` stays null.

**Phone auth needs an SMS provider** (Twilio, Vonage or MessageBird) configured in
the Supabase dashboard under Authentication → Providers. Without it the code never
arrives and A3 shows a generic error.

There is no test runner yet — it gets added with the first queue usecase. The pure
usecases under `src/core/usecases/` are written to be unit-tested the moment it does.
