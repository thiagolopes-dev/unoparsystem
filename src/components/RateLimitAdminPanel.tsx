"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  updateRateLimitConfigAction,
  unblockRateLimitIdentifierAction,
  unblockAllRateLimitAction,
} from "@/app/actions";
import {
  formatRemainingSecondsPtBr,
  RATE_LIMIT_EVENT_LABELS,
} from "@/domain/gestao-aulas";
import { Select, type SelectOption } from "@/components/ui/select";
import type { Database, RateLimitEventType } from "@/types/database.types";
import {
  Activity,
  Ban,
  CheckCircle2,
  Clock,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Unlock,
} from "lucide-react";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type RateLimitConfigRow =
  Database["public"]["Tables"]["rate_limit_config"]["Row"];
type RateLimitStateRow =
  Database["public"]["Tables"]["rate_limit_state"]["Row"];
type RateLimitAuditRow =
  Database["public"]["Tables"]["rate_limit_audit"]["Row"];

interface RateLimitAdminPanelProps {
  config: RateLimitConfigRow | null;
  states: RateLimitStateRow[];
  audits: RateLimitAuditRow[];
  usuarios: ProfileRow[];
  isPending: boolean;
  onRunAction: (
    fn: () => Promise<{ ok: boolean; error?: string; message?: string }>,
    onSuccess?: () => void,
    successTitle?: string
  ) => void;
}

const INPUT_CLASS =
  "login-glass-input h-10 w-full rounded-xl border border-white/15 bg-white/[0.05] px-3.5 text-xs font-mono text-slate-100 placeholder:text-slate-400/70 transition-all hover:border-white/25 focus:bg-white/[0.09] focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/15 focus:outline-none";

const EVENT_BADGE_STYLES: Record<RateLimitEventType, string> = {
  BLOCKED: "bg-rose-500/15 text-rose-200 border-rose-400/35",
  REJECTED_WHILE_BLOCKED: "bg-amber-500/15 text-amber-200 border-amber-400/35",
  UNBLOCKED_ADMIN: "bg-emerald-500/15 text-emerald-200 border-emerald-400/35",
  CONFIG_UPDATED: "bg-cyan-500/15 text-cyan-200 border-cyan-400/35",
};

const EVENT_FILTER_OPTIONS: SelectOption[] = [
  { value: "TODOS", label: "Todos os Eventos" },
  { value: "BLOCKED", label: "Bloqueado", dotColor: "bg-rose-400" },
  {
    value: "REJECTED_WHILE_BLOCKED",
    label: "Tentativa Bloqueada",
    dotColor: "bg-amber-400",
  },
  {
    value: "UNBLOCKED_ADMIN",
    label: "Liberado pelo Admin",
    dotColor: "bg-emerald-400",
  },
  {
    value: "CONFIG_UPDATED",
    label: "Parâmetro Alterado",
    dotColor: "bg-cyan-400",
  },
];

