"use client";

import { useState, useMemo, useTransition } from "react";
import {
  createAulaAction,
  updateAulaStatusAction,
  deleteAulaAction,
  createDisciplinaAction,
  deleteDisciplinaAction,
  createTurmaAction,
  deleteTurmaAction,
  createProfessorAction,
  deleteProfessorAction,
  logoutAction,
} from "@/app/actions";
import {
  detectScheduleConflict,
  canManageCatalog,
  canUpdateAula,
  STATUS_LABELS,
  TURNO_LABELS,
} from "@/domain/gestao-aulas";
import type {
  AulaStatus,
  Database,
  TurnoTipo,
  UserRole,
} from "@/types/database.types";
import {
  BookOpen,
  Calendar,
  Clock,
  GraduationCap,
  Layers,
  LogOut,
  Plus,
  Trash2,
  Users,
  CheckCircle2,
  AlertTriangle,
  PlayCircle,
  XCircle,
  Filter,
  Shield,
  MapPin,
} from "lucide-react";

type DisciplinaRow = Database["public"]["Tables"]["disciplinas"]["Row"];
type TurmaRow = Database["public"]["Tables"]["turmas"]["Row"];
type ProfessorRow = Database["public"]["Tables"]["professores"]["Row"];
type AulaRow = Database["public"]["Tables"]["aulas"]["Row"];

export interface AulaEnriched extends AulaRow {
  disciplina?: Pick<DisciplinaRow, "id" | "codigo" | "nome"> | null;
  turma?: Pick<TurmaRow, "id" | "codigo" | "nome" | "turno" | "periodo"> | null;
  professor?: Pick<
    ProfessorRow,
    "id" | "nome" | "email" | "titulacao" | "user_id"
  > | null;
}

interface GestaoAulasAppProps {
  currentUser: {
    id: string;
    nome: string;
    email: string;
    role: UserRole;
  };
  disciplinas: DisciplinaRow[];
  turmas: TurmaRow[];
  professores: ProfessorRow[];
  aulas: AulaEnriched[];
}

type ActiveTab = "aulas" | "disciplinas" | "turmas" | "professores";

const STATUS_BADGE_STYLES: Record<AulaStatus, string> = {
  AGENDADA: "bg-zinc-100 text-zinc-800 border-zinc-200",
  EM_ANDAMENTO: "bg-amber-50 text-amber-800 border-amber-200",
  CONCLUIDA: "bg-emerald-50 text-emerald-800 border-emerald-200",
  CANCELADA: "bg-red-50 text-red-700 border-red-200 line-through",
};

