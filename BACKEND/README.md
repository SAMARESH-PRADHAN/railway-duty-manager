# OTA Manager — Backend (Neon serverless Postgres)

Node.js + Express + `@neondatabase/serverless` (raw SQL, no ORM) backend for the
Western Railway Overtime & Attendance (OTA) Manager frontend.

## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Copy `.env.example` to `.env` and set your Neon connection string:
   ```
   cp .env.example .env
   ```
   Get this from your Neon project dashboard → Connection Details.

3. Apply the database schema:
   ```
   npm run db:migrate
   ```
   This runs `sql/schema.sql` against your Neon database (tables, indexes,
   `updated_at` triggers). Safe to re-run — uses `CREATE TABLE IF NOT EXISTS`.

4. (Optional) Seed demo data — same seed as the frontend's old `seed.ts`:
   ```
   npm run dev
   # in another terminal:
   curl -X POST http://localhost:3000/api/seed/reset
   ```

5. Start the dev server:
   ```
   npm run dev
   ```

Server runs on `http://localhost:3000` by default. Health check: `GET /health`.

## Project structure

```
backend/
├─ .env.example
├─ .gitignore
├─ package.json
├─ README.md
├─ sql/
│  └─ schema.sql          -- run once via `npm run db:migrate`
├─ scripts/
│  └─ migrate.js          -- applies sql/schema.sql
└─ src/
   ├─ server.js
   ├─ lib/
   │  ├─ db.js            -- Neon `sql` tagged-template client
   │  ├─ mappers.js        -- snake_case DB rows -> camelCase JS objects
   │  ├─ ot-utils.js        -- OT calculation, ported from frontend
   │  ├─ seed.js            -- demo data builder
   │  └─ async-handler.js   -- wraps async route handlers for error forwarding
   ├─ controllers/
   │  ├─ employees.controller.js
   │  ├─ trains.controller.js
   │  ├─ duty-sheets.controller.js
   │  └─ seed.controller.js
   └─ routes/
      ├─ employees.routes.js
      ├─ trains.routes.js
      ├─ duty-sheets.routes.js
      └─ seed.routes.js
```

## API

Same endpoints as before — only the storage layer changed (raw SQL over Neon
instead of Prisma/ORM):

| Resource | Endpoints |
|---|---|
| Employees | `GET /api/employees`, `POST /api/employees`, `PATCH /api/employees/:id`, `PATCH /api/employees/:id/toggle-status`, `PATCH /api/employees/:id/soft-delete`, `PATCH /api/employees/:id/restore` |
| Trains | `GET /api/trains`, `POST /api/trains`, `PATCH /api/trains/:id`, `PATCH /api/trains/:id/toggle-status`, `PATCH /api/trains/:id/soft-delete`, `PATCH /api/trains/:id/restore` |
| Duty Sheets | `GET /api/duty-sheets`, `GET /api/duty-sheets/:id`, `POST /api/duty-sheets` (upsert — pass `id` to update), `DELETE /api/duty-sheets/:id` |
| Seed | `POST /api/seed/reset` (wipes and reseeds demo data) |

Pass `?includeDeleted=true` to `GET /api/employees` or `GET /api/trains` to include archived records.

## Business logic notes

- **OT calculation is always done server-side** in `src/lib/ot-utils.js`, ported 1:1 from
  the frontend's `ot-utils.ts`. `POST /api/duty-sheets` recalculates `totalActualHours`,
  `totalRosteredHours`, `deductionHours`, and `otPayable` from the raw `days` array —
  it never trusts client-submitted totals.
- **Overlap guard**: saving a non-draft duty sheet checks for overlapping periods for
  the same employee and returns `409` if found.
- **Soft delete**: `is_deleted` flags records instead of removing them.
- **`duty_sheets.days`** is a single `JSONB` column, since the frontend always
  reads/writes it as one 14-element array with nested time-slot arrays.
- **Row mapping**: DB columns are `snake_case` (SQL convention); `src/lib/mappers.js`
  converts every row to the `camelCase` shape the frontend's `lib/types.ts` expects,
  so the frontend never has to change.

## Next steps for the frontend

Replace `src/lib/storage.ts` + the `useEffect`/`localStorage` logic in `DataContext.tsx`
with `fetch` calls to these endpoints (e.g. via `@tanstack/react-query`, already in
`package.json`). Happy to wire that up next.
