"use client";

import { useState, useEffect, useCallback, useRef, useTransition } from "react";
import {
  acceptTermoUsoAction,
  completeFirstAccessPasswordAction,
  logoutAction,
} from "@/app/actions";
import { Dialog } from "@/components/ui/dialog";
import type { Database } from "@/types/database.types";
import {
  AlertCircle,
  AlertTriangle,
  ArrowDown,
  CheckCircle2,
  Eye,
  EyeOff,
  FileText,
  KeyRound,
  Loader2,
  Lock,
  LogOut,
  MapPin,
  ShieldCheck,
} from "lucide-react";

type TermoUsoRow = Database["public"]["Tables"]["termos_uso"]["Row"];

interface FirstAccessOnboardingModalProps {
  activeTermo: TermoUsoRow | null;
  initialNeedsAcceptTerms: boolean;
  initialNeedsChangePassword: boolean;
  userName: string;
  onCompleted?: (message: string) => void;
}

const INPUT_CLASS =
  "login-glass-input h-10 w-full rounded-xl border border-white/15 bg-white/[0.05] pl-10 pr-11 text-xs text-slate-100 placeholder:text-slate-400/70 transition-all hover:border-white/25 focus:bg-white/[0.09] focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/15 focus:outline-none";

function requestBrowserGeolocation(): Promise<{
  latitude: number;
  longitude: number;
  accuracy: number | null;
}> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      reject(
        new Error(
          "Seu navegador não suporta geolocalização. Utilize um navegador compatível com localização ativa para confirmar os Termos de Uso."
        )
      );
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: Number.isFinite(position.coords.accuracy)
            ? position.coords.accuracy
            : null,
        });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          reject(
            new Error(
              "Localização desativada ou bloqueada. Ative a permissão de localização no navegador (ícone na barra de endereço) para habilitar a confirmação dos Termos de Uso."
            )
          );
          return;
        }
        if (err.code === err.POSITION_UNAVAILABLE) {
          reject(
            new Error(
              "Localização indisponível no dispositivo. Ative os serviços de localização para liberar a confirmação dos Termos de Uso."
            )
          );
          return;
        }
        reject(
          new Error(
            "Não foi possível obter sua localização automaticamente (tempo esgotado). Verifique se a localização está ativa no navegador e recarregue a página."
          )
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  });
}

