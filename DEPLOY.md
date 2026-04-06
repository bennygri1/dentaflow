# DentaFlow — Deployment Guide

## Prerequisites

- GitHub repo with this code pushed to `main`
- Supabase project created (free tier is fine)
- Vercel account
- Anthropic API key — only required for the AI chat widget (`/api/chat`). The lead capture flow (`/api/leads`) works without it.

---

## Step 1 — Supabase: create tables

In **Supabase → SQL Editor**, run:

```sql
-- Profiles table (one row per clinic owner / agency account)
create table if not exists profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  role           text not null default 'owner', -- 'owner' or 'agency'
  clinic_name    text,
  doctor_name    text,
  avatar_initials text,
  email          text
);

-- Leads table (one row per inbound lead)
create table if not exists leads (
  id         uuid primary key default gen_random_uuid(),
  clinic_id  uuid not null references profiles(id) on delete cascade,
  name       text not null,
  service    text,
  phone      text,
  status     text not null default 'new',
  created_at timestamptz not null default now()
);
```

---

## Step 2 — Supabase: enable RLS and add policies

The app uses the **anon key** for all API calls. RLS must be enabled and the
following policies must exist, or every request will fail.

In **Supabase → SQL Editor**, run:

```sql
-- Enable RLS on both tables
alter table profiles enable row level security;
alter table leads    enable row level security;

-- profiles: anon can look up a clinic by ID (used by /api/leads and /api/chat
--           to verify that a clinic_id exists before inserting a lead)
create policy "anon can read profiles"
  on profiles for select
  to anon
  using (true);

-- profiles: authenticated users can read and update their own row
create policy "owner can read own profile"
  on profiles for select
  to authenticated
  using (id = auth.uid());

create policy "owner can update own profile"
  on profiles for update
  to authenticated
  using (id = auth.uid());

-- leads: anon can insert (widget submissions from clinic websites)
create policy "anon can insert leads"
  on leads for insert
  to anon
  with check (true);

-- leads: authenticated users can read their own clinic's leads
create policy "owner can read own leads"
  on leads for select
  to authenticated
  using (clinic_id = auth.uid());
```

> **Note:** The `anon can read profiles` policy is intentionally permissive —
> it only exposes the profile `id`, which is a UUID with no PII. If you want
> to restrict it further, change `using (true)` to `using (id = $1)` and pass
> the clinic_id explicitly, but this requires a service-role key on the server.

---

## Step 3 — Supabase: create a test owner account

1. **Supabase → Authentication → Users → Invite user** (or use the sign-up flow in the app)
2. After the user is created, insert a profile row:

```sql
insert into profiles (id, role, clinic_name, doctor_name, avatar_initials, email)
values (
  '<paste-the-user-uuid-here>',
  'owner',
  'My Dental Clinic',
  'Dr. Smith',
  'DS',
  'owner@myclinic.com'
);
```

Keep the UUID — you will need it for the widget snippet in Step 7.

---

## Step 4 — Deploy to Vercel

1. Go to [vercel.com/new](https://vercel.com/new) → **Import Git Repository**
2. Select your repo. Framework preset: **Next.js** (auto-detected)
3. Leave build and output settings as defaults
4. **Before clicking Deploy**, add the environment variables below

---

## Step 5 — Set environment variables in Vercel

**Project Settings → Environment Variables.** Apply every variable to
**Production**, **Preview**, and **Development**.

| Variable | Value | Where to find it |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxx.supabase.co` | Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_...` | Supabase → Project Settings → API → anon / public |
| `NEXT_PUBLIC_APP_URL` | `https://your-app.vercel.app` | Your Vercel deployment URL (set after first deploy) |
| `ANTHROPIC_API_KEY` | `sk-ant-...` | [console.anthropic.com](https://console.anthropic.com) → API Keys — **required for AI chat only** |

> ⚠️ `ANTHROPIC_API_KEY` is **server-only** — never prefix it with `NEXT_PUBLIC_`.
> The `/api/leads` endpoint works without it. Only `/api/chat` needs it.

> ⚠️ Use the **anon / public** key, not the service-role key. The anon key is
> safe to expose; Supabase RLS is the security boundary.

After setting `NEXT_PUBLIC_APP_URL`, trigger a **Redeploy** so the Chatbot tab
snippet picks up the real domain.

---

## Step 6 — Verify `/api/leads`

Run this from any terminal after deploy:

```bash
curl -s -X POST https://YOUR-APP.vercel.app/api/leads \
  -H "Content-Type: application/json" \
  -d '{
    "clinic_id": "OWNER-UUID-FROM-STEP-3",
    "name": "Test Patient",
    "service": "General check-up",
    "phone": "+44 7700 900000"
  }'
```

Expected response (`201`):
```json
{ "success": true, "id": "..." }
```

Common failure responses and causes:

| Response | Cause |
|---|---|
| `404 clinic_id not found` | Profile row missing or wrong UUID |
| `500` with Supabase error | RLS policy missing — re-run Step 2 SQL |
| `500 Missing Supabase env vars` | Env vars not set or redeploy not triggered |

---

## Step 7 — Embed the widget on a clinic website

Log in as the clinic owner → **Chatbot** tab. The embed snippet is pre-filled
with the real domain and the clinic's UUID. Copy and paste it before `</body>`:

```html
<script
  src="https://YOUR-APP.vercel.app/widget.js"
  data-clinic-id="OWNER-UUID"
  data-api-url="https://YOUR-APP.vercel.app"
  data-clinic-name="My Dental Clinic"
  data-color="#2563eb">
</script>
```

**`data-api-url` must be the base domain** — no path, no trailing slash.
The widget constructs `/api/chat` from it automatically.

For WordPress, Webflow, or any CMS that injects scripts dynamically, use the
`window.DentaFlowConfig` form instead:

```html
<script>
  window.DentaFlowConfig = {
    clinicId:   'OWNER-UUID',
    apiUrl:     'https://YOUR-APP.vercel.app',
    clinicName: 'My Dental Clinic',
    color:      '#2563eb'
  };
</script>
<script src="https://YOUR-APP.vercel.app/widget.js"></script>
```

---

## Step 8 — Verify lead appears in the dashboards

1. Open a page with the widget embedded
2. Chat with the bot until it confirms your details are saved
   *(or use the curl command from Step 6 to insert a lead directly)*
3. Log in as the **clinic owner** → **Leads** tab → lead should appear at the top
4. Log in as the **agency account** → **Clients** → click the clinic → leads shown in detail view

---

## Known production limitations

| Item | Detail |
|---|---|
| Rate limiter | In-memory per serverless instance. Resets on cold start. Sufficient for MVP; replace with Redis at scale. |
| Supabase anon key | Visible in the browser — this is expected. RLS policies are the security boundary. |
| `/api/chat` without `ANTHROPIC_API_KEY` | Returns `500`. The widget shows a graceful error. `/api/leads` is unaffected. |
| `widget.js` cache | Vercel serves `public/` with `Cache-Control: public, max-age=0, must-revalidate`. Always fresh. |
