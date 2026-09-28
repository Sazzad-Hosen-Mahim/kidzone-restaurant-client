# Kid Zone + Restaurant — frontend

React point-of-sale and back-office for the [Kid Zone + Restaurant API](../kidzone-restaurant-server). Vite, TypeScript, RTK Query, Tailwind v4 and shadcn/ui.

---

## Quick start

The API must be running first — see its README. Then:

```bash
cp .env.example .env     # or just create .env with the line below
npm install
npm run dev
```

Open <http://localhost:5173> and sign in with a seeded account:

| Role | Phone | Password |
|---|---|---|
| Administrator | `01711000001` | `Admin#2026` |
| Kid Zone manager | `01711000002` | `Manager#2026` |
| Restaurant cashier | `01711000003` | `Cashier#2026` |

Each role lands on the screen it actually works on: the admin on the dashboard, the manager at the gate, the cashier at the till.

### Environment

| Variable | Default | Notes |
|---|---|---|
| `VITE_API_URL` | `http://localhost:3000/api/v1` | Must be an origin listed in the API's `CORS_ORIGINS`. |

The dev server is pinned to port **5173** because that is the origin on the API's CORS allow-list. Changing one means changing both.

### Commands

| Command | |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Type-check and build to `dist/` |
| `npm run preview` | Serve the production build |
| `npm run lint` | oxlint |

---

## How it talks to the API

### The response envelope

Every success is `{ data, meta }` and every error is `{ statusCode, error, message, details? }`. RTK Query endpoints unwrap `data` via `transformEnvelope`, and list endpoints become `{ items, meta }` via `transformList`, so components never see the envelope.

Errors go through `src/app/api-error.ts`. The API's messages are written for staff — *"This membership expired on 2026-09-21. Please renew it to check in."* — so they are shown as-is rather than replaced with something generic. Branch on `errorCode(error)`, never on the message text.

### Money

**Every amount in the API is an integer number of poisha** (1 BDT = 100 poisha). The app keeps it that way internally: taka only appears at the edges, rendered by `<Money>` or parsed by `parseTakaInput`. Nothing in between holds a float.

`src/lib/money.ts` also carries `priceOrder()`, which mirrors the server's bill arithmetic exactly — subtotal → discount → service charge → VAT, each rounded once — so the till can quote a total before submitting. The server recomputes it all from its own prices; the preview is a convenience, not the source of truth.

### Authentication

The access token lives **in memory only** (`authSlice`). It is deliberately not in `localStorage`: the refresh token is already an httpOnly cookie the browser handles, and keeping the access token out of storage means an XSS payload cannot read a long-lived credential out of the page. The cost is that a reload starts with nothing, which `SessionGate` covers by calling `POST /auth/refresh` once on boot.

Refreshes are **serialised behind a mutex** (`src/app/base-query.ts`). The API rotates the refresh token on every use and treats a replayed one as theft — it revokes the entire session. Without the mutex, a screen that fires five queries against an expired token would send five refreshes, and the four losers would log the user out mid-shift.

### Dates

Two different things arrive as strings and must not be confused:

- a **business date** (`2026-09-22`) is a calendar day in the business timezone. `parseBusinessDate` reads it as local midnight so it never shifts a day.
- an **instant** (`2026-09-22T09:15:00.000Z`) is a moment in UTC, shown in the viewer's local time.

Receipts are a third case: the API pre-renders their times in the business timezone, because a receipt must read the same wherever it is reprinted.

---

## Roles

The sidebar, the routes and the individual actions all derive from one capability matrix in `src/app/permissions.ts`, mirroring the server's. This is presentation, not security — the API enforces everything — but a button that leads to a guaranteed 403 is worse than no button, because the user cannot tell "I may not do this" from "this is broken".

| | Admin | Kid Zone manager | Cashier |
|---|:---:|:---:|:---:|
| Dashboard | ✅ | ❌ | ❌ |
| Check in, floor, sell, memberships, visits | ✅ | ✅ | ❌ |
| Plans and prices | ✅ | ❌ | ❌ |
| Till, orders | ✅ | ❌ | ✅ |
| Menu availability | ✅ | ❌ | ✅ |
| Menu prices and items | ✅ | ❌ | ❌ |
| Customers | ✅ | ✅ (with children) | ✅ (guardian only) |
| Void a sale or order | ✅ | ❌ | ❌ |
| Manual check-in override | ✅ | ❌ | ❌ |
| Close own day | ✅ | ✅ | ✅ |
| Reopen a day | ✅ | ❌ | ❌ |
| Reports | all, any period | Kid Zone, today | Restaurant, today |
| Export to file | ✅ | ❌ | ❌ |
| Staff, settings, audit, jobs | ✅ | ❌ | ❌ |

**Child data never reaches a cashier.** `GET /customers` returns them a guardian and a child *count*; `GET /customers/:id` omits the whole `kidZone` block and loads no child rows at all. The customer detail page reflects that rather than rendering empty sections.

---

## Screens

