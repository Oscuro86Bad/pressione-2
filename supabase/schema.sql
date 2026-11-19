-- ============================================================
--  PRESSIONE 2.0 — schema Supabase
--  Esegui tutto questo file in: Supabase Dashboard → SQL Editor → Run
--
--  Crea:
--   • bp_settings : profilo, target e soglie (una riga per utente)
--   • bp_readings : misurazioni (una riga per lettura, soft delete)
--
--  Sicurezza: Row Level Security attiva su entrambe le tabelle.
--  Ogni utente autenticato vede e modifica SOLO le proprie righe.
--  La chiave "anon" può stare nel frontend: senza login non vede nulla.
-- ============================================================

begin;

-- ---------- profilo e impostazioni ----------
create table if not exists public.bp_settings (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  name        text not null default '',
  target_sys  integer not null default 135 check (target_sys between 80 and 250),
  target_dia  integer not null default 85 check (target_dia between 40 and 150),
  limits      jsonb not null default '{"sysLow":90,"diaLow":60,"pulseLow":50,"pulseHigh":100}'::jsonb,
  updated_at  timestamptz not null default now(),
  constraint bp_settings_target_order check (target_sys > target_dia)
);

-- ---------- misurazioni ----------
create table if not exists public.bp_readings (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  local_at    text not null,
  measured_at timestamptz not null default now(),
  tz_offset   integer,
  sys         integer not null check (sys between 40 and 300),
  dia         integer not null check (dia between 20 and 200),
  pulse       integer check (pulse is null or pulse between 20 and 250),
  irregular   boolean not null default false,
  arm         text check (arm is null or arm in ('sx', 'dx')),
  posture     text check (posture is null or posture in ('seduto', 'sdraiato', 'in piedi')),
  note        text not null default '',
  source      text not null default 'manual' check (source in ('manual', 'photo', 'import')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted     boolean not null default false,
  constraint bp_readings_pressure_order check (sys > dia)
);

-- Indici per le query dell'app (storico per data, sync incrementale).
create index if not exists bp_readings_user_local_idx
  on public.bp_readings (user_id, local_at desc);

create index if not exists bp_readings_user_updated_idx
  on public.bp_readings (user_id, updated_at desc);

-- ---------- Row Level Security ----------
alter table public.bp_settings enable row level security;
alter table public.bp_readings enable row level security;

drop policy if exists "bp_settings_select_own" on public.bp_settings;
create policy "bp_settings_select_own"
  on public.bp_settings for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "bp_settings_insert_own" on public.bp_settings;
create policy "bp_settings_insert_own"
  on public.bp_settings for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "bp_settings_update_own" on public.bp_settings;
create policy "bp_settings_update_own"
  on public.bp_settings for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "bp_settings_delete_own" on public.bp_settings;
create policy "bp_settings_delete_own"
  on public.bp_settings for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "bp_readings_select_own" on public.bp_readings;
create policy "bp_readings_select_own"
  on public.bp_readings for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "bp_readings_insert_own" on public.bp_readings;
create policy "bp_readings_insert_own"
  on public.bp_readings for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "bp_readings_update_own" on public.bp_readings;
create policy "bp_readings_update_own"
  on public.bp_readings for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "bp_readings_delete_own" on public.bp_readings;
create policy "bp_readings_delete_own"
  on public.bp_readings for delete
  to authenticated
  using (auth.uid() = user_id);

-- ---------- permessi per il ruolo autenticato ----------
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.bp_settings to authenticated;
grant select, insert, update, delete on public.bp_readings to authenticated;

-- Il ruolo anon non deve poter leggere né scrivere dati sanitari.
revoke all on public.bp_settings from anon;
revoke all on public.bp_readings from anon;

commit;

-- Forza PostgREST a ricaricare lo schema appena creato.
notify pgrst, 'reload schema';