export function FirstAccessOnboardingModal({
  activeTermo,
  initialNeedsAcceptTerms,
  initialNeedsChangePassword,
  userName,
  onCompleted,
}: FirstAccessOnboardingModalProps) {
  const [needsTerms, setNeedsTerms] = useState(initialNeedsAcceptTerms);
  const [needsPassword, setNeedsPassword] = useState(
    initialNeedsChangePassword
  );

  useEffect(() => {
    setNeedsTerms(initialNeedsAcceptTerms);
  }, [initialNeedsAcceptTerms]);

  useEffect(() => {
    setNeedsPassword(initialNeedsChangePassword);
  }, [initialNeedsChangePassword]);

  // Estado da Etapa 1: Termos de Uso + Leitura Completa + Geolocalização Automática
  const [agreed, setAgreed] = useState(false);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const termsScrollRef = useRef<HTMLDivElement>(null);
  const [geoStatus, setGeoStatus] = useState<
    "locating" | "captured" | "error"
  >("locating");
  const [geoCoords, setGeoCoords] = useState<{
    latitude: number;
    longitude: number;
    accuracy: number | null;
  } | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isTermSubmitting, setIsTermSubmitting] = useState(false);

  // Estado da Etapa 2: Nova Senha Obrigatória
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isPasswordPending, startPasswordTransition] = useTransition();

  const totalSteps =
    initialNeedsAcceptTerms && initialNeedsChangePassword ? 2 : 1;

  const captureLocationAutomatically = useCallback(async () => {
    setGeoStatus("locating");
    setGeoError(null);
    try {
      const coords = await requestBrowserGeolocation();
      setGeoCoords(coords);
      setGeoStatus("captured");
      setGeoError(null);
    } catch (err) {
      setGeoCoords(null);
      setGeoStatus("error");
      setAgreed(false);
      setGeoError(
        err instanceof Error
          ? err.message
          : "Localização desativada. Ative a localização para continuar."
      );
    }
  }, []);

  // Captura automática ao abrir o modal de Termos + reação automática quando o usuário reativar a permissão
  useEffect(() => {
    if (!needsTerms || !activeTermo) return;

    let cancelled = false;
    let permissionStatus: PermissionStatus | null = null;

    async function runInitialCapture() {
      if (cancelled) return;
      await captureLocationAutomatically();
    }

    runInitialCapture();

    if (typeof navigator !== "undefined" && navigator.permissions?.query) {
      navigator.permissions
        .query({ name: "geolocation" })
        .then((status) => {
          if (cancelled) return;
          permissionStatus = status;
          status.onchange = () => {
            if (cancelled) return;
            if (status.state === "granted" || status.state === "prompt") {
              captureLocationAutomatically();
            } else {
              setGeoCoords(null);
              setGeoStatus("error");
              setAgreed(false);
              setGeoError(
                "Localização desativada ou bloqueada. Ative a permissão de localização no navegador (ícone na barra de endereço) para habilitar a confirmação dos Termos de Uso."
              );
            }
          };
        })
        .catch(() => {
          // Alguns navegadores não suportam navigator.permissions para geolocation
        });
    }

    function handleWindowFocus() {
      if (cancelled) return;
      setGeoStatus((current) => {
        if (current === "error") {
          void captureLocationAutomatically();
        }
        return current;
      });
    }

    window.addEventListener("focus", handleWindowFocus);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", handleWindowFocus);
      if (permissionStatus) {
        permissionStatus.onchange = null;
      }
    };
  }, [needsTerms, activeTermo, captureLocationAutomatically]);

  const checkTermsScrollBottom = useCallback(() => {
    const el = termsScrollRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 12) {
      setHasScrolledToBottom(true);
    }
  }, []);

  // Reseta a verificação de leitura quando muda o termo e libera automaticamente se o texto couber sem rolagem
  useEffect(() => {
    if (!needsTerms || !activeTermo) return;
    setHasScrolledToBottom(false);
    setAgreed(false);
    const frame = window.requestAnimationFrame(() => {
      checkTermsScrollBottom();
    });
    window.addEventListener("resize", checkTermsScrollBottom);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", checkTermsScrollBottom);
    };
  }, [needsTerms, activeTermo?.id, checkTermsScrollBottom]);

  const hasValidLocation = geoStatus === "captured" && geoCoords !== null;
  const canAgreeTerms = hasValidLocation && hasScrolledToBottom;

  async function handleAcceptTerms() {
    if (!activeTermo || !canAgreeTerms || !agreed || !geoCoords) return;

    setSubmitError(null);
    setIsTermSubmitting(true);

    try {
      const res = await acceptTermoUsoAction({
        termoId: activeTermo.id,
        latitude: geoCoords.latitude,
        longitude: geoCoords.longitude,
        accuracy: geoCoords.accuracy,
      });

      if (!res.ok) {
        setSubmitError(res.error ?? "Erro ao registrar o aceite dos termos.");
        return;
      }

      setNeedsTerms(false);
      if (!needsPassword) {
        onCompleted?.(res.message ?? "Termos de uso aceitos com sucesso.");
      }
    } finally {
      setIsTermSubmitting(false);
    }
  }

  function handleSaveNewPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPasswordError(null);

    if (password.length < 6) {
      setPasswordError("A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setPasswordError("As senhas informadas não coincidem.");
      return;
    }

    const formData = new FormData(e.currentTarget);
    startPasswordTransition(async () => {
      const res = await completeFirstAccessPasswordAction(formData);
      if (!res.ok) {
        setPasswordError(
          res.error ?? "Não foi possível definir a nova senha."
        );
        return;
      }
      setNeedsPassword(false);
      setPassword("");
      setConfirmPassword("");
      onCompleted?.(res.message ?? "Nova senha salva com sucesso!");
    });
  }

  // Etapa 1: Termo de Uso obrigatório com captura automática de Latitude e Longitude
  if (needsTerms && activeTermo) {
    return (
      <Dialog
        open
        dismissible={false}
        maxWidthClass="max-w-2xl"
        eyebrow={
          totalSteps === 2
            ? "Primeiro Acesso · Etapa 1 de 2"
            : "Conformidade Obrigatória"
        }
        title={activeTermo.titulo}
        description={`Olá, ${userName}. Para continuar utilizando o UnoparSystem, leia e aceite os Termos de Uso vigentes (v${activeTermo.versao}).`}
      >
        <div className="space-y-3.5">
          <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-slate-400">
            <span className="inline-flex items-center gap-1.5 text-cyan-300">
              <FileText className="h-3.5 w-3.5" />
              Versão {activeTermo.versao}
            </span>
            <span className="px-2 py-0.5 rounded-md border border-emerald-400/25 bg-emerald-400/10 text-emerald-200">
              Termo Vigente
            </span>
          </div>

          {/* Texto completo do Termo com detecção obrigatória de rolagem até o fim */}
          <div className="space-y-1.5">
            <div className="relative">
              <div
                ref={termsScrollRef}
                onScroll={checkTermsScrollBottom}
                className="max-h-52 overflow-y-auto rounded-xl border border-white/12 bg-[#060b18]/80 p-4 text-xs leading-relaxed text-slate-200 whitespace-pre-wrap"
              >
                {activeTermo.conteudo}
              </div>

              {!hasScrolledToBottom && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-px bottom-px h-10 rounded-b-xl bg-gradient-to-t from-[#060b18] via-[#060b18]/75 to-transparent"
                />
              )}
            </div>

            {!hasScrolledToBottom ? (
              <p className="flex items-center gap-1.5 text-[11px] text-amber-300/95">
                <ArrowDown className="h-3.5 w-3.5 shrink-0 animate-bounce" />
                <span>
                  Role até o final do termo para habilitar a declaração de
                  aceite.
                </span>
              </p>
            ) : (
              <p className="flex items-center gap-1.5 text-[11px] text-emerald-300/90">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                <span>Leitura do termo concluída.</span>
              </p>
            )}
          </div>

          {/* Status automático de Geolocalização (sem botão manual) */}
          {geoStatus === "locating" && (
            <div className="rounded-xl border border-cyan-400/25 bg-cyan-400/[0.06] px-3.5 py-3 flex items-center gap-2.5 text-xs text-cyan-100">
              <Loader2 className="h-4 w-4 text-cyan-300 animate-spin shrink-0" />
              <span>
                Obtendo sua geolocalização automaticamente para habilitar a
                confirmação dos termos...
              </span>
            </div>
          )}

          {geoStatus === "captured" && geoCoords && (
            <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/[0.08] px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 text-emerald-200">
                <MapPin className="h-4 w-4 text-emerald-300 shrink-0" />
                <span>Geolocalização identificada automaticamente</span>
              </div>
              <span className="font-mono text-[11px] text-emerald-300/90 shrink-0">
                {geoCoords.latitude.toFixed(6)}, {geoCoords.longitude.toFixed(6)}
              </span>
            </div>
          )}

          {geoStatus === "error" && (
            <div
              role="alert"
              className="rounded-xl border border-amber-400/35 bg-amber-500/10 p-3.5 flex items-start gap-2.5 text-xs text-amber-100"
            >
              <AlertTriangle className="h-4 w-4 text-amber-300 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-amber-200">
                  Geolocalização obrigatória desativada
                </p>
                <p className="text-amber-100/90 leading-relaxed">
                  {geoError ??
                    "Ative a permissão de localização no navegador para habilitar a confirmação dos Termos de Uso."}
                </p>
              </div>
            </div>
          )}

          {submitError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-xs text-rose-200"
            >
              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{submitError}</span>
            </div>
          )}

          {/* Checkbox de confirmação (habilitado apenas após rolar até o final do termo e com localização ativa) */}
          <label
            className={`flex items-start gap-2.5 rounded-xl border p-3 text-xs select-none transition-colors ${
              canAgreeTerms
                ? "border-white/10 bg-white/[0.03] text-slate-200 cursor-pointer hover:border-white/20"
                : "border-white/[0.07] bg-white/[0.02] text-slate-500 cursor-not-allowed opacity-60"
            }`}
          >
            <input
              type="checkbox"
              disabled={!canAgreeTerms || isTermSubmitting}
              checked={agreed}
              onChange={(e) => {
                setAgreed(e.target.checked);
                if (e.target.checked) setSubmitError(null);
              }}
              className="mt-0.5 h-4 w-4 rounded border-white/25 bg-white/[0.06] accent-cyan-400 cursor-pointer disabled:cursor-not-allowed shrink-0"
            />
            <span>
              Declaro que li e aceito integralmente os{" "}
              <strong
                className={canAgreeTerms ? "text-white" : "text-slate-400"}
              >
                Termos de Uso
              </strong>{" "}
              acima e autorizo o registro da minha{" "}
              <strong
                className={canAgreeTerms ? "text-white" : "text-slate-400"}
              >
                latitude e longitude
              </strong>{" "}
              para fins de auditoria.
            </span>
          </label>

          <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-white/10">
            <form action={logoutAction}>
              <button
                type="submit"
                disabled={isTermSubmitting}
                className="h-9 px-3.5 inline-flex items-center gap-1.5 rounded-xl border border-white/12 bg-white/[0.04] text-xs font-medium text-slate-300 hover:bg-white/[0.09] hover:text-white transition-colors cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sair</span>
              </button>
            </form>

            <button
              type="button"
              onClick={handleAcceptTerms}
              disabled={!canAgreeTerms || !agreed || isTermSubmitting}
              className="h-9 inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-400 via-sky-400 to-emerald-400 px-4 text-xs font-semibold text-slate-950 shadow-[0_4px_20px_-4px_rgba(34,211,238,0.45)] hover:brightness-105 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>
                {isTermSubmitting
                  ? "Registrando aceite..."
                  : "Confirmar e Aceitar Termos"}
              </span>
            </button>
          </div>
        </div>
      </Dialog>
    );
  }

  // Etapa 2: Dialog NÃO FECHÁVEL exigindo definição de Nova Senha
  if (needsPassword) {
    return (
      <Dialog
        open
        dismissible={false}
        maxWidthClass="max-w-md"
        eyebrow={
          totalSteps === 2
            ? "Primeiro Acesso · Etapa 2 de 2"
            : "Segurança Obrigatória"
        }
        title="Crie sua Nova Senha"
        description="Para proteger sua conta, defina uma nova senha pessoal antes de acessar o sistema. Esta etapa é obrigatória."
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 p-3 flex items-center gap-2.5 text-xs text-emerald-200">
            <ShieldCheck className="h-4 w-4 text-emerald-300 shrink-0" />
            <span>
              Termos de uso confirmados. Agora cadastre sua nova senha pessoal.
            </span>
          </div>

          {passwordError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-xs text-rose-200"
            >
              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{passwordError}</span>
            </div>
          )}

          <form onSubmit={handleSaveNewPassword} className="space-y-4">
            <div>
              <label
                htmlFor="first-access-password"
                className="block text-xs font-medium text-slate-300 mb-1.5"
              >
                Nova Senha *
              </label>
              <div className="relative">
                <Lock className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="first-access-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo de 6 caracteres"
                  className={INPUT_CLASS}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-cyan-300 cursor-pointer"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="first-access-confirm-password"
                className="block text-xs font-medium text-slate-300 mb-1.5"
              >
                Confirmar Nova Senha *
              </label>
              <div className="relative">
                <KeyRound className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="first-access-confirm-password"
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a nova senha"
                  className={INPUT_CLASS}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  aria-label={
                    showConfirmPassword
                      ? "Ocultar confirmação"
                      : "Mostrar confirmação"
                  }
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-cyan-300 cursor-pointer"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end">
              <button
                type="submit"
                disabled={isPasswordPending}
                className="w-full h-10 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 via-sky-400 to-emerald-400 px-4 text-xs font-semibold text-slate-950 shadow-[0_4px_20px_-4px_rgba(34,211,238,0.45)] hover:brightness-105 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                <KeyRound className="h-4 w-4" />
                <span>
                  {isPasswordPending
                    ? "Salvando nova senha..."
                    : "Salvar Nova Senha e Acessar"}
                </span>
              </button>
            </div>
          </form>
        </div>
      </Dialog>
    );
  }

  return null;
}
