# MentorsEdgePro: How It Works

Copytrading + multi-asset trading platform. Static frontend (HTML/CSS/JS + Three.js) talks to a Fastify/TypeScript API over REST + WebSocket.

> Files marked **(not in this snapshot)** are referenced by code but were not part of the files used to write this doc. Check the repo for them.

---

## 1. Architecture

```
Browser (static site, Vercel)                    API (Node 22, Fastify, port 4000)
┌────────────────────────────┐   REST + cookie   ┌────────────────────────────────────┐
│ index/markets/mentorboard  │ ────────────────▶ │ src/app.ts  (plugins, routes)      │
│ login/register/kyc/photo   │   JWT (Bearer)    │  ├─ auth, kyc, profile             │
│ dashboard (dashboard.js +  │ ◀──────────────── │  ├─ wallet, funds (ledger)         │
│   live.js)                 │                   │  ├─ market (feed, sources, ws)     │
│ mentor.html, admin.html    │   WebSocket /ws   │  ├─ trading engine + triggers      │
└────────────────────────────┘ ◀──── ticks ───── │  ├─ copy, mentor, tier             │
                                                 │  └─ admin, notifications, support  │
                                                 └───────┬──────────────┬─────────────┘
                                                         │              │
                                                  PostgreSQL        Redis
                                                  (Prisma)     (rate limit, OTP, price
                                                                cache, calendar cache,
                                                                blocked users, BullMQ)
External: Cloudinary (KYC/deposit proofs, avatars), Brevo (email),
          Binance WS, Finnhub, Twelve Data, Yahoo Finance (prices), faireconomy (calendar)
```

**Core ideas**
- **Money = append-only ledger.** Balance is always `SUM(LedgerEntry.amount)` in cents (BigInt). Nothing stores a mutable balance.
- **Idempotency everywhere money moves.** Each ledger entry has a unique `idempotencyKey`; retries return the existing row.
- **Prices are never faked.** An instrument has no quote until a real feed (or a Redis-restored last price) provides one. Stale (>20 min) = "market closed", trading blocked.
- **Trades are fully-funded, no leverage in the engine.** `units = amount / price`; the amount is debited on open and `amount + pnl` credited on close.
- **Admin approves all real money in/out** (deposits with proof, withdrawals), protected by role + 2FA step-up.

---

## 2. Repo layout

### Backend (`tradex-backend`)
```
src/
  server.ts                 entry: BigInt JSON patch, start renewals + trading cron, listen, graceful shutdown
  app.ts                    builds Fastify app, registers plugins/routes/error handler
  config/env.ts             zod-validated environment
  plugins/auth.ts           JWT plugin + app.auth preHandler (+ Redis "blocked:" check)
  lib/
    prisma.ts               PrismaClient (tx maxWait 20s / timeout 30s)
    redis.ts                ioredis (maxRetriesPerRequest: null for BullMQ)
    crypto.ts               AES-256-GCM encrypt/decrypt (TOTP secrets)
    audit.ts                fire-and-forget AuditLog writer
    mail.ts                 Brevo sender + HTML templates (tpl, otpTpl)
    notify.ts               in-app Notification + optional email; usd() formatter
    cloudinary.ts           private uploads, signed URLs, avatar upload, image magic-byte check
  modules/
    auth/       auth.routes.ts, otp.ts
    kyc/        kyc.routes.ts
    profile/    profile.routes.ts           (avatar upload)
    wallet/     ledger.ts, money.ts, wallet.routes.ts, funds.routes.ts
    market/     instruments.ts, feed.ts, sources.ts, ws.ts, yahoo.ts, market.routes.ts,
                trading.worker.ts (not in this snapshot; exports setupTradingCron)
    trading/    engine.ts, trading.routes.ts
    copy/       copy.ts, copy.routes.ts, public.routes.ts, renewal.ts
    mentor/     mentor.routes.ts, apply.routes.ts
    tier/       tier.ts
    admin/      admin.routes.ts
    notifications/ notifications.routes.ts
    support/    support.routes.ts
    calendar/   calendar.routes.ts
    gym/        gym.routes.ts
    signals/    signals.routes.ts
prisma/schema.prisma + migrations/
Dockerfile, docker-compose.yml (postgres + redis only), .dockerignore, tsconfig.json
```

### Frontend (static, deployed on Vercel)
```
Pages:   index, markets, mentorboard, tools, support, login, register, kyc, photo,
         dashboard, mentor, admin
         company, regulation, legal (not in this snapshot; linked from nav/footer)
Shared:  config.js (API_BASE/WS_URL), api.js (fetch wrapper), theme.js (light/dark),
         i18n.js (language picker), touch-fx.js (touch glow/tilt)
Styles:  style.css (tokens + site), auth.css, kyc.css, dashboard.css, admin.css
Page JS: script.js + fx3d.js (home), auth.js, kyc.js, dashboard.js + live.js,
         mentor.js, admin.js (tools/markets/mentorboard/support use inline <script>)
Config:  vercel.json, robots.txt, sitemap.xml, favicon.svg
```

