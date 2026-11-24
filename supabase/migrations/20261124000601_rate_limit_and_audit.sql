-- ============================================================================
-- Migration: Rate Limit Global (50 req), Parâmetros de Bloqueio e Auditoria
-- ============================================================================

-- 1. Parâmetros Globais de Rate Limit (Singleton id = 1, gerenciado por ADMIN)
create table if not exists public.rate_limit_config (
  id integer primary key default 1 check (id = 1),
  enabled boolean not null default true,
  bypass_admin boolean not null default true,
  max_requests integer not null default 50 check (max_requests >= 1 and max_requests <= 10000),
  window_seconds integer not null default 60 check (window_seconds >= 10 and window_seconds <= 86400),
  block_duration_minutes integer not null default 15 check (block_duration_minutes >= 1 and block_duration_minutes <= 10080),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.rate_limit_config (
  id, enabled, bypass_admin, max_requests, window_seconds, block_duration_minutes
)
values (1, true, true, 50, 60, 15)
on conflict (id) do nothing;

create trigger trg_rate_limit_config_updated_at
  before update on public.rate_limit_config
  for each row execute function private.set_updated_at();

-- 2. Estado Ativo de Contadores e Bloqueios por Identificador (Usuário ou IP)
create table if not exists public.rate_limit_state (
  identifier text primary key,
  user_id uuid references auth.users(id) on delete set null,
  user_email text,
  ip_address text,
  request_count integer not null default 0,
  window_started_at timestamptz not null default now(),
  blocked_until timestamptz,
  total_blocks integer not null default 0,
  last_route text,
  last_request_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_rate_limit_state_blocked_until
  on public.rate_limit_state(blocked_until)
  where blocked_until is not null;

create index if not exists idx_rate_limit_state_user_id
  on public.rate_limit_state(user_id);

create trigger trg_rate_limit_state_updated_at
  before update on public.rate_limit_state
  for each row execute function private.set_updated_at();

-- 3. Auditoria de Eventos de Rate Limit (Bloqueios, Tentativas, Desbloqueios e Config)
create table if not exists public.rate_limit_audit (
  id uuid primary key default gen_random_uuid(),
  identifier text not null,
  user_id uuid references auth.users(id) on delete set null,
  user_email text,
  ip_address text,
  route text not null,
  method text not null default 'GET',
  event_type text not null check (
    event_type in (
      'BLOCKED',
      'REJECTED_WHILE_BLOCKED',
      'UNBLOCKED_ADMIN',
      'CONFIG_UPDATED'
    )
  ),
  request_count integer not null default 0,
  limit_threshold integer not null default 50,
  blocked_until timestamptz,
  details text,
  actor_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_rate_limit_audit_created_at
  on public.rate_limit_audit(created_at desc);

create index if not exists idx_rate_limit_audit_identifier
  on public.rate_limit_audit(identifier);

create index if not exists idx_rate_limit_audit_event_type
  on public.rate_limit_audit(event_type);

-- 4. Row Level Security (Apenas ADMIN tem acesso a Parâmetros, Bloqueados e Auditoria)
alter table public.rate_limit_config enable row level security;
alter table public.rate_limit_state enable row level security;
alter table public.rate_limit_audit enable row level security;

create policy "rate_limit_config_select_admin"
  on public.rate_limit_config for select
  to authenticated
  using ((select private.is_admin()));

create policy "rate_limit_config_update_admin"
  on public.rate_limit_config for update
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy "rate_limit_state_select_admin"
  on public.rate_limit_state for select
  to authenticated
  using ((select private.is_admin()));

create policy "rate_limit_state_update_admin"
  on public.rate_limit_state for update
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy "rate_limit_state_delete_admin"
  on public.rate_limit_state for delete
  to authenticated
  using ((select private.is_admin()));

create policy "rate_limit_audit_select_admin"
  on public.rate_limit_audit for select
  to authenticated
  using ((select private.is_admin()));

create policy "rate_limit_audit_insert_admin"
  on public.rate_limit_audit for insert
  to authenticated
  with check ((select private.is_admin()));

grant select, update on public.rate_limit_config to authenticated;
grant select, update, delete on public.rate_limit_state to authenticated;
grant select, insert on public.rate_limit_audit to authenticated;

-- 5. Função Atômica de Verificação e Consumo de Rate Limit
--    Executada exclusivamente via service_role pelo Middleware / Server Actions
create or replace function public.consume_rate_limit(
  p_identifier text,
  p_user_id uuid default null,
  p_user_email text default null,
  p_ip_address text default null,
  p_route text default '/',
  p_method text default 'GET'
)
returns table (
  allowed boolean,
  remaining integer,
  limit_max integer,
  window_seconds integer,
  blocked_until timestamptz,
  request_count integer,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_cfg record;
  v_state record;
  v_is_admin boolean := false;
  v_new_count integer;
  v_new_blocked_until timestamptz;
  v_retry_secs integer;
begin
  select *
    into v_cfg
    from public.rate_limit_config
   where id = 1;

  if not found then
    return query select true, 50, 50, 60, null::timestamptz, 0, 0;
    return;
  end if;

  if not v_cfg.enabled then
    return query select true, v_cfg.max_requests, v_cfg.max_requests, v_cfg.window_seconds, null::timestamptz, 0, 0;
    return;
  end if;

  -- Verifica se usuário autenticado é ADMIN e se bypass_admin está ativo
  if v_cfg.bypass_admin and p_user_id is not null then
    select exists (
      select 1
        from public.profiles p
       where p.id = p_user_id
         and 'ADMIN' = any(p.roles)
    )
    into v_is_admin;

    if v_is_admin then
      return query select true, v_cfg.max_requests, v_cfg.max_requests, v_cfg.window_seconds, null::timestamptz, 0, 0;
      return;
    end if;
  end if;

  -- Garante existência do registro e trava a linha para incremento atômico
  insert into public.rate_limit_state (
    identifier, user_id, user_email, ip_address,
    request_count, window_started_at, blocked_until, last_route, last_request_at
  )
  values (
    p_identifier, p_user_id, p_user_email, p_ip_address,
    0, v_now, null, p_route, v_now
  )
  on conflict (identifier) do nothing;

  select *
    into v_state
    from public.rate_limit_state
   where identifier = p_identifier
   for update;

  -- Caso 1: Já está bloqueado e o tempo ainda não expirou
  if v_state.blocked_until is not null and v_state.blocked_until > v_now then
    v_retry_secs := greatest(1, ceil(extract(epoch from (v_state.blocked_until - v_now)))::integer);

    update public.rate_limit_state
       set user_id = coalesce(p_user_id, user_id),
           user_email = coalesce(p_user_email, user_email),
           ip_address = coalesce(p_ip_address, ip_address),
           last_route = p_route,
           last_request_at = v_now
     where identifier = p_identifier;

    insert into public.rate_limit_audit (
      identifier, user_id, user_email, ip_address, route, method,
      event_type, request_count, limit_threshold, blocked_until, details
    )
    values (
      p_identifier,
      coalesce(p_user_id, v_state.user_id),
      coalesce(p_user_email, v_state.user_email),
      coalesce(p_ip_address, v_state.ip_address),
      p_route,
      p_method,
      'REJECTED_WHILE_BLOCKED',
      v_state.request_count,
      v_cfg.max_requests,
      v_state.blocked_until,
      format('Tentativa rejeitada durante bloqueio ativo (%s s restantes).', v_retry_secs)
    );

    return query select
      false,
      0,
      v_cfg.max_requests,
      v_cfg.window_seconds,
      v_state.blocked_until,
      v_state.request_count,
      v_retry_secs;
    return;
  end if;

  -- Caso 2: Janela expirou ou bloqueio anterior já venceu -> reinicia contador
  if (v_state.blocked_until is not null and v_state.blocked_until <= v_now)
     or (v_state.window_started_at + make_interval(secs => v_cfg.window_seconds) <= v_now) then
    v_new_count := 1;

    update public.rate_limit_state
       set user_id = coalesce(p_user_id, user_id),
           user_email = coalesce(p_user_email, user_email),
           ip_address = coalesce(p_ip_address, ip_address),
           request_count = v_new_count,
           window_started_at = v_now,
           blocked_until = null,
           last_route = p_route,
           last_request_at = v_now
     where identifier = p_identifier;

    return query select
      true,
      greatest(0, v_cfg.max_requests - v_new_count),
      v_cfg.max_requests,
      v_cfg.window_seconds,
      null::timestamptz,
      v_new_count,
      0;
    return;
  end if;

  -- Caso 3: Dentro da janela atual -> incrementa e verifica limite
  v_new_count := v_state.request_count + 1;

  if v_new_count > v_cfg.max_requests then
    v_new_blocked_until := v_now + make_interval(mins => v_cfg.block_duration_minutes);
    v_retry_secs := v_cfg.block_duration_minutes * 60;

    update public.rate_limit_state
       set user_id = coalesce(p_user_id, user_id),
           user_email = coalesce(p_user_email, user_email),
           ip_address = coalesce(p_ip_address, ip_address),
           request_count = v_new_count,
           blocked_until = v_new_blocked_until,
           total_blocks = v_state.total_blocks + 1,
           last_route = p_route,
           last_request_at = v_now
     where identifier = p_identifier;

    insert into public.rate_limit_audit (
      identifier, user_id, user_email, ip_address, route, method,
      event_type, request_count, limit_threshold, blocked_until, details
    )
    values (
      p_identifier,
      coalesce(p_user_id, v_state.user_id),
      coalesce(p_user_email, v_state.user_email),
      coalesce(p_ip_address, v_state.ip_address),
      p_route,
      p_method,
      'BLOCKED',
      v_new_count,
      v_cfg.max_requests,
      v_new_blocked_until,
      format('Limite de %s requisições em %ss excedido. Bloqueado por %s minuto(s).',
        v_cfg.max_requests, v_cfg.window_seconds, v_cfg.block_duration_minutes)
    );

    return query select
      false,
      0,
      v_cfg.max_requests,
      v_cfg.window_seconds,
      v_new_blocked_until,
      v_new_count,
      v_retry_secs;
    return;
  end if;

  -- Ainda dentro do limite permitido
  update public.rate_limit_state
     set user_id = coalesce(p_user_id, user_id),
         user_email = coalesce(p_user_email, user_email),
         ip_address = coalesce(p_ip_address, ip_address),
         request_count = v_new_count,
         last_route = p_route,
         last_request_at = v_now
   where identifier = p_identifier;

  return query select
    true,
    greatest(0, v_cfg.max_requests - v_new_count),
    v_cfg.max_requests,
    v_cfg.window_seconds,
    null::timestamptz,
    v_new_count,
    0;
end;
$$;

-- Restringe execução da RPC exclusivamente ao service_role (nunca exposta a anon/authenticated)
revoke all on function public.consume_rate_limit(text, uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, uuid, text, text, text, text) to service_role;
