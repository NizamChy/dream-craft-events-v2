# Dream Craft Events web app

Next.js 16 (App Router) + Tailwind CSS 4 + shadcn/ui.

## Setup

```bash
npm install
cp .env.example .env.local    # JWT_ACCESS_SECRET must equal the backend's value
npm run dev                   # http://localhost:3000 (backend must run on :5000)
```

`npm run build && npm start` for production. Set `BACKEND_URL` if the API is not on localhost:5000.

## Structure

```
src/
  app/(site)/        public pages: home, events, event detail, shop, cart, checkout, plan-your-event, about, contact
  app/(auth)/        login (with demo buttons), register
  app/dashboard/     role-based dashboard: my/*, manage/* (organizer), admin/*
  proxy.ts           route guard: verifies the JWT cookie and enforces roles (see lib/access.ts)
  components/        ui/ (shadcn), shared/, layout/, events/, dashboard/, ...
  lib/api.ts         fetch wrapper with automatic token refresh
  lib/server-api.ts  server-side fetch for server components
  stores/cart.ts     persisted cart (zustand)
```

The browser never calls Express directly: `next.config.ts` rewrites `/api/*` and `/uploads/*` to the backend, so auth cookies stay first-party and httpOnly.