---

## 3. Running it

```bash
# infra
docker compose up -d                 # postgres:16 (mep/mep/mep) + redis:7
# backend
npm i
npx prisma migrate dev               # or: npx prisma migrate deploy
npm run dev                          # tsx watch --env-file=.env src/server.ts
npm test                             # vitest
npm run build && npm start           # production
# frontend: any static server, e.g.
npx serve .                          # config.js auto-points to localhost:4000
```

**Docker (prod):** multi-stage build → runtime runs `npx prisma migrate deploy && node dist/server.js`, `USER node`, exposes 4000. Compose file only provides Postgres/Redis, not the API.

### Environment variables (`src/config/env.ts`)
| Var | Required | Notes |
|---|---|---|
| `DATABASE_URL`, `DIRECT_URL` | yes | `DIRECT_URL` is read by `schema.prisma` (`directUrl`) |
| `REDIS_URL` | yes | |
| `CORS_ORIGIN` | yes | comma-separated allowed origins; also used for WS origin + CSRF check + email links |
| `DATA_ENC_KEY` | yes (≥32) | key for TOTP secret encryption |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | yes (≥32) | prod rejects values starting `change-me`. Refresh secret also keys OTP hashes |
| `APP_URL` | no | base URL in emails (falls back to first CORS origin) |
| `CLOUDINARY_URL` | for uploads | KYC ID, deposit proofs, avatars |
| `BREVO_API_KEY` | prod | missing in dev = emails are logged to console only |
| `MAIL_FROM_EMAIL`, `MAIL_FROM_NAME`, `SUPPORT_EMAIL` | no | defaults provided |
| `FINNHUB_KEY` | for stocks/forex | |
| `TWELVE_KEY` | for gold/silver | |
| `PORT` | no | default 4000 |

> `.gitignore` also ignores `.env.example`, so no template is committed. Consider removing that line.

---

## 4. Backend internals

### 4.1 Boot sequence
`server.ts` → patches `BigInt.prototype.toJSON` (BigInts serialize as **strings**) → `buildApp()` → `startRenewals()` (monthly copy fees) → `setupTradingCron()` (BullMQ, not in snapshot) → `app.listen(0.0.0.0:PORT)`. SIGINT/SIGTERM close worker, renewals, app, Redis.

`app.ts` registration order:
1. helmet (CSP off), cors (credentials, GET/POST/PUT/PATCH/DELETE), cookie, rate-limit (100/min, Redis-backed, `skipOnError`), under-pressure (event-loop guard)
2. **onRequest origin check**: for non-GET/HEAD/OPTIONS, if `Origin` header exists and isn't in `CORS_ORIGIN` → `403 BAD_ORIGIN` (CSRF defense for the cookie refresh endpoint)
3. Custom JSON parser (empty body → `{}`)
4. `authPlugin` → `/auth` routes → multipart (5 MB, 1 file) → `/kyc`, `/profile`, `/wallet` (×2), `/markets`
5. `startFeed()` → `startSources()` → `attachWs(server)` → `startTriggers()`
6. `/trades`, `/copy`, `/mentor`, `/mentor-apply`, `/mentors`, `/calendar`, `/gym`, `/signals`, `/admin`, `/notifications`, `/support`
7. Error handler, `GET /health`, `GET /ping`

**Error contract:** `{ error: 'CODE', ... }`. Zod failure → `400 { error:'VALIDATION', issues:[{path,message}] }`. Errors with `statusCode<500` pass through; others → `500 { error:'INTERNAL', debug }` (the `debug` field leaks internals; remove for production hardening).

