-- ============================================================================
-- Seed Automático Local (Ambientes de Desenvolvimento e Testes)
-- Credenciais padrão:
--   1. Admin:     admin@unopar.br     | Senha: Password123!
--   2. Professor: professor@unopar.br | Senha: Password123!
-- ============================================================================

do $$
declare
  v_admin_uid uuid := '11111111-1111-1111-1111-111111111111';
  v_prof_uid  uuid := '22222222-2222-2222-2222-222222222222';

  v_prof_1 uuid := 'a1111111-1111-1111-1111-111111111111';
  v_prof_2 uuid := 'a2222222-2222-2222-2222-222222222222';
  v_prof_3 uuid := 'a3333333-3333-3333-3333-333333333333';

  v_disc_1 uuid := 'b1111111-1111-1111-1111-111111111111';
  v_disc_2 uuid := 'b2222222-2222-2222-2222-222222222222';
  v_disc_3 uuid := 'b3333333-3333-3333-3333-333333333333';
  v_disc_4 uuid := 'b4444444-4444-4444-4444-444444444444';

  v_turma_1 uuid := 'c1111111-1111-1111-1111-111111111111';
  v_turma_2 uuid := 'c2222222-2222-2222-2222-222222222222';
  v_turma_3 uuid := 'c3333333-3333-3333-3333-333333333333';
begin
  -- 1. Cadastra Professores primeiro (para vínculo automático no trigger de auth.users)
  insert into public.professores (id, nome, email, telefone, titulacao, ativo)
  values
    (v_prof_1, 'Prof. Dr. Ricardo Mendes', 'professor@unopar.br', '(43) 99911-2233', 'Doutor', true),
    (v_prof_2, 'Profa. Dra. Helena Vasconcelos', 'helena.vasconcelos@unopar.br', '(43) 99822-3344', 'Doutora', true),
    (v_prof_3, 'Prof. Me. Carlos Eduardo Silva', 'carlos.silva@unopar.br', '(43) 99733-4455', 'Mestre', true)
  on conflict (id) do nothing;

  -- 2. Cria usuários no Supabase Auth (GoTrue) com hash bcrypt nativo (extensions.crypt)
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
  )
  values
    (
      '00000000-0000-0000-0000-000000000000',
      v_admin_uid,
      'authenticated',
      'authenticated',
      'admin@unopar.br',
      extensions.crypt('Password123!', extensions.gen_salt('bf', 10)),
      now(),
      '{"provider":"email","providers":["email"],"role":"ADMIN"}'::jsonb,
      '{"nome":"Coordenação Acadêmica (Admin)"}'::jsonb,
      now(), now(), '', '', '', ''
    ),
    (
      '00000000-0000-0000-0000-000000000000',
      v_prof_uid,
      'authenticated',
      'authenticated',
      'professor@unopar.br',
      extensions.crypt('Password123!', extensions.gen_salt('bf', 10)),
      now(),
      '{"provider":"email","providers":["email"],"role":"PROFESSOR"}'::jsonb,
      '{"nome":"Prof. Dr. Ricardo Mendes"}'::jsonb,
      now(), now(), '', '', '', ''
    )
  on conflict (id) do nothing;

  -- Identidades para login por e-mail/senha no GoTrue
  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  )
  values
    (
      v_admin_uid,
      v_admin_uid,
      v_admin_uid::text,
      jsonb_build_object('sub', v_admin_uid::text, 'email', 'admin@unopar.br', 'email_verified', true),
      'email',
      now(), now(), now()
    ),
    (
      v_prof_uid,
      v_prof_uid,
      v_prof_uid::text,
      jsonb_build_object('sub', v_prof_uid::text, 'email', 'professor@unopar.br', 'email_verified', true),
      'email',
      now(), now(), now()
    )
  on conflict do nothing;

  -- 3. Cadastra Disciplinas
  insert into public.disciplinas (id, codigo, nome, carga_horaria, ementa, ativa)
  values
    (v_disc_1, 'ENG-401', 'Arquitetura de Sistemas e Microsserviços', 80, 'Clean Architecture, DDD, padrões distribuídos e resiliência.', true),
    (v_disc_2, 'BDA-302', 'Banco de Dados Avançado (PostgreSQL)', 60, 'Modelagem relacional, indexação avançada, transações e RLS.', true),
    (v_disc_3, 'QTS-204', 'Engenharia de Qualidade, TDD e Testes', 60, 'Pirâmide de testes, ciclo Red-Green-Refactor, Vitest e E2E.', true),
    (v_disc_4, 'SEC-501', 'Segurança de Aplicações Web', 40, 'OWASP Top 10, autenticação JWT/OAuth2, bcrypt e hardening.', true)
  on conflict (id) do nothing;

  -- 4. Cadastra Turmas
  insert into public.turmas (id, codigo, nome, periodo, turno, sala_padrao, ativa)
  values
    (v_turma_1, 'ADS-4N', 'Análise e Desenv. de Sistemas - 4º Sem', '2026.2', 'NOTURNO', 'Lab 03 - Bloco B', true),
    (v_turma_2, 'ESO-6M', 'Engenharia de Software - 6º Sem', '2026.2', 'MATUTINO', 'Sala 204 - Bloco A', true),
    (v_turma_3, 'CCO-2V', 'Ciência da Computação - 2º Sem', '2026.2', 'VESPERTINO', 'Lab 01 - Bloco C', true)
  on conflict (id) do nothing;

  -- 5. Cadastra Aulas na Grade
  insert into public.aulas (
    disciplina_id, turma_id, professor_id, data_aula, hora_inicio, hora_fim, status, sala, conteudo_programatico, observacoes
  )
  values
    (
      v_disc_1, v_turma_1, v_prof_1,
      current_date, '19:00', '20:40', 'EM_ANDAMENTO',
      'Lab 03 - Bloco B',
      'Módulo 3: Clean Architecture e separação de camadas na prática.',
      'Trazer repositório base clonado.'
    ),
    (
      v_disc_2, v_turma_1, v_prof_1,
      current_date, '20:55', '22:30', 'AGENDADA',
      'Lab 03 - Bloco B',
      'Políticas de Row Level Security (RLS) e índices parciais no PostgreSQL.',
      'Prática com containers Docker.'
    ),
    (
      v_disc_3, v_turma_2, v_prof_2,
      current_date, '08:00', '09:40', 'CONCLUIDA',
      'Sala 204 - Bloco A',
      'Ciclo TDD (Red-Green-Refactor) aplicado a regras de agendamento.',
      '100% de presença registrada.'
    ),
    (
      v_disc_4, v_turma_3, v_prof_3,
      current_date + 1, '14:00', '15:40', 'AGENDADA',
      'Lab 01 - Bloco C',
      'Autenticação JWT, cookies HttpOnly e proteção contra XSS/CSRF.',
      'Revisão para avaliação prática.'
    ),
    (
      v_disc_1, v_turma_2, v_prof_1,
      current_date - 1, '10:00', '11:40', 'CANCELADA',
      'Sala 204 - Bloco A',
      'Revisão de System Design e C4 Model.',
      'Aula reagendada devido a evento acadêmico institucional.'
    );
end;
$$;
