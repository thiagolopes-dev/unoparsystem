# UnoparSystem — Gestão Acadêmica de Aulas (MVP Local)

Sistema de gestão de **Disciplinas**, **Turmas**, **Professores** e **Grade de Aulas** desenvolvido com **Next.js 15 (App Router)** e **Supabase 100% Local (Docker + PostgreSQL + GoTrue JWT/bcrypt + Row Level Security)**.

---

## 🚀 Como Rodar 100% Localmente

### 1. Pré-requisitos (Já instalados na máquina)
- **Docker Desktop** (certifique-se de que o aplicativo **Docker Desktop** está aberto e rodando)
- **Supabase CLI** (`v2.98.2`)
- **Node.js** (`v22+`)

### 2. Subir o Banco PostgreSQL, Auth (JWT/bcrypt) e Studio no Docker
Com o **Docker Desktop** aberto, execute na raiz do projeto:

```bash
npm run db:start
```

> O Supabase CLI subirá os containers locais e aplicará automaticamente:
> - A migration inicial ([`20261020004032_init_gestao_aulas.sql`](./supabase/migrations/20261020004032_init_gestao_aulas.sql)) com tabelas, triggers anti-conflito de horário e políticas RLS (`ADMIN` e `PROFESSOR`).
> - O seed inicial ([`seed.sql`](./supabase/seed.sql)) com usuários de teste e dados acadêmicos.

Caso queira recriar o banco do zero e reaplicar o seed a qualquer momento:
```bash
npm run db:reset
```

### 3. Verificar as Chaves Locais (Opcional)
O arquivo `.env.local` já está configurado com a URL local (`http://127.0.0.1:54321`) e a chave `anon` padrão do Supabase CLI. Caso sua versão do CLI gere uma `ANON_KEY` diferente no `supabase start`, copie o valor exibido no terminal para o `.env.local`.

### 4. Iniciar a Aplicação Next.js
```bash
npm run dev
```

Acesse:
- **Aplicação Web:** `http://localhost:3000`
- **Supabase Studio Local (Painel do Banco e Auth):** `http://127.0.0.1:54323`

---

## 🔐 Credenciais de Teste (Seed Local)

Na tela de `/login`, você pode clicar nos botões de preenchimento rápido ou usar:

| Perfil | E-mail | Senha | Permissões (RBAC + RLS) |
| :--- | :--- | :--- | :--- |
| **ADMIN (Coordenação)** | `admin@unopar.br` | `Password123!` | CRUD completo de Disciplinas, Turmas, Professores e Aulas. |
| **PROFESSOR** | `professor@unopar.br` | `Password123!` | Visualiza a grade e atualiza o **Status** (`EM_ANDAMENTO`, `CONCLUIDA`, `CANCELADA`) das próprias aulas. |

---

## 🧪 Executar a Suíte de Testes (TDD / Vitest)

```bash
npm test
```
