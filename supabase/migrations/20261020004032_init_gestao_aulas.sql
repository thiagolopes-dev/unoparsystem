-- ============================================================================
-- Migration: Inicialização do Sistema de Gestão de Aulas (UnoparSystem)
-- ============================================================================

create schema if not exists private;

-- 1. Tipos Enumerados (Enums)
create type public.user_role as enum ('ADMIN', 'PROFESSOR');
create type public.turno_tipo as enum ('MATUTINO', 'VESPERTINO', 'NOTURNO');
create type public.aula_status as enum ('AGENDADA', 'EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA');

-- 2. Tabela de Perfis de Acesso (RBAC vinculado ao Supabase Auth)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  email text not null unique,
  role public.user_role not null default 'PROFESSOR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Tabela de Professores
create table public.professores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  nome text not null,
  email text not null unique,
  telefone text,
  titulacao text not null default 'Especialista',
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. Tabela de Disciplinas
create table public.disciplinas (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nome text not null,
  carga_horaria integer not null check (carga_horaria > 0 and carga_horaria <= 1000),
  ementa text,
  ativa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 5. Tabela de Turmas
create table public.turmas (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nome text not null,
  periodo text not null,
  turno public.turno_tipo not null,
  sala_padrao text,
  ativa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 6. Tabela de Aulas
create table public.aulas (
  id uuid primary key default gen_random_uuid(),
  disciplina_id uuid not null references public.disciplinas(id) on delete restrict,
  turma_id uuid not null references public.turmas(id) on delete restrict,
  professor_id uuid not null references public.professores(id) on delete restrict,
  data_aula date not null,
  hora_inicio time not null,
  hora_fim time not null,
  status public.aula_status not null default 'AGENDADA',
  sala text,
  conteudo_programatico text,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint aulas_horario_valido check (hora_fim > hora_inicio)
);

-- 7. Índices de Performance (Foreign Keys, Filtros e RLS)
create index idx_professores_user_id on public.professores(user_id);
create index idx_professores_email on public.professores(email);
create index idx_aulas_disciplina_id on public.aulas(disciplina_id);
create index idx_aulas_turma_id on public.aulas(turma_id);
create index idx_aulas_professor_id on public.aulas(professor_id);
create index idx_aulas_data_horario on public.aulas(data_aula, hora_inicio, hora_fim);
create index idx_aulas_status on public.aulas(status);

-- 8. Trigger de Atualização Automática de updated_at
create or replace function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

create trigger trg_professores_updated_at
  before update on public.professores
  for each row execute function private.set_updated_at();

create trigger trg_disciplinas_updated_at
  before update on public.disciplinas
  for each row execute function private.set_updated_at();

create trigger trg_turmas_updated_at
  before update on public.turmas
  for each row execute function private.set_updated_at();

create trigger trg_aulas_updated_at
  before update on public.aulas
  for each row execute function private.set_updated_at();

-- 9. Trigger de Prevenção de Choque de Horário (Professor e Turma)
create or replace function private.check_aula_schedule_conflict()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_conflict_prof record;
  v_conflict_turma record;
begin
  -- Aulas canceladas não bloqueiam grade horária
  if new.status = 'CANCELADA' then
    return new;
  end if;

  -- Verifica choque de horário para o mesmo Professor
  select a.id, a.hora_inicio, a.hora_fim, t.nome as turma_nome
    into v_conflict_prof
    from public.aulas a
    join public.turmas t on t.id = a.turma_id
   where a.id is distinct from new.id
     and a.status != 'CANCELADA'
     and a.professor_id = new.professor_id
     and a.data_aula = new.data_aula
     and a.hora_inicio < new.hora_fim
     and a.hora_fim > new.hora_inicio
   limit 1;

  if found then
    raise exception 'Choque de horário do professor: já existe aula alocada na turma "%" das % às % nesta data.',
      v_conflict_prof.turma_nome,
      to_char(v_conflict_prof.hora_inicio, 'HH24:MI'),
      to_char(v_conflict_prof.hora_fim, 'HH24:MI')
      using errcode = '23P01';
  end if;

  -- Verifica choque de horário para a mesma Turma
  select a.id, a.hora_inicio, a.hora_fim, d.nome as disciplina_nome
    into v_conflict_turma
    from public.aulas a
    join public.disciplinas d on d.id = a.disciplina_id
   where a.id is distinct from new.id
     and a.status != 'CANCELADA'
     and a.turma_id = new.turma_id
     and a.data_aula = new.data_aula
     and a.hora_inicio < new.hora_fim
     and a.hora_fim > new.hora_inicio
   limit 1;

  if found then
    raise exception 'Choque de horário da turma: já existe aula da disciplina "%" das % às % nesta data.',
      v_conflict_turma.disciplina_nome,
      to_char(v_conflict_turma.hora_inicio, 'HH24:MI'),
      to_char(v_conflict_turma.hora_fim, 'HH24:MI')
      using errcode = '23P01';
  end if;

  return new;
end;
$$;

create trigger trg_check_aula_schedule_conflict
  before insert or update on public.aulas
  for each row execute function private.check_aula_schedule_conflict();

-- 10. Sincronização Automática de auth.users -> public.profiles e public.professores
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.user_role;
  v_nome text;
begin
  v_role := coalesce(
    (new.raw_app_meta_data ->> 'role')::public.user_role,
    'PROFESSOR'::public.user_role
  );
  v_nome := coalesce(
    new.raw_user_meta_data ->> 'nome',
    split_part(new.email, '@', 1)
  );

  insert into public.profiles (id, nome, email, role)
  values (new.id, v_nome, new.email, v_role)
  on conflict (id) do update
    set nome = excluded.nome,
        email = excluded.email,
        role = excluded.role;

  -- Se existir professor com o mesmo e-mail, vincula o user_id automaticamente
  update public.professores
     set user_id = new.id
   where lower(email) = lower(new.email)
     and user_id is null;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- 11. Funções Auxiliares de Autorização (RBAC em Schema Privado)
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
       and role = 'ADMIN'
  );
$$;

grant usage on schema private to authenticated;
revoke execute on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;

-- 12. Row Level Security (RLS)
alter table public.profiles enable row level security;
alter table public.professores enable row level security;
alter table public.disciplinas enable row level security;
alter table public.turmas enable row level security;
alter table public.aulas enable row level security;

-- Políticas: profiles
create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()));

