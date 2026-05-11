# Fairshare

> A Splitwise-style expense splitter for groups of friends. Track who paid, who owes, and settle up without spreadsheets or math.

**[🚀 Live demo →](https://fairshare-liard.vercel.app)**

Fairshare is a full-stack web app I built end-to-end to deepen my full-stack skills: schema design, REST API, JWT auth, React state management, and production deployment. It lets a group of users split bills evenly, scope expenses to a group or individuals, and see who owes whom at a glance.

> ⏱️ **Cold-start note:** the backend runs on Render's free tier, which spins down after 15 minutes of inactivity. The first request after sleep takes 30–50 seconds; everything after that is fast. Just hit "Sign up" and wait through the first load.

---

## Features

- 🔐 **Email + password auth** with bcrypt hashing and JWT-protected routes
- 👥 **Friends graph** — search by email, send/accept/decline requests
- 🧑‍🤝‍🧑 **Groups (optional)** — create groups, invite members by email, leave anytime
- 💸 **Expense logging** — payer-only, split evenly across selected participants
- 🪙 **Personal *or* group expenses** — same form, different scoping
- ✏️ **Edit & delete** — only the payer can modify their own expenses
- 📊 **Live balances** — net amount each friend owes you (or you owe them), aggregated across all expenses and settlements
- 🤝 **Settlements** — record cash repayments to zero out a balance
- 🎨 **Polished UI** — custom landing page, responsive navbar, color-coded payer/payee chips

---

## Tech Stack

| Layer | Stack |
|---|---|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS v3, React Query, Zustand, React Router |
| **Backend** | Node.js, Express 5, TypeScript, Prisma v7 ORM, bcrypt, jsonwebtoken |
| **Database** | PostgreSQL (Supabase) |
| **Hosting** | Vercel (frontend), Render (backend), Supabase (database) |
| **CI/CD** | GitHub-triggered auto-deploy on every push to `main` |

---

## Architecture

```
┌──────────────────────────┐         ┌────────────────────────────┐         ┌──────────────────┐
│  Vercel (static CDN)     │  HTTPS  │  Render (Node container)   │  TCP/TLS │  Supabase        │
│  fairshare-liard         │ ──────► │  fairshare-wcuq.onrender   │ ───────► │  Postgres        │
│  React + Vite bundle     │  REST   │  Express + Prisma          │  pooled  │  5 tables        │
└──────────────────────────┘         └────────────────────────────┘         └──────────────────┘
       │                                       │
       │ VITE_API_URL                          │ DATABASE_URL, DIRECT_URL
       │ baked in at build time                │ JWT_SECRET, CORS_ALLOWED_ORIGIN
```

### Data model

Five tables in PostgreSQL:

- **`users`** — id, name, email (unique), passwordHash
- **`friendships`** — directional userA → userB rows with status (`pending` / `accepted` / `declined`)
- **`groups`** + **`group_members`** — many-to-many via a composite primary key
- **`expenses`** — description, amount, payer, optional `groupId` (nullable for personal expenses)
- **`expense_participants`** — per-participant `amountOwed` (stored, not derived, so future split types don't require schema changes)
- **`settlements`** — payer → payee repayments, also with optional `groupId`

### Auth flow

1. **Register** → password hashed with bcrypt → user row inserted
2. **Login** → bcrypt compare → JWT signed with `JWT_SECRET`, returned to client
3. **Client** → JWT stored in Zustand + `localStorage`; attached as `Authorization: Bearer <token>` on every request
4. **Server** → `authMiddleware` decodes the JWT, attaches `req.userId`; every protected route reads from there
5. **Authorization** → per-route checks (e.g. only the payer can edit/delete their expense)

### Balance calculation

For each pair `(you, friend)`, balance is the net of:

```
+ Σ amountOwed where you paid    and friend is participant
- Σ amountOwed where friend paid and you are participant
+ Σ settlements where friend paid you
- Σ settlements where you paid friend
```

Positive = they owe you. Negative = you owe them. Zero = settled up.

---

## Local Development

### Prerequisites

- Node.js 20+
- A PostgreSQL database (Supabase free tier works)

### Setup

```bash
# Clone
git clone https://github.com/prathameshhire/fairshare.git
cd fairshare

# --- Backend ---
cd server
npm install
cp .env.example .env       # fill in DATABASE_URL, DIRECT_URL, JWT_SECRET
npx prisma migrate dev     # creates the 5 tables
npm run dev                # http://localhost:3000

# --- Frontend (new terminal) ---
cd client
npm install
# .env.local with VITE_API_URL=http://localhost:3000 is optional;
# the code falls back to this default if VITE_API_URL is unset.
npm run dev                # http://localhost:5173
```

### Required env vars

**`server/.env`**
```env
DATABASE_URL="postgresql://...?pgbouncer=true"
DIRECT_URL="postgresql://..."
JWT_SECRET="<a long random string>"
CORS_ALLOWED_ORIGIN="<your production frontend URL, optional in dev>"
```

**`client/.env.local`** (optional in dev)
```env
VITE_API_URL=http://localhost:3000
```

---

## Project Structure

```
fairshare/
├── client/                  # React + Vite frontend
│   ├── src/
│   │   ├── components/      # Layout, ProtectedRoute, UserAvatar, LogoMark
│   │   ├── pages/           # Landing, Login, Register, Expenses, Balances, Friends, Groups
│   │   ├── hooks/           # React Query hooks (useExpenses, useGroups, useBalances, ...)
│   │   ├── lib/             # api.ts (fetch wrapper), queryClient
│   │   ├── store/           # Zustand: useAuthStore
│   │   └── types/           # Shared TypeScript types
│   └── ...
├── server/                  # Express + Prisma backend
│   ├── src/
│   │   ├── index.ts         # Routes, middleware, server bootstrap
│   │   └── lib/prisma.ts    # Prisma client singleton with Neon adapter
│   ├── prisma/
│   │   ├── schema.prisma    # 5-table data model
│   │   └── migrations/      # Migration history
│   └── prisma.config.ts     # Prisma v7 datasource config
└── README.md
```

---

## Notable Implementation Details

### Dual-mode expense validation
The same `POST /api/expenses` endpoint handles both personal and group expenses. When `groupId` is present, the server validates that the payer and all participants are members of that group. When absent, it validates that all participants are accepted friends of the payer. This avoids two near-duplicate endpoints.

### Cache invalidation on user switch
React Query caches queries by key. Without intervention, logging out and logging back in as a different user shows the previous user's cached data. Fixed by calling `queryClient.clear()` in the Zustand `setAuth` and `clearAuth` actions — every auth transition starts with a clean cache.

### CORS allowlist
The backend's CORS middleware reads `CORS_ALLOWED_ORIGIN` and rejects any other origin (with a hardcoded exception for `localhost` to keep dev simple). A successful CORS preflight (`OPTIONS` request) was verified with `curl` before integration testing.

### Build-time vs runtime env vars
The frontend's `VITE_API_URL` is inlined into the JS bundle at build time — once deployed, it's a hardcoded string. The backend's `JWT_SECRET` and DB URLs are read at process startup, so env changes require a service restart (which Render does automatically when you save a new env var).

### Prisma v7 + Neon adapter
Prisma v7 moved datasource configuration out of `schema.prisma` into a separate `prisma.config.ts`. Combined with the `@prisma/adapter-neon` adapter, this keeps the schema file purely declarative.

---

## About

Built solo as a learning project to practice production full-stack development end-to-end — from schema design and REST API to React state management, JWT auth, and deploying to a real domain. Every piece was written and explained step-by-step rather than copied from a template.

If you're a recruiter or engineer kicking the tires: I'd love to walk through the architecture or talk about decisions I made.
