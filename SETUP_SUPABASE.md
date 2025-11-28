# Supabase Migration Setup

This project now uses Supabase for authentication, database persistence, and file storage.

## 1. Create Supabase Project
1. Go to https://supabase.com and create a new project.
2. Note your Project URL and the anon + service role keys from Project Settings > API.
3. In the dashboard, go to Storage and create a bucket named `product-images` (set it to public for simpler direct access or keep private and serve via signed URLs).

## 2. Environment Variables (add to `.env.local` or server env)
```
SUPABASE_URL=https://YOURPROJECT.supabase.co
SUPABASE_ANON_KEY=public-anon-key
SUPABASE_SERVICE_ROLE_KEY=service-role-key (DO NOT expose to client)
```

Remove old `JWT_SECRET` usage (now replaced by Supabase) once frontend migration is complete.

## 3. Database Schema SQL (Run in Supabase SQL editor)
```sql
-- Users table (mirrors existing MySQL structure, with auth user_id linkage)
create table public.users (
  id bigserial primary key,
  auth_user_id uuid unique, -- references auth.users.id
  name text not null,
  email text unique not null,
  password text, -- optional if still keeping legacy hashing (can be dropped later)
  phone text,
  address text,
  city text,
  avatar text,
  is_seller boolean default false,
  rating numeric default 5,
  total_reviews integer default 0,
  created_at timestamptz default now()
);

-- Categories
create table public.categories (
  id bigserial primary key,
  name text not null,
  icon text,
  created_at timestamptz default now()
);

-- Products
create table public.products (
  id bigserial primary key,
  user_id bigint references public.users(id) on delete cascade,
  category_id bigint references public.categories(id) on delete set null,
  name text not null,
  description text,
  price integer not null,
  condition text check (condition in ('like_new','good','fair','poor')),
  images text, -- comma separated paths in storage bucket
  location text,
  stock integer default 0,
  is_sold boolean default false,
  view_count integer default 0,
  created_at timestamptz default now()
);

-- Cart
create table public.cart (
  id bigserial primary key,
  user_id bigint references public.users(id) on delete cascade,
  product_id bigint references public.products(id) on delete cascade,
  quantity integer default 1,
  added_at timestamptz default now()
);

-- Orders
create table public.orders (
  id bigserial primary key,
  buyer_id bigint references public.users(id) on delete cascade,
  seller_id bigint references public.users(id) on delete cascade,
  product_id bigint references public.products(id) on delete cascade,
  quantity integer not null,
  total_price integer not null,
  payment_method text,
  shipping_address text,
  notes text,
  status text default 'pending' check (status in ('pending','confirmed','shipped','delivered','cancelled')),
  created_at timestamptz default now()
);

-- Reviews
create table public.reviews (
  id bigserial primary key,
  order_id bigint references public.orders(id) on delete cascade,
  buyer_id bigint references public.users(id) on delete cascade,
  seller_id bigint references public.users(id) on delete cascade,
  rating integer check (rating between 1 and 5),
  comment text,
  created_at timestamptz default now()
);

-- Basic indexes
create index on public.products(user_id);
create index on public.products(category_id);
create index on public.orders(buyer_id);
create index on public.orders(seller_id);
create index on public.orders(product_id);
create index on public.cart(user_id);

-- Optional: update ratings trigger (example placeholder)
-- You can implement a Postgres function to recalc seller rating after insert on reviews.
```

## 4. Storage Usage
Upload images using Supabase Storage JS client:
```js
const { data, error } = await supabase.storage.from('product-images').upload(`products/${Date.now()}-${file.name}`, file, {
  cacheControl: '3600',
  upsert: false
})
```
Then public URL:
```js
const publicUrl = supabase.storage.from('product-images').getPublicUrl(data.path).data.publicUrl
```

Persist `publicUrl` or just `data.path` (and reconstruct later) in `products.images` comma-separated.

## 5. Backend Migration Status
All major backend routes have been migrated to Supabase.

Summary:
- Auth: Register creates auth user + profile row; Login uses Supabase password sign-in and returns access & refresh tokens.
- Middleware: Validates access token and hydrates `req.user` with profile data.
- Routes: Products, Orders, Cart, Users, Categories now use Supabase queries/joins; stock and rating logic preserved.
- Upload: Uses Supabase Storage (`product-images` bucket) accepting base64 JSON payload.
- MySQL: Legacy pool no longer required; safe to remove `db/mysql.js` and multer-based upload after cleanup.

## 6. Security Notes
- Never expose SERVICE_ROLE_KEY to client; keep it server-only.
- Consider Row Level Security (RLS) in Supabase and policies instead of manual ownership checks once tables finalized.
- Enable RLS and create policies mirroring `user_id = auth.uid()` where appropriate after linking `auth_user_id`.

## 7. Next Steps
- Remove `uploads/` directory and multer middleware.
- Delete `db/mysql.js` and purge remaining imports.
- Frontend: Replace custom token storage with Supabase client session (`supabase.auth.onAuthStateChange`).
- Refactor upload flow to direct client-side Storage usage (avoid base64 route for performance).
- Add Row Level Security (RLS) and policies; then drop service role usage for non-admin operations.
- Create Postgres function + trigger for rating auto-recalculation (optional) and view count increment.

---
Keep this document updated as tables evolve.