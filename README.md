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

## Google Maps key (Android only)

C1's map is blank on Android without this, and nothing in the build warns you —
Android has no built-in map provider. iOS uses Apple Maps and needs no key.

1. **Google Cloud console** → <https://console.cloud.google.com/> → create or pick
   a project.
2. **Enable billing on the project.** Maps refuses to serve without a billing
   account attached, even inside the free tier.
3. **APIs & Services → Library** → enable **Maps SDK for Android**. Enable that
   exact one; "Maps JavaScript API" is a different product and will not work.
4. **APIs & Services → Credentials → Create credentials → API key.**
5. **Restrict the key immediately** — it ships inside the APK, so restriction is
   what protects it, not secrecy:
   - *Application restrictions* → **Android apps** → add package name
     `com.lavage.app` plus your signing SHA-1.
   - *API restrictions* → **Restrict key** → Maps SDK for Android.
6. Get the SHA-1 you need in step 5:
   - EAS builds: `npx eas credentials` → Android → the build profile → it prints
     the fingerprint. Add one entry per profile you build (development,
     preview, production) — they are signed by different keys.
   - Local debug builds: `keytool -list -v -keystore ~/.android/debug.keystore
     -alias androiddebugkey -storepass android -keypass android`
7. Put it in `.env`:
   ```
   GOOGLE_MAPS_ANDROID_API_KEY=AIza...
   ```
8. **Make a new native build.** This value goes into the Android manifest at
   build time, so a JS reload or a restarted dev server will not pick it up:
   ```
   npx expo run:android          # local
   npx eas build -p android      # EAS — set the same variable as an EAS secret
   ```

If the key is missing, C1's map says so on screen instead of rendering blank.
That check reads a boolean published by `app.config.ts`, not the key itself —
`android.config` is stripped from the runtime manifest.

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
