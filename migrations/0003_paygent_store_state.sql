-- Storage-adapter backing table for Postgres mode

create table if not exists paygent_store_state (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);
