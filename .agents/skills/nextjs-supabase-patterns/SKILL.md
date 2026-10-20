---
name: nextjs-supabase-patterns
description: >-
  Use when working with Next.js + Supabase projects. Provides best practices for
  RLS policies, Server Components, API routes, Auth SSR, and type-safe database
  queries. Do not use for non-Supabase projects.
triggers:
  - supabase
  - rls
  - server component
  - database migration
---

# Next.js + Supabase Patterns

## Padrões Obrigatórios

### Row Level Security (RLS)
- Toda tabela no schema `public` DEVE ter RLS ativado (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`).
- Nunca crie tabela sem política explícita.
- Use o template em [rls-template.sql](./references/rls-template.sql) como base e otimize chamadas `auth.uid()` com `(select auth.uid())` para evitar reavaliação por linha.

### Server Components & SSR Auth
- Prefira **React Server Components (RSC)** para data fetching direto com o client server-side (`@supabase/ssr`).
- Use **Client Components** (`"use client"`) apenas quando necessário para interatividade (eventos, hooks de estado local, Realtime subscriptions).
- Proteja rotas no `middleware.ts` validando a sessão com `supabase.auth.getUser()` (nunca confie apenas em `getSession()` no servidor).

### Tipos TypeScript e Migrations
- Sempre utilize os tipos gerados pelo Supabase CLI (`Database`).
- Execute `supabase gen types typescript --local > src/types/database.types.ts` (ou equivalente do projeto) após qualquer migration.
- Toda alteração de banco deve ser feita via SQL migration versionada em `supabase/migrations/`.

## Checklist antes de concluir feature ou PR
- [ ] RLS ativado e testado em todas as novas tabelas
- [ ] Índices criados em todas as colunas usadas em políticas RLS e chaves estrangeiras
- [ ] Migration versionada com estratégia de rollback segura
- [ ] Tipos TypeScript (`database.types.ts`) atualizados
- [ ] Validação de input (ex.: Zod) nas Server Actions / Route Handlers