| Route | What it is |
|---|---|
| `/dashboard` | Today by section, the live floor, expiring memberships, top dishes, 7-day trend — one request |
| `/kidzone/checkin` | The gate: look up by phone, then verify by OTP, QR or admin override |
| `/kidzone/floor` | Who is inside, with live timers; check out and settle overtime |
| `/kidzone/sell` | Sell a membership or session, find-or-create the guardian and child |
| `/kidzone/memberships` | The book, with the expiry windows that drive renewal calls |
| `/kidzone/sales`, `/kidzone/visits` | History, filterable |
| `/kidzone/plans` | Plans and prices (admin) |
| `/restaurant/pos` | The till: tappable menu, running ticket, split payment |
| `/restaurant/orders` | Order history with a detail view and voiding |
| `/restaurant/menu` | Items and categories; cashiers may only toggle availability |
| `/customers`, `/customers/:id` | Guardians and their history across both sections |
| `/receipts/:kind/:id` | Receipt and gatepass viewer, plus the 80mm PDF |
| `/closing` | Count the drawer, record the difference, lock the day |
| `/reports` | All sixteen reports, with Excel and PDF export |
| `/admin/*` | Staff, settings, audit log, SMS and jobs |

---

## Structure

```
src/
  app/          store, RTK Query base, auth'd fetch, error helpers, permissions
  components/
    ui/         shadcn primitives
    shared/     Money, DataTable, PaymentSplit, DiscountField, MetricTile…
    layout/     shell, sidebar, header
  features/     one folder per area: its API slice, its pages, its dialogs
  lib/          money, dates, phone, download
  routes/       router and guards
  types/api.ts  the API contract, transcribed
```

Each feature owns its endpoints via `api.injectEndpoints`, so they share one cache and one set of tags while staying in the folder that uses them.

---

## Decisions

**RTK Query rather than a data-fetching library plus a separate store.** Two things here genuinely need client state — the session and the order in progress — and everything else is server state. One library covering both, with cache invalidation by tag, means a completed sale can invalidate the floor board, the closing preview and the dashboard in one declaration.

**Lists are server-paged, sorted and filtered.** The table component is a thin wrapper over the shadcn table rather than a headless table library, because the client never owns a row model.

**Polling, not sockets.** The floor board refreshes every 30 seconds and the dashboard every two minutes. A session timer only needs to be right to the minute, and polling survives a tablet sleeping and waking without any of the reconnection logic a socket would need.

**The payment splitter refuses to submit an unbalanced split.** The server will not accept one — an over- or under-tendered bill would corrupt the day-end cash reconciliation — so the UI helps the cashier land on the exact figure with a "set exact amount" button instead of letting them discover the problem on submit.

**The discount limit is checked in exact integer arithmetic**, not against the rounded display percentage: 1001 poisha off 10000 is 10.01%, which must fail a 10% cap even though it renders as "10%". Getting that wrong client-side would mean offering a discount the API then rejects.

**The cart is in Redux but not persisted.** A cashier can walk to another screen and come back to the same order; a half-built order surviving a browser restart hours later is more likely to be rung up by mistake than wanted.

**Reports and admin are code-split.** A cashier's tablet never downloads Recharts.

**Charts plot taka, not poisha**, because an axis labelled in poisha is unreadable — but the tooltip and every figure outside the chart go through the same `formatTaka` as the rest of the app.

**The membership QR is fetched when a card is shown, never with the list.** Each fetch writes an audit row on the server, so `getMembershipQr` is cached for zero seconds and is only ever called from the card dialog or the sale confirmation — not prefetched, and not attached to the `Membership` tag where a list refresh would re-pull it.

**The card prints via `visibility`, not `display`.** It usually sits inside a dialog, and `display: none` on the ancestors would take the card down with them. The print rule hides everything by visibility, makes the `[data-print-root]` subtree visible again and lifts it to the top of the sheet — scoped behind `:has()`, so pages with no card print exactly as before.

**The gate camera is opt-in per check-in, and lazy-loaded.** Mounting a live scanner on every check-in would throw a permission prompt at staff each time and keep the lens warm all shift; the barcode-detection ponyfill is also ~146 kB that the till has no use for. So the camera starts on a tap, the chunk loads then, and the text field stays for handheld USB scanners and for a guardian reading the code out of their SMS.

### Known gaps

- **Concurrent refreshes are serialised per tab, not across tabs.** Two tabs whose tokens expire at the same moment can still trip the server's replay detection and log the user out. A `BroadcastChannel` or a shared worker would close it.
- **No offline handling.** A dropped connection surfaces as an error on the affected panel; the till does not queue orders to send later.
- **The camera needs HTTPS.** Browsers only grant camera access over HTTPS or on `localhost`, so a gate tablet pointed at a plain-HTTP LAN address falls back to the text field. The scanner says so explicitly rather than failing silently. Serving the client over TLS is the fix.
- **The printed card carries no business name or logo.** Only admins can read `/settings`, so a Kid Zone manager printing a card has no way to fetch the business name. Putting it on a staff-readable endpoint would let the card be branded for everyone.
- **No automated frontend tests.** The API side has 222; this side is verified by type-checking, a production build, and `npm run smoke` on the server, which calls every endpoint each screen uses as the role that uses it.
