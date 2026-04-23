-- Waitlist table for Coming Soon feature interest
create table if not exists waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text,
  interest text,
  created_at timestamptz default now(),
  constraint unique_waitlist_email unique(email)
);

-- RLS: anon can only insert
alter table waitlist enable row level security;

create policy "anon_insert_waitlist"
  on waitlist for insert
  to anon
  with check (true);
