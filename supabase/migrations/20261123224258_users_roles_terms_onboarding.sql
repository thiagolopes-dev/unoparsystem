-- ============================================================================
-- Migration: Gestão Unificada de Usuários (Multi-Perfil), Termos de Uso
--            com Geolocalização (Lat/Lng) e Troca Obrigatória de Senha
-- ============================================================================

-- 1. Evolução de public.profiles para suportar múltiplos perfis via checkbox
--    (ADMIN, PROFESSOR, ALUNO), titulação, telefone e controle de 1º acesso
alter table public.profiles
  alter column role drop default;

alter table public.profiles
  alter column role type text using role::text;

alter table public.profiles
  alter column role set default 'ALUNO';

alter table public.profiles
  add constraint profiles_role_valid
  check (role in ('ADMIN', 'PROFESSOR', 'ALUNO'));

alter table public.profiles
  add column if not exists roles text[] not null default array['ALUNO']::text[],
  add column if not exists titulacao text,
  add column if not exists telefone text,
  add column if not exists must_change_password boolean not null default false,
  add column if not exists ativo boolean not null default true;

alter table public.profiles
  add constraint profiles_roles_valid
  check (
    cardinality(roles) > 0
    and roles <@ array['ADMIN', 'PROFESSOR', 'ALUNO']::text[]
  );

-- Backfill dos perfis já existentes no banco
update public.profiles
   set roles = array[role]
 where role in ('ADMIN', 'PROFESSOR', 'ALUNO');

update public.profiles p
   set titulacao = coalesce(p.titulacao, pr.titulacao),
       telefone = coalesce(p.telefone, pr.telefone)
  from public.professores pr
 where pr.user_id = p.id;

create index if not exists idx_profiles_roles_gin
  on public.profiles using gin (roles);

-- 2. Atualização das funções RBAC no schema privado
create or replace function private.is_admin()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
      from public.profiles
     where id = (select auth.uid())
       and 'ADMIN' = any(roles)
  );
$$;

create or replace function private.has_role(target_role text)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
      from public.profiles
     where id = (select auth.uid())
       and target_role = any(roles)
  );
$$;

revoke execute on function private.has_role(text) from public, anon;
grant execute on function private.has_role(text) to authenticated;

-- 3. Atualização do trigger de sincronização auth.users -> public.profiles
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_roles text[];
  v_primary_role text;
  v_nome text;
  v_titulacao text;
  v_telefone text;
  v_must_change_password boolean;
begin
  if jsonb_typeof(new.raw_app_meta_data -> 'roles') = 'array'
     and jsonb_array_length(new.raw_app_meta_data -> 'roles') > 0 then
    select array_agg(distinct val)
      into v_roles
      from jsonb_array_elements_text(new.raw_app_meta_data -> 'roles') as t(val)
     where val in ('ADMIN', 'PROFESSOR', 'ALUNO');
  end if;

  if v_roles is null or cardinality(v_roles) = 0 then
    if (new.raw_app_meta_data ->> 'role') in ('ADMIN', 'PROFESSOR', 'ALUNO') then
      v_roles := array[new.raw_app_meta_data ->> 'role'];
    else
      v_roles := array['ALUNO']::text[];
    end if;
  end if;

  if 'ADMIN' = any(v_roles) then
    v_primary_role := 'ADMIN';
  elsif 'PROFESSOR' = any(v_roles) then
    v_primary_role := 'PROFESSOR';
  else
    v_primary_role := 'ALUNO';
  end if;

  v_nome := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'nome'), ''),
    split_part(new.email, '@', 1)
  );
  v_titulacao := nullif(trim(new.raw_user_meta_data ->> 'titulacao'), '');
  v_telefone := nullif(trim(new.raw_user_meta_data ->> 'telefone'), '');
  v_must_change_password := coalesce(
    (new.raw_app_meta_data ->> 'must_change_password')::boolean,
    false
  );

  insert into public.profiles (
    id, nome, email, role, roles, titulacao, telefone, must_change_password
  )
  values (
    new.id,
    v_nome,
    lower(new.email),
    v_primary_role,
    v_roles,
    v_titulacao,
    v_telefone,
    v_must_change_password
  )
  on conflict (id) do update
    set nome = excluded.nome,
        email = excluded.email,
        role = excluded.role,
        roles = excluded.roles,
        titulacao = coalesce(excluded.titulacao, public.profiles.titulacao),
        telefone = coalesce(excluded.telefone, public.profiles.telefone),
        must_change_password = excluded.must_change_password;

  -- Se existir professor com o mesmo e-mail sem user_id, vincula automaticamente
  update public.professores
     set user_id = new.id
   where lower(email) = lower(new.email)
     and user_id is null;

  return new;
end;
$$;

