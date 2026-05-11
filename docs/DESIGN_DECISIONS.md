# Fairshare — Design Decisions & Trade-offs

> A reference for understanding *why* Fairshare was built the way it was, what those choices cost, and what to revisit if you scale this into a real product.

This isn't a "things you got wrong" list. Every choice below is **appropriate for a solo learning project**, but most have a different default at product scale. Read this as: *here are the forks in the road you've taken, and the path you'd switch to later.*

---

## How to read this document

Each decision has a consistent shape:

- **The choice:** what was built.
- **Why it's right for now:** the stage-appropriate justification.
- **Pros / cons:** what you gain and what you give up.
- **When to revisit:** the concrete signal that would push you toward a different choice.
- **Migration path:** what changing this would actually involve.

---

## Table of Contents

1. [Architecture](#1-architecture)
2. [Authentication & Security](#2-authentication--security)
3. [Backend & Data Layer](#3-backend--data-layer)
4. [Frontend State & Rendering](#4-frontend-state--rendering)
5. [Data Model](#5-data-model)
6. [Hosting & Operations](#6-hosting--operations)
7. [Code Quality & DX](#7-code-quality--dx)
8. [Priority order for product-stage upgrades](#8-priority-order-for-product-stage-upgrades)

---

## 1. Architecture

### 1.1 — SPA (Vite + React Router) instead of SSR / SSG

**The choice:** Frontend is a Single Page Application. The browser downloads one HTML file plus a JS bundle. React Router handles all routing client-side. The server (Vercel) only serves static files.

**Why it's right for now:**
- The entire interesting part of Fairshare (expenses, balances, groups) is behind a login wall. SEO is irrelevant for those routes.
- The interactive UX (live participant selection, dynamic balance updates) is where SPA shines.
- Hosting cost is $0 on Vercel's free CDN tier.
- Simpler mental model than SSR — fewer moving parts to learn.

**Pros:**
- Snappy in-app navigation (no full reloads).
- Single bundle, served from CDN, one cache key.
- Backend and frontend cleanly separated.

**Cons:**
- Initial bundle has to download + parse before *anything* shows on screen → slow first paint, especially on mobile.
- Google sees `<div id="root"></div>` for the landing page — bad for SEO.
- Social-share previews (Twitter cards, OG tags) require the page to be pre-rendered to be reliable.
- Refresh-on-deep-link requires a server rewrite rule (see [`client/vercel.json`](../client/vercel.json) — we just added this to fix a 404 bug).

**When to revisit:**
- You want the landing page to rank in Google for terms like "free expense splitter."
- Real users are bouncing on the first load because of bundle size.
- You want email links like "View your balance with Alice" to feel instant.

**Migration path:** **Next.js**. Most of your code (components, hooks, API calls) transfers untouched. You'd:
1. Move pages to `app/<route>/page.tsx`.
2. Mark interactive pages as `"use client"`.
3. Keep `react-query`, `zustand`, `tailwind` unchanged.
4. Optionally fold the Express API into Next.js API routes (or leave it separate — both work).

Effort: ~1-2 weekends.

---

### 1.2 — Express + separate React frontend instead of Next.js full-stack

**The choice:** Two distinct services. `server/` runs Express + Prisma, deployed to Render. `client/` is a Vite-built static site, deployed to Vercel. They communicate over HTTPS with CORS.

**Why it's right for now:**
- You learn the actual primitives — HTTP, headers, JWTs, CORS — by hand, instead of having them abstracted into a framework.
- Backend is reusable: if you ever build a mobile client or CLI, the same API serves it.
- Failures are isolated. A bug in the frontend can't take down the backend, and vice versa.

**Pros:**
- Clean separation of concerns.
- Backend stack is yours to swap (could move to Fastify, NestJS, Go, anything).
- Frontend stack is yours to swap (could move to SvelteKit, Solid, anything).

**Cons:**
- Two deployments, two `package.json`s, two `.env` files to manage.
- CORS is a real thing you have to configure and debug.
- Types are duplicated — `User`, `Expense`, etc. exist in both `server/` (via Prisma) and `client/src/types/`. They can drift.
- Cold-start latency from frontend → backend on free hosting.

**When to revisit:**
- You're adding lots of features and the duplicated type definitions become a maintenance burden.
- You want server components and end-to-end type safety in one repo.

**Migration path:** Move the whole thing into a Next.js monorepo. Express routes become Next.js API routes; Prisma client stays the same. Shared types live in one folder. Effort: ~1 weekend.

---

## 2. Authentication & Security

### 2.1 — JWT in `localStorage` instead of httpOnly cookies

**The choice:** Server signs a JWT on login. Client stores it in `localStorage` (via Zustand persist). Every request attaches `Authorization: Bearer <token>` manually.

**Why it's right for now:**
- Conceptually simpler — you can `console.log` the token, decode it on jwt.io, see how it flows.
- No CSRF protection needed (CSRF only attacks cookie-based auth).
- Stateless backend: no session store, no Redis, easy to deploy anywhere.

**Pros:**
- Auth state is visible and debuggable.
- Backend horizontal scaling is trivial — any instance can verify any token.
- Works with non-browser clients (mobile, CLI) the same way.

**Cons:**
- **XSS vulnerability surface:** any injected script (compromised npm package, missed sanitization) can read the token from `localStorage` and steal the session.
- No revocation: a stolen token is valid for its full 7-day lifetime. You can't kick out a compromised user without rotating `JWT_SECRET` (which logs everyone out).
- No "logged in elsewhere" enforcement.

**When to revisit:**
- You're handling actually-sensitive data (payments, PII beyond email/name).
- You want real users to trust the app.
- Compliance becomes a thing (GDPR, SOC2, etc.).

**Migration path:**
- **Step 1:** Move to httpOnly cookies. Server sets a `Set-Cookie: token=...; HttpOnly; Secure; SameSite=Lax` on login. JS literally cannot read it. CSRF protection becomes necessary (double-submit tokens or SameSite cookies handle it).
- **Step 2:** Switch to short-lived access tokens (15 min) + long-lived refresh tokens (30 days) with rotation. Server-side revocation list in Redis.

Effort for Step 1: ~half a day. Step 2: ~2-3 days including testing.

---

### 2.2 — Bcrypt with 10 rounds

**The choice:** Passwords hashed with `bcrypt.hash(password, 10)`. 10 rounds = industry standard ~2025.

**Why it's right for now:** This *is* the right choice. 10 rounds is the OWASP-recommended floor. Higher rounds slow login proportionally — 12 takes ~4x longer, 14 takes ~16x longer.

**When to revisit:**
- You're seeing brute-force attempts in logs → bump rounds to 12 to make each attempt more expensive.
- You're seeing slow login complaints → don't lower below 10; instead, fix the slow connection or DB.

**Migration path:** Trivial — change one constant. New users get the new cost factor. Existing users get re-hashed on their next successful login (you can add this logic to the login handler).

---

### 2.3 — 7-day JWT expiry

**The choice:** Tokens valid for 7 days. No refresh tokens. User has to log in again after a week.

**Why it's right for now:**
- Long enough that you don't get logged out mid-session.
- Short enough that a leaked token has a bounded lifetime.

**Cons:**
- Stolen tokens are valid for up to 7 days. No revocation.
- Users who do log in regularly experience a forced logout every week with no "remember me."

**When to revisit:** When you implement refresh tokens (see 2.1 migration path).

---

### 2.4 — `JWT_SECRET` from environment, no rotation

**The choice:** Single secret, set once at deploy time. Used to sign all tokens.

**Why it's right for now:** Simple. Works.

**Cons:** If `JWT_SECRET` is ever leaked (env file committed, server compromised), every token ever issued is compromised. Rotating it invalidates everyone's session.

**Migration path:** Use a signing key + key ID (`kid`) header so old tokens can still be validated by old keys while new tokens use a new key. Or move to asymmetric signing (RS256) so the public key can be rotated independently.

---

### 2.5 — No rate limiting

**The choice:** No limit on login attempts, password resets, friend requests, expense creation, etc.

**Why it's right for now:** Single-user testing, no abuse vector.

**Cons:**
- Login endpoint can be brute-forced.
- A malicious user could create infinite expenses, friendships, etc.
- A bot could enumerate emails by sending friend requests to common addresses.

**When to revisit:** Before any public launch. Even one bad actor with a script can ruin your DB.

**Migration path:** `express-rate-limit` middleware. ~30 minutes to wire up sensible defaults (5 logins/min, 100 API calls/min per IP). Use a Redis-backed store if you scale to multiple instances.

---

## 3. Backend & Data Layer

### 3.1 — Prisma ORM instead of raw SQL or a query builder

**The choice:** Prisma v7 with the Neon adapter. Schema lives in `prisma/schema.prisma`. Migrations are tracked in `prisma/migrations/`. Every DB call goes through the typed Prisma client.

**Why it's right for now:**
- Type safety from DB → API → frontend without manual effort.
- Schema migrations have a clear, reversible history.
- You learn the *concept* of an ORM before deciding it's not for you.

**Pros:**
- Auto-generated TS types match your schema exactly.
- Relational queries (with `include`) are concise.
- Migration tooling is solid.

**Cons:**
- Generates SQL you don't see — performance pitfalls are hidden (N+1 queries, missing indexes).
- Limited support for advanced SQL (CTEs, window functions, full-text search).
- The Prisma client is heavy (~5MB) — slower cold starts on serverless.

**When to revisit:**
- You hit a query the ORM can't express well, and find yourself fighting it.
- Bundle size or cold-start time becomes a problem.
- You want to use Postgres features (`generated columns`, `materialized views`, `LISTEN/NOTIFY`) Prisma doesn't expose.

**Migration path:** **Drizzle ORM** is the modern alternative — closer to SQL, smaller bundle, better at advanced queries. Or drop to raw SQL via `postgres.js` and write your own types. Effort: 1-3 days depending on query count.

---

### 3.2 — Live-computed balances instead of materialized totals

**The choice:** `computeBalancesFor(userId)` runs three Prisma queries on every balance request, then loops in JS to net them. Nothing is cached or stored.

**Why it's right for now:**
- One source of truth — you can never have a balance that disagrees with the underlying expenses.
- Edits and deletes don't need cleanup logic.
- Implementation is ~60 lines and trivially correct.

**Pros:** Bulletproof correctness, simple debugging.

**Cons:**
- O(n) where n = (expenses paid + participations + settlements). At 10K expenses per user, this is slow.
- Three round-trips to the DB per request. Some are wasteful (you only need a slice).
- No way to ask "what was Alice's balance on March 5th?" without reconstructing it from history.

**When to revisit:**
- A single user's balance query takes >200ms in production.
- You want historical balance graphs ("your debt to Bob over time").
- You want push notifications like "Alice now owes you over $100."

**Migration path (in order of disruption):**
1. **Cache at the API layer** — React Query already does this client-side. Add `staleTime` to keep things hot.
2. **Cache at the server** — Redis, keyed by `userId`, invalidated on every write that touches that user.
3. **Materialize into a `user_balances` table** — updated by triggers on expense/settlement insert/update/delete, OR by a background job that runs daily.
4. **Event-sourced model** — store every "balance event," recompute on demand or in a stream. Overkill until you're Splitwise-scale.

---

### 3.3 — Store `amountOwed` per participant instead of deriving from split type

**The choice:** Every `expense_participants` row has an explicit `amountOwed` column, even though V1 only does even splits where this is always `amount / participants.length`.

**Why this is actually a great call:**
- Adding "split by percentage" or "split by exact amounts" later requires zero schema changes.
- Historical splits stay correct even if your split logic evolves.
- The data model documents itself — anyone reading the schema sees the participant's actual share, not a derived value.

**The redundancy this costs:**
- Validation has to check that participants' amounts sum to the expense's `amount` (currently you trust the computation, which is fine for even splits but won't be for custom splits).
- Rounding: `$10 / 3 = $3.33 × 3 = $9.99`. The expense says $10, the participants sum to $9.99. **This is one of the bugs flagged earlier.** Not a design problem, an implementation gap.

**Action item:** Add a "rounding remainder" rule — give the last participant the leftover cent, or rotate which participant absorbs it across the user's history.

---

### 3.4 — Single `friendships` row per pair with `status` column

**The choice:** One directional row (`requesterId → addresseeId`). Status is `pending` / `accepted` / `declined`. Declined requests are "revived" by reusing the row with new direction + status.

**Why it's right for now:**
- One row per pair → uniqueness is enforced by the schema, not by application code.
- The friendship lifecycle (request → accept/decline → reactivate) is one record's history.

**Cons:**
- Direction is asymmetric. Every query that asks "who are my friends" has to do `OR (requesterId = me) (addresseeId = me)`.
- You lose audit history — when a friendship is "revived," the old declined state is overwritten.
- Edge cases: if Alice declines Bob, then Bob sends another request, then Alice sends one too — the model handles this but it's not obvious why it works.

**When to revisit:** If you want a full request history ("here's every friendship interaction") or if friend-graph queries become a hot path needing optimization.

**Migration path:** Split into `friend_requests` (history) and `friendships` (current state, bidirectional row pair). More tables, but clearer semantics.

---

### 3.5 — Nullable `groupId` on expenses & settlements (dual-mode)

**The choice:** One `expenses` table handles both personal and group expenses. `groupId` is nullable: `NULL` = personal, `<uuid>` = group-scoped. Same API endpoint, same validation flow with a branch inside.

**Why it's right for now:**
- One API, one model, one validation function.
- Easy to "convert" a personal expense to group later (just set `groupId`).
- No code duplication between two near-identical endpoints.

**Pros:** DRY, easy to reason about.

**Cons:**
- Validation gets branchy: "if `groupId` then check membership else check friendship."
- Nullability is contagious — `groupId` is null in lots of queries, easy to forget to handle.
- If group expenses gain group-specific features (categories, budgets, tags), the schema starts to feel cluttered.

**When to revisit:** When group and personal expenses diverge enough that the shared model has more `if (groupId)` branches than common code.

**Migration path:** Split into `personal_expenses` and `group_expenses`. Or keep one table but add a `kind` enum column instead of relying on `NULL`. Both work; the latter is a smaller change.

---

### 3.6 — Application-level transactions instead of database-level CASCADE

**The choice:** When deleting an expense, the application wraps `deleteMany(participants) + delete(expense)` in `prisma.$transaction`. The DB schema doesn't declare `ON DELETE CASCADE`.

**Why it's right for now:**
- Cascading deletes are visible in code — you can grep for "delete" and see what's cleaned up.
- Works the same regardless of DB vendor (Postgres, MySQL, SQLite).

**Cons:**
- Easy to forget to wrap in a transaction. Forgetting one cascade rule = orphan rows.
- If you add a new child table later (e.g. `expense_comments`), you have to remember to also delete from there.

**When to revisit:** When you've shipped one too many "forgot to delete the child rows" bugs.

**Migration path:** Add `onDelete: Cascade` to the relations in `schema.prisma`. Prisma generates the SQL constraints automatically. One migration, mechanical change.

---

### 3.7 — Email normalization at write time (lowercase + trim)

**The choice:** Every email is `email.trim().toLowerCase()` before being stored or queried.

**Why it's right for now:** This is the right call. Emails are case-insensitive per RFC 5321 in practice (the spec technically allows case-sensitive local parts, but no real provider does this).

**Action item:** None — keep doing this. The only thing to add is a DB-level `CHECK` constraint or a Postgres `citext` column type as a belt-and-suspenders measure.

---

### 3.8 — CORS allowlist from environment variable

**The choice:** `CORS_ALLOWED_ORIGIN` env var defines allowed production origins; localhost is always allowed for dev.

**Why it's right for now:** Simple, explicit, correct.

**Cons:** A typo in the env var = production frontend can't talk to backend. No visibility from the app what origins are configured.

**Action item:** Maybe log the allowed origins at server startup so it's obvious in deploy logs. ~3 lines.

---

## 4. Frontend State & Rendering

### 4.1 — React Query for server state + Zustand for client state

**The choice:** Two libraries, two responsibilities.
- **React Query** owns server data (expenses, balances, friendships) — caching, refetching, invalidation, optimistic updates.
- **Zustand** owns client-only state (auth token, current user) — persisted to `localStorage`.

**Why it's right for now:** This is the modern recommended pattern. Most teams have stopped using Redux for new projects precisely because of this split.

**Pros:**
- Tiny bundles (<5KB each).
- Clear semantics: "is this from the server or local?" answers which tool to use.
- React Query handles 90% of the work data fetching normally requires (loading states, errors, refetching on focus, etc.).

**Cons:**
- Two mental models to learn.
- Boundaries can be fuzzy — the current user's profile is "server state" stored as "client state" so it's available synchronously. (Currently handled by `getMe` updating the Zustand store.)
- Cache invalidation across the two tools is manual: `clearAuth` calls `queryClient.clear()`.

**When to revisit:** Hard to imagine. This pattern scales well.

---

### 4.2 — Tailwind utility classes instead of CSS modules / styled-components

**The choice:** All styling is inline Tailwind classes. No `.css` or `.module.css` files outside the global reset.

**Why it's right for now:**
- Fast to iterate — no naming things, no file switching.
- Consistent design tokens (spacing, colors) out of the box.
- No specificity wars, no orphan styles.

**Cons:**
- Long, noisy `className` strings on every element.
- Reusing styles requires `@apply` (creates a CSS file you'd otherwise avoid) or extracting components.
- Hard to grep for "everywhere using `bg-emerald-100`" — utility class names don't carry semantic meaning.
- Designers need to learn Tailwind to contribute.

**When to revisit:** When you onboard a non-Tailwind-familiar contributor, or when the styling logic starts duplicating across many components.

**Migration path:** Adopt a component library on top of Tailwind — **shadcn/ui** is the leading choice. Pre-built accessible components (button, dialog, dropdown, etc.) you copy into your repo and customize with Tailwind. Cuts down inline classes dramatically.

---

### 4.3 — `queryClient.clear()` on every auth transition

**The choice:** `setAuth` and `clearAuth` in `useAuthStore` call `queryClient.clear()` so logging out + back in as a different user starts with a clean cache.

**Why it's right for now:** Fixes a real bug — without this, you log out as Alice, log in as Bob, and see Alice's expenses cached for a second before they refetch.

**Pros:** Bulletproof correctness.

**Cons:** Throws away *all* cache, including queries that aren't user-specific. Slight wasted re-fetch.

**Action item:** None — this is fine. If you ever have caches that should survive auth changes (e.g. a public stats endpoint), you'd switch to selective invalidation: `queryClient.removeQueries({ queryKey: ['expenses'] })`.

---

### 4.4 — `ProtectedRoute` component as the auth gate

**The choice:** A wrapper component checks the auth store and either renders `<Outlet />` (children) or redirects to `/login`.

**Why it's right for now:** Standard React Router pattern. Easy to read.

**Cons:** Auth check happens on the client, after the bundle loads. A user who isn't logged in still briefly sees the layout before being redirected. Not a security issue (the API enforces auth), but a UX nit.

**Migration path:** Combine with server-side auth check (only relevant if you migrate to Next.js).

---

### 4.5 — Per-route page components in `pages/`, not per-feature folders

**The choice:** `pages/ExpensesPage.tsx`, `pages/BalancesPage.tsx`, etc. Hooks live in `hooks/`, components in `components/`.

**Why it's right for now:** Conventional for small apps. Easy to find things.

**Cons:** As features grow (expenses get sub-features: receipts, recurring, categories), `pages/ExpensesPage.tsx` swells. Related concerns (the expense hook, the expense components, the expense types) live in different folders.

**When to revisit:** When you have 5+ files per "feature" scattered across folders.

**Migration path:** Reorganize into `features/expenses/` containing the page, hook, types, and components. Tedious but mechanical. Tools like `nx` or `turborepo` can enforce this at scale.

---

## 5. Data Model

### 5.1 — `Decimal` columns for money, stored as string in JSON

**The choice:** `amount` and `amountOwed` are Prisma `Decimal` (Postgres `numeric`). Serialized to JSON as strings to preserve precision.

**Why it's right for now:** Floating-point is wrong for money (`0.1 + 0.2 !== 0.3`). Decimal is correct.

**Cons:**
- Strings in JSON are a footgun — the frontend has to `Number(amount)` everywhere. A forgotten conversion = NaN bugs.
- Some places in the code use `Number(amount)` then do arithmetic, which loses precision again.

**Best practice (not yet adopted):** Store as integer cents (`amount: 1099` for $10.99). All arithmetic stays in integers. Format only for display.

**When to revisit:** When you have a rounding bug that traces back to floating-point conversion.

**Migration path:** Add a new `amountCents: Int` column, backfill, switch reads, eventually drop the Decimal. Annoying but mechanical.

---

### 5.2 — `isSettled` flag on participants, never written to

**The choice:** The `expense_participants` table has an `isSettled` boolean. In V1 we never set it — we compute "effectively settled" based on the relationship-level balance instead.

**Why it's right for now:** Forward-compatibility hedge. Schema cost is one column; future flexibility is real.

**Cons:** Dead code in the data model. A reader might think it's meaningful and try to use it.

**Action item:** Either commit to the relationship-level approach and drop the column, OR start using it and document the semantics. Currently it's neither, which is a smell.

---

### 5.3 — Settlements as a separate table, not signed expenses

**The choice:** `settlements` is its own table with `payerId`, `payeeId`, `amount`. A settlement is **not** modeled as a negative expense.

**Why it's right for now:**
- Semantically distinct: an expense is "I spent money on something we shared"; a settlement is "I paid you back what I owed."
- Easier to filter/display ("show me only real expenses, not settlements").
- Different validation rules (settlement needs both parties present and friends/group members).

**Pros:** Clean separation, clear UI distinction.

**Cons:** Duplicate fields with `expenses` (amount, currency-equivalent, group, timestamps). Two queries needed to compute balances (currently parallelized — fine).

**This is the right call.** Splitwise uses the same model.

---

### 5.4 — Group archive via `archivedAt` timestamp, not a boolean

**The choice:** `groups.archivedAt` is nullable timestamp. Null = active. Non-null = archived (and you know *when* it was archived).

**Why it's right for now:** Strictly better than a boolean. Stores more information for free.

**Pros:** You can answer "groups archived in the last 30 days" without an extra audit table.

**Cons:** None worth mentioning.

**Action item:** Apply the same pattern to other soft-delete needs as they come up (e.g. `expenses.deletedAt` if you ever add soft-delete for expenses).

---

### 5.5 — Composite primary key on `group_members`

**The choice:** `group_members` primary key is `(groupId, userId)`. No separate `id` column.

**Why it's right for now:**
- Natural uniqueness: a user is either a member of a group or not, no duplicates possible.
- One less index to maintain.
- Inserts that would create duplicates fail at the DB level with a unique violation (Prisma surfaces as `P2002`).

**Pros:** Constraint enforced by the schema, not by application code. Less code to maintain.

**Cons:** Some Prisma operations are a tiny bit more verbose (`where: { groupId_userId: { ... } }` instead of `where: { id }`).

**This is the right call.**

---

## 6. Hosting & Operations

### 6.1 — Render free tier (cold starts after 15 min idle)

**The choice:** Backend deployed to Render's free tier. Container sleeps after 15 minutes of inactivity. First request after sleep takes 30-50 seconds while the container spins up.

**Why it's right for now:** Free. For a portfolio/learning project, the cost matches the audience size.

**Cons:**
- **Bad first impression.** A user trying the live demo waits ~45 seconds with no feedback. The README acknowledges this but doesn't fix it.
- Some scheduled tasks (e.g. periodic cleanup) can't be done — there's no always-on process.

**When to revisit:** As soon as you want to share Fairshare with people not pre-warned about the cold start.

**Migration path:**
- **Cheapest fix:** $7/mo Render Starter plan → always-on, no cold start.
- **Free workaround:** Use a service like UptimeRobot to ping `/api/health` every 10 minutes. Keeps the container warm. Slight abuse of free tier but tolerated.

---

### 6.2 — Split hosting (Vercel + Render + Supabase) instead of a single platform

**The choice:** Frontend on Vercel. Backend on Render. Database on Supabase. Three providers, three control planes, three sets of env vars.

**Why it's right for now:**
- Each platform is best-in-class for its tier (Vercel for static frontends, Render for Node servers, Supabase for managed Postgres).
- All have free tiers — total cost: $0.

**Pros:** No vendor lock-in to any one provider. Failure of one is isolated.

**Cons:**
- Three places to debug. Three different log UIs to learn.
- Env vars duplicated across services (e.g. CORS allowlist on backend has to match the frontend URL exactly).
- Cross-service requests have to traverse the public internet (HTTPS), adding latency.

**When to revisit:** When operational overhead from three platforms is more annoying than the price of consolidating.

**Migration path:**
- **Consolidate to Vercel:** Vercel can host a Next.js full-stack app + Postgres (via Vercel Postgres or Neon). Single dashboard, single deploy, single env file.
- **Consolidate to Supabase:** They've added edge functions; backend could move there. Database is already there.

---

### 6.3 — Build-time env var inlining (`VITE_API_URL`)

**The choice:** `VITE_API_URL` is read by Vite at build time and inlined into the JS bundle. Once deployed, it's a hardcoded string.

**Why it's right for now:** Standard Vite pattern. Frontend is static — no runtime env vars possible without extra plumbing.

**Cons:**
- Changing the backend URL requires a frontend rebuild + redeploy. Not a quick env-var-swap.
- All "build time" config is baked into a single bundle — no way to have different envs (dev/staging/prod) without separate builds.

**When to revisit:** When you have multiple environments (staging, prod) and don't want a separate build per environment.

**Migration path:** Move to runtime env vars by serving a small `/config.js` from the frontend's hosting that exposes `window.__APP_CONFIG__`. Vite has plugins for this. Or migrate to Next.js (which supports runtime env vars natively).

---

### 6.4 — No staging environment

**The choice:** One environment: production. Pushes to `main` deploy straight to live.

**Why it's right for now:** Solo project, single user, low cost of breaking things. Easy to revert.

**Cons:**
- No safe place to test migrations on production-like data.
- Bugs land in production before you can catch them.
- Hard to demo "what's coming next" to anyone.

**When to revisit:** When you have real users who'd be inconvenienced by a broken deploy.

**Migration path:**
- **Vercel:** Preview deployments per branch are free and automatic. Already half-solves this.
- **Render:** Spin up a second service pointing at `staging` branch, with its own DB (Supabase has a free second project).
- **DB:** Copy production to staging periodically with `pg_dump`.

---

### 6.5 — No CI / automated tests

**The choice:** Zero tests. No CI pipeline. Push to main = deploy.

**Why it's right for now:**
- Solo project, no team to coordinate.
- Writing tests would slow learning velocity on early architecture.

**Cons:**
- Refactors are nerve-wracking — no safety net.
- Bugs found in production could've been caught by a basic integration test.
- Specific concerns I'd test today if pressed:
  - Balance computation against a hand-built fixture.
  - Auth middleware (rejects missing/invalid/expired tokens).
  - Expense create/update validation paths.

**When to revisit:** When you've shipped one too many regressions.

**Migration path:**
- **Minimum viable testing:** Vitest for the frontend, Vitest or Jest for the backend, with a few integration tests against a test Postgres (use a Docker container or Supabase's branching feature).
- **CI:** GitHub Actions on every PR runs the tests. Already free for public repos.

---

### 6.6 — GitHub auto-deploy on push to `main`

**The choice:** Vercel and Render both watch the `main` branch and redeploy on every push.

**Why it's right for now:** Fast iteration, low operational overhead, free.

**Pros:** Push = ship. Friction approaches zero.

**Cons:**
- No gate between "code merged" and "code live." A bad commit on main = immediate production breakage.
- No deploy approvals, no canary, no rollback strategy beyond `git revert`.

**When to revisit:** When you have real users and the cost of a broken deploy is non-trivial.

**Migration path:**
- Vercel preview deployments + a "promote to prod" button.
- Render: deploy only on tags or release branches, not every push to main.
- Eventually: full CI/CD with manual approval, blue/green deploys, etc.

---

## 7. Code Quality & DX

### 7.1 — Manual type duplication between server and client

**The choice:** `User`, `Expense`, etc. exist in `server/` via Prisma's generated types AND in `client/src/types/index.ts` as manual TS interfaces. They have to be kept in sync by hand.

**Why it's right for now:**
- No shared monorepo tooling needed.
- Each side can evolve its representation slightly (e.g. server returns `Decimal`, client receives `string`).

**Cons:**
- Drift is easy. Add a column server-side → forget to update client types → runtime errors.

**When to revisit:** When you ship one drift-induced bug.

**Migration path:**
- **Easy:** Generate types from the server's Prisma schema and import them in the client. Tools: `prisma-generator-zod`, `kysely-codegen`, or just hand-rolled scripts.
- **Better:** End-to-end type safety with **tRPC** — write a server function, get a typed client. Or move to **Next.js** where the same types are accessible naturally.

---

### 7.2 — No shared package / monorepo tooling

**The choice:** Two `package.json`s. No `pnpm workspaces` / Turborepo / Nx. No shared `tsconfig`. No shared lint config.

**Why it's right for now:** Two services don't have enough shared concerns to justify the tooling overhead.

**Cons:** ESLint and tsconfig settings drift. Shared types (see 7.1) have nowhere to live.

**When to revisit:** When the duplication starts hurting more than the tooling would.

**Migration path:** Turborepo or pnpm workspaces. Modern monorepo tooling is low-overhead. ~2-3 hours to set up.

---

### 7.3 — Comments-on-everything style

**The choice:** The codebase is heavily commented — most functions have a "what this does and why" block.

**Why it's right for now:** A learning project benefits from explaining yourself to your future self. Comments here are pedagogical.

**Cons (at product scale):**
- Comments rot. As the code changes, the comments become stale and misleading.
- A well-named function and a small commit message usually carry the same information without the rot risk.

**Action item:** As you grow more confident, prune comments that just restate what the code does. Keep comments that explain *why* something non-obvious is done (rare cases, performance hacks, historical decisions).

---

### 7.4 — Catch-all `try/catch` on Prisma errors (P2002 etc.)

**The choice:** Specific Prisma error codes (like `P2002` for unique constraint violation) are caught and converted to friendly HTTP errors. Other errors propagate.

**Why it's right for now:** Pragmatic — fast to add as new uniqueness conflicts arise.

**Cons:** No central error handler. Each route reinvents the pattern.

**Migration path:** Express error-handling middleware: `app.use((err, req, res, next) => { ... })`. Inspect `err.code`, translate to HTTP. ~30 lines, centralizes the pattern.

---

### 7.5 — No structured logging

**The choice:** `console.log` for ad-hoc debugging, no request/response logging in production.

**Why it's right for now:** Render captures stdout and shows it in the dashboard.

**Cons:**
- Hard to grep production logs for specific user actions.
- No latency metrics, no error rates.

**When to revisit:** When you're debugging a production bug and don't have the context you need.

**Migration path:**
- **Minimum:** `morgan` middleware for HTTP access logs.
- **Better:** A structured logger like `pino` that emits JSON, then ship logs to a service (Logtail, Axiom, Datadog).
- **Best:** OpenTelemetry for traces (request → DB query → response).

---

## 8. Priority order for product-stage upgrades

If you decided tomorrow that Fairshare was going to be a real product, here's the order I'd tackle the upgrades — most impact first:

1. **Move auth to httpOnly cookies (2.1)** — security. Non-negotiable for real users.
2. **Add rate limiting (2.5)** — security. Prevents the most basic abuse.
3. **Migrate hosting off Render free tier (6.1)** — UX. First impressions matter.
4. **Add a staging environment + CI tests for critical paths (6.4, 6.5)** — confidence to ship.
5. **Move to Next.js (1.1 + 1.2)** — SEO, first paint, and unifies the codebase.
6. **Materialize balances (3.2)** — performance, when needed.
7. **Refresh tokens + revocation (2.1 step 2)** — security maturity.
8. **DB-level CASCADE constraints (3.6)** — correctness polish.
9. **Integer-cents money (5.1)** — eliminate rounding entirely.
10. **Structured logging + observability (7.5)** — operate confidently.

Everything else (folder reorg, shared types, comment pruning) is incremental polish you can do anytime.

---

## Closing thought

A common feeling when reading a list like this is *"oh no, I have so much wrong."* That's not the takeaway. **Every item here is a deliberate trade-off you'd make differently at a different stage.** A learning project that did everything in this document on day one would have taken a year and taught you nothing about why those choices matter.

The skill being developed isn't *"build it the right way the first time."* It's *"know enough about each decision that when the constraints change, you can see clearly what to upgrade."* That skill is exactly what this document is meant to reinforce.

When in doubt, the move is: **build the simplest thing that works, ship it, watch what hurts, and only then complicate things.**
