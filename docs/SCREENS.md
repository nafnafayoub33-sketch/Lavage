# Screens — full specification

Every screen lists: **Purpose** · **Contents** · **Actions** · **States** · **Goes to**.
Names in `code` are expo-router routes. Screen IDs (C1, O3, D2…) are used in commits and issues.

---

## Menus

### Client — 4 bottom tabs
| Tab | Route | Contains |
|---|---|---|
| Near you | `(client)/home` | Map and list |
| My turn | `(client)/turn` | Live ticket (badge shows the number when a booking is active) |
| History | `(client)/history` | Past washes |
| Account | `(client)/account` | Profile, points, settings |

### Owner — 4 bottom tabs
| Tab | Route | Contains |
|---|---|---|
| Queue | `(owner)/queue` | Today's bookings (badge shows the count) |
| My wash | `(owner)/wash` | Page, services, prices, hours |
| Credit | `(owner)/credit` | Balance, top-up, transactions |
| Account | `(owner)/account` | Stats, settings |

### Admin — side drawer
Dashboard · Approvals · Car washes · Users · Bookings · Disputes · Finance · Settings

---

# 1. Auth — `(auth)`

### A1 · Splash — `(auth)/index`
- **Purpose:** decide where the user lands
- **Contents:** logo only
- **Logic:** not signed in → A2 | client → home | approved owner → queue | pending owner → O2

### A2 · Language — `(auth)/language`
- **Contents:** three large buttons: العربية / Français / English
- **Note:** first launch only — "has never chosen" is the absence of the stored
  language, so this is skipped forever after the first pick. Changing it later
  is C14.
- **Note:** choosing Arabic switches the UI to RTL and restarts the app. When the
  restart cannot happen (Expo Go, any build without expo-updates) the language
  still changes and the user is told a restart is needed.
- → A3

### A3 · Phone number — `(auth)/phone`
- **Contents:** fixed `+212` prefix with flag, number field, terms line
- **Actions:** "Send the code" (disabled until the number is complete)
- **States:** invalid number · number blocked · offline
- → A4

### A4 · SMS code — `(auth)/otp`
- **Contents:** 6 boxes, the number it was sent to with "change number", 60-second countdown
- **Actions:** "Resend" (after the countdown)
- **States:** wrong code (3 attempts, then 15-minute lockout) · code expired
- → new user: A5 | returning: the app

### A5 · Account type — `(auth)/role`
- **Contents:** two cards: "I have a car" / "I own a car wash"
- **Important:** cannot be changed later except by an admin. Enforced in the
  database — `profiles.role` is locked against self-service updates (0003)
- **Note:** the answer is held on the device until A6, because the profile row
  cannot exist before there is a name (`profiles.full_name` is NOT NULL)
- → A6, whichever card was picked

### A6 · Profile setup — `(auth)/profile-setup`
- **Applies to:** every account, client and owner alike
- **Contents:** full name (required), photo (optional), city
- **Important:** this is where the profile row is created, with the role
  chosen at A5
- **States:** name empty (continue disabled) · saving · save failed with retry
- → A7

### A7 · Permissions — `(auth)/permissions`
- **Applies to:** every account, client and owner alike
- **Contents:** two explanations shown before the OS prompt:
  - **Location** — "so we can show the car washes closest to you"
  - **Notifications** — "so we can tell you when your turn is coming"
- **Actions:** "Allow" / "Later"
- → client: the app | owner: O1

---

# 2. Client — `(client)`

### C1 · Near you — `(client)/home` ⭐
- **Contents:** map on top (pins coloured by queue state) with a list below, map/list toggle,
  search field, filter bar
- **Each row:** name · distance · price from · estimated wait · status dot (green/amber/red)
- **Sorting:** nearest by default; also fastest / cheapest / best rated
- **States:**
  - location off → "Turn on location" with a settings button
  - no results → "No car wash is open near you right now" plus widen radius
  - active booking → banner on top: "You have a place at X · number 12", taps through to C6
- → C3

### C2 · Filters — sheet
Distance (1/3/5/10 km) · price · open now · service type · rating 4+ · wait under X minutes

### C3 · Car wash page — `(client)/wash/[id]` ⭐
- **Contents:** photos · name, rating, review count · open/closed badge ·
  **queue right now + estimated wait** · services with prices and durations · hours ·
  location on the map with a directions button · reviews
- **Actions:** "Book my turn" (pinned at the bottom) · call · share
- **States:** closed now (button disabled, "opens at 08:00") · out of credit (never listed at all)
- → C4

### C4 · Booking — `(client)/book/[washId]` (sheet)
- **Contents:** pick service · pick vehicle (or add one) · payment method (cash / card) ·
  summary: price, duration, your expected number, expected time
