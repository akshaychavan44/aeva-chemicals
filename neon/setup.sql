create table if not exists aeva_content (
  key text primary key check (key in ('whatwedo', 'home_products', 'page_aesop', 'page_aekomala', 'careers')),
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists aeva_images (
  id uuid primary key,
  mime text not null check (mime in ('image/jpeg', 'image/png', 'image/webp')),
  bytes bytea not null check (octet_length(bytes) between 1 and 3145728)
);

create table if not exists aeva_inquiries (
  id uuid primary key,
  received_at timestamptz not null default now(),
  details jsonb not null
);

-- One row, created on the first password change in the admin Settings. Holds an scrypt hash
-- that replaces CMS_ADMIN_PASSWORD for signing in. Delete the row to go back to the Vercel password.
create table if not exists aeva_admin_auth (
  id smallint primary key default 1 check (id = 1),
  password_hash text not null,
  updated_at timestamptz not null default now()
);
