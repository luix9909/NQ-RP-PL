# إعداد Supabase لنظام NQ PL RP MDT

## 1. إنشاء المشروع

1. اذهب إلى [supabase.com](https://supabase.com) وأنشئ مشروعاً جديداً
2. من **Settings → API** انسخ:
   - **Project URL** → `SUPABASE_URL` و `VITE_SUPABASE_URL`
   - **anon/public key** → `VITE_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_KEY` (سري، للباكند فقط)

## 2. إنشاء الجداول (SQL كامل)

افتح **SQL Editor** في Supabase Dashboard والصق هذا الكود كاملاً:

```sql
-- ── جدول المستخدمين
create table if not exists mdt_users (
  id uuid primary key default gen_random_uuid(),
  roblox_user_id text unique not null,
  user_name text not null,
  rank text not null default 'Guest',
  rank_id integer not null default 0,
  is_police boolean not null default false,
  avatar_url text not null default '',
  updated_at timestamptz not null default now()
);

-- ── جلسات اللعبة (تُحدَّث من سكريبت Lua)
create table if not exists mdt_sessions (
  id uuid primary key default gen_random_uuid(),
  roblox_user_id text unique not null,
  job_id text not null,
  team text not null,
  updated_at timestamptz not null default now()
);

-- ── رسائل الشات
create table if not exists mdt_chat (
  id uuid primary key default gen_random_uuid(),
  server_id text not null,
  frequency integer not null default 1,
  roblox_user_id text not null,
  user_name text not null,
  rank text not null,
  team text not null default '',
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists mdt_chat_server_freq
  on mdt_chat (server_id, frequency, created_at desc);

-- ── البلاغات (911 + قبول/رفض الشرطة)
create table if not exists mdt_dispatches (
  id uuid primary key default gen_random_uuid(),
  server_id text not null,
  caller text not null,
  type text not null,
  location text not null,
  description text not null default '',
  priority text not null default 'HIGH',

  -- نظام القبول / الرفض
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected')),
  accepted_by text,           -- roblox user id للشرطي اللي قبل
  accepted_by_name text,      -- اسمه للعرض في الموقع

  created_at timestamptz not null default now()
);
create index if not exists mdt_dispatches_server
  on mdt_dispatches (server_id, created_at desc);

-- ── تفعيل Realtime
alter publication supabase_realtime add table mdt_chat;
alter publication supabase_realtime add table mdt_dispatches;
```

## 3. إلغاء RLS (Row Level Security)

```sql
alter table mdt_users     disable row level security;
alter table mdt_sessions  disable row level security;
alter table mdt_chat      disable row level security;
alter table mdt_dispatches disable row level security;
```

## 4. متغيرات البيئة

```env
# Frontend (يجب أن يبدأ بـ VITE_)
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Backend API Server
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Roblox OAuth
ROBLOX_CLIENT_ID=1234567890
ROBLOX_CLIENT_SECRET=RBX-xxxxxxxxxxxxx
ROBLOX_GROUP_ID=12345678
ROBLOX_REDIRECT_URI=https://YOUR_RENDER_APP.onrender.com/api/auth/callback
ALLOWED_RANKS=250,251,252,253,254,255

# أمان
SESSION_SECRET=long-random-string-here
GAME_API_KEY=your-secret-key-same-in-lua-scripts

# تسجيل دخول تلقائي بالـ IP (اختياري — للمالك فقط)
OWNER_IP=1.2.3.4          # عنوان IP الخاص بك (تقدر تعرفه من whatismyip.com)
OWNER_ROBLOX_ID=123456789 # رقم حساب Roblox الخاص بك
OWNER_USERNAME=YourName    # اسمك (اختياري — يُجلب تلقائياً إن تُرك فارغاً)
```

## 5. إعداد Roblox OAuth

1. اذهب إلى [create.roblox.com](https://create.roblox.com)
2. **Open Cloud → OAuth Apps → Create App**
3. Redirect URI: `https://YOUR_RENDER_APP.onrender.com/api/auth/callback`
4. Scopes: `openid`, `profile`
5. انسخ Client ID و Client Secret

## 6. الملفات المُرفقة

| ملف | الغرض |
|-----|-------|
| `roblox-lua-updated.lua` | سكريبت الخادم — يزامن JobId وTeam كل 30 ثانية |
| `roblox-report-ui.lua` | LocalScript — واجهة بلاغات المواطنين داخل اللعبة |

### مكان السكريبتات في Roblox Studio
- `roblox-lua-updated.lua` ← **ServerScriptService** (Script عادي)
- `roblox-report-ui.lua` ← **StarterPlayerScripts** (LocalScript)