- **Actions:** "Confirm booking"
- **States:** already has an active booking (only one allowed) · 3 no-shows (blocked 48h) ·
  the car wash just closed
- → C5

### C5 · Booking confirmed — `(client)/booking/[id]/done`
- **Contents:** large check · your number · estimated time ·
  "We'll notify you when one car is left"
- **Actions:** "See my turn" · "Directions"
- → C6

### C6 · My turn — `(client)/turn` ⭐
- **Contents:** your number, large · progress track · "2 cars ahead of you" · now washing 09 ·
  details (car wash, service, wait, price) · directions button
- **Actions:** "Cancel booking" (with confirmation) · call the car wash
- **States:**
  - **you're next** → screen turns amber: "You're up"
  - **wash started** → "Your car is being washed"
  - **finished** → straight to C8
  - **owner cancelled** → reason plus "Find another car wash nearby"
  - **no booking** → "You don't have a turn right now" plus "Browse car washes"

### C7 · Cancel booking — sheet
Warning: "Cancelling often can block you from booking" · reason (optional) · confirm

### C8 · Confirm and rate — `(client)/booking/[id]/confirm` ⭐
- **Contents:** "Is the wash finished?" · 1–5 stars · comment (optional) · photos (optional)
- **Actions:** "Confirm and rate" · "Something's wrong" (opens a dispute)
- **Important:** if the client does nothing, the booking **auto-confirms after 2 hours** and the
  rating step is skipped
- → C9

### C9 · History — `(client)/history`
List: date · car wash · service · price · your rating
Filter by month · search · **empty state:** "You haven't washed anything yet"
→ C10

### C10 · Wash detail — `(client)/history/[id]`
Everything, plus the receipt (PDF) and "Book the same car wash again"

### C11 · Account — `(client)/account` ⭐
Photo, name, phone · points card (7/10 with a track) · vehicles · settings · history ·
invite a friend · log out

### C12 · My cars — `(client)/account/vehicles`
List · add/edit: brand, model, plate, colour, photo · set default · delete

### C13 · Points and gifts — `(client)/account/points`
Points balance · progress to the free wash · how points are earned ·
**referral code** with share · points history

### C14 · Settings — `(client)/account/settings`
Language (requires a restart) · appearance (system/light/dark) · notifications (my turn, offers) ·
payment methods · terms and privacy · **delete account**

### C15 · Payment methods — `(client)/account/payment`
Saved cards · add card · set default · delete

### C16 · Notifications — `(client)/notifications`
List, read/unread, each one deep-links to its screen

### C17 · Support — `(client)/support`
FAQ · WhatsApp/call · report a problem

### C18 · Mobile wash — `(client)/mobile` — **phase 2**
Request: location, car photos, service, time · live tracking · before/after photos ·
**"Approved — release the payment"** · dispute

---

# 3. Owner — `(owner)`

### O1 · Register the car wash — `(owner)/register`
The owner arrives from A7 with a profile row already created, so this screen is
only ever about the car wash, never about the person.
Step by step: name and description · location on the map plus address · photos (3 minimum) ·
number of bays · hours · documents (ID and business registration) · submit
→ O2

### O2 · Pending approval — `(owner)/pending`
"Your application is with the admin, we'll get back to you within 48 hours" · edit details · contact
**Rejected:** reason plus "Submit again"

`rejected` is its own wash status (0012), distinct from `suspended`: rejected never went
live and is answered by the owner, suspended was live and is lifted by an admin. The reason
is in `car_washes.review_note`, written only by D2 and read-only to the owner.
"Submit again" calls `resubmit_wash()`, which moves the application back to `pending`.

### O3 · Queue — `(owner)/queue` ⭐⭐ (the most important screen in the app)
- **Top:** credit balance plus "Top up" · open/closed badge
- **List:** each booking shows number · service · vehicle · client status (on the way / arrived) · time
- **Per-row actions:** Start · Done · No-show · Call
- **Walk-ins:** "Add a customer" opens a sheet — a free-text label (a name or a car) and
  which service. The walk-in takes a ticket and a queue position like any other booking,
  is marked `arrived` on insert, and carries a "no app" badge on the board.
  There is nobody to confirm it afterwards, so a finished walk-in gets a
  **"Confirm and bill"** button; app bookings still wait on the client.
  Walk-ins bill at `walkin_fee_centimes` (0.50 DH), app bookings at
  `wash_fee_centimes` (1 DH) — both editable in D9. Arrival only: no future slot.
- **Bottom:** "Closed today" (stops new bookings; queued clients get a notification)
- **States:** empty queue · credit running low (amber warning) ·
  **credit at zero** (red screen: "You're hidden from clients — top up now") ·
  no service on the price list yet (the walk-in sheet says so and links to O6)
