# Dream Craft Events v2

Event ticketing, a party-supply shop and custom event planning, rebuilt on a modern TypeScript stack.

| Layer    | Tech                                                                 |
| -------- | -------------------------------------------------------------------- |
| Frontend | Next.js 16 (App Router), Tailwind CSS 4, shadcn/ui, TanStack Query   |
| Backend  | Express 5, Zod validation, sharp image optimisation                  |
| Database | PostgreSQL via Prisma 7                                              |
| Auth     | JWT access token (15 min) + rotating refresh token, httpOnly cookies, role-based access (USER / ORGANIZER / ADMIN) |

```
dream-craft-events-v2/
├── backend/    Express API  (http://localhost:5000)
└── frontend/   Next.js app  (http://localhost:3000)
```

## Live demo

**https://dream-craft-events-beta.vercel.app** — use the demo login buttons (password `Demo@1234`).

| Part     | Hosting                                                        |
| -------- | -------------------------------------------------------------- |
| Frontend | Vercel project `dream-craft-events` (root `frontend/`)         |
| API      | Vercel project `dream-craft-events-api` (root `backend/`), https://dream-craft-events-api.vercel.app |
| Database | Neon Postgres (Singapore), connected through the Vercel Marketplace |

Every push to `main` deploys both projects automatically. The browser only talks to the
frontend; `/api/*` and `/uploads/*` are proxied to the API, so auth cookies stay first-party.
The API runs as a single Vercel function (`backend/api/index.js`); uploaded images are stored
in Postgres because serverless functions have no persistent disk.

After changing the Prisma schema, apply migrations to production before pushing:

```bash
cd backend
npx vercel env pull .env.production.local --environment production   # gitignored
DATABASE_URL="<DATABASE_URL_UNPOOLED from that file>" npx prisma migrate deploy
```

## Quick start

Requirements: Node.js 20+, PostgreSQL 14+ running locally.

```bash
# 1. Install
npm run install:all

# 2. Configure
#    backend/.env        <- copy backend/.env.example, set DATABASE_URL + secrets
#    frontend/.env.local <- copy frontend/.env.example, JWT_ACCESS_SECRET must match the backend

# 3. Create the database schema and sample data
npm run db:setup

# 4. Run (two terminals)
npm run dev:backend
npm run dev:frontend
```

Open http://localhost:3000.

## Demo accounts

The login page has one-click demo buttons. All accounts use the password **Demo@1234**.

| Role      | Email                     | Can do                                                        |
| --------- | ------------------------- | ------------------------------------------------------------- |
| Admin     | admin@dreamcraft.dev      | Everything: users, products, orders, approvals, reviews, messages |
| Organizer | organizer@dreamcraft.dev  | Create/edit own events, see ticket sales + revenue            |
| User      | user@dreamcraft.dev       | Book tickets, shop, plan custom events, apply to be an organizer |

Disable demo login in production with `ENABLE_DEMO_LOGIN=false`.

## How auth works

1. Login sets two httpOnly cookies: `access_token` (JWT, 15 min) and `refresh_token` (opaque, 7 days, stored hashed in the DB).
2. The browser only talks to Next.js; `/api/*` and `/uploads/*` are rewritten to Express, so cookies are first-party.
3. `frontend/src/proxy.ts` verifies the JWT before rendering `/dashboard/**` and `/checkout/**` and redirects by role. Expired access tokens are refreshed transparently.
4. Express re-reads the user's role and active status from the database on every request, so role changes and deactivation apply immediately. Refresh tokens rotate on every use; reusing an old one revokes all sessions.

## Payments

All prices are in Bangladeshi Taka (৳). Amounts are stored as integer poisha (1 BDT = 100 poisha) in the `*Cents` columns, so there are no rounding errors.

Checkout uses a **demo gateway**: the payment page offers "Pay" and "Simulate a declined payment". Seat reservation and stock decrement are atomic, so overselling is impossible. To go live, replace the `POST /api/bookings/:id/pay` and `POST /api/orders/:id/pay` handlers with your gateway's (SSLCommerz, Stripe, bKash...) success callback; the reservation logic stays the same.

## Useful scripts

| Command                  | What it does                                  |
| ------------------------ | --------------------------------------------- |
| `npm run dev:backend`    | API with hot reload                           |
| `npm run dev:frontend`   | Next.js dev server                            |
| `npm run db:setup`       | Apply migrations + seed sample data           |
| `npm run db:reset`       | Drop, re-migrate and re-seed the database     |
| `npm test`               | 34 end-to-end API tests (needs a seeded DB)   |
| `npm run build`          | Production build of both apps                 |

See `backend/README.md` and `frontend/README.md` for details.
