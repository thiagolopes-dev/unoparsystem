"use client";

import { useState, useTransition } from "react";
import { loginAction } from "@/app/actions";
import {
  Lock,
  Mail,
  ArrowRight,
  AlertCircle,
  BookOpenCheck,
  Eye,
  EyeOff,
} from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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

  return (
    <main className="min-h-screen flex items-center justify-center bg-zinc-50 text-zinc-950 p-6 md:p-12">
      {/* Center Auth Card */}
      <section className="max-w-md w-full">
        <div className="bg-white border border-zinc-200/90 rounded-2xl p-8 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
          <div className="mb-7 flex items-center justify-center gap-3.5">
            <div className="h-11 w-11 rounded-xl bg-zinc-950 text-white flex items-center justify-center">
              <BookOpenCheck className="h-5 w-5" />
            </div>
            <h1 className="font-semibold tracking-tight text-xl leading-none">
              UNOPAR<span className="text-zinc-400 font-normal">SYSTEM</span>
            </h1>
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
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 pl-10 pr-10 py-2.5 text-sm text-zinc-950 placeholder:text-zinc-400 focus:bg-white focus:border-zinc-900 focus:outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 transition-colors cursor-pointer"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
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
        </div>
      </section>
    </main>
  );
}