### 4.2 Data model (`prisma/schema.prisma`)
| Model | Purpose |
|---|---|
| `User` | email, passwordHash (argon2), role `USER/MENTOR/ADMIN`, status `ACTIVE/SUSPENDED/DEACTIVATED`, `emailVerified`, TOTP (encrypted), `avatarUrl` |
| `RefreshToken` | sha256 of cookie token, expiry, `revokedAt` (rotation/reuse detection) |
| `KycProfile` / `KycDocument` | status `NOT_STARTED/PENDING/APPROVED/REJECTED`, JSON form data, Cloudinary private doc |
| `Account` | per user; type `LIVE` (default since migration `live_account_default`; `DEMO` enum remains, unused) |
| `LedgerEntry` | **source of truth for money.** amount (cents, BigInt, signed), type, refType/refId, unique `idempotencyKey` |
| `Deposit` / `Withdrawal` | request rows (PENDING→APPROVED/REJECTED) with own idempotency key |
| `DepositAddress` | admin-managed payout details per method (`wire`, `sepa`, `crypto`) as JSON |
| `Instrument` | upserted from `INSTRUMENTS` on boot |
| `Position` | OPEN/CLOSED trade; `sourceId` = mentor position this copies |
| `Mentor` | handle, displayName, tag, bio, `riskScore`, `feeMinor` (default 1000 = $10), `verified`, `stats` JSON (gain, winRate, trades, capital, copiers, avgTime, tier) |
| `CopyRelation` | follower account ↔ mentor, `allocationMinor`, status `ACTIVE/PAUSED/STOPPED`, unique per pair |
| `Notification`, `AuditLog`, `Signal` | in-app inbox, admin/security audit trail, published trade ideas |
| `Trade`, `TradeExecution`, `MirrorAllocation` | mentor-trade mirroring tables (migration `mentor_trade_mirroring`). Used by `trading.worker.ts` (not in snapshot); also the `/wallet/pnl-today` query filters `refType:'Trade'` |

Migrations (in order): `init`, `admin` (UserStatus, DepositAddress, mentor display fields), `email_verify`, `live_account_default`, `user_avatar_url`, `signal`, `mentor_trade_mirroring`.

### 4.3 Ledger & money (`wallet/ledger.ts`, `wallet/money.ts`)
- `money` (zod): string `"100.50"` (≤9 int digits, ≤2 decimals) → `10050n` cents.
- `idemKey` (zod): 8–100 chars `[\w-]`; sent as `Idempotency-Key` header.
- `balanceOf(accountId, tx?)` = `SUM(amount)`.
- `postEntry(tx, {accountId, amount, type, key, refType?, refId?})` — **call inside `prisma.$transaction`**:
  1. If `key` exists → return existing (idempotent).
  2. If `amount < 0`: `SELECT … FOR UPDATE` on the Account row, then reject with `INSUFFICIENT_FUNDS` (400) if it would overdraw.
  3. Insert.

**Ledger keys in use** (grep these to trace money):
| Key pattern | Meaning |
|---|---|
| `dep-credit:<depositId>` | approved deposit credit |
| `wd-hold:<withdrawalId>` | funds held at withdrawal request |
| `wd-refund:<withdrawalId>` | refund on rejected withdrawal |
| `pos-open:<accountId>:<idemKey>` | trade open debit (copies: `…:copy:<copyId>:<posId>`) |
| `pos-close:<positionId>` | trade close payout |
| `copystart:<acct>:<mentor>:<uuid>` | first-time/restart copy fee |
| `copyfee:<acct>:<mentor>:<YYYY-MM>` | monthly renewal fee |
| `adj:<idemKey>` | admin balance adjustment |

### 4.4 Auth (`auth/auth.routes.ts`, `otp.ts`, `plugins/auth.ts`, `lib/crypto.ts`)
**Tokens**
- Access JWT: 15 min, payload `{sub, role}`, sent as `Authorization: Bearer`.
- Refresh: 48 random bytes, stored only as sha256 in `RefreshToken`; cookie `rt` (httpOnly, path `/auth`, `SameSite=None; Secure` in prod, `Lax` in dev). 30-day persistent, or session cookie (1-day DB expiry) when `remember:false`.
- `POST /auth/refresh` rotates: old token revoked, new issued. **Reusing a revoked token revokes all of that user's tokens** (`auth.refresh_reuse` audit). The frontend therefore single-flights refreshes (see `api.js`).
- `app.auth` preHandler: `jwtVerify` (401 `UNAUTHORIZED`), then Redis `blocked:<userId>` → 403 `ACCOUNT_SUSPENDED`.

**Endpoints**
| Route | Notes |
|---|---|
| `POST /auth/register` (5/min) | creates User + LIVE Account + KycProfile in one tx, sends `verify` OTP, returns `{needsVerification, email}` (no session yet) |
| `POST /auth/verify-email` | OTP check → `emailVerified=true` → issues session |
| `POST /auth/resend-otp`, `/forgot-password` | always `{ok:true}` (no account enumeration) |
| `POST /auth/reset-password` | OTP + new password; revokes all refresh tokens |
| `POST /auth/login` (10/min) | order: credentials → status → emailVerified (else re-sends OTP, `EMAIL_NOT_VERIFIED`) → TOTP (`TOTP_REQUIRED`/`INVALID_TOTP`) → session |
| `POST /auth/refresh`, `/logout` | see above |
| `GET/PATCH /auth/me` | profile + `kycStatus`, `accounts`, `tier` |
| `POST /auth/change-password` | revokes all sessions |
| `POST /auth/2fa/setup|enable|disable` | otplib; secret stored AES-256-GCM (`v1:iv:tag:ciphertext`, key = sha256(`DATA_ENC_KEY`)) |
| `POST /auth/2fa/reset-request`, `/2fa/reset` | **admin-only** lost-authenticator flow: password + emailed code → 2FA wiped → session issued so a new authenticator can be set up |

