-- Paygent extended parity schema for Week 6-8 operational entities

create table if not exists pilot_modes (
  business_id text primary key references businesses(id),
  mode text not null,
  max_auto_executions int not null,
  auto_executed_count int not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists ai_commands (
  id text primary key,
  business_id text not null references businesses(id),
  command text not null,
  parsed_supplier_id text,
  parsed_amount_ngn numeric(18,2),
  action text not null,
  confidence numeric(5,4) not null,
  explanation text not null,
  created_at timestamptz not null default now()
);

create table if not exists activity_events (
  id text primary key,
  business_id text not null references businesses(id),
  type text not null,
  message text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists activity_events_business_created_idx
  on activity_events (business_id, created_at desc);

create table if not exists retry_jobs (
  id text primary key,
  intent_id text not null references payout_intents(id),
  business_id text not null references businesses(id),
  attempt int not null,
  max_attempts int not null,
  status text not null,
  last_error text,
  next_run_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists retry_jobs_due_idx
  on retry_jobs (status, next_run_at);

create table if not exists owner_notifications (
  id text primary key,
  business_id text not null references businesses(id),
  intent_id text not null references payout_intents(id),
  event_type text not null,
  channel text not null,
  status text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create table if not exists webhook_inbox (
  id text primary key,
  provider text not null,
  event_id text not null,
  event_type text not null,
  signature text not null,
  status text not null,
  business_id text,
  intent_id text,
  execution_id text,
  received_at timestamptz not null,
  processed_at timestamptz not null,
  payload jsonb not null,
  unique (provider, event_id)
);

create table if not exists alerts (
  id text primary key,
  severity text not null,
  source text not null,
  message text not null,
  status text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists credential_rotations (
  id text primary key,
  credential_type text not null,
  status text not null,
  requested_by text not null,
  reason text not null,
  requested_at timestamptz not null,
  completed_at timestamptz,
  next_due_at timestamptz,
  notes text
);