- **Live:** new bookings appear without a refresh, with a sound

### O4 · Booking detail — `(owner)/booking/[id]`
Client (first name and phone number) · vehicle and photo · service and price · timestamps · actions

**Phone numbers are shown in full, on both sides, deliberately.** An owner who cannot
reach the car in front of them cannot run the queue. `maskPhone()` is kept in
`src/lib/format.ts` with its tests, unwired — we will want it the first time an owner
complains about late-night calls, and turning it on is a one-line change.

### O5 · My wash page — `(owner)/wash` ⭐
The same page as C3 but **editable**: photos, description, hours, bays, location, open/closed
→ O6

### O6 · Services and prices — `(owner)/wash/services`
List · add/edit: name, price, duration, vehicle type, active toggle · delete
Duration drives the wait estimate — warn when a value is unrealistic

### O7 · Credit — `(owner)/credit` ⭐
- Large balance plus free washes remaining
- **Top up:** 20 / 50 / 100 / 200 DH or a custom amount, paid by card
- Transactions: top-up / charge (linked to a booking) / refund
- Warning: "Your balance is under 10 DH"

### O8 · Stats — `(owner)/account/stats`
Washes (day/week/month) · revenue · **peak hours** · cancellation rate · no-show rate · rating

### O9 · Reviews — `(owner)/wash/reviews`
List · reply to each one · report a fake review

### O10 · Staff — `(owner)/wash/staff` — **phase 2**
Add a worker by phone · limited permissions (start/done only) · who did what

### O11 · Account — `(owner)/account`
Owner details · stats · invoices · language and appearance · notifications · support · log out

---

# 4. Admin — `(admin)`

### D1 · Dashboard
Washes today · revenue (today/month) · active car washes · pending approvals · open disputes · chart

### D2 · Approvals ⭐ — `(admin)/approvals`
Pending car washes, oldest first · photos · address and pin (opens the map) · hours and bays ·
how many services are on the price list · the owner's name and number (tap to call) ·
**Approve** (confirms first) / **Reject with reason**

- The rejection reason is required, and it is the whole of what the owner reads on O2.
- A wash with **no service on its price list** is flagged: approving it puts something in
  C1 that nobody can book.
- **States:** loading skeleton · error with retry · nothing waiting · data · offline.
- Both decisions go through an RPC (`approve_wash` / `reject_wash`), not an UPDATE — since
  migration 0010 no client-side write can move `car_washes.status` at all.
- **Documents are not part of this yet.** The schema has photos and a location but no
  document upload; when one is added it belongs on this card.

### D3 · Car washes
Search and filter (status, city, credit, cancellation rate) · suspend/activate · manual credit

### D4 · Car wash detail
Everything · bookings · transactions · adjust credit with a reason · change log

### D5 · Users
Clients · no-show counts · block/unblock · delete account (data request)

### D6 · Bookings
All bookings · filters · open a dispute · administrative cancellation

### D7 · Disputes ⭐
The dispute with its photos and messages · decision: for the client / for the car wash · refund

### D8 · Finance
Top-ups received · charges · reconciliation with the payment gateway · export to Excel

### D9 · Settings ⭐
Fee per wash (**1 DH**) · free washes for new car washes (**100**) · auto-confirm delay
(**2 hours**) · cancellation thresholds (**20% / 40%**) · no-show lockout duration ·
in-app promos and banners

---

# 5. Notifications

**Client:** 2 cars ahead · **your turn now** · wash started · finished → confirm and rate ·
cancelled by the car wash · points earned · free wash unlocked

**Owner:** new booking · client cancelled · client arrived · **balance under 10 DH** ·
balance empty · new review · cancellation-rate warning · account suspended

---

# 6. Rules for every screen

1. **One primary button** per screen — no more.
2. Every list handles **four states**: loading skeleton · empty · error with retry · data.
3. **Offline** → banner on top, cached data stays visible.
4. Numbers (prices, plates, ticket numbers) are **always LTR** in all three languages.
5. Motion fires only when something real changes.
6. Destructive actions (cancel, delete, top up) always confirm first.
7. Owner buttons are at least **52px** tall — tapped with wet hands.
8. Copy speaks to the user in plain language, never in system terms.

---

# 7. Priority

| Phase | Screens |
|---|---|
| **MVP** | A1–A7 · C1, C3, C4, C5, C6, C8, C11 · O1, O2, O3, O5, O6, O7 · D1, D2, D3, D9 |
| **Phase 2** | C9, C10, C12, C13, C14 · O4, O8, O9 · D4–D8 |
| **Phase 3** | C15, C16, C17 · O10 · mobile wash C18 |

**Total:** 18 screens for the first release · 44 screens for the complete app.