**OTP** (`otp.ts`): purposes `verify | reset | reset2fa`. Redis: `otp:<purpose>:<uid>` = HMAC-SHA256 of 6-digit code (TTL 600s), `otp:tries:*` (max 5), `otp:cool:*` (60 s resend cooldown). Verified with `timingSafeEqual`, single-use (`DEL` must return 1).

### 4.5 KYC & profile
- `GET /kyc` upserts and returns `{status, data}`.
- `POST /kyc/id` (10/h): multipart `file`; JPG/PNG/WebP by magic bytes; stored as Cloudinary **private** under `kyc/<userId>`; replaces previous `ID_FRONT`. 409 `KYC_LOCKED` once PENDING/APPROVED.
- `PUT /kyc`: validates full form (age 18–100, dd/mm/yyyy, etc.), requires an ID doc (`ID_REQUIRED`), sets `PENDING`.
- Admin reviews via `/admin/kyc/:userId/review` (signed Cloudinary URL for viewing) → user notified + emailed.
- `POST /profile/photo` (10/h): square 400×400 avatar to Cloudinary `avatars/<userId>`.

### 4.6 Deposits & withdrawals (`wallet/funds.routes.ts`)
- `GET /wallet/deposit-methods` → `{wire, sepa, crypto}` JSON from `DepositAddress` (the UI only uses `crypto`).
- `POST /wallet/deposits` (10/min): **multipart text fields `amount`, `method` must come before the file**. Needs `Idempotency-Key`. Proof types: JPG/PNG/PDF. Creates `PENDING` Deposit; no ledger entry yet.
- Admin approves (`/admin/deposits/:id/review`, step-up 2FA) → in one tx marks APPROVED and posts `dep-credit`.
- `POST /wallet/withdrawals` (5/min): requires KYC `APPROVED`, min $10, network `BTC | USDT_TRC20 | ETH_ERC20`, address regex `[A-Za-z0-9]{20,100}`.
  Inside a tx (account row locked): cap = `(balance + withdrawn-in-last-30d (non-rejected)) × tier.wdPct%`; over cap → `400 TIER_LIMIT {limit, remaining}`. Otherwise creates the Withdrawal and **debits immediately** (`wd-hold`).
- Admin approve = marks APPROVED (payout is done manually off-platform). Reject = refund entry `wd-refund`.
- `GET /wallet/balance[?acct=trading]`, `GET /wallet/pnl-today`, `GET /wallet/ledger` (cursor paginated).

### 4.7 Tiers (`tier/tier.ts`)
Tier is derived from total **APPROVED deposits** and KYC:
| Tier | Min deposited | Withdraw cap / 30 d | Max open trades |
|---|---|---|---|
| 0 | (KYC not approved) | 0% | 1 |
| 1 | $0 | 10% | 1 |
| 2 | $10,000 | 20% | 1 |
| 3 | $25,000 | 30% | 50 |
| 4 | $35,000 | 50% | 50 |
| 5 | $50,000 | 70% | 50 (+ may apply to become mentor) |

`tradingAccount(userId)` = the user's single LIVE account.

### 4.8 Market data
- `instruments.ts`: 22 instruments (forex 5, stocks 5, crypto 4, indices 4, commodities 4) with `base` (fallback seed only, never shown as a quote), `dp` (decimals). `pipInfo(sym)` gives pip size/unit (forex pips; others points).
- `feed.ts`: in-memory `state` (price/open) per symbol. `setLive()` is called by sources. `quote(sym)` returns `null` until a symbol has been seen live **or restored from Redis hash `px:last`** (persisted every 30 s so weekends/restarts still show last price). `closed = !isLive` (no update in 20 min). A 1-second `tick` event emits only live symbols.
- `sources.ts`:
  | Source | Covers | Mode |
  |---|---|---|
  | Binance `!miniTicker@arr` WS | BTC, ETH, SOL, XRP | push (use `stream.binance.us` for US region) |
  | Finnhub REST + WS | AAPL, TSLA, NVDA, MSFT, AMZN, 5 forex pairs | needs `FINNHUB_KEY` |
  | Twelve Data REST | XAU, XAG | every 15 min, `TWELVE_KEY` |
  | Yahoo chart API | US500, NAS100, US30, UK100, WTI, NATGAS | every 60 s (unofficial endpoint) |