-- 4. Endurecimento das políticas RLS de profiles e aulas
drop policy if exists "profiles_update_own_or_admin" on public.profiles;

create policy "profiles_insert_admin"
  on public.profiles for insert
  to authenticated
  with check ((select private.is_admin()));

create policy "profiles_update_admin"
  on public.profiles for update
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy "profiles_delete_admin"
  on public.profiles for delete
  to authenticated
  using ((select private.is_admin()));

-- Apenas ADMIN pode atualizar aulas (Professor e Aluno apenas visualizam a grade)
drop policy if exists "aulas_update_admin_or_assigned_professor" on public.aulas;

create policy "aulas_update_admin"
  on public.aulas for update
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- 5. Tabela de Cadastro de Termos de Uso
create table if not exists public.termos_uso (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  versao text not null,
  conteudo text not null,
  ativo boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_termos_uso_single_active
  on public.termos_uso (ativo)
  where ativo = true;

create trigger trg_termos_uso_updated_at
  before update on public.termos_uso
  for each row execute function private.set_updated_at();

alter table public.termos_uso enable row level security;

create policy "termos_uso_select_authenticated"
  on public.termos_uso for select
  to authenticated
  using (ativo = true or (select private.is_admin()));

create policy "termos_uso_insert_admin"
  on public.termos_uso for insert
  to authenticated
  with check ((select private.is_admin()));

create policy "termos_uso_update_admin"
  on public.termos_uso for update
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy "termos_uso_delete_admin"
  on public.termos_uso for delete
  to authenticated
  using ((select private.is_admin()));

-- 6. Tabela de Aceites dos Termos de Uso (com Latitude e Longitude)
create table if not exists public.termos_aceites (
  id uuid primary key default gen_random_uuid(),
  termo_id uuid not null references public.termos_uso(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  latitude double precision not null check (latitude >= -90 and latitude <= 90),
  longitude double precision not null check (longitude >= -180 and longitude <= 180),
  accuracy double precision,
  user_agent text,
  accepted_at timestamptz not null default now(),
  constraint termos_aceites_unique_user_termo unique (termo_id, user_id)
);

create index if not exists idx_termos_aceites_termo_id
  on public.termos_aceites(termo_id);

create index if not exists idx_termos_aceites_user_id
  on public.termos_aceites(user_id);

alter table public.termos_aceites enable row level security;

create policy "termos_aceites_select_own_or_admin"
  on public.termos_aceites for select
  to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

create policy "termos_aceites_insert_own"
  on public.termos_aceites for insert
  to authenticated
  with check (user_id = (select auth.uid()));

-- Grants explícitos para Data API
grant select, insert, update, delete on public.termos_uso to authenticated;
grant select, insert on public.termos_aceites to authenticated;

-- 7. Termo de Uso inicial padrão (caso não exista nenhum cadastrado)
do $$
declare
  v_termo_id uuid;
begin
  if not exists (select 1 from public.termos_uso) then
    insert into public.termos_uso (titulo, versao, conteudo, ativo)
    values (
      'Termos de Uso e Política de Privacidade — UnoparSystem',
      '1.0',
      E'1. OBJETO E ACEITAÇÃO\nAo acessar o UnoparSystem (Sistema de Gestão Acadêmica de Aulas), o usuário declara ter lido, compreendido e aceito integralmente os presentes Termos de Uso.\n\n2. CREDENCIAIS E SEGURANÇA\nO acesso é pessoal e intransferível. No primeiro acesso, é obrigatória a definição de uma nova senha pessoal. O usuário é responsável por manter a confidencialidade de suas credenciais.\n\n3. PERFIS E PERMISSÕES DE ACESSO\nAs funcionalidades disponíveis variam conforme o(s) perfil(is) atribuído(s) pela Coordenação Acadêmica (Administrador, Professor ou Aluno).\n\n4. REGISTRO DE AUDITORIA E GEOLOCALIZAÇÃO\nPara fins de conformidade, segurança e comprovação de ciência (LGPD), o aceite deste termo registra data, hora e coordenadas geográficas (latitude e longitude) do dispositivo no momento da confirmação.\n\n5. DISPOSIÇÕES FINAIS\nEstes termos podem ser atualizados periodicamente pela instituição, sendo exigido novo aceite sempre que uma nova versão entrar em vigor.',
      true
    )
    returning id into v_termo_id;

    -- Pré-registra aceite para administradores iniciais já existentes (evita bloqueio do admin seed)
    insert into public.termos_aceites (termo_id, user_id, latitude, longitude, user_agent)
    select v_termo_id, p.id, -23.304452, -51.169582, 'Seed Inicial (Admin)'
      from public.profiles p
     where 'ADMIN' = any(p.roles)
    on conflict do nothing;
  end if;
end;
$$;
