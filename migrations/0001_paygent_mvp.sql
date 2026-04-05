-- Paygent MVP baseline schema

create table if not exists businesses (
  id text primary key,
  name text not null,
  business_type text not null,
  owner_phone text not null,
  status text not null default 'active',
  pilot_stage text not null default 'safe_launch',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists subaccounts (
  id text primary key,
  business_id text not null references businesses(id),
  zendfi_subaccount_id text not null unique,
  wallet_address text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists suppliers (
  id text primary key,
  business_id text not null references businesses(id),
  supplier_name text not null,
  bank_id text not null,
  account_number text not null,
  account_name text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, bank_id, account_number)
);

create table if not exists policy_versions (
  id text primary key,
  business_id text not null references businesses(id),
  status text not null,
  max_per_tx_ngn numeric(18,2) not null,
  daily_cap_ngn numeric(18,2) not null,
  approval_threshold_ngn numeric(18,2) not null,
  active_days_utc int[] not null,
  active_start_time_utc text not null,
  active_end_time_utc text not null,
  created_at timestamptz not null default now(),
  activated_at timestamptz
);

create unique index if not exists policy_versions_one_active_idx
  on policy_versions (business_id)
  where status = 'active';

create table if not exists spending_counters_daily (
  business_id text not null references businesses(id),
  usage_date date not null,
  spent_ngn numeric(18,2) not null default 0,
  updated_at timestamptz not null default now(),
  primary key (business_id, usage_date)
);

create table if not exists payout_intents (
  id text primary key,
  business_id text not null references businesses(id),
  supplier_id text not null references suppliers(id),
  source text not null,
  amount_ngn numeric(18,2) not null,
  reason text,
  idempotency_key text not null,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, idempotency_key)
);

create table if not exists payout_executions (
  id text primary key,
  intent_id text not null references payout_intents(id),
  zendfi_order_id text,
  status text not null,
  failure_code text,
  failure_reason text,
  fee_ngn numeric(18,2),
  fx_rate numeric(18,6),
  latency_ms int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists webhook_events (
  id text primary key,
  provider text not null,
  provider_event_id text not null,
  payload_hash text not null,
  payload jsonb not null,
  status text not null default 'received',
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, provider_event_id, payload_hash)
);

create table if not exists notifications (
  id text primary key,
  business_id text not null references businesses(id),
  channel text not null,
  status text not null,
  message text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table if not exists freeze_events (
  id text primary key,
  business_id text not null references businesses(id),
  action text not null,
  reason text,
  actor text,
  created_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id text primary key,
  business_id text,
  actor text not null,
  action text not null,
  result text not null,
  reason_codes text[] not null default '{}',
  metadata jsonb,
  created_at timestamptz not null default now()
);