- `ws.ts`: `ws://…/ws`. Validates path and `Origin` (against `CORS_ORIGIN`), max 1000 clients, 1 KB max payload, 30 s ping/pong heartbeat. On connect sends `{t:'snapshot',p:{SYM:"price"}}`; then every second `{t:'tick',p:{…}}`. Server → client only.
- `GET /markets[?asset=]` (public) → `items[{sym,name,asset,pip,dp,price,chg,closed}]`.
- `yahoo.ts` also exports the `YF` symbol map used by the gym.

### 4.9 Trading engine (`trading/engine.ts`, `trading.routes.ts`)
- `px(sym)` = tradable price (null if closed/stale → `503 PRICE_UNAVAILABLE`); `pxAny(sym)` = display price.
- **Open** `POST /trades` (30/min, header `Idempotency-Key`): body `{symbol, side, amount, stopLoss?, takeProfit?}` (amount via `money`, min $10). Validates SL/TP side (`BAD_STOP_LOSS`/`BAD_TAKE_PROFIT`). In one tx: idempotency check, open-count ≤ tier `maxOpen` (`TOO_MANY_POSITIONS`), create `Position` (`units = amount/100/price`), debit ledger. Then `mirrorOpen()` fires async for copiers.
- **Close** `POST /trades/:id/close`: ownership check (404 otherwise), exit price = `px`, `pnl = units × (exit−entry)` (sign flipped for SELL), `payout = max(0, invested + pnl)`, credit `pos-close:<id>`. Then `mirrorClose()`.
- **SL/TP triggers** `startTriggers()`: on every feed tick (guarded by a `busy` flag) loads OPEN positions with SL/TP, closes any that crossed, mirrors the close, emails the owner.
- `GET /trades?status=OPEN|CLOSED` → view model: `{id,sym,name,asset,dir,side,status,units,entry,cur,stopLoss,takeProfit,pnl(cents),pnlPct,copied,openedAt,closedAt}`.

### 4.10 Copytrading (`copy/*`, `mentor/*`)
**Mirror open** (`copy.ts → mirrorOpen`, called when *any* user opens a trade; no-op unless user is a Mentor):
1. Mentor's stake `S` = their debit for the position; mentor balance before trade `B = balance + S`.
2. For each ACTIVE copier: `amount = allocation × min(S/B, 1)`; skip if `< $10` or copier balance too low.
3. Open a position on the copier's account with key `copy:<copyId>:<mentorPositionId>`, same SL/TP, `sourceId = mentorPositionId`; email details.

**Mirror close**: finds all OPEN positions with `sourceId` and closes them at current price; notifies each follower with entry/exit/PnL.

> The allocation is a **sizing cap**, not a locked/reserved balance.

**Endpoints (`/copy`, auth required):** `GET /mentors` (verified list), `GET /` (my copies), `POST /mentors/:id/copy` (min allocation $50; needs balance ≥ allocation + fee; charges the fee only when starting new/after STOPPED; upsert relation; no self-copy), `POST /:id/pause|resume|stop`.

**Monthly renewal** (`renewal.ts`): runs at boot and every 3 h, acts only on UTC day 1; idempotent by period key. If balance < fee → relation `PAUSED` + notification; else charge `copyfee`.

**Public mentors** `GET /mentors` (no auth) feeds the Mentorboard.

**Mentor lifecycle**
1. Tier-5 user applies: `POST /mentor-apply` (handle, bio, tag) → unverified `Mentor` (`GET` returns `NONE|PENDING|APPROVED`).
   *or* admin creates one directly (`POST /admin/mentors`, creates the user + emails a set-password link if the email is new).
2. Admin `PATCH /admin/mentors/:id {verified:true}` → role becomes `MENTOR`, user notified. Admin can also set display stats shown publicly (`stats` JSON is admin-controlled, **not computed**).
3. Mentor logs into `mentor.html`; `/mentor/*` requires `verified` + ACTIVE. `GET /mentor/overview` computes balance, copiers, allocated, closed trades, win rate, realised PnL from the ledger.

### 4.11 Admin (`admin/admin.routes.ts`)
Guard: `adminOnly` = role ADMIN + ACTIVE; in production also requires TOTP enabled (`ADMIN_2FA_REQUIRED`). **Step-up**: sensitive actions need header `x-totp: <code>` (`STEP_UP_REQUIRED` otherwise); in non-prod with no 2FA enabled it passes.

| Route | Step-up |
|---|---|
| `GET /admin/stats`, `/users`, `/users/:id`, `/kyc`, `/deposits`, `/withdrawals`, `/mentors`, `/audit`, `/deposit-addresses` | no |
| `POST /users/:id/status` (suspend/deactivate/activate; cannot touch admins) | no. Sets Redis `blocked:<id>`, revokes refresh tokens, pauses copies |
| `POST /users/:id/adjust` (credit/debit, idempotent) | **yes** |
| `POST /kyc/:userId/review` | no |
| `POST /deposits/:id/review`, `/withdrawals/:id/review` | **yes** |
| `PUT /deposit-addresses/:method` | **yes** (old/new values go to audit log) |
| `POST/PATCH /mentors`, `POST /mentors/:id/photo` | no |
| `POST /signals`, `/signals/:id/close` | no |

