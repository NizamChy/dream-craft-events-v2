# Dream Craft Events API

Express 5 + TypeScript + Prisma 7 (PostgreSQL).

## Setup

```bash
npm install
cp .env.example .env          # set DATABASE_URL and two random JWT secrets
npm run db:migrate            # create tables (dev)  |  npm run db:deploy in production
npm run db:seed               # sample users, events, products, orders...
npm run dev                   # http://localhost:5000/api/health
```

## Scripts

| Script            | Description                                   |
| ----------------- | --------------------------------------------- |
| `dev`             | Hot-reload server (tsx watch)                 |
| `build` / `start` | Compile to `dist/` and run it                 |
| `typecheck`       | `tsc --noEmit`                                |
| `db:migrate`      | Create/apply a migration in development       |
| `db:deploy`       | Apply migrations in production                |
| `db:seed`         | Wipe and re-seed sample data                  |
| `db:reset`        | Drop everything, migrate and seed             |
| `test`            | Vitest + Supertest end-to-end tests           |

## Structure

```
src/
  config/env.ts           validated environment variables
  lib/                    prisma client, auth helpers (JWT, refresh tokens, cookies)
  middlewares/            authenticate / authorize(role), zod validate, error handler
  modules/<feature>/      one router per feature
  utils/http.ts           ApiError, pagination, slugs
prisma/
  schema.prisma           data model (money stored as integer poisha, 1 BDT = 100; columns are named *Cents)
  seed.ts                 demo data
uploads/                  optimised WebP uploads (seed images in uploads/seed)
```

## API overview (all under `/api`)

| Area               | Endpoints                                                                                     | Access |
| ------------------ | --------------------------------------------------------------------------------------------- | ------ |
| Auth               | `POST /auth/register`, `/login`, `/demo-login`, `/refresh`, `/logout`; `GET/PATCH /auth/me`; `PATCH /auth/password` | public / signed in |
| Events             | `GET /events`, `/events/categories`, `/events/:idOrSlug`; `GET /events/manage/list`; `POST/PATCH/DELETE /events/:id` | public / organizer, admin |
| Bookings           | `POST /bookings`, `/bookings/:id/pay`, `/bookings/:id/cancel`; `GET /bookings/me`, `/bookings/:id`; `GET /bookings` | signed in / organizer, admin |
| Products           | `GET /products`, `/products/:idOrSlug`; `POST/PATCH/DELETE /products/:id`                     | public / admin |
| Orders             | `POST /orders`, `/orders/:id/pay`, `/orders/:id/cancel`; `GET /orders/me`; `GET /orders`; `PATCH /orders/:id/status` | signed in / admin |
| Custom events      | `GET /custom-events/pricing`; `POST /custom-events`; `GET /custom-events/me`; admin list + decide | public / signed in / admin |
| Organizer requests | `POST /organizer-requests`; `GET /organizer-requests/me`; admin list + approve (promotes the user) | user / admin |
| Community          | `/reviews`, `/contact`, `/newsletter`, `/wishlist`                                            | mixed |
| Dashboard          | `GET /dashboard/admin`, `/dashboard/organizer`, `/dashboard/user`                             | by role |
| Uploads            | `POST /uploads` (multipart `image`, max 5 MB, converted to WebP)                               | signed in |

Errors always look like `{ "message": "...", "errors"?: { "field": "message" } }`.
