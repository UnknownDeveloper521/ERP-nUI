# ERP-v1

Internal ERP system with a Vite + React + TypeScript frontend, an Express + TypeScript backend, Supabase Auth + Postgres for persistence, and a Socket.IO powered **Internal Chat** module.

## Tech Stack

- Client: Vite, React, TypeScript, Tailwind
- Server: Node.js, Express, TypeScript
- Realtime: Socket.IO (no Supabase Realtime)
- Auth/DB: Supabase Auth + Supabase Postgres

## Prerequisites

- Node.js **18+** (LTS recommended)
- A Supabase project (URL + anon key + Postgres connection string)

## 1) Clone

```bash
git clone <your-repo-url>
cd ERP-v1
```

## 2) Environment variables

This repo uses **two** env files:

### Server env (`./.env`)

Create `./.env` (not committed):

```env
# Server
PORT=5000
DATABASE_URL=postgresql://<user>:<password>:<host>:<port>/<db>?sslmode=require
```

Notes:
- If your DB password contains special characters (e.g. `@`), URL-encode it.

### Client env (`./client/.env`)

Create `./client/.env` (not committed):

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

## 3) Install dependencies

From repo root:

```bash
npm ci
```

(Use `npm install` if you do not have a lockfile, but this repo includes `package-lock.json` so `npm ci` is preferred.)

## 4) Run in development

```bash
npm run dev
```

Open:

- http://127.0.0.1:5000

This starts:
- Express server
- Vite dev middleware
- Socket.IO server (`/socket.io`)

## 5) Typecheck

```bash
npm run check
```

## 6) Build + run (production-style)

```bash
npm run build
npm run start
```

## Supabase setup

### SQL schema

In Supabase Dashboard -> **SQL Editor**, run:

1. `supabase-chat-schema.sql`
2. `supabase-chat-profiles-backfill.sql`

### What these scripts do

- `supabase-chat-schema.sql`
  - Creates chat tables + indexes + RLS (rooms/members/messages/reads)
- `supabase-chat-profiles-backfill.sql`
  - Backfills `public.users_profile` from existing `auth.users`
  - Adds a trigger to auto-create a `users_profile` row on future signups

## Internal Chat module

- Route: `/chat`
- Uses Socket.IO for realtime events (send/receive messages, presence)
- Uses Supabase Postgres for persistence

## Troubleshooting

### Blank page or auth errors

- Ensure `client/.env` has `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`

### Server fails to start

- Ensure root `/.env` has `DATABASE_URL`

### Windows notes

This project includes Windows-safe scripts (via `cross-env`) and server listen configuration compatible with Windows.

## Security notes

- Never commit `.env` files.
- If you later add “Create Employee -> Create Supabase Auth user”, that must be done server-side using a Supabase **Service Role** key (never expose it to the browser).