Promote/demote admin manually with SQL (see `setadmin` file).

### 4.12 Smaller modules
- **Notifications** `/notifications` (list + unread count, `read-all`, `:id/read`). `notify(userId,title,body,email?,rows?)` always writes the DB row; optionally emails.
- **Mail** (`lib/mail.ts`): `sendMail` is fire-and-forget with 4 retries (2 s exponential backoff) via Brevo; dev with no key just logs.
- **Support** `POST /support` (3 per 10 min) → email to `SUPPORT_EMAIL`.
- **Calendar** `GET /calendar`: faireconomy weekly JSON, Redis `cal:data` (1 h), `cal:stale` (7 d fallback), `cal:fail` (5 min circuit breaker).
- **Gym** `GET /gym/candles?sym&interval&range`: Yahoo candles, cached 5 min (`gym:*`).
- **Signals** `GET /signals` public; created/closed by admin.
- **Audit** `audit(actorId, action, ip, meta)` swallows its own errors; never blocks a request.

---

## 5. API quick reference
Auth column: **P** public, **U** user token, **M** verified mentor, **A** admin.

| Method + path | Auth | Purpose |
|---|---|---|
| POST `/auth/register` `/login` `/verify-email` `/resend-otp` `/forgot-password` `/reset-password` `/refresh` `/logout` | P | session lifecycle |
| GET/PATCH `/auth/me` · POST `/auth/change-password`, `/auth/2fa/*` | U | profile/security |
| GET/POST/PUT `/kyc`, `/kyc/id` · POST `/profile/photo` | U | KYC + avatar |
| GET `/wallet/balance` `/ledger` `/pnl-today` `/deposits` `/withdrawals` `/deposit-methods` | U | wallet |
| POST `/wallet/deposits` `/wallet/withdrawals` | U | money requests |
| GET `/markets` | P | prices |
| WS `/ws` | P | live ticks |
| GET/POST `/trades`, POST `/trades/:id/close` | U | trading |
| GET `/copy/mentors` `/copy` · POST `/copy/mentors/:id/copy`, `/copy/:id/{pause,resume,stop}` | U | copying |
| GET `/mentors` | P | public mentor list |
| GET/POST `/mentor-apply` | U (tier 5) | apply |
| GET `/mentor/overview` | M | mentor stats |
| GET `/notifications`, POST `/notifications/read-all`, `/:id/read` | U | inbox |
| GET `/calendar` `/signals` `/gym/candles` · POST `/support` | P | tools/support |
| `/admin/*` | A | back office |
| GET `/health` `/ping` | P | liveness (`/ping` not rate-limited) |

---

## 6. Frontend internals

