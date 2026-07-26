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

## State of the skeleton

`app/index.tsx` is a smoke-test screen, not a screen from `docs/SCREENS.md`. It
checks that the fonts load, the theme switches, the translations resolve and the
language switch flips direction. It goes away when A1 (splash) lands.

No feature screens exist yet. The route groups `(auth)`, `(client)`, `(owner)`
and `(admin)` are empty placeholders.

There is no test runner yet — it gets added with the first queue usecase.
