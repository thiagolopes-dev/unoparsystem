-- ============================================================================
-- Migration: Adiciona data_fim em public.aulas e torna horários opcionais
-- ============================================================================

alter table public.aulas
  add column if not exists data_fim date;

update public.aulas
   set data_fim = data_aula
 where data_fim is null;

alter table public.aulas
  alter column data_fim set not null;

alter table public.aulas
  drop constraint if exists aulas_periodo_valido;

alter table public.aulas
  add constraint aulas_periodo_valido check (data_fim >= data_aula);

alter table public.aulas
  alter column hora_inicio set default '08:00:00';

alter table public.aulas
  alter column hora_fim set default '22:00:00';

drop trigger if exists trg_check_aula_schedule_conflict on public.aulas;

create index if not exists idx_aulas_periodo
  on public.aulas (data_aula, data_fim);

notify pgrst, 'reload schema';