create policy "profiles_update_own_or_admin"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()))
  with check (id = (select auth.uid()) or (select private.is_admin()));

-- Políticas: professores (Leitura para autenticados, escrita para ADMIN)
create policy "professores_select_authenticated"
  on public.professores for select
  to authenticated
  using (true);

create policy "professores_insert_admin"
  on public.professores for insert
  to authenticated
  with check ((select private.is_admin()));

create policy "professores_update_admin"
  on public.professores for update
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy "professores_delete_admin"
  on public.professores for delete
  to authenticated
  using ((select private.is_admin()));

-- Políticas: disciplinas (Leitura para autenticados, escrita para ADMIN)
create policy "disciplinas_select_authenticated"
  on public.disciplinas for select
  to authenticated
  using (true);

create policy "disciplinas_insert_admin"
  on public.disciplinas for insert
  to authenticated
  with check ((select private.is_admin()));

create policy "disciplinas_update_admin"
  on public.disciplinas for update
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy "disciplinas_delete_admin"
  on public.disciplinas for delete
  to authenticated
  using ((select private.is_admin()));

-- Políticas: turmas (Leitura para autenticados, escrita para ADMIN)
create policy "turmas_select_authenticated"
  on public.turmas for select
  to authenticated
  using (true);

create policy "turmas_insert_admin"
  on public.turmas for insert
  to authenticated
  with check ((select private.is_admin()));

create policy "turmas_update_admin"
  on public.turmas for update
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy "turmas_delete_admin"
  on public.turmas for delete
  to authenticated
  using ((select private.is_admin()));

-- Políticas: aulas
-- Leitura: Admin vê todas; Professor vê todas da grade (ou suas próprias)
create policy "aulas_select_authenticated"
  on public.aulas for select
  to authenticated
  using (true);

-- Criação e Exclusão de Aulas: Apenas ADMIN
create policy "aulas_insert_admin"
  on public.aulas for insert
  to authenticated
  with check ((select private.is_admin()));

create policy "aulas_delete_admin"
  on public.aulas for delete
  to authenticated
  using ((select private.is_admin()));

-- Atualização de Aulas: ADMIN atualiza qualquer aula; PROFESSOR atualiza apenas aulas vinculadas ao seu user_id
create policy "aulas_update_admin_or_assigned_professor"
  on public.aulas for update
  to authenticated
  using (
    (select private.is_admin())
    or exists (
      select 1
        from public.professores p
       where p.id = public.aulas.professor_id
         and p.user_id = (select auth.uid())
    )
  )
  with check (
    (select private.is_admin())
    or exists (
      select 1
        from public.professores p
       where p.id = public.aulas.professor_id
         and p.user_id = (select auth.uid())
    )
  );

-- Grants explícitos para Data API
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
