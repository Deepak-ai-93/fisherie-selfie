# I Support Blue Economy — React + Supabase

A React (Vite) front-end replacing the old PHP version. Photos, consent logs,
visit tracking and admin auth all live in **Supabase**.

## Features

- **Booth** (`/`) — camera selfie filter with the Gujarat Fisheries frame,
  flip camera, capture, auto-upload to Supabase Storage, consent logging,
  share sheet (native share / copy caption / download), visit tracking.
- **Gallery** (`/gallery`) — password-protected (Supabase Auth) grid of all
  selfies with stats, search, pagination, lightbox and download.
- **Logs** (`/logs`) — password-protected consent log viewer with stats and search.

## Setup

### 1. Create a Supabase project
Go to https://supabase.com → New project.

### 2. Run the schema
Open **SQL Editor → New query**, paste the contents of
`supabase/schema.sql`, and run it. This creates:
- `public.visits` and `public.consents` tables
- Row Level Security (anon may insert, admins may read)
- a private `selfies` storage bucket + upload/read policies

### 3. Create admin users
**Authentication → Users → Add user** (email + password) for each team member.
These accounts unlock `/gallery` and `/logs`.

### 4. Configure the app
```bash
cd client
cp .env.example .env   # Windows: copy .env.example .env
```
Edit `.env` and paste your project URL + anon key from
**Project Settings → API**.

### 5. Run it
```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
```

## Notes

- The `selfies` bucket is **private**; the gallery generates short-lived
  signed URLs to display photos, so only logged-in admins can view them.
- Client-side JS cannot read the visitor's real IP (the old PHP server could).
  Device / browser / language / referrer are still captured; `ip` is left
  `null`. If you need real IPs, add a Supabase Edge Function to read
  `x-forwarded-for` and insert the visit server-side.