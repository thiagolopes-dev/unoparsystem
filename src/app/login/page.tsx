"use client";

import { useState, useTransition } from "react";
import { loginAction } from "@/app/actions";
import {
  ShieldCheck,
  Lock,
  Mail,
  ArrowRight,
  KeyRound,
  AlertCircle,
  BookOpenCheck,
} from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const res = await loginAction(formData);
      if (res && !res.ok) {
        setError(res.error ?? "Erro ao autenticar.");
      }
    });
  }

  function fillQuickCredentials(role: "ADMIN" | "PROFESSOR") {
    setError(null);
    if (role === "ADMIN") {
      setEmail("admin@unopar.br");
      setPassword("Password123!");
    } else {
      setEmail("professor@unopar.br");
      setPassword("Password123!");
    }
  }

  return (
    <main className="min-h-screen flex flex-col justify-between bg-zinc-50 text-zinc-950 p-6 md:p-12">
      {/* Top Minimal Header */}
      <header className="max-w-6xl w-full mx-auto flex items-center justify-between border-b border-zinc-200 pb-5">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-zinc-950 text-white flex items-center justify-center">
            <BookOpenCheck className="h-4 w-4" />
          </div>
          <div>
            <span className="font-semibold tracking-tight text-sm block leading-none">
              UNOPAR<span className="text-zinc-400 font-normal">SYSTEM</span>
            </span>
            <span className="font-mono text-[11px] text-zinc-500 uppercase tracking-widest">
              Academic Ops · v1.0
            </span>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-zinc-500 bg-white border border-zinc-200 px-3 py-1.5 rounded-full">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
          <span>Auth JWT + bcrypt + PostgreSQL RLS</span>
        </div>
      </header>

      {/* Center Auth Card */}
      <section className="max-w-md w-full mx-auto my-auto py-12">
        <div className="bg-white border border-zinc-200/90 rounded-2xl p-8 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
          <div className="mb-7">
            <span className="font-mono text-[11px] uppercase tracking-widest text-zinc-400 block mb-1.5">
              Acesso Restrito
            </span>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">
              Gestão de Aulas e Grade
            </h1>
            <p className="text-sm text-zinc-500 mt-1">
              Entre com sua conta institucional para gerenciar disciplinas, turmas e status de aulas.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-6 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50/70 p-3.5 text-xs text-red-800"
            >
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-medium text-zinc-700 mb-1.5"
              >
                E-mail Institucional
              </label>
              <div className="relative">
                <Mail className="h-4 w-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nome@unopar.br"
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 pl-10 pr-3.5 py-2.5 text-sm text-zinc-950 placeholder:text-zinc-400 focus:bg-white focus:border-zinc-900 focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-medium text-zinc-700 mb-1.5"
              >
                Senha
              </label>
              <div className="relative">
                <Lock className="h-4 w-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 pl-10 pr-3.5 py-2.5 text-sm text-zinc-950 placeholder:text-zinc-400 focus:bg-white focus:border-zinc-900 focus:outline-none transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 transition-colors cursor-pointer"
            >
              <span>{isPending ? "Autenticando..." : "Entrar no Sistema"}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          {/* Quick Local Seed Fillers */}
          <div className="mt-7 pt-6 border-t border-zinc-100">
            <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-3">
              <KeyRound className="h-3 w-3" />
              <span>Ambiente Local (Seed Docker) — Preenchimento Rápido</span>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => fillQuickCredentials("ADMIN")}
                className="text-left p-2.5 rounded-xl border border-zinc-200 hover:border-zinc-900 hover:bg-zinc-50 transition-colors cursor-pointer"
              >
                <span className="font-mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-900 text-white">
                  ADMIN
                </span>
                <p className="text-xs font-medium text-zinc-900 mt-1.5 truncate">
                  admin@unopar.br
                </p>
                <p className="text-[11px] text-zinc-500">Acesso total (CRUDs)</p>
              </button>

              <button
                type="button"
                onClick={() => fillQuickCredentials("PROFESSOR")}
                className="text-left p-2.5 rounded-xl border border-zinc-200 hover:border-zinc-900 hover:bg-zinc-50 transition-colors cursor-pointer"
              >
                <span className="font-mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-200 text-zinc-800">
                  PROFESSOR
                </span>
                <p className="text-xs font-medium text-zinc-900 mt-1.5 truncate">
                  professor@unopar.br
                </p>
                <p className="text-[11px] text-zinc-500">Minhas aulas / Status</p>
              </button>
            </div>
          </div>
        </div>
      </section>

      <footer className="max-w-6xl w-full mx-auto flex flex-col sm:flex-row items-center justify-between text-xs text-zinc-400 border-t border-zinc-200 pt-5 gap-2">
        <span>UnoparSystem · Arquitetura Next.js 15 + Supabase Local</span>
        <span className="font-mono">127.0.0.1:54321 · RLS Enabled</span>
      </footer>
    </main>
  );
}