### 6.1 Shared infrastructure
- **`config.js`**: `API_BASE` = `http://localhost:4000` on localhost, else `https://api.mentorsedgepro.co`; `WS_URL` derived (`/ws`). Must load before `api.js` and any fetch.
- **`api.js`** → `window.api(path, {method, body, headers, auth, form, noRedirect})`:
  - Access token kept in `sessionStorage['at']`; adds `Authorization`; `credentials:'include'` for the `rt` cookie.
  - On `401` (and `auth !== false`): **single-flight** `POST /auth/refresh` (prevents token-reuse detection), retries once; on failure clears token and redirects to `login.html` (unless `noRedirect`).
  - Throws `Error` with `.status` and `.data` (parsed body, e.g. `err.data.error === 'INSUFFICIENT_FUNDS'`).
  - Helpers: `api.setToken`, `api.refresh`, `api.key()` (UUID for `Idempotency-Key`).
  - Multipart: pass `form: FormData` (don't set Content-Type).
- **`theme.js`**: sets `data-theme` (light default, persisted in `localStorage['theme']`) and injects a ☾/☀ toggle into `.topbar-right/.nav-actions/.mt-top`. Dark tokens live at the bottom of `style.css`.
- **`i18n.js`**: language `<select>` using Google Translate via `googtrans` cookie (13 languages incl. Yoruba/Igbo/Hausa).
- **`touch-fx.js`**: on touch devices, moves the cursor glow and tilts `.tilt/[data-tilt]/.magnetic` elements under the finger.
- **CSS layering**: `style.css` defines all design tokens (`--brand`, `--bg-*`, `--bull/--bear`, fonts Space Grotesk / Inter / IBM Plex Mono) and shared components; `auth.css`, `kyc.css`, `dashboard.css` extend it. `admin.css` is a standalone older dark-theme copy used only by `admin.html`.

### 6.2 Public pages
| Page | JS | Data |
|---|---|---|
| `index.html` | `script.js` (nav, reveal, counters, ticker, FAQ, hero/CTA Three.js), `fx3d.js` (5 extra 3D scenes) | `GET /markets` every 5 s (ticker, heatmap, volatility); `GET /mentors` for platform stats |
| `markets.html` | inline | `?m=forex|stocks|crypto|indices|commodities`; polls `/markets?asset=` every 5 s |
| `mentorboard.html` | inline | `GET /mentors`; filter by risk (≤3 / 4–6 / ≥7), sort by gain/copiers/risk; "Copy" → `register.html` |
| `tools.html` | inline | `?p=calendar` (`/calendar`), `signals` (`/signals`), `gym` (candle replay from `/gym/candles`, simulated trades client-side only), `education` (static) |
| `support.html` | inline | `POST /support` |

### 6.3 Signup → KYC → dashboard flow
```
register.html (auth.js)
  POST /auth/register → OTP modal → POST /auth/verify-email → api.setToken → kyc.html
kyc.html (kyc.js, 6-step wizard, client validation)
  POST /kyc/id (FormData 'file') → PUT /kyc (JSON) → photo.html
photo.html
  POST /profile/photo (optional, "Skip") → dashboard.html
login.html (auth.js)
  POST /auth/login → dashboard.html
  EMAIL_NOT_VERIFIED → OTP modal; TOTP_REQUIRED → prompt() for code
  Forgot password: modal → /auth/forgot-password → /auth/reset-password (also opens via login.html#forgot)
```

### 6.4 Dashboard (`dashboard.html` + `dashboard.js` + `live.js`)
Two-layer design, **load order matters** (`config → api → dashboard.js → live.js`):
- `dashboard.js`: original UI shell: sidebar collapse/drawer, tab switching (`data-tab`), markets table + order ticket rendering from the global `MARKETS` object, toasts, bottom-sheet ticket on mobile, Three.js balance hero. Starts with empty/skeleton data.
- `live.js`: **patches the shell with real data** and relies on `dashboard.js` globals (`MARKETS`, `renderMarkets`, `currentAsset`, `selectedInstrument`, `otAmount`, `showToast`, `activateTab`, `pmBackdrop`, `miniSpark`, …). It clones some nodes (`otSubmit`, `marketsBody`) to drop old listeners, and calls `clearInterval` for ids 1…9999 to kill `dashboard.js`'s mock intervals (also stops its clock line).

What `live.js` loads (all in parallel at start, then every 15 s: balance, positions, wallet, notifications, stats, tx):
| Area | Endpoints |
|---|---|
| Greeting/avatar/tier badge/KYC banner/account details | `GET /auth/me` |
| Balance, stats, allocation donut | `/wallet/balance?acct=trading`, `/trades`, `/wallet/pnl-today` |
| Markets table + live prices | `GET /markets`, then WebSocket `/ws` ticks update price cells |
| Order ticket | `POST /trades` with `Idempotency-Key`; errors mapped via `errMsg` |
| Positions + close | `GET /trades?status=OPEN`, `POST /trades/:id/close` |
| Transactions (+receipt modal) | `GET /wallet/ledger?limit=100` |
| Copytrading | `GET /copy/mentors`, `GET /copy`, `POST /copy/mentors/:id/copy` (allocation, min $50), pause/resume/stop |
| Deposits | only **crypto** is live; wire/SEPA show an "under maintenance" modal. Addresses from `/wallet/deposit-methods`; proof via `POST /wallet/deposits` (FormData) |
| Withdrawals | `POST /wallet/withdrawals` (network + destination, min $10) |
| Wallet tab | balance, pending deposits, invested, activity from deposits+withdrawals |
| Notifications bell | `GET /notifications`, then `POST /notifications/read-all` on open |
| Settings | `PATCH /auth/me`, `POST /profile/photo`, `POST /auth/change-password`, 2FA modal (`/auth/2fa/setup|enable|disable`), "Become a mentor" card for tier ≥5 |
| Market calendar | `GET /calendar` |
| Market-hours pill | computed client-side (NY time) |

Skeleton placeholders (`.sk`) are removed after the first `Promise.all`; `loadStats` runs after 1.6 s so count-up animations finish first.

### 6.5 Mentor portal (`mentor.html` + `mentor.js`)
Own login box (same `/auth/login`, 2FA aware). Checks `/mentor/overview`; 403 → explains the account isn't a verified mentor without logging out. Features: stats cards, TradingView chart, buy/sell ticket (SL/TP entered as pips/points from entry and converted to prices), open positions table with close, live price via WS. **Trade snapshot**: when a position disappears between polls (10 s), it fetches closed trades and renders a downloadable PNG card with `html2canvas`. Placing/closing trades uses the normal `/trades` endpoints, which triggers copier mirroring server-side.

### 6.6 Admin console (`admin.html` + `admin.js`)
Tab renderers in `TABS`: overview, users (search, status, balance adjust), kyc, deposits, withdrawals, signals, addresses, mentors (create/edit/photo/stats), audit, security (2FA setup). `A(path,{totp:true})` prompts for a 6-digit code and sends it as `x-totp`. Includes the "Reset 2FA" 3-step form (`/auth/2fa/reset-request` → `/auth/2fa/reset` → QR setup → `/auth/2fa/enable`). Table cells get `data-label` via a MutationObserver for the mobile card layout. Only `ADMIN` role may enter.

### 6.7 Hosting (`vercel.json`)
`cleanUrls` (`/markets` serves `markets.html`), `noindex` header on dashboard/kyc/photo/admin/mentor, cache headers for static assets, permanent redirect from `mentorsedgepro-one.vercel.app` to `mentorsedgepro.co`. Note the folder is spelled `assests/` (videos); keep the spelling or update all references.

---

## 7. Key end-to-end flows

**A. Deposit**
`dashboard Deposits → copy address → send crypto → upload proof → POST /wallet/deposits (PENDING)` → admin opens `admin.html > Deposits`, views signed proof, Approve (+2FA code) → `dep-credit` ledger entry → user notified/emailed → balance and **tier** update.

**B. Withdrawal**
`POST /wallet/withdrawals` → KYC + tier-cap check → funds debited immediately (`wd-hold`) → admin Approve (pays manually) or Reject (`wd-refund`).

**C. Manual trade**
`order ticket → POST /trades` → price from live feed → Position OPEN + debit → every tick checks SL/TP → close (manual or trigger) → `pos-close` credit.

**D. Copy a mentor**
`Copy this mentor → POST /copy/mentors/:id/copy` (fee debit + relation) → mentor opens trade → `mirrorOpen` sizes each copier's trade → mentor/SL/TP closes → `mirrorClose` closes all → emails sent → 1st of month: fee renewal or auto-pause.

**E. Suspend a user**
Admin `POST /users/:id/status` → DB status, Redis `blocked:<id>` (instant 403 on access tokens), refresh tokens revoked, copies paused, user emailed.

---

## 8. How to extend

| Task | Where |
|---|---|
| Add instrument | `market/instruments.ts` (+ source mapping in `sources.ts` / `YF` in `yahoo.ts`; TradingView map in `mentor.js`; ticker list in `script.js` if wanted). `startFeed` upserts the DB row |
| Add API module | create `modules/x/x.routes.ts` exporting a `FastifyPluginAsync`, `app.addHook('preHandler', app.auth)`, register in `app.ts` with a prefix |
| New money flow | always `prisma.$transaction` + `postEntry` with a deterministic idempotency key; add a `LedgerType` via migration if needed (then update `txNames`/`TXF` in `live.js`) |
| Change tiers | `tier/tier.ts` `TIERS` (cents) |
| New admin action | add route in `admin.routes.ts` (use `stepUp(req)` for money/addresses), add a tab in `admin.js` `TABS` |
| New error code | return `{error:'CODE'}` in backend; map to text in `errMsg` (`live.js`) or `ERR` (`mentor.js`/`admin.js`) |
| New migration | edit `schema.prisma` → `npx prisma migrate dev --name x` |

---

## 9. Known gaps / gotchas (read before changing things)
2. `INTERNAL` error responses include a `debug` string, so strip them before public launch.
3. `/auth/me` does not return `fx`; `mentor.js` falls back to USD/rate 1 (currency conversion is dormant).
4. `live.js` clears all timers (`clearInterval` 1…9999) and depends on `dashboard.js` globals, so keep the load order and be careful adding earlier timers.
5. Feed state is **per process**. With multiple API instances each runs its own sources and SL/TP trigger loop. Closes are race-safe (`updateMany … status: 'OPEN'`), but WS clients only see their instance's prices.
6. Finnhub-only forex/stocks and Twelve (15-min poll vs 20-min staleness window) can flap to "closed"; Yahoo is an unofficial endpoint.
7. Copy allocation is not escrowed; a follower can spend the balance elsewhere and later copies are skipped for insufficient funds.
8. Withdrawal approval only marks status; the actual crypto payout is a manual step.
9. `.env.example` is gitignored; Docker image keeps dev dependencies in `node_modules`.
10. `dashboard.html` still contains some static marketing copy (e.g. withdrawal timing text) not driven by backend rules, so verify it matches policy.
private - b319fc6f41df60018533725790ce189f8c46e9062a36a68b64585df1f21a2b90