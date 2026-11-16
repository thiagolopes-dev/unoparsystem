"use client";

import { useState, useMemo, useTransition } from "react";
import {
  createAulaAction,
  updateAulaAction,
  updateAulaStatusAction,
  deleteAulaAction,
  createDisciplinaAction,
  updateDisciplinaAction,
  deleteDisciplinaAction,
  createTurmaAction,
  updateTurmaAction,
  deleteTurmaAction,
  createProfessorAction,
  updateProfessorAction,
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
import { Select, type SelectOption } from "@/components/ui/select";
import { DatePicker, formatIsoDatePtBr } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";
import { Dialog } from "@/components/ui/dialog";
import {
  BookOpen,
  Calendar,
  Clock,
  GraduationCap,
  Layers,
  LogOut,
  Plus,
  Pencil,
  Trash2,
  Users,
  CheckCircle2,
  AlertTriangle,
  Shield,
  MapPin,
  Search,
  RotateCcw,
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

const STATUS_BADGE_STYLES: Record<
  AulaStatus,
  { pill: string; dot: string }
> = {
  AGENDADA: {
    pill: "bg-zinc-100/90 text-zinc-800 border-zinc-200/90",
    dot: "bg-zinc-500",
  },
  EM_ANDAMENTO: {
    pill: "bg-amber-50 text-amber-900 border-amber-200/90",
    dot: "bg-amber-500",
  },
  CONCLUIDA: {
    pill: "bg-emerald-50 text-emerald-900 border-emerald-200/90",
    dot: "bg-emerald-500",
  },
  CANCELADA: {
    pill: "bg-red-50 text-red-800 border-red-200/90 line-through",
    dot: "bg-red-500",
  },
};

const STATUS_OPTIONS: SelectOption[] = [
  { value: "AGENDADA", label: "Agendada", dotColor: "bg-zinc-400" },
  { value: "EM_ANDAMENTO", label: "Em Andamento", dotColor: "bg-amber-500" },
  { value: "CONCLUIDA", label: "Concluída", dotColor: "bg-emerald-500" },
  { value: "CANCELADA", label: "Cancelada", dotColor: "bg-red-500" },
];

const STATUS_FILTER_OPTIONS: SelectOption[] = [
  { value: "TODOS", label: "Todos os Status", dotColor: "bg-zinc-900" },
  ...STATUS_OPTIONS,
];

const TURNO_OPTIONS: SelectOption[] = [
  { value: "MATUTINO", label: "Matutino", badge: "MANHÃ" },
  { value: "VESPERTINO", label: "Vespertino", badge: "TARDE" },
  { value: "NOTURNO", label: "Noturno", badge: "NOITE" },
];

const TITULACAO_OPTIONS: SelectOption[] = [
  { value: "Especialista", label: "Especialista", badge: "ESP" },
  { value: "Mestre", label: "Mestre(a)", badge: "MSC" },
  { value: "Doutor", label: "Doutor(a)", badge: "DR" },
  { value: "Pós-Doutor", label: "Pós-Doutor(a)", badge: "PÓS-DOC" },
];

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

  // Controle de Modais de Criação e Edição (shadcn Dialog pattern)
  const [openModal, setOpenModal] = useState<ActiveTab | null>(null);
  const [editingDisciplina, setEditingDisciplina] = useState<DisciplinaRow | null>(null);
  const [editingTurma, setEditingTurma] = useState<TurmaRow | null>(null);
  const [editingProfessor, setEditingProfessor] = useState<ProfessorRow | null>(null);
  const [editingAula, setEditingAula] = useState<AulaEnriched | null>(null);

  // Filtros da Grade de Aulas
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterDate, setFilterDate] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("TODOS");
  const [filterTurmaId, setFilterTurmaId] = useState<string>("TODAS");
  const [filterProfId, setFilterProfId] = useState<string>("TODOS");
  const [onlyMyClasses, setOnlyMyClasses] = useState<boolean>(
    currentUser.role === "PROFESSOR"
  );

  // Estado dos selects em modais de Turma e Professor
  const [draftTurno, setDraftTurno] = useState<string>("NOTURNO");
  const [draftTitulacao, setDraftTitulacao] = useState<string>("Mestre");

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

  // Opções formatadas para os Custom Selects (padrão shadcn/ui)
  const disciplinaOptions = useMemo<SelectOption[]>(
    () =>
      disciplinas.map((d) => ({
        value: d.id,
        badge: d.codigo,
        label: d.nome,
        description: `${d.carga_horaria}h de carga horária`,
      })),
    [disciplinas]
  );

  const turmaOptions = useMemo<SelectOption[]>(
    () =>
      turmas.map((t) => ({
        value: t.id,
        badge: t.codigo,
        label: t.nome,
        description: `Período ${t.periodo} · ${TURNO_LABELS[t.turno]}`,
      })),
    [turmas]
  );

  const turmaFilterOptions = useMemo<SelectOption[]>(
    () => [
      { value: "TODAS", label: "Todas as Turmas" },
      ...turmas.map((t) => ({
        value: t.id,
        badge: t.codigo,
        label: t.nome,
      })),
    ],
    [turmas]
  );

  const professorOptions = useMemo<SelectOption[]>(
    () =>
      professores.map((p) => ({
        value: p.id,
        label: p.nome,
        badge: p.titulacao,
        description: p.email,
      })),
    [professores]
  );

  const professorFilterOptions = useMemo<SelectOption[]>(
    () => [
      { value: "TODOS", label: "Todos os Professores" },
      ...professores.map((p) => ({
        value: p.id,
        label: p.nome,
        badge: p.titulacao,
      })),
    ],
    [professores]
  );

  const scheduledDates = useMemo(
    () => Array.from(new Set(aulas.map((a) => a.data_aula))),
    [aulas]
  );

  function handleOpenCreate(tab: ActiveTab) {
    setEditingDisciplina(null);
    setEditingTurma(null);
    setEditingProfessor(null);
    setEditingAula(null);
    if (tab === "aulas") {
      setDraftAula({
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
    } else if (tab === "turmas") {
      setDraftTurno("NOTURNO");
    } else if (tab === "professores") {
      setDraftTitulacao("Mestre");
    }
    setOpenModal(tab);
  }

  function handleEditDisciplina(d: DisciplinaRow) {
    setEditingDisciplina(d);
    setOpenModal("disciplinas");
  }

  function handleEditTurma(t: TurmaRow) {
    setEditingTurma(t);
    setDraftTurno(t.turno);
    setOpenModal("turmas");
  }

  function handleEditProfessor(p: ProfessorRow) {
    setEditingProfessor(p);
    setDraftTitulacao(p.titulacao);
    setOpenModal("professores");
  }

  function handleEditAula(a: AulaEnriched) {
    setEditingAula(a);
    setDraftAula({
      disciplina_id: a.disciplina_id,
      turma_id: a.turma_id,
      professor_id: a.professor_id,
      data_aula: a.data_aula,
      hora_inicio: a.hora_inicio.slice(0, 5),
      hora_fim: a.hora_fim.slice(0, 5),
      status: a.status,
      sala: a.sala ?? "",
      conteudo_programatico: a.conteudo_programatico ?? "",
      observacoes: a.observacoes ?? "",
    });
    setOpenModal("aulas");
  }

  function handleCloseModal() {
    setOpenModal(null);
    setEditingDisciplina(null);
    setEditingTurma(null);
    setEditingProfessor(null);
    setEditingAula(null);
  }

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
    const candidate = {
      ...(editingAula ? { id: editingAula.id } : {}),
      ...draftAula,
    };
    const result = detectScheduleConflict(candidate, aulas);
    return result.hasConflict ? result : null;
  }, [draftAula, aulas, editingAula]);

  const filteredAulas = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
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
      if (q) {
        const haystack = [
          aula.disciplina?.codigo,
          aula.disciplina?.nome,
          aula.turma?.codigo,
          aula.turma?.nome,
          aula.professor?.nome,
          aula.sala,
          aula.conteudo_programatico,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [
    aulas,
    searchQuery,
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

  const hasActiveFilters = Boolean(
    searchQuery.trim() ||
      filterDate ||
      filterStatus !== "TODOS" ||
      filterTurmaId !== "TODAS" ||
      filterProfId !== "TODOS"
  );

  function resetFilters() {
    setSearchQuery("");
    setFilterDate("");
    setFilterStatus("TODOS");
    setFilterTurmaId("TODAS");
    setFilterProfId("TODOS");
  }

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

  const ctaButtonLabel: Record<ActiveTab, string> = {
    aulas: "Agendar Aula",
    disciplinas: "Nova Disciplina",
    turmas: "Nova Turma",
    professores: "Novo Professor",
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAFA] text-zinc-950 antialiased">
      {/* Top Bar Minimalista */}
      <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-zinc-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-zinc-950 text-white flex items-center justify-center font-mono text-xs font-bold shadow-xs">
              UN
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm tracking-tight text-zinc-950">
                  UnoparSystem
                </span>
                <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md border border-zinc-200/80 bg-zinc-100/70 text-zinc-600">
                  Gestão Acadêmica
                </span>
              </div>
              <p className="text-xs text-zinc-500 hidden sm:block">
                Controle unificado de disciplinas, turmas, corpo docente e diário de aulas
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
                className="h-9 inline-flex items-center gap-1.5 rounded-lg border border-zinc-200/90 bg-white px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950 transition-colors cursor-pointer shadow-2xs"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sair</span>
              </button>
            </form>
          </div>
        </div>

        {/* Navigation Tabs + Primary Action Button */}
        <div className="max-w-7xl mx-auto px-4 sm:px-8 flex items-center justify-between gap-4 border-t border-zinc-100">
          <div className="flex items-center gap-1 overflow-x-auto">
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
                  className={`flex items-center gap-2 px-3.5 py-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                    active
                      ? "border-zinc-950 text-zinc-950"
                      : "border-transparent text-zinc-500 hover:text-zinc-800"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{tab.label}</span>
                  <span
                    className={`font-mono text-[10px] px-1.5 py-0.5 rounded-md ${
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

          {isAdmin && (
            <button
              type="button"
              onClick={() => handleOpenCreate(activeTab)}
              className="my-1.5 h-8 inline-flex items-center gap-1.5 rounded-lg bg-zinc-950 px-3 text-xs font-medium text-white hover:bg-zinc-800 transition-colors cursor-pointer shrink-0 shadow-xs outline-none focus:outline-none focus-visible:outline-none"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{ctaButtonLabel[activeTab]}</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-8 py-6 flex-1 space-y-5">
        {/* Compact KPI Strip */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <button
            type="button"
            onClick={() => {
              setActiveTab("aulas");
              setFilterStatus("TODOS");
            }}
            className={`text-left bg-white border rounded-xl p-4 transition-all cursor-pointer shadow-2xs ${
              filterStatus === "TODOS" && activeTab === "aulas"
                ? "border-zinc-900 ring-1 ring-zinc-950/5"
                : "border-zinc-200/80 hover:border-zinc-300"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">
                Total na Grade
              </span>
              <span className="h-2 w-2 rounded-full bg-zinc-900" />
            </div>
            <p className="text-2xl font-semibold mt-1.5 font-mono tracking-tight text-zinc-950">
              {metrics.total}
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("aulas");
              setFilterStatus("AGENDADA");
            }}
            className={`text-left bg-white border rounded-xl p-4 transition-all cursor-pointer shadow-2xs ${
              filterStatus === "AGENDADA" && activeTab === "aulas"
                ? "border-zinc-900 ring-1 ring-zinc-950/5"
                : "border-zinc-200/80 hover:border-zinc-300"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">
                Agendadas
              </span>
              <span className="h-2 w-2 rounded-full bg-zinc-400" />
            </div>
            <p className="text-2xl font-semibold mt-1.5 font-mono tracking-tight text-zinc-900">
              {metrics.agendadas}
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("aulas");
              setFilterStatus("EM_ANDAMENTO");
            }}
            className={`text-left bg-white border rounded-xl p-4 transition-all cursor-pointer shadow-2xs ${
              filterStatus === "EM_ANDAMENTO" && activeTab === "aulas"
                ? "border-amber-500 ring-1 ring-amber-500/20"
                : "border-zinc-200/80 hover:border-zinc-300"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-wider text-amber-700">
                Em Andamento
              </span>
              <span className="h-2 w-2 rounded-full bg-amber-500" />
            </div>
            <p className="text-2xl font-semibold mt-1.5 font-mono tracking-tight text-amber-700">
              {metrics.emAndamento}
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("aulas");
              setFilterStatus("CONCLUIDA");
            }}
            className={`text-left bg-white border rounded-xl p-4 transition-all cursor-pointer shadow-2xs ${
              filterStatus === "CONCLUIDA" && activeTab === "aulas"
                ? "border-emerald-600 ring-1 ring-emerald-600/20"
                : "border-zinc-200/80 hover:border-zinc-300"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-wider text-emerald-700">
                Concluídas
              </span>
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
            </div>
            <p className="text-2xl font-semibold mt-1.5 font-mono tracking-tight text-emerald-700">
              {metrics.concluidas}
            </p>
          </button>
        </section>

        {/* RBAC Notice Banner for Professor */}
        {!isAdmin && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200/80 bg-white px-4 py-3 text-xs text-zinc-600 shadow-2xs">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-zinc-900 shrink-0" />
              <span>
                Modo <strong>Professor</strong> ativo: você pode consultar toda a
                grade e atualizar o <strong>Status da Aula</strong> das aulas alocadas ao seu perfil.
              </span>
            </div>
            <span className="font-mono text-[11px] text-zinc-400 shrink-0 hidden sm:inline">
              RLS: aulas_update_admin_or_assigned_professor
            </span>
          </div>
        )}

        {/* Global Feedback Toast */}
        {feedback && (
          <div
            role="status"
            className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-xs font-medium shadow-xs ${
              feedback.type === "success"
                ? "border-emerald-200 bg-emerald-50/90 text-emerald-950"
                : "border-red-200 bg-red-50/90 text-red-950"
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
              className="text-[11px] font-mono uppercase tracking-wider opacity-70 hover:opacity-100 cursor-pointer"
            >
              Fechar
            </button>
          </div>
        )}

        {/* ===================================================================
            TAB 1: GRADE DE AULAS (12 COLUNAS CONCISAS + FILTROS SHADCN)
           =================================================================== */}
        {activeTab === "aulas" && (
          <section className="space-y-4">
            {/* Barra de Filtros Minimalista Padrão shadcn/ui */}
            <div className="bg-white border border-zinc-200/80 rounded-2xl p-3 shadow-2xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 items-center">
                {/* Busca Textual */}
                <div className="relative lg:col-span-3">
                  <Search className="h-3.5 w-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar disciplina, sala, turma..."
                    className="h-9 w-full rounded-lg border border-zinc-200/90 bg-white pl-8 pr-3 text-xs text-zinc-900 placeholder:text-zinc-400 hover:border-zinc-300 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-950/10 focus:outline-none transition-all shadow-2xs"
                  />
                </div>

                {/* DatePicker Customizado (Substitui o calendário nativo) */}
                <div className="lg:col-span-2">
                  <DatePicker
                    size="sm"
                    value={filterDate}
                    onChange={setFilterDate}
                    placeholder="Filtrar por data"
                    allowClear
                    highlightedDates={scheduledDates}
                  />
                </div>

                {/* Select Customizado de Status */}
                <div className="lg:col-span-2">
                  <Select
                    size="sm"
                    value={filterStatus}
                    onChange={setFilterStatus}
                    options={STATUS_FILTER_OPTIONS}
                    searchable={false}
                  />
                </div>

                {/* Select Customizado de Turma */}
                <div className="lg:col-span-2">
                  <Select
                    size="sm"
                    value={filterTurmaId}
                    onChange={setFilterTurmaId}
                    options={turmaFilterOptions}
                    searchPlaceholder="Buscar turma..."
                  />
                </div>

                {/* Select Customizado de Professor */}
                <div className="lg:col-span-3 flex items-center gap-2">
                  <Select
                    size="sm"
                    className="flex-1"
                    value={filterProfId}
                    onChange={setFilterProfId}
                    options={professorFilterOptions}
                    searchPlaceholder="Buscar docente..."
                    align="right"
                  />

                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={resetFilters}
                      title="Limpar todos os filtros"
                      className="h-9 px-2.5 inline-flex items-center gap-1 rounded-lg border border-zinc-200/90 bg-zinc-50 text-xs font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 transition-colors cursor-pointer shrink-0"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span className="hidden xl:inline">Limpar</span>
                    </button>
                  )}
                </div>
              </div>

              {currentUser.role === "PROFESSOR" && (
                <div className="mt-2.5 pt-2.5 border-t border-zinc-100 flex items-center justify-between">
                  <label className="inline-flex items-center gap-2 text-xs text-zinc-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={onlyMyClasses}
                      onChange={(e) => setOnlyMyClasses(e.target.checked)}
                      className="rounded border-zinc-300 text-zinc-950 focus:ring-zinc-950"
                    />
                    <span>Exibir apenas aulas alocadas ao meu perfil docente</span>
                  </label>
                  <span className="text-[11px] font-mono text-zinc-400">
                    {filteredAulas.length} aula(s) exibida(s)
                  </span>
                </div>
              )}
            </div>

            {/* Lista Concisa de Aulas */}
            {filteredAulas.length === 0 ? (
              <div className="bg-white border border-zinc-200/80 rounded-2xl p-12 text-center shadow-2xs">
                <Calendar className="h-8 w-8 text-zinc-300 mx-auto mb-2.5" />
                <p className="text-sm font-medium text-zinc-800">
                  Nenhuma aula encontrada para os filtros selecionados.
                </p>
                <p className="text-xs text-zinc-500 mt-1">
                  Ajuste os filtros na barra superior ou agende uma nova aula na grade.
                </p>
                <div className="mt-4 flex items-center justify-center gap-2">
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="h-8 px-3 rounded-lg border border-zinc-200 bg-white text-xs font-medium text-zinc-700 hover:bg-zinc-50 cursor-pointer"
                    >
                      Limpar filtros
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => handleOpenCreate("aulas")}
                      className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg bg-zinc-950 text-xs font-medium text-white hover:bg-zinc-800 cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Agendar Aula</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredAulas.map((aula) => {
                  const userCanEditStatus = canUpdateAula({
                    userRole: currentUser.role,
                    userId: currentUser.id,
                    aulaProfessorUserId: aula.professor?.user_id,
                  });
                  const badgeStyle = STATUS_BADGE_STYLES[aula.status];

                  return (
                    <article
                      key={aula.id}
                      className="bg-white border border-zinc-200/80 rounded-2xl p-4 sm:p-5 hover:border-zinc-300/90 transition-all shadow-2xs"
                    >
                      {/* Linha Superior: Metadados de Horário + Seletor Rápido de Status */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-zinc-100">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1.5 font-mono text-[11px] font-medium px-2.5 py-0.5 rounded-full border ${badgeStyle.pill}`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${badgeStyle.dot}`}
                            />
                            {STATUS_LABELS[aula.status]}
                          </span>

                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-900 bg-zinc-100/80 border border-zinc-200/60 px-2.5 py-0.5 rounded-lg">
                            <Calendar className="h-3.5 w-3.5 text-zinc-500" />
                            {formatIsoDatePtBr(aula.data_aula)}
                          </span>

                          <span className="inline-flex items-center gap-1 font-mono text-xs text-zinc-700 bg-zinc-50 border border-zinc-200/60 px-2.5 py-0.5 rounded-lg">
                            <Clock className="h-3.5 w-3.5 text-zinc-400" />
                            {aula.hora_inicio.slice(0, 5)} –{" "}
                            {aula.hora_fim.slice(0, 5)}
                          </span>

                          {aula.sala && (
                            <span className="inline-flex items-center gap-1 text-xs text-zinc-600 px-2 py-0.5">
                              <MapPin className="h-3.5 w-3.5 text-zinc-400" />
                              {aula.sala}
                            </span>
                          )}
                        </div>

                        {/* Controle Rápido de Status via Custom Select + Exclusão */}
                        <div className="flex items-center gap-2">
                          {userCanEditStatus && (
                            <div className="w-44">
                              <Select
                                size="sm"
                                align="right"
                                searchable={false}
                                disabled={isPending}
                                value={aula.status}
                                options={STATUS_OPTIONS}
                                onChange={(novoStatus) => {
                                  if (novoStatus !== aula.status) {
                                    runAction(() =>
                                      updateAulaStatusAction({
                                        aulaId: aula.id,
                                        novoStatus: novoStatus as AulaStatus,
                                      })
                                    );
                                  }
                                }}
                              />
                            </div>
                          )}

                          {isAdmin && (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                disabled={isPending}
                                title="Editar dados da aula"
                                onClick={() => handleEditAula(aula)}
                                className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-transparent text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition-colors cursor-pointer"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={isPending}
                                title="Excluir aula"
                                onClick={() =>
                                  runAction(() => deleteAulaAction(aula.id))
                                }
                                className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-transparent text-zinc-400 hover:text-red-600 hover:bg-red-50 hover:border-red-100 transition-colors cursor-pointer"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Grid Principal de 3 Colunas (Sem colisão de texto) */}
                      <div className="mt-3.5 grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                        <div className="md:col-span-5 min-w-0">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block">
                            Disciplina
                          </span>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="font-mono text-[11px] font-semibold px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-800 shrink-0">
                              {aula.disciplina?.codigo}
                            </span>
                            <p className="text-sm font-semibold text-zinc-950 truncate">
                              {aula.disciplina?.nome}
                            </p>
                          </div>
                        </div>

                        <div className="md:col-span-4 min-w-0">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block">
                            Turma & Período
                          </span>
                          <p className="text-xs font-medium text-zinc-900 mt-1 truncate">
                            <span className="font-mono font-semibold text-zinc-700">
                              {aula.turma?.codigo}
                            </span>{" "}
                            · {aula.turma?.nome}
                          </p>
                          <span className="text-[11px] text-zinc-500 block mt-0.5">
                             Semestre {aula.turma?.periodo} ·{" "}
                            {aula.turma?.turno
                              ? TURNO_LABELS[aula.turma.turno]
                              : ""}
                          </span>
                        </div>

                        <div className="md:col-span-3 min-w-0">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block">
                            Docente Responsável
                          </span>
                          <p className="text-xs font-medium text-zinc-900 mt-1 truncate">
                            {aula.professor?.nome}
                          </p>
                          <span className="text-[11px] text-zinc-500 block truncate mt-0.5">
                            {aula.professor?.email}
                          </span>
                        </div>
                      </div>

                      {(aula.conteudo_programatico || aula.observacoes) && (
                        <div className="mt-3.5 pt-3 border-t border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-zinc-600">
                          {aula.conteudo_programatico && (
                            <p className="truncate">
                              <strong className="font-medium text-zinc-900">
                                Conteúdo:
                              </strong>{" "}
                              {aula.conteudo_programatico}
                            </p>
                          )}
                          {aula.observacoes && (
                            <p className="text-zinc-500 shrink-0">
                              <strong className="font-medium text-zinc-700">
                                Obs:
                              </strong>{" "}
                              {aula.observacoes}
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
        )}

        {/* ===================================================================
            TAB 2: DISCIPLINAS (TABELA COMPACTA / SMALL)
           =================================================================== */}
        {activeTab === "disciplinas" && (
          <section className="bg-white border border-zinc-200/80 rounded-xl overflow-hidden shadow-2xs">
            <div className="px-4 py-2.5 border-b border-zinc-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <h2 className="text-xs font-semibold text-zinc-950">
                  Catálogo de Disciplinas
                </h2>
                <span className="text-[11px] text-zinc-400 hidden sm:inline">
                  · Matriz curricular disponível para alocação nas turmas
                </span>
              </div>
            </div>

            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-200/80 bg-zinc-50/70 font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                  <th className="py-2 px-4 w-28">Código</th>
                  <th className="py-2 px-4">Disciplina</th>
                  <th className="py-2 px-4 w-32">Carga Horária</th>
                  {isAdmin && (
                    <th className="py-2 px-4 w-20 text-right">Ações</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-xs">
                {disciplinas.map((d) => (
                  <tr
                    key={d.id}
                    className="h-9 hover:bg-zinc-50/70 transition-colors"
                  >
                    <td className="py-1.5 px-4 font-mono text-[11px] font-semibold text-zinc-900 whitespace-nowrap">
                      <span className="px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-800">
                        {d.codigo}
                      </span>
                    </td>
                    <td className="py-1.5 px-4 max-w-0 w-full">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-medium text-zinc-900 shrink-0">
                          {d.nome}
                        </span>
                        {d.ementa && (
                          <span className="text-zinc-400 truncate">
                            — {d.ementa}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-1.5 px-4 font-mono text-[11px] text-zinc-700 whitespace-nowrap">
                      {d.carga_horaria}h
                    </td>
                    {isAdmin && (
                      <td className="py-1.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1">
                          <button
                            type="button"
                            disabled={isPending}
                            title="Editar disciplina"
                            onClick={() => handleEditDisciplina(d)}
                            className="p-1 rounded-md text-zinc-400 hover:text-zinc-950 hover:bg-zinc-100 cursor-pointer"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={isPending}
                            title="Excluir disciplina"
                            onClick={() =>
                              runAction(() => deleteDisciplinaAction(d.id))
                            }
                            className="p-1 rounded-md text-zinc-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* ===================================================================
            TAB 3: TURMAS (TABELA COMPACTA / SMALL)
           =================================================================== */}
        {activeTab === "turmas" && (
          <section className="bg-white border border-zinc-200/80 rounded-xl overflow-hidden shadow-2xs">
            <div className="px-4 py-2.5 border-b border-zinc-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <h2 className="text-xs font-semibold text-zinc-950">
                  Turmas Ativas
                </h2>
                <span className="text-[11px] text-zinc-400 hidden sm:inline">
                  · Organizadas por semestre letivo, turno e sala padrão
                </span>
              </div>
            </div>

            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-200/80 bg-zinc-50/70 font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                  <th className="py-2 px-4 w-28">Código</th>
                  <th className="py-2 px-4">Turma</th>
                  <th className="py-2 px-4 w-44">Período / Turno</th>
                  <th className="py-2 px-4 w-44">Sala Padrão</th>
                  {isAdmin && (
                    <th className="py-2 px-4 w-20 text-right">Ações</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-xs">
                {turmas.map((t) => (
                  <tr
                    key={t.id}
                    className="h-9 hover:bg-zinc-50/70 transition-colors"
                  >
                    <td className="py-1.5 px-4 font-mono text-[11px] font-semibold text-zinc-900 whitespace-nowrap">
                      <span className="px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-800">
                        {t.codigo}
                      </span>
                    </td>
                    <td className="py-1.5 px-4 font-medium text-zinc-900">
                      {t.nome}
                    </td>
                    <td className="py-1.5 px-4 whitespace-nowrap">
                      <span className="font-mono text-[11px] text-zinc-800">
                        {t.periodo}
                      </span>{" "}
                      ·{" "}
                      <span className="text-zinc-500">
                        {TURNO_LABELS[t.turno as TurnoTipo]}
                      </span>
                    </td>
                    <td className="py-1.5 px-4 text-zinc-600 whitespace-nowrap">
                      {t.sala_padrao ?? "—"}
                    </td>
                    {isAdmin && (
                      <td className="py-1.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1">
                          <button
                            type="button"
                            disabled={isPending}
                            title="Editar turma"
                            onClick={() => handleEditTurma(t)}
                            className="p-1 rounded-md text-zinc-400 hover:text-zinc-950 hover:bg-zinc-100 cursor-pointer"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={isPending}
                            title="Excluir turma"
                            onClick={() =>
                              runAction(() => deleteTurmaAction(t.id))
                            }
                            className="p-1 rounded-md text-zinc-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* ===================================================================
            TAB 4: PROFESSORES (TABELA COMPACTA / SMALL)
           =================================================================== */}
        {activeTab === "professores" && (
          <section className="bg-white border border-zinc-200/80 rounded-xl overflow-hidden shadow-2xs">
            <div className="px-4 py-2.5 border-b border-zinc-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <h2 className="text-xs font-semibold text-zinc-950">
                  Corpo Docente
                </h2>
                <span className="text-[11px] text-zinc-400 hidden sm:inline">
                  · Lista de professores e status de acesso ao sistema
                </span>
              </div>
            </div>

            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-200/80 bg-zinc-50/70 font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                  <th className="py-2 px-4">Docente</th>
                  <th className="py-2 px-4 w-36">Titulação</th>
                  <th className="py-2 px-4">Contato</th>
                  <th className="py-2 px-4 w-36">Acesso ao Sistema</th>
                  {isAdmin && (
                    <th className="py-2 px-4 w-20 text-right">Ações</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-xs">
                {professores.map((p) => (
                  <tr
                    key={p.id}
                    className="h-9 hover:bg-zinc-50/70 transition-colors"
                  >
                    <td className="py-1.5 px-4 font-medium text-zinc-900 whitespace-nowrap">
                      {p.nome}
                    </td>
                    <td className="py-1.5 px-4 text-zinc-600 whitespace-nowrap">
                      {p.titulacao}
                    </td>
                    <td className="py-1.5 px-4 whitespace-nowrap">
                      <span className="text-zinc-800">{p.email}</span>
                      {p.telefone && (
                        <span className="text-zinc-400 font-mono text-[11px] ml-2">
                          · {p.telefone}
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 px-4 whitespace-nowrap">
                      {p.user_id ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Acesso Ativo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-600 bg-zinc-100 border border-zinc-200/80 px-2 py-0.5 rounded-full">
                          <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
                          Sem Acesso
                        </span>
                      )}
                    </td>
                    {isAdmin && (
                      <td className="py-1.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1">
                          <button
                            type="button"
                            disabled={isPending}
                            title="Editar professor"
                            onClick={() => handleEditProfessor(p)}
                            className="p-1 rounded-md text-zinc-400 hover:text-zinc-950 hover:bg-zinc-100 cursor-pointer"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={isPending}
                            title="Excluir professor"
                            onClick={() =>
                              runAction(() => deleteProfessorAction(p.id))
                            }
                            className="p-1 rounded-md text-zinc-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </main>

      {/* =====================================================================
          DIALOG 1: AGENDAR OU EDITAR AULA (COM SELECT, DATEPICKER & TIMEPICKER)
         ===================================================================== */}
      <Dialog
        open={openModal === "aulas"}
        onClose={handleCloseModal}
        eyebrow="Agendamento Acadêmico"
        title={editingAula ? "Editar Aula na Grade" : "Agendar Nova Aula na Grade"}
        description={
          editingAula
            ? "Atualize os detalhes, horários ou docentes desta aula."
            : "Validação automática contra conflitos de horário de turma ou professor."
        }
      >
        {liveConflict && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <span>{liveConflict.message}</span>
          </div>
        )}

        <form
          key={editingAula ? editingAula.id : "new-aula"}
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            if (editingAula) {
              runAction(
                () => updateAulaAction(editingAula.id, fd),
                () => handleCloseModal()
              );
            } else {
              runAction(
                () => createAulaAction(fd),
                () => {
                  setDraftAula((prev) => ({
                    ...prev,
                    conteudo_programatico: "",
                    observacoes: "",
                  }));
                  handleCloseModal();
                }
              );
            }
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1.5">
              Disciplina *
            </label>
            <Select
              name="disciplina_id"
              value={draftAula.disciplina_id}
              onChange={(val) =>
                setDraftAula({ ...draftAula, disciplina_id: val })
              }
              options={disciplinaOptions}
              searchPlaceholder="Buscar código ou nome..."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                Turma *
              </label>
              <Select
                name="turma_id"
                value={draftAula.turma_id}
                onChange={(val) =>
                  setDraftAula({ ...draftAula, turma_id: val })
                }
                options={turmaOptions}
                searchPlaceholder="Buscar turma..."
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                Professor(a) *
              </label>
              <Select
                name="professor_id"
                value={draftAula.professor_id}
                onChange={(val) =>
                  setDraftAula({ ...draftAula, professor_id: val })
                }
                options={professorOptions}
                searchPlaceholder="Buscar professor..."
                align="right"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                Data da Aula *
              </label>
              <DatePicker
                name="data_aula"
                value={draftAula.data_aula}
                onChange={(iso) =>
                  setDraftAula({ ...draftAula, data_aula: iso })
                }
                highlightedDates={scheduledDates}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                Horário Inicial *
              </label>
              <TimePicker
                name="hora_inicio"
                value={draftAula.hora_inicio}
                onChange={(time) =>
                  setDraftAula({ ...draftAula, hora_inicio: time })
                }
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                Horário Final *
              </label>
              <TimePicker
                name="hora_fim"
                value={draftAula.hora_fim}
                onChange={(time) =>
                  setDraftAula({ ...draftAula, hora_fim: time })
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                Status
              </label>
              <Select
                name="status"
                value={draftAula.status}
                onChange={(val) =>
                  setDraftAula({ ...draftAula, status: val as AulaStatus })
                }
                options={STATUS_OPTIONS}
                searchable={false}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                Sala / Laboratório
              </label>
              <input
                type="text"
                name="sala"
                placeholder="Ex: Lab 03 - Bloco B"
                value={draftAula.sala}
                onChange={(e) =>
                  setDraftAula({ ...draftAula, sala: e.target.value })
                }
                className="h-10 w-full rounded-xl border border-zinc-200/90 bg-white px-3.5 text-xs text-zinc-950 placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-950/10 focus:outline-none shadow-2xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1.5">
              Conteúdo Programático da Aula
            </label>
            <textarea
              name="conteudo_programatico"
              rows={2}
              placeholder="Tópicos que serão ministrados..."
              value={draftAula.conteudo_programatico}
              onChange={(e) =>
                setDraftAula({
                  ...draftAula,
                  conteudo_programatico: e.target.value,
                })
              }
              className="w-full rounded-xl border border-zinc-200/90 bg-white px-3.5 py-2.5 text-xs text-zinc-950 placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-950/10 focus:outline-none shadow-2xs"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleCloseModal}
              className="h-9 px-4 rounded-xl border border-zinc-200 bg-white text-xs font-medium text-zinc-700 hover:bg-zinc-50 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending || Boolean(liveConflict)}
              className="h-9 inline-flex items-center gap-1.5 rounded-xl bg-zinc-950 px-4 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-40 transition-colors cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>{editingAula ? "Salvar Alterações" : "Confirmar Agendamento"}</span>
            </button>
          </div>
        </form>
      </Dialog>

      {/* =====================================================================
          DIALOG 2: CADASTRAR OU EDITAR DISCIPLINA
         ===================================================================== */}
      <Dialog
        open={openModal === "disciplinas"}
        onClose={handleCloseModal}
        eyebrow="Catálogo Curricular"
        title={editingDisciplina ? "Editar Disciplina" : "Cadastrar Nova Disciplina"}
      >
        <form
          key={editingDisciplina ? editingDisciplina.id : "new-disciplina"}
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const fd = new FormData(form);
            if (editingDisciplina) {
              runAction(
                () => updateDisciplinaAction(editingDisciplina.id, fd),
                () => handleCloseModal()
              );
            } else {
              runAction(
                () => createDisciplinaAction(fd),
                () => {
                  form.reset();
                  handleCloseModal();
                }
              );
            }
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                Código *
              </label>
              <input
                name="codigo"
                required
                defaultValue={editingDisciplina?.codigo ?? ""}
                placeholder="ENG-401"
                className="h-10 w-full rounded-xl border border-zinc-200/90 bg-white px-3.5 text-xs font-mono uppercase shadow-2xs focus:border-zinc-900 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                Carga Horária (h) *
              </label>
              <input
                name="carga_horaria"
                type="number"
                min={1}
                max={1000}
                defaultValue={editingDisciplina?.carga_horaria ?? 60}
                required
                className="h-10 w-full rounded-xl border border-zinc-200/90 bg-white px-3.5 text-xs font-mono shadow-2xs focus:border-zinc-900 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1.5">
              Nome da Disciplina *
            </label>
            <input
              name="nome"
              required
              defaultValue={editingDisciplina?.nome ?? ""}
              placeholder="Ex: Engenharia de Software II"
              className="h-10 w-full rounded-xl border border-zinc-200/90 bg-white px-3.5 text-xs shadow-2xs focus:border-zinc-900 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1.5">
              Ementa Resumida
            </label>
            <textarea
              name="ementa"
              rows={3}
              defaultValue={editingDisciplina?.ementa ?? ""}
              placeholder="Principais tópicos da disciplina..."
              className="w-full rounded-xl border border-zinc-200/90 bg-white px-3.5 py-2.5 text-xs shadow-2xs focus:border-zinc-900 focus:outline-none"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleCloseModal}
              className="h-9 px-4 rounded-xl border border-zinc-200 bg-white text-xs font-medium text-zinc-700 hover:bg-zinc-50 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="h-9 inline-flex items-center gap-1.5 rounded-xl bg-zinc-950 px-4 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-40 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>{editingDisciplina ? "Salvar Alterações" : "Salvar Disciplina"}</span>
            </button>
          </div>
        </form>
      </Dialog>

      {/* =====================================================================
          DIALOG 3: CADASTRAR OU EDITAR TURMA
         ===================================================================== */}
      <Dialog
        open={openModal === "turmas"}
        onClose={handleCloseModal}
        eyebrow="Estrutura de Ensino"
        title={editingTurma ? "Editar Turma" : "Cadastrar Nova Turma"}
      >
        <form
          key={editingTurma ? editingTurma.id : "new-turma"}
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const fd = new FormData(form);
            if (editingTurma) {
              runAction(
                () => updateTurmaAction(editingTurma.id, fd),
                () => handleCloseModal()
              );
            } else {
              runAction(
                () => createTurmaAction(fd),
                () => {
                  form.reset();
                  handleCloseModal();
                }
              );
            }
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                Código *
              </label>
              <input
                name="codigo"
                required
                defaultValue={editingTurma?.codigo ?? ""}
                placeholder="ADS-4N"
                className="h-10 w-full rounded-xl border border-zinc-200/90 bg-white px-3.5 text-xs font-mono uppercase shadow-2xs focus:border-zinc-900 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                Período Letivo *
              </label>
              <input
                name="periodo"
                required
                defaultValue={editingTurma?.periodo ?? "2026.2"}
                placeholder="2026.2"
                className="h-10 w-full rounded-xl border border-zinc-200/90 bg-white px-3.5 text-xs font-mono shadow-2xs focus:border-zinc-900 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1.5">
              Nome da Turma *
            </label>
            <input
              name="nome"
              required
              defaultValue={editingTurma?.nome ?? ""}
              placeholder="Ex: Análise e Desenv. de Sistemas - 4º Sem"
              className="h-10 w-full rounded-xl border border-zinc-200/90 bg-white px-3.5 text-xs shadow-2xs focus:border-zinc-900 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                Turno *
              </label>
              <Select
                name="turno"
                value={draftTurno}
                onChange={setDraftTurno}
                options={TURNO_OPTIONS}
                searchable={false}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                Sala Padrão
              </label>
              <input
                name="sala_padrao"
                defaultValue={editingTurma?.sala_padrao ?? ""}
                placeholder="Lab 03 - Bloco B"
                className="h-10 w-full rounded-xl border border-zinc-200/90 bg-white px-3.5 text-xs shadow-2xs focus:border-zinc-900 focus:outline-none"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleCloseModal}
              className="h-9 px-4 rounded-xl border border-zinc-200 bg-white text-xs font-medium text-zinc-700 hover:bg-zinc-50 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="h-9 inline-flex items-center gap-1.5 rounded-xl bg-zinc-950 px-4 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-40 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>{editingTurma ? "Salvar Alterações" : "Salvar Turma"}</span>
            </button>
          </div>
        </form>
      </Dialog>

      {/* =====================================================================
          DIALOG 4: CADASTRAR OU EDITAR PROFESSOR
         ===================================================================== */}
      <Dialog
        open={openModal === "professores"}
        onClose={handleCloseModal}
        eyebrow="Corpo Docente"
        title={editingProfessor ? "Editar Professor(a)" : "Cadastrar Professor(a)"}
      >
        <form
          key={editingProfessor ? editingProfessor.id : "new-prof"}
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const fd = new FormData(form);
            if (editingProfessor) {
              runAction(
                () => updateProfessorAction(editingProfessor.id, fd),
                () => handleCloseModal()
              );
            } else {
              runAction(
                () => createProfessorAction(fd),
                () => {
                  form.reset();
                  handleCloseModal();
                }
              );
            }
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1.5">
              Nome Completo *
            </label>
            <input
              name="nome"
              required
              defaultValue={editingProfessor?.nome ?? ""}
              placeholder="Ex: Prof. Dr. Marcos Vinicius"
              className="h-10 w-full rounded-xl border border-zinc-200/90 bg-white px-3.5 text-xs shadow-2xs focus:border-zinc-900 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1.5">
              E-mail Institucional *
            </label>
            <input
              name="email"
              type="email"
              required
              defaultValue={editingProfessor?.email ?? ""}
              placeholder="marcos.vinicius@unopar.br"
              className="h-10 w-full rounded-xl border border-zinc-200/90 bg-white px-3.5 text-xs shadow-2xs focus:border-zinc-900 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                Titulação *
              </label>
              <Select
                name="titulacao"
                value={draftTitulacao}
                onChange={setDraftTitulacao}
                options={TITULACAO_OPTIONS}
                searchable={false}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                Telefone
              </label>
              <input
                name="telefone"
                defaultValue={editingProfessor?.telefone ?? ""}
                placeholder="(43) 99999-0000"
                className="h-10 w-full rounded-xl border border-zinc-200/90 bg-white px-3.5 text-xs shadow-2xs focus:border-zinc-900 focus:outline-none"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleCloseModal}
              className="h-9 px-4 rounded-xl border border-zinc-200 bg-white text-xs font-medium text-zinc-700 hover:bg-zinc-50 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="h-9 inline-flex items-center gap-1.5 rounded-xl bg-zinc-950 px-4 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-40 cursor-pointer"
            >
              <Users className="h-4 w-4" />
              <span>{editingProfessor ? "Salvar Alterações" : "Salvar Professor(a)"}</span>
            </button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