export function GestaoAulasApp({
  currentUser,
  disciplinas,
  turmas,
  professores,
  aulas,
}: GestaoAulasAppProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>("aulas");
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  // Filtros da Grade de Aulas
  const [filterDate, setFilterDate] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("TODOS");
  const [filterTurmaId, setFilterTurmaId] = useState<string>("TODAS");
  const [filterProfId, setFilterProfId] = useState<string>("TODOS");
  const [onlyMyClasses, setOnlyMyClasses] = useState<boolean>(
    currentUser.role === "PROFESSOR"
  );

  // Estado do formulário de Nova Aula para pré-validação em tempo real de choque de horário
  const todayIso = new Date().toISOString().slice(0, 10);
  const [draftAula, setDraftAula] = useState({
    disciplina_id: disciplinas[0]?.id ?? "",
    turma_id: turmas[0]?.id ?? "",
    professor_id: professores[0]?.id ?? "",
    data_aula: todayIso,
    hora_inicio: "19:00",
    hora_fim: "20:40",
    status: "AGENDADA" as AulaStatus,
    sala: "",
    conteudo_programatico: "",
    observacoes: "",
  });

  const isAdmin = canManageCatalog(currentUser.role);

  // Checagem instantânea de conflito de horário no cliente antes mesmo de enviar
  const liveConflict = useMemo(() => {
    if (
      !draftAula.professor_id ||
      !draftAula.turma_id ||
      !draftAula.data_aula ||
      !draftAula.hora_inicio ||
      !draftAula.hora_fim
    ) {
      return null;
    }
    if (draftAula.hora_fim <= draftAula.hora_inicio) {
      return {
        hasConflict: true,
        message: "O horário final deve ser maior que o horário inicial.",
      };
    }
    const result = detectScheduleConflict(draftAula, aulas);
    return result.hasConflict ? result : null;
  }, [draftAula, aulas]);

  const filteredAulas = useMemo(() => {
    return aulas.filter((aula) => {
      if (filterDate && aula.data_aula !== filterDate) return false;
      if (filterStatus !== "TODOS" && aula.status !== filterStatus)
        return false;
      if (filterTurmaId !== "TODAS" && aula.turma_id !== filterTurmaId)
        return false;
      if (filterProfId !== "TODOS" && aula.professor_id !== filterProfId)
        return false;
      if (
        onlyMyClasses &&
        aula.professor?.user_id &&
        aula.professor.user_id !== currentUser.id
      ) {
        return false;
      }
      return true;
    });
  }, [
    aulas,
    filterDate,
    filterStatus,
    filterTurmaId,
    filterProfId,
    onlyMyClasses,
    currentUser.id,
  ]);

  // Métricas rápidas da grade
  const metrics = useMemo(() => {
    return {
      total: aulas.length,
      agendadas: aulas.filter((a) => a.status === "AGENDADA").length,
      emAndamento: aulas.filter((a) => a.status === "EM_ANDAMENTO").length,
      concluidas: aulas.filter((a) => a.status === "CONCLUIDA").length,
    };
  }, [aulas]);

  function runAction(
    fn: () => Promise<{ ok: boolean; error?: string; message?: string }>,
    onSuccess?: () => void
  ) {
    setFeedback(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        setFeedback({
          type: "error",
          text: res.error ?? "Não foi possível concluir a operação.",
        });
      } else {
        setFeedback({
          type: "success",
          text: res.message ?? "Operação realizada com sucesso.",
        });
        onSuccess?.();
      }
    });
  }

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 text-zinc-950">
      {/* Top Bar Minimalista */}
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-zinc-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-zinc-950 text-white flex items-center justify-center font-mono text-xs font-bold">
              UN
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm tracking-tight">
                  UnoparSystem
                </span>
                <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border border-zinc-200 bg-zinc-50 text-zinc-600">
                  Gestão de Aulas
                </span>
              </div>
              <p className="text-xs text-zinc-500 hidden sm:block">
                Controle acadêmico de disciplinas, turmas, corpo docente e diário de aulas
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden md:block">
              <div className="flex items-center justify-end gap-1.5">
                <span className="text-xs font-medium text-zinc-900">
                  {currentUser.nome}
                </span>
                <span
                  className={`font-mono text-[10px] uppercase px-1.5 py-0.5 rounded ${
                    isAdmin
                      ? "bg-zinc-950 text-white"
                      : "bg-zinc-200 text-zinc-800"
                  }`}
                >
                  {currentUser.role}
                </span>
              </div>
              <span className="text-[11px] font-mono text-zinc-500 block">
                {currentUser.email}
              </span>
            </div>

            <form action={logoutAction}>
              <button
                type="submit"
                title="Sair do sistema"
                className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950 transition-colors cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sair</span>
              </button>
            </form>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-8 flex items-center gap-1 overflow-x-auto border-t border-zinc-100">
          {[
            {
              id: "aulas" as const,
              label: "Grade de Aulas",
              count: aulas.length,
              icon: Calendar,
            },
            {
              id: "disciplinas" as const,
              label: "Disciplinas",
              count: disciplinas.length,
              icon: BookOpen,
            },
            {
              id: "turmas" as const,
              label: "Turmas",
              count: turmas.length,
              icon: Layers,
            },
            {
              id: "professores" as const,
              label: "Professores",
              count: professores.length,
              icon: GraduationCap,
            },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  setFeedback(null);
                }}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                  active
                    ? "border-zinc-950 text-zinc-950"
                    : "border-transparent text-zinc-500 hover:text-zinc-800"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
                <span
                  className={`font-mono text-[10px] px-1.5 py-0.2 rounded-full ${
                    active
                      ? "bg-zinc-950 text-white"
                      : "bg-zinc-100 text-zinc-600"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-8 py-8 flex-1 space-y-6">
        {/* KPI Strip */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white border border-zinc-200 rounded-xl p-4">
            <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-400">
              Total de Aulas
            </span>
            <p className="text-2xl font-semibold mt-1 font-mono">
              {metrics.total}
            </p>
          </div>
          <div className="bg-white border border-zinc-200 rounded-xl p-4">
            <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">
              Agendadas
            </span>
            <p className="text-2xl font-semibold mt-1 font-mono text-zinc-900">
              {metrics.agendadas}
            </p>
          </div>
          <div className="bg-white border border-zinc-200 rounded-xl p-4">
            <span className="font-mono text-[11px] uppercase tracking-wider text-amber-700">
              Em Andamento
            </span>
            <p className="text-2xl font-semibold mt-1 font-mono text-amber-700">
              {metrics.emAndamento}
            </p>
          </div>
          <div className="bg-white border border-zinc-200 rounded-xl p-4">
            <span className="font-mono text-[11px] uppercase tracking-wider text-emerald-700">
              Concluídas
            </span>
            <p className="text-2xl font-semibold mt-1 font-mono text-emerald-700">
              {metrics.concluidas}
            </p>
          </div>
        </section>

        {/* RBAC Notice Banner for Professor */}
        {!isAdmin && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-xs text-zinc-600">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-zinc-900 shrink-0" />
              <span>
                Modo <strong>Professor</strong> ativo: você pode consultar toda a
                grade e atualizar o <strong>Status da Aula</strong> das aulas alocadas ao seu perfil.
              </span>
            </div>
            <span className="font-mono text-[11px] text-zinc-400 shrink-0">
              RLS Policy: aulas_update_admin_or_assigned_professor
            </span>
          </div>
        )}

        {/* Global Feedback Toast */}
        {feedback && (
          <div
            role="status"
            className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-xs font-medium ${
              feedback.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-red-200 bg-red-50 text-red-900"
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.type === "success" ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
              )}
              <span>{feedback.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-[11px] underline opacity-75 hover:opacity-100 cursor-pointer"
            >
              Fechar
            </button>
          </div>
        )}

        {/* ===================================================================
            TAB 1: GRADE DE AULAS
           =================================================================== */}
        {activeTab === "aulas" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Formulário de Agendamento (Visível para ADMIN) */}
            {isAdmin && (
              <section className="lg:col-span-4 bg-white border border-zinc-200 rounded-2xl p-6 space-y-4">
                <div className="border-b border-zinc-100 pb-3">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-400">
                    Agendamento Acadêmico
                  </span>
                  <h2 className="text-base font-semibold text-zinc-950">
                    Nova Aula na Grade
                  </h2>
                </div>

                {liveConflict && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>{liveConflict.message}</span>
                  </div>
                )}

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    runAction(() => createAulaAction(fd), () => {
                      setDraftAula((prev) => ({
                        ...prev,
                        conteudo_programatico: "",
                        observacoes: "",
                      }));
                    });
                  }}
                  className="space-y-3.5"
                >
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">
                      Disciplina *
                    </label>
                    <select
                      name="disciplina_id"
                      required
                      value={draftAula.disciplina_id}
                      onChange={(e) =>
                        setDraftAula({
                          ...draftAula,
                          disciplina_id: e.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 py-2 text-xs text-zinc-950 focus:bg-white focus:border-zinc-900 focus:outline-none"
                    >
                      {disciplinas.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.codigo} — {d.nome}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">
                      Turma *
                    </label>
                    <select
                      name="turma_id"
                      required
                      value={draftAula.turma_id}
                      onChange={(e) =>
                        setDraftAula({ ...draftAula, turma_id: e.target.value })
                      }
                      className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 py-2 text-xs text-zinc-950 focus:bg-white focus:border-zinc-900 focus:outline-none"
                    >
                      {turmas.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.codigo} — {t.nome} ({TURNO_LABELS[t.turno]})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">
                      Professor(a) *
                    </label>
                    <select
                      name="professor_id"
                      required
                      value={draftAula.professor_id}
                      onChange={(e) =>
                        setDraftAula({
                          ...draftAula,
                          professor_id: e.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 py-2 text-xs text-zinc-950 focus:bg-white focus:border-zinc-900 focus:outline-none"
                    >
                      {professores.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nome} ({p.titulacao})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-1">
                      <label className="block text-xs font-medium text-zinc-700 mb-1">
                        Data *
                      </label>
                      <input
                        type="date"
                        name="data_aula"
                        required
                        value={draftAula.data_aula}
                        onChange={(e) =>
                          setDraftAula({
                            ...draftAula,
                            data_aula: e.target.value,
                          })
                        }
                        className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-2.5 py-2 text-xs font-mono text-zinc-950 focus:bg-white focus:border-zinc-900 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1">
                        Início *
                      </label>
                      <input
                        type="time"
                        name="hora_inicio"
                        required
                        value={draftAula.hora_inicio}
                        onChange={(e) =>
                          setDraftAula({
                            ...draftAula,
                            hora_inicio: e.target.value,
                          })
                        }
                        className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-2.5 py-2 text-xs font-mono text-zinc-950 focus:bg-white focus:border-zinc-900 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1">
                        Término *
                      </label>
                      <input
                        type="time"
                        name="hora_fim"
                        required
                        value={draftAula.hora_fim}
                        onChange={(e) =>
                          setDraftAula({
                            ...draftAula,
                            hora_fim: e.target.value,
                          })
                        }
                        className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-2.5 py-2 text-xs font-mono text-zinc-950 focus:bg-white focus:border-zinc-900 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1">
                        Status Inicial
                      </label>
                      <select
                        name="status"
                        value={draftAula.status}
                        onChange={(e) =>
                          setDraftAula({
                            ...draftAula,
                            status: e.target.value as AulaStatus,
                          })
                        }
                        className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 py-2 text-xs text-zinc-950 focus:bg-white focus:border-zinc-900 focus:outline-none"
                      >
                        <option value="AGENDADA">Agendada</option>
                        <option value="EM_ANDAMENTO">Em Andamento</option>
                        <option value="CONCLUIDA">Concluída</option>
                        <option value="CANCELADA">Cancelada</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1">
                        Sala / Lab
                      </label>
                      <input
                        type="text"
                        name="sala"
                        placeholder="Ex: Lab 03 - Bloco B"
                        value={draftAula.sala}
                        onChange={(e) =>
                          setDraftAula({ ...draftAula, sala: e.target.value })
                        }
                        className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 py-2 text-xs text-zinc-950 focus:bg-white focus:border-zinc-900 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">
                      Conteúdo Programático da Aula
                    </label>
                    <textarea
                      name="conteudo_programatico"
                      rows={2}
                      placeholder="Tópicos abordados na aula..."
                      value={draftAula.conteudo_programatico}
                      onChange={(e) =>
                        setDraftAula({
                          ...draftAula,
                          conteudo_programatico: e.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 py-2 text-xs text-zinc-950 focus:bg-white focus:border-zinc-900 focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isPending || Boolean(liveConflict)}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-950 px-4 py-2.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-40 transition-colors cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Agendar Aula na Grade</span>
                  </button>
                </form>
              </section>
            )}

            {/* Lista e Filtros de Aulas */}
            <section
              className={`${
                isAdmin ? "lg:col-span-8" : "lg:col-span-12"
              } space-y-4`}
            >
              {/* Barra de Filtros */}
              <div className="bg-white border border-zinc-200 rounded-2xl p-4 flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 mr-1">
                  <Filter className="h-3.5 w-3.5" />
                  <span>Filtros:</span>
                </div>

                <input
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs font-mono text-zinc-800"
                />

                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs text-zinc-800"
                >
                  <option value="TODOS">Todos os Status</option>
                  <option value="AGENDADA">Agendada</option>
                  <option value="EM_ANDAMENTO">Em Andamento</option>
                  <option value="CONCLUIDA">Concluída</option>
                  <option value="CANCELADA">Cancelada</option>
                </select>

                <select
                  value={filterTurmaId}
                  onChange={(e) => setFilterTurmaId(e.target.value)}
                  className="rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs text-zinc-800"
                >
                  <option value="TODAS">Todas as Turmas</option>
                  {turmas.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.codigo} — {t.nome}
                    </option>
                  ))}
                </select>

                <select
                  value={filterProfId}
                  onChange={(e) => setFilterProfId(e.target.value)}
                  className="rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs text-zinc-800"
                >
                  <option value="TODOS">Todos os Professores</option>
                  {professores.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>

                {currentUser.role === "PROFESSOR" && (
                  <label className="inline-flex items-center gap-1.5 text-xs text-zinc-700 cursor-pointer ml-auto">
                    <input
                      type="checkbox"
                      checked={onlyMyClasses}
                      onChange={(e) => setOnlyMyClasses(e.target.checked)}
                      className="rounded border-zinc-300"
                    />
                    <span>Apenas minhas aulas</span>
                  </label>
                )}

                {(filterDate ||
                  filterStatus !== "TODOS" ||
                  filterTurmaId !== "TODAS" ||
                  filterProfId !== "TODOS") && (
                  <button
                    type="button"
                    onClick={() => {
                      setFilterDate("");
                      setFilterStatus("TODOS");
                      setFilterTurmaId("TODAS");
                      setFilterProfId("TODOS");
                    }}
                    className="text-xs text-zinc-500 underline hover:text-zinc-900 ml-auto cursor-pointer"
                  >
                    Limpar filtros
                  </button>
                )}
              </div>

              {/* Cards das Aulas */}
              {filteredAulas.length === 0 ? (
                <div className="bg-white border border-zinc-200 rounded-2xl p-12 text-center">
                  <p className="text-sm font-medium text-zinc-700">
                    Nenhuma aula encontrada para os filtros selecionados.
                  </p>
                  <p className="text-xs text-zinc-400 mt-1">
                    Ajuste os filtros acima ou cadastre uma nova aula na grade.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredAulas.map((aula) => {
                    const userCanEditStatus = canUpdateAula({
                      userRole: currentUser.role,
                      userId: currentUser.id,
                      aulaProfessorUserId: aula.professor?.user_id,
                    });

                    return (
                      <article
                        key={aula.id}
                        className="bg-white border border-zinc-200 rounded-2xl p-5 hover:border-zinc-300 transition-colors"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 pb-3.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`font-mono text-[11px] font-medium px-2.5 py-0.5 rounded-full border ${
                                STATUS_BADGE_STYLES[aula.status]
                              }`}
                            >
                              {STATUS_LABELS[aula.status]}
                            </span>
                            <span className="font-mono text-xs font-semibold text-zinc-900 bg-zinc-100 px-2.5 py-0.5 rounded-md">
                              {aula.data_aula}
                            </span>
                            <span className="inline-flex items-center gap-1 font-mono text-xs text-zinc-600">
                              <Clock className="h-3.5 w-3.5 text-zinc-400" />
                              {aula.hora_inicio.slice(0, 5)} –{" "}
                              {aula.hora_fim.slice(0, 5)}
                            </span>
                            {aula.sala && (
                              <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
                                <MapPin className="h-3.5 w-3.5 text-zinc-400" />
                                {aula.sala}
                              </span>
                            )}
                          </div>

                          {/* Controles rápidos de Status da Aula */}
                          <div className="flex items-center gap-1.5">
                            {userCanEditStatus && (
                              <>
                                {aula.status !== "EM_ANDAMENTO" && (
                                  <button
                                    type="button"
                                    disabled={isPending}
                                    onClick={() =>
                                      runAction(() =>
                                        updateAulaStatusAction({
                                          aulaId: aula.id,
                                          novoStatus: "EM_ANDAMENTO",
                                        })
                                      )
                                    }
                                    className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-800 hover:bg-amber-100 transition-colors cursor-pointer"
                                  >
                                    <PlayCircle className="h-3.5 w-3.5" />
                                    <span>Iniciar</span>
                                  </button>
                                )}
                                {aula.status !== "CONCLUIDA" && (
                                  <button
                                    type="button"
                                    disabled={isPending}
                                    onClick={() =>
                                      runAction(() =>
                                        updateAulaStatusAction({
                                          aulaId: aula.id,
                                          novoStatus: "CONCLUIDA",
                                        })
                                      )
                                    }
                                    className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-800 hover:bg-emerald-100 transition-colors cursor-pointer"
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    <span>Concluir</span>
                                  </button>
                                )}
                                {aula.status !== "CANCELADA" && (
                                  <button
                                    type="button"
                                    disabled={isPending}
                                    onClick={() =>
                                      runAction(() =>
                                        updateAulaStatusAction({
                                          aulaId: aula.id,
                                          novoStatus: "CANCELADA",
                                        })
                                      )
                                    }
                                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-medium text-red-700 hover:bg-red-100 transition-colors cursor-pointer"
                                  >
                                    <XCircle className="h-3.5 w-3.5" />
                                    <span>Cancelar</span>
                                  </button>
                                )}
                              </>
                            )}

                            {isAdmin && (
                              <button
                                type="button"
                                disabled={isPending}
                                title="Excluir aula"
                                onClick={() =>
                                  runAction(() => deleteAulaAction(aula.id))
                                }
                                className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="mt-3.5 grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block">
                              Disciplina
                            </span>
                            <p className="text-sm font-semibold text-zinc-950 mt-0.5">
                              {aula.disciplina?.codigo} —{" "}
                              {aula.disciplina?.nome}
                            </p>
                          </div>

                          <div>
                            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block">
                              Turma
                            </span>
                            <p className="text-sm font-medium text-zinc-800 mt-0.5">
                              {aula.turma?.codigo} · {aula.turma?.nome}
                            </p>
                            <span className="text-[11px] text-zinc-500">
                              Período {aula.turma?.periodo} ·{" "}
                              {aula.turma?.turno
                                ? TURNO_LABELS[aula.turma.turno]
                                : ""}
                            </span>
                          </div>

                          <div>
                            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block">
                              Professor(a)
                            </span>
                            <p className="text-sm font-medium text-zinc-800 mt-0.5">
                              {aula.professor?.nome}
                            </p>
                            <span className="text-[11px] text-zinc-500">
                              {aula.professor?.email}
                            </span>
                          </div>
                        </div>

                        {(aula.conteudo_programatico || aula.observacoes) && (
                          <div className="mt-3.5 pt-3 border-t border-zinc-100 text-xs text-zinc-600 space-y-1">
                            {aula.conteudo_programatico && (
                              <p>
                                <strong className="text-zinc-800">
                                  Conteúdo:
                                </strong>{" "}
                                {aula.conteudo_programatico}
                              </p>
                            )}
                            {aula.observacoes && (
                              <p className="text-zinc-500">
                                <strong>Obs:</strong> {aula.observacoes}
                              </p>
                            )}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}

        {/* ===================================================================
            TAB 2: DISCIPLINAS
           =================================================================== */}
        {activeTab === "disciplinas" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {isAdmin && (
              <section className="lg:col-span-4 bg-white border border-zinc-200 rounded-2xl p-6 space-y-4">
                <div className="border-b border-zinc-100 pb-3">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-400">
                    Catálogo Curricular
                  </span>
                  <h2 className="text-base font-semibold text-zinc-950">
                    Cadastrar Disciplina
                  </h2>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const form = e.currentTarget;
                    const fd = new FormData(form);
                    runAction(
                      () => createDisciplinaAction(fd),
                      () => form.reset()
                    );
                  }}
                  className="space-y-3.5"
                >
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1">
                        Código *
                      </label>
                      <input
                        name="codigo"
                        required
                        placeholder="ENG-401"
                        className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 py-2 text-xs font-mono uppercase"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1">
                        Carga Horária (h) *
                      </label>
                      <input
                        name="carga_horaria"
                        type="number"
                        min={1}
                        max={1000}
                        defaultValue={60}
                        required
                        className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 py-2 text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">
                      Nome da Disciplina *
                    </label>
                    <input
                      name="nome"
                      required
                      placeholder="Ex: Engenharia de Software II"
                      className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 py-2 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">
                      Ementa Resumida
                    </label>
                    <textarea
                      name="ementa"
                      rows={3}
                      placeholder="Principais tópicos da disciplina..."
                      className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 py-2 text-xs"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isPending}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-950 px-4 py-2.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-40 cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Salvar Disciplina</span>
                  </button>
                </form>
              </section>
            )}

            <section
              className={`${
                isAdmin ? "lg:col-span-8" : "lg:col-span-12"
              } bg-white border border-zinc-200 rounded-2xl overflow-hidden`}
            >
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50/80 font-mono text-[11px] uppercase text-zinc-500">
                    <th className="py-3.5 px-4">Código</th>
                    <th className="py-3.5 px-4">Disciplina</th>
                    <th className="py-3.5 px-4">Carga Horária</th>
                    {isAdmin && <th className="py-3.5 px-4 text-right">Ações</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 text-xs">
                  {disciplinas.map((d) => (
                    <tr key={d.id} className="hover:bg-zinc-50/60">
                      <td className="py-3.5 px-4 font-mono font-semibold text-zinc-900">
                        {d.codigo}
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="font-medium text-zinc-900">{d.nome}</p>
                        {d.ementa && (
                          <p className="text-zinc-500 mt-0.5">{d.ementa}</p>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-zinc-700">
                        {d.carga_horaria}h
                      </td>
                      {isAdmin && (
                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() =>
                              runAction(() => deleteDisciplinaAction(d.id))
                            }
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
        )}

        {/* ===================================================================
            TAB 3: TURMAS
           =================================================================== */}
        {activeTab === "turmas" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {isAdmin && (
              <section className="lg:col-span-4 bg-white border border-zinc-200 rounded-2xl p-6 space-y-4">
                <div className="border-b border-zinc-100 pb-3">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-400">
                    Estrutura de Ensino
                  </span>
                  <h2 className="text-base font-semibold text-zinc-950">
                    Cadastrar Turma
                  </h2>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const form = e.currentTarget;
                    const fd = new FormData(form);
                    runAction(() => createTurmaAction(fd), () => form.reset());
                  }}
                  className="space-y-3.5"
                >
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1">
                        Código *
                      </label>
                      <input
                        name="codigo"
                        required
                        placeholder="ADS-4N"
                        className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 py-2 text-xs font-mono uppercase"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1">
                        Período Letivo *
                      </label>
                      <input
                        name="periodo"
                        required
                        defaultValue="2026.2"
                        placeholder="2026.2"
                        className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 py-2 text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">
                      Nome da Turma *
                    </label>
                    <input
                      name="nome"
                      required
                      placeholder="Ex: Análise e Desenv. de Sistemas - 4º Sem"
                      className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 py-2 text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1">
                        Turno *
                      </label>
                      <select
                        name="turno"
                        defaultValue="NOTURNO"
                        className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 py-2 text-xs"
                      >
                        <option value="MATUTINO">Matutino</option>
                        <option value="VESPERTINO">Vespertino</option>
                        <option value="NOTURNO">Noturno</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1">
                        Sala Padrão
                      </label>
                      <input
                        name="sala_padrao"
                        placeholder="Lab 03 - Bloco B"
                        className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 py-2 text-xs"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isPending}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-950 px-4 py-2.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-40 cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Salvar Turma</span>
                  </button>
                </form>
              </section>
            )}

            <section
              className={`${
                isAdmin ? "lg:col-span-8" : "lg:col-span-12"
              } bg-white border border-zinc-200 rounded-2xl overflow-hidden`}
            >
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50/80 font-mono text-[11px] uppercase text-zinc-500">
                    <th className="py-3.5 px-4">Código</th>
                    <th className="py-3.5 px-4">Turma</th>
                    <th className="py-3.5 px-4">Período / Turno</th>
                    <th className="py-3.5 px-4">Sala Padrão</th>
                    {isAdmin && <th className="py-3.5 px-4 text-right">Ações</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 text-xs">
                  {turmas.map((t) => (
                    <tr key={t.id} className="hover:bg-zinc-50/60">
                      <td className="py-3.5 px-4 font-mono font-semibold text-zinc-900">
                        {t.codigo}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-zinc-900">
                        {t.nome}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-mono text-zinc-800">
                          {t.periodo}
                        </span>{" "}
                        ·{" "}
                        <span className="text-zinc-500">
                          {TURNO_LABELS[t.turno as TurnoTipo]}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-zinc-600">
                        {t.sala_padrao ?? "—"}
                      </td>
                      {isAdmin && (
                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() =>
                              runAction(() => deleteTurmaAction(t.id))
                            }
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
        )}

        {/* ===================================================================
            TAB 4: PROFESSORES
           =================================================================== */}
        {activeTab === "professores" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {isAdmin && (
              <section className="lg:col-span-4 bg-white border border-zinc-200 rounded-2xl p-6 space-y-4">
                <div className="border-b border-zinc-100 pb-3">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-400">
                    Corpo Docente
                  </span>
                  <h2 className="text-base font-semibold text-zinc-950">
                    Cadastrar Professor(a)
                  </h2>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const form = e.currentTarget;
                    const fd = new FormData(form);
                    runAction(
                      () => createProfessorAction(fd),
                      () => form.reset()
                    );
                  }}
                  className="space-y-3.5"
                >
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">
                      Nome Completo *
                    </label>
                    <input
                      name="nome"
                      required
                      placeholder="Ex: Prof. Dr. Marcos Vinicius"
                      className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 py-2 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">
                      E-mail Institucional *
                    </label>
                    <input
                      name="email"
                      type="email"
                      required
                      placeholder="marcos.vinicius@unopar.br"
                      className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 py-2 text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1">
                        Titulação *
                      </label>
                      <select
                        name="titulacao"
                        defaultValue="Mestre"
                        className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 py-2 text-xs"
                      >
                        <option value="Especialista">Especialista</option>
                        <option value="Mestre">Mestre(a)</option>
                        <option value="Doutor">Doutor(a)</option>
                        <option value="Pós-Doutor">Pós-Doutor(a)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1">
                        Telefone
                      </label>
                      <input
                        name="telefone"
                        placeholder="(43) 99999-0000"
                        className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 py-2 text-xs"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isPending}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-950 px-4 py-2.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-40 cursor-pointer"
                  >
                    <Users className="h-4 w-4" />
                    <span>Salvar Professor(a)</span>
                  </button>
                </form>
              </section>
            )}

            <section
              className={`${
                isAdmin ? "lg:col-span-8" : "lg:col-span-12"
              } bg-white border border-zinc-200 rounded-2xl overflow-hidden`}
            >
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50/80 font-mono text-[11px] uppercase text-zinc-500">
                    <th className="py-3.5 px-4">Docente</th>
                    <th className="py-3.5 px-4">Titulação</th>
                    <th className="py-3.5 px-4">Contato</th>
                    <th className="py-3.5 px-4">Vínculo Auth</th>
                    {isAdmin && <th className="py-3.5 px-4 text-right">Ações</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 text-xs">
                  {professores.map((p) => (
                    <tr key={p.id} className="hover:bg-zinc-50/60">
                      <td className="py-3.5 px-4 font-medium text-zinc-900">
                        {p.nome}
                      </td>
                      <td className="py-3.5 px-4 text-zinc-600">
                        {p.titulacao}
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="text-zinc-800">{p.email}</p>
                        {p.telefone && (
                          <p className="text-zinc-400 font-mono text-[11px]">
                            {p.telefone}
                          </p>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {p.user_id ? (
                          <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Conta Vinculada
                          </span>
                        ) : (
                          <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-500">
                            Aguardando Login
                          </span>
                        )}
                      </td>
                      {isAdmin && (
                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() =>
                              runAction(() => deleteProfessorAction(p.id))
                            }
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
