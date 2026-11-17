"use client";

import { useState, useTransition } from "react";
import { loginAction, requestPasswordResetAction } from "@/app/actions";
import {
  Lock,
  Mail,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  BookOpenCheck,
  Eye,
  EyeOff,
} from "lucide-react";

function OrbitalBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden select-none"
    >
      {/* Atmospheric gradient mesh */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,#0f1f40_0%,#060913_58%,#03050b_100%)]" />

      {/* Aurora glows */}
      <div className="login-aurora absolute -top-36 -left-24 h-[460px] w-[460px] rounded-full bg-cyan-500/20 blur-[125px]" />
      <div className="login-aurora-delayed absolute -bottom-40 -right-24 h-[480px] w-[480px] rounded-full bg-emerald-500/15 blur-[135px]" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[420px] w-[560px] rounded-full bg-indigo-500/15 blur-[150px]" />

      {/* Architectural coordinate grid + concentric orbital SVG */}
      <svg
        className="absolute inset-0 h-full w-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern
            id="login-grid"
            width="48"
            height="48"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 48 0 L 0 0 0 48"
              fill="none"
              stroke="rgba(148, 163, 184, 0.08)"
              strokeWidth="1"
            />
          </pattern>
          <radialGradient id="login-grid-fade" cx="50%" cy="50%" r="55%">
            <stop offset="0%" stopColor="white" stopOpacity="0.95" />
            <stop offset="65%" stopColor="white" stopOpacity="0.35" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <mask id="login-grid-mask">
            <rect width="100%" height="100%" fill="url(#login-grid-fade)" />
          </mask>
          <linearGradient id="orbit-cyan-indigo" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.45" />
            <stop offset="50%" stopColor="#818cf8" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#34d399" stopOpacity="0.4" />
          </linearGradient>
          <linearGradient id="orbit-emerald-sky" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#34d399" stopOpacity="0.35" />
            <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.3" />
          </linearGradient>
        </defs>

        {/* Masked background coordinate grid */}
        <rect
          width="100%"
          height="100%"
          fill="url(#login-grid)"
          mask="url(#login-grid-mask)"
        />
      </svg>

      {/* Centered SVG orbital rings & nodes behind the glass card */}
      <svg
        viewBox="0 0 800 800"
        className="absolute left-1/2 top-1/2 h-[760px] w-[760px] sm:h-[880px] sm:w-[880px] -translate-x-1/2 -translate-y-1/2 opacity-80"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Outer static subtle horizon ring */}
        <circle
          cx="400"
          cy="400"
          r="355"
          fill="none"
          stroke="rgba(148, 163, 184, 0.08)"
          strokeWidth="1"
        />

        {/* Rotating outer dashed ring with satellite nodes */}
        <g className="login-orbit-slow">
          <circle
            cx="400"
            cy="400"
            r="305"
            fill="none"
            stroke="url(#orbit-cyan-indigo)"
            strokeWidth="1.25"
            strokeDasharray="10 14 2 14"
          />
          <circle cx="400" cy="95" r="3.5" fill="#67e8f9" opacity="0.85" />
          <circle cx="400" cy="95" r="9" fill="#22d3ee" opacity="0.18" />
          <circle cx="664" cy="552" r="2.5" fill="#6ee7b7" opacity="0.75" />
          <circle cx="136" cy="552" r="2.5" fill="#a5b4fc" opacity="0.65" />
        </g>

        {/* Counter-rotating inner telemetry ring */}
        <g className="login-orbit-reverse">
          <circle
            cx="400"
            cy="400"
            r="242"
            fill="none"
            stroke="url(#orbit-emerald-sky)"
            strokeWidth="1"
            strokeDasharray="48 18 6 18"
          />
          <circle cx="642" cy="400" r="3" fill="#34d399" opacity="0.85" />
          <circle cx="642" cy="400" r="8" fill="#34d399" opacity="0.18" />
          <circle cx="158" cy="400" r="2.5" fill="#38bdf8" opacity="0.75" />
        </g>

        {/* Subtle axis hairlines */}
        <line
          x1="400"
          y1="25"
          x2="400"
          y2="775"
          stroke="rgba(148, 163, 184, 0.06)"
          strokeWidth="1"
          strokeDasharray="3 9"
        />
        <line
          x1="25"
          y1="400"
          x2="775"
          y2="400"
          stroke="rgba(148, 163, 184, 0.06)"
          strokeWidth="1"
          strokeDasharray="3 9"
        />
      </svg>
    </div>
  );
}

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [pointerPos, setPointerPos] = useState({ x: 200, y: 120, active: false });

  function switchMode(nextMode: "login" | "forgot") {
    setMode(nextMode);
    setError(null);
    setSuccessMessage(null);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      if (mode === "forgot") {
        const res = await requestPasswordResetAction(formData);
        if (res.ok) {
          setSuccessMessage(
            res.message ??
              "Se o e-mail informado estiver cadastrado, você receberá um link para redefinir sua senha em instantes."
          );
        } else {
          setError(
            res.error ?? "Não foi possível enviar o link de recuperação."
          );
        }
        return;
      }

      const res = await loginAction(formData);
      if (res && !res.ok) {
        setError(res.error ?? "Erro ao autenticar.");
      }
    });
  }

  function handlePointerMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    setPointerPos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      active: true,
    });
  }

  return (
    <main className="relative min-h-screen overflow-hidden flex items-center justify-center bg-[#060913] text-slate-100 p-5 sm:p-8 md:p-12 selection:bg-cyan-400/30 selection:text-cyan-100">
      <OrbitalBackdrop />

      {/* Center Frosted-Glass Auth Card */}
      <section className="relative z-10 max-w-md w-full login-card-enter">
        {/* Iridescent 1px glass rim */}
        <div
          onMouseMove={handlePointerMove}
          onMouseLeave={() => setPointerPos((prev) => ({ ...prev, active: false }))}
          className="relative p-[1px] rounded-3xl bg-gradient-to-b from-white/25 via-cyan-300/15 to-white/5 shadow-[0_24px_80px_-16px_rgba(0,0,0,0.85),0_0_55px_-18px_rgba(34,211,238,0.22)]"
        >
          <div className="relative overflow-hidden rounded-[calc(1.5rem-1px)] bg-[#0b1121]/72 backdrop-blur-2xl p-7 sm:p-9">
            {/* Top specular glass reflection */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/65 to-transparent"
            />

            {/* Interactive pointer light refraction */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 transition-opacity duration-300"
              style={{
                opacity: pointerPos.active ? 1 : 0,
                background: `radial-gradient(360px circle at ${pointerPos.x}px ${pointerPos.y}px, rgba(56, 189, 248, 0.14), rgba(52, 211, 153, 0.05) 42%, transparent 72%)`,
              }}
            />

            {/* Centered Brand Lockup */}
            <div className="relative z-10 mb-6 flex items-center justify-center gap-3.5">
              <div className="relative h-12 w-12 rounded-2xl bg-gradient-to-br from-cyan-400/20 via-sky-500/10 to-emerald-400/20 border border-cyan-300/30 text-cyan-300 flex items-center justify-center shadow-[0_0_26px_-4px_rgba(34,211,238,0.45)]">
                <BookOpenCheck className="h-6 w-6 drop-shadow-[0_0_8px_rgba(103,232,249,0.55)]" />
              </div>
              <h1 className="font-semibold tracking-tight text-2xl leading-none text-white">
                UNOPAR
                <span className="bg-gradient-to-r from-cyan-300 via-sky-300 to-emerald-300 bg-clip-text text-transparent font-normal">
                  SYSTEM
                </span>
              </h1>
            </div>

            {/* Subtle luminous divider */}
            <div
              aria-hidden="true"
              className="relative z-10 mb-7 h-px w-full bg-gradient-to-r from-transparent via-white/15 to-transparent"
            />

            {mode === "forgot" && (
              <div className="relative z-10 mb-5">
                <h2 className="text-base font-semibold tracking-tight text-white">
                  Recuperar acesso
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">
                  Informe seu e-mail institucional para receber um link seguro de
                  redefinição de senha.
                </p>
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="relative z-10 mb-6 flex items-start gap-2.5 rounded-xl border border-rose-400/30 bg-rose-500/10 backdrop-blur-md p-3.5 text-xs text-rose-200 shadow-[0_0_24px_-8px_rgba(244,63,94,0.35)]"
              >
                <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {successMessage && (
              <div
                role="status"
                className="relative z-10 mb-6 flex items-start gap-2.5 rounded-xl border border-emerald-400/30 bg-emerald-500/10 backdrop-blur-md p-3.5 text-xs text-emerald-200 shadow-[0_0_24px_-8px_rgba(52,211,153,0.35)]"
              >
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>{successMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="relative z-10 space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="block text-xs font-medium tracking-wide text-slate-300 mb-1.5"
                >
                  E-mail
                </label>
                <div className="relative group">
                  <Mail className="h-4 w-4 text-slate-400 group-focus-within:text-cyan-300 transition-colors duration-200 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nome@unopar.br"
                    className="login-glass-input w-full rounded-xl border border-white/15 bg-white/[0.05] pl-10 pr-3.5 py-3 text-sm text-white placeholder:text-slate-400/70 transition-all duration-200 hover:border-white/25 hover:bg-white/[0.07] focus:bg-white/[0.09] focus:border-cyan-400/60 focus:shadow-[0_0_0_3px_rgba(34,211,238,0.14)] focus:outline-none"
                  />
                </div>
              </div>

              {mode === "login" && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="password"
                      className="block text-xs font-medium tracking-wide text-slate-300"
                    >
                      Senha
                    </label>
                    <button
                      type="button"
                      onClick={() => switchMode("forgot")}
                      className="text-xs font-medium text-cyan-300/90 hover:text-cyan-200 transition-colors cursor-pointer"
                    >
                      Esqueci minha senha
                    </button>
                  </div>
                  <div className="relative group">
                    <Lock className="h-4 w-4 text-slate-400 group-focus-within:text-cyan-300 transition-colors duration-200 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="login-glass-input w-full rounded-xl border border-white/15 bg-white/[0.05] pl-10 pr-11 py-3 text-sm text-white placeholder:text-slate-400/70 transition-all duration-200 hover:border-white/25 hover:bg-white/[0.07] focus:bg-white/[0.09] focus:border-cyan-400/60 focus:shadow-[0_0_0_3px_rgba(34,211,238,0.14)] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={
                        showPassword ? "Ocultar senha" : "Mostrar senha"
                      }
                      aria-pressed={showPassword}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-white/10 focus-visible:text-cyan-300 focus-visible:bg-white/10 transition-colors cursor-pointer"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isPending}
                className="group relative w-full mt-2 overflow-hidden inline-flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-cyan-400 via-sky-400 to-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 shadow-[0_8px_30px_-6px_rgba(34,211,238,0.5)] hover:shadow-[0_12px_36px_-4px_rgba(34,211,238,0.68)] hover:brightness-105 active:scale-[0.99] focus-visible:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 cursor-pointer"
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                >
                  <span className="login-shimmer-track block h-full w-1/3 bg-gradient-to-r from-transparent via-white/45 to-transparent" />
                </span>
                {isPending ? (
                  <>
                    <svg
                      className="relative h-4 w-4 animate-spin text-slate-950"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                    >
                      <circle
                        cx="12"
                        cy="12"
                        r="9"
                        stroke="currentColor"
                        strokeOpacity="0.25"
                        strokeWidth="2.5"
                      />
                      <path
                        d="M21 12a9 9 0 0 0-9-9"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className="relative">
                      {mode === "forgot"
                        ? "Enviando link..."
                        : "Autenticando..."}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="relative">
                      {mode === "forgot"
                        ? "Enviar link de recuperação"
                        : "Entrar no Sistema"}
                    </span>
                    <ArrowRight className="relative h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                  </>
                )}
              </button>

              {mode === "forgot" && (
                <button
                  type="button"
                  onClick={() => switchMode("login")}
                  disabled={isPending}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.03] px-4 py-2.5 text-xs font-medium text-slate-300 hover:bg-white/[0.07] hover:text-white hover:border-white/25 disabled:opacity-60 transition-all cursor-pointer"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Voltar para o login</span>
                </button>
              )}
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