function formatDateTimePtBr(iso: string): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "medium",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function RateLimitAdminPanel({
  config,
  states,
  audits,
  usuarios,
  isPending,
  onRunAction,
}: RateLimitAdminPanelProps) {
  const router = useRouter();

  const [enabled, setEnabled] = useState<boolean>(config?.enabled ?? true);
  const [bypassAdmin, setBypassAdmin] = useState<boolean>(
    config?.bypass_admin ?? true
  );
  const [maxRequests, setMaxRequests] = useState<string>(
    String(config?.max_requests ?? 50)
  );
  const [windowSeconds, setWindowSeconds] = useState<string>(
    String(config?.window_seconds ?? 60)
  );
  const [blockMinutes, setBlockMinutes] = useState<string>(
    String(config?.block_duration_minutes ?? 15)
  );

  const [auditQuery, setAuditQuery] = useState<string>("");
  const [auditEventFilter, setAuditEventFilter] = useState<string>("TODOS");

  const userById = useMemo(
    () => new Map(usuarios.map((u) => [u.id, u])),
    [usuarios]
  );

  const nowMs = Date.now();

  const activeBlockedStates = useMemo(
    () =>
      states.filter(
        (s) => s.blocked_until && new Date(s.blocked_until).getTime() > nowMs
      ),
    [states, nowMs]
  );

  const filteredAudits = useMemo(() => {
    const q = auditQuery.trim().toLowerCase();
    return audits.filter((item) => {
      if (
        auditEventFilter !== "TODOS" &&
        item.event_type !== auditEventFilter
      ) {
        return false;
      }
      if (q) {
        const user = item.user_id ? userById.get(item.user_id) : undefined;
        const haystack = [
          item.identifier,
          item.user_email,
          user?.nome,
          item.ip_address,
          item.route,
          item.method,
          item.details,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [audits, auditQuery, auditEventFilter, userById]);

  const totalHistoricalBlocks = useMemo(
    () => states.reduce((acc, s) => acc + (s.total_blocks ?? 0), 0),
    [states]
  );

  return (
    <div className="space-y-4">
      {/* Resumo Rápido de Segurança / Rate Limit */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-[#0b1224]/65 backdrop-blur-xl border border-white/10 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
              Limite Configurado
            </span>
            <span
              className={`font-mono text-[10px] px-2 py-0.5 rounded-full border ${
                config?.enabled ?? true
                  ? "bg-emerald-400/12 text-emerald-200 border-emerald-400/30"
                  : "bg-amber-400/12 text-amber-200 border-amber-400/30"
              }`}
            >
              {config?.enabled ?? true ? "Ativo" : "Pausado"}
            </span>
          </div>
          <p className="text-xl font-semibold font-mono text-white mt-1.5">
            {config?.max_requests ?? 50} req / {config?.window_seconds ?? 60}s
          </p>
        </div>

        <div className="bg-[#0b1224]/65 backdrop-blur-xl border border-white/10 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
              Tempo de Bloqueio
            </span>
            <Clock className="h-3.5 w-3.5 text-cyan-300" />
          </div>
          <p className="text-xl font-semibold font-mono text-cyan-200 mt-1.5">
            {config?.block_duration_minutes ?? 15} minuto(s)
          </p>
        </div>

        <div
          className={`bg-[#0b1224]/65 backdrop-blur-xl border rounded-xl p-4 ${
            activeBlockedStates.length > 0
              ? "border-rose-400/40 bg-rose-500/[0.06]"
              : "border-white/10"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
              Bloqueados Atualmente
            </span>
            <ShieldAlert
              className={`h-3.5 w-3.5 ${
                activeBlockedStates.length > 0
                  ? "text-rose-300"
                  : "text-emerald-300"
              }`}
            />
          </div>
          <div className="flex items-baseline justify-between mt-1.5">
            <p
              className={`text-xl font-semibold font-mono ${
                activeBlockedStates.length > 0
                  ? "text-rose-200"
                  : "text-emerald-200"
              }`}
            >
              {activeBlockedStates.length}
            </p>
            <span className="text-[11px] font-mono text-slate-400">
              {totalHistoricalBlocks} bloqueio(s) acumulado(s)
            </span>
          </div>
        </div>
      </div>

      {/* Seção 1: Parâmetros Globais de Rate Limit */}
      <section className="bg-[#0b1224]/65 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/[0.08] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <SlidersHorizontal className="h-4 w-4 text-cyan-300 shrink-0" />
            <div>
              <h2 className="text-xs font-semibold text-white">
                Parâmetros de Rate Limit (Todas as Rotas)
              </h2>
              <p className="text-[11px] text-slate-400">
                Gerencie o limite de requisições, a janela de contagem e o tempo
                de bloqueio automático.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => router.refresh()}
            className="h-8 px-2.5 inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.04] text-[11px] font-medium text-slate-300 hover:bg-white/[0.09] hover:text-white transition-colors cursor-pointer shrink-0"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Atualizar</span>
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData();
            fd.set("enabled", enabled ? "true" : "false");
            fd.set("bypass_admin", bypassAdmin ? "true" : "false");
            fd.set("max_requests", maxRequests);
            fd.set("window_seconds", windowSeconds);
            fd.set("block_duration_minutes", blockMinutes);

            onRunAction(
              () => updateRateLimitConfigAction(fd),
              () => router.refresh(),
              "Parâmetros salvos"
            );
          }}
          className="p-4 sm:p-5 space-y-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-slate-200 cursor-pointer select-none hover:border-white/20 transition-colors">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-white/25 bg-white/[0.06] accent-cyan-400 cursor-pointer shrink-0"
              />
              <div>
                <span className="font-semibold text-white block">
                  Ativar Rate Limit global
                </span>
                <span className="text-[11px] text-slate-400">
                  Aplica o bloqueio automático HTTP 429 em todas as rotas quando
                  o limite for excedido.
                </span>
              </div>
            </label>

            <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-slate-200 cursor-pointer select-none hover:border-white/20 transition-colors">
              <input
                type="checkbox"
                checked={bypassAdmin}
                onChange={(e) => setBypassAdmin(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-white/25 bg-white/[0.06] accent-cyan-400 cursor-pointer shrink-0"
              />
              <div>
                <span className="font-semibold text-white block">
                  Isentar Administradores do bloqueio
                </span>
                <span className="text-[11px] text-slate-400">
                  Evita que administradores fiquem bloqueados ao operar a tela
                  de Parâmetros e Liberação.
                </span>
              </div>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label
                htmlFor="rl-max-requests"
                className="block text-xs font-medium text-slate-300 mb-1.5"
              >
                Máximo de Requisições *
              </label>
              <input
                id="rl-max-requests"
                type="number"
                min={1}
                max={10000}
                required
                value={maxRequests}
                onChange={(e) => setMaxRequests(e.target.value)}
                className={INPUT_CLASS}
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Padrão: 50 requisições por janela.
              </span>
            </div>

            <div>
              <label
                htmlFor="rl-window-seconds"
                className="block text-xs font-medium text-slate-300 mb-1.5"
              >
                Janela de Contagem (segundos) *
              </label>
              <input
                id="rl-window-seconds"
                type="number"
                min={10}
                max={86400}
                required
                value={windowSeconds}
                onChange={(e) => setWindowSeconds(e.target.value)}
                className={INPUT_CLASS}
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Ex: 60 = 1 minuto · 300 = 5 minutos.
              </span>
            </div>

            <div>
              <label
                htmlFor="rl-block-minutes"
                className="block text-xs font-medium text-slate-300 mb-1.5"
              >
                Tempo de Bloqueio (minutos) *
              </label>
              <input
                id="rl-block-minutes"
                type="number"
                min={1}
                max={10080}
                required
                value={blockMinutes}
                onChange={(e) => setBlockMinutes(e.target.value)}
                className={INPUT_CLASS}
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Tempo até liberação automática (ou liberação manual abaixo).
              </span>
            </div>
          </div>

          <div className="pt-1 flex items-center justify-between gap-3">
            <span className="text-[11px] font-mono text-slate-400">
              {config?.updated_at
                ? `Última atualização: ${formatDateTimePtBr(config.updated_at)}`
                : "Configuração padrão ativa"}
            </span>
            <button
              type="submit"
              disabled={isPending}
              className="h-9 inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-400 via-sky-400 to-emerald-400 px-4 text-xs font-semibold text-slate-950 shadow-[0_4px_20px_-4px_rgba(34,211,238,0.45)] hover:brightness-105 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              <Save className="h-3.5 w-3.5" />
              <span>Salvar Parâmetros</span>
            </button>
          </div>
        </form>
      </section>

      {/* Seção 2: Usuários & IPs Bloqueados (Liberação pelo Admin) */}
      <section className="bg-[#0b1224]/65 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/[0.08] flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <Ban className="h-4 w-4 text-rose-300 shrink-0" />
            <div>
              <h2 className="text-xs font-semibold text-white">
                Usuários e IPs Bloqueados
              </h2>
              <p className="text-[11px] text-slate-400">
                Libere imediatamente qualquer usuário ou IP bloqueado por
                excesso de requisições.
              </p>
            </div>
          </div>

          {activeBlockedStates.length > 0 && (
            <button
              type="button"
              disabled={isPending}
              onClick={() =>
                onRunAction(
                  () => unblockAllRateLimitAction(),
                  () => router.refresh(),
                  "Bloqueios liberados"
                )
              }
              className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/35 bg-emerald-400/12 text-[11px] font-medium text-emerald-200 hover:bg-emerald-400/20 hover:text-white disabled:opacity-40 transition-colors cursor-pointer"
            >
              <Unlock className="h-3.5 w-3.5" />
              <span>Liberar Todos ({activeBlockedStates.length})</span>
            </button>
          )}
        </div>

        {activeBlockedStates.length === 0 ? (
          <div className="p-8 text-center">
            <CheckCircle2 className="h-7 w-7 text-emerald-400/50 mx-auto mb-2" />
            <p className="text-xs font-medium text-slate-200">
              Nenhum usuário ou IP bloqueado no momento.
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Quando alguém ultrapassar {config?.max_requests ?? 50} requisições
              em {config?.window_seconds ?? 60}s, aparecerá aqui para liberação
              imediata.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03] font-mono text-[10px] uppercase tracking-wider text-slate-400">
                  <th className="py-2.5 px-4">Usuário / Identificador</th>
                  <th className="py-2.5 px-4 w-36">IP</th>
                  <th className="py-2.5 px-4">Consumo / Última Rota</th>
                  <th className="py-2.5 px-4 w-52">Bloqueado Até</th>
                  <th className="py-2.5 px-4 w-36 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06] text-xs">
                {activeBlockedStates.map((row) => {
                  const u = row.user_id ? userById.get(row.user_id) : undefined;
                  const remSeconds = row.blocked_until
                    ? Math.max(
                        0,
                        (new Date(row.blocked_until).getTime() - nowMs) / 1000
                      )
                    : 0;
                  return (
                    <tr
                      key={row.identifier}
                      className="h-12 hover:bg-white/[0.04] transition-colors"
                    >
                      <td className="py-2 px-4 whitespace-nowrap">
                        <span className="font-medium text-white block">
                          {u?.nome ??
                            row.user_email ??
                            "Acesso Anônimo (IP)"}
                        </span>
                        <span className="font-mono text-[11px] text-slate-400">
                          {u?.email ?? row.identifier}
                        </span>
                      </td>
                      <td className="py-2 px-4 font-mono text-[11px] text-slate-300 whitespace-nowrap">
                        {row.ip_address ?? "—"}
                      </td>
                      <td className="py-2 px-4 whitespace-nowrap">
                        <span className="font-mono text-[11px] text-rose-200 font-semibold">
                          {row.request_count} req
                        </span>
                        {row.last_route && (
                          <span className="font-mono text-[11px] text-slate-400 ml-2">
                            · {row.last_route}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-4 whitespace-nowrap">
                        <span className="font-mono text-[11px] text-rose-200 block">
                          {row.blocked_until
                            ? formatDateTimePtBr(row.blocked_until)
                            : "—"}
                        </span>
                        <span className="font-mono text-[10px] text-amber-300">
                          Restam {formatRemainingSecondsPtBr(remSeconds)}
                        </span>
                      </td>
                      <td className="py-2 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() =>
                            onRunAction(
                              () =>
                                unblockRateLimitIdentifierAction(
                                  row.identifier
                                ),
                              () => router.refresh(),
                              "Acesso liberado"
                            )
                          }
                          className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/35 bg-emerald-400/12 text-[11px] font-semibold text-emerald-200 hover:bg-emerald-400/22 hover:text-white disabled:opacity-40 transition-colors cursor-pointer"
                        >
                          <Unlock className="h-3.5 w-3.5" />
                          <span>Liberar</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Seção 3: Auditoria Completa de Rate Limit */}
      <section className="bg-[#0b1224]/65 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Activity className="h-4 w-4 text-cyan-300 shrink-0" />
            <div>
              <h2 className="text-xs font-semibold text-white">
                Auditoria de Rate Limit
              </h2>
              <p className="text-[11px] text-slate-400">
                Histórico de bloqueios aplicados, tentativas rejeitadas,
                liberações manuais e alterações de parâmetros.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-56">
              <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={auditQuery}
                onChange={(e) => setAuditQuery(e.target.value)}
                placeholder="Filtrar e-mail, IP ou rota..."
                className="h-9 w-full rounded-lg border border-white/12 bg-white/[0.04] pl-8 pr-3 text-xs text-slate-100 placeholder:text-slate-400 hover:border-white/25 focus:border-cyan-400/60 focus:bg-white/[0.08] focus:outline-none transition-all"
              />
            </div>

            <div className="w-48">
              <Select
                size="sm"
                align="right"
                searchable={false}
                value={auditEventFilter}
                onChange={setAuditEventFilter}
                options={EVENT_FILTER_OPTIONS}
              />
            </div>
          </div>
        </div>

        {filteredAudits.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            Nenhum evento de auditoria encontrado para os filtros selecionados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03] font-mono text-[10px] uppercase tracking-wider text-slate-400">
                  <th className="py-2.5 px-4 w-40">Data / Hora</th>
                  <th className="py-2.5 px-4 w-44">Evento</th>
                  <th className="py-2.5 px-4">Usuário / IP</th>
                  <th className="py-2.5 px-4 w-36">Rota</th>
                  <th className="py-2.5 px-4 w-24">Req / Lim</th>
                  <th className="py-2.5 px-4">Detalhes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06] text-xs">
                {filteredAudits.map((item) => {
                  const u = item.user_id
                    ? userById.get(item.user_id)
                    : undefined;
                  return (
                    <tr
                      key={item.id}
                      className="h-11 hover:bg-white/[0.04] transition-colors"
                    >
                      <td className="py-2 px-4 font-mono text-[11px] text-slate-300 whitespace-nowrap">
                        {formatDateTimePtBr(item.created_at)}
                      </td>
                      <td className="py-2 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center font-mono text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                            EVENT_BADGE_STYLES[item.event_type]
                          }`}
                        >
                          {RATE_LIMIT_EVENT_LABELS[item.event_type]}
                        </span>
                      </td>
                      <td className="py-2 px-4 whitespace-nowrap">
                        <span className="font-medium text-slate-100 block">
                          {u?.nome ??
                            item.user_email ??
                            item.identifier}
                        </span>
                        <span className="font-mono text-[10px] text-slate-400">
                          {item.ip_address
                            ? `IP ${item.ip_address}`
                            : item.identifier}
                        </span>
                      </td>
                      <td className="py-2 px-4 font-mono text-[11px] text-cyan-200 whitespace-nowrap">
                        <span className="text-slate-400 mr-1">
                          {item.method}
                        </span>
                        {item.route}
                      </td>
                      <td className="py-2 px-4 font-mono text-[11px] text-slate-200 whitespace-nowrap">
                        {item.event_type === "CONFIG_UPDATED"
                          ? `— / ${item.limit_threshold}`
                          : `${item.request_count} / ${item.limit_threshold}`}
                      </td>
                      <td className="py-2 px-4 text-[11px] text-slate-300 max-w-xs truncate">
                        {item.details ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
