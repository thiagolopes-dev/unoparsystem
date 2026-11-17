"use client";

import { useState, useEffect, useMemo, useTransition } from "react";
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
  canManageCatalog,
  canUpdateAula,
  formatPhoneBr,
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
import { Dialog } from "@/components/ui/dialog";
import {
  BookOpen,
  BookOpenCheck,
  Calendar,
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
  X,
} from "lucide-react";

function formatAulaPeriod(dataInicio: string, dataFim?: string | null): string {
  const inicioLabel = formatIsoDatePtBr(dataInicio);
  if (!dataFim || dataFim === dataInicio) {
    return inicioLabel;
  }
  return `${inicioLabel} até ${formatIsoDatePtBr(dataFim)}`;
}

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
    pill: "bg-sky-400/10 text-sky-200 border-sky-400/25",
    dot: "bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.75)]",
  },
  EM_ANDAMENTO: {
    pill: "bg-amber-400/12 text-amber-200 border-amber-400/30",
    dot: "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.75)]",
  },
  CONCLUIDA: {
    pill: "bg-emerald-400/12 text-emerald-200 border-emerald-400/30",
    dot: "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.75)]",
  },
  CANCELADA: {
    pill: "bg-rose-400/12 text-rose-200 border-rose-400/30 line-through",
    dot: "bg-rose-400",
  },
};

const STATUS_OPTIONS: SelectOption[] = [
  { value: "AGENDADA", label: "Agendada", dotColor: "bg-sky-400" },
  { value: "EM_ANDAMENTO", label: "Em Andamento", dotColor: "bg-amber-400" },
  { value: "CONCLUIDA", label: "Concluída", dotColor: "bg-emerald-400" },
  { value: "CANCELADA", label: "Cancelada", dotColor: "bg-rose-400" },
];

const STATUS_FILTER_OPTIONS: SelectOption[] = [
  { value: "TODOS", label: "Todos os Status", dotColor: "bg-cyan-400" },
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

const GLASS_LABEL_CLASS = "block text-xs font-medium text-slate-300 mb-1.5";
const GLASS_INPUT_CLASS =
  "login-glass-input h-10 w-full rounded-xl border border-white/15 bg-white/[0.05] px-3.5 text-xs text-slate-100 placeholder:text-slate-400/70 transition-all hover:border-white/25 focus:bg-white/[0.09] focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/15 focus:outline-none";
const GLASS_TEXTAREA_CLASS =
  "w-full rounded-xl border border-white/15 bg-white/[0.05] px-3.5 py-2.5 text-xs text-slate-100 placeholder:text-slate-400/70 transition-all hover:border-white/25 focus:bg-white/[0.09] focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/15 focus:outline-none";
const GLASS_CANCEL_BTN_CLASS =
  "h-9 px-4 rounded-xl border border-white/15 bg-white/[0.05] text-xs font-medium text-slate-300 hover:bg-white/[0.1] hover:text-white transition-colors cursor-pointer";
const GLASS_PRIMARY_BTN_CLASS =
  "h-9 inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-400 via-sky-400 to-emerald-400 px-4 text-xs font-semibold text-slate-950 shadow-[0_4px_20px_-4px_rgba(34,211,238,0.45)] hover:brightness-105 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer";

type DeleteEntityKind = "aula" | "disciplina" | "turma" | "professor";

const DELETE_DIALOG_META: Record<
  DeleteEntityKind,
  { title: string; description: string }
> = {
  aula: {
    title: "Excluir Aula da Grade",
    description:
      "Esta ação removerá permanentemente o agendamento selecionado da grade.",
  },
  disciplina: {
    title: "Excluir Disciplina",
    description:
      "Esta ação removerá permanentemente a disciplina do catálogo curricular.",
  },
  turma: {
    title: "Excluir Turma",
    description:
      "Esta ação removerá permanentemente a turma cadastrada do sistema.",
  },
  professor: {
    title: "Excluir Professor(a)",
    description:
      "Esta ação removerá permanentemente o registro docente do sistema.",
  },
};

function DashboardBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none"
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,#0f1f40_0%,#060913_58%,#03050b_100%)]" />
      <div className="login-aurora absolute -top-40 -left-24 h-[460px] w-[460px] rounded-full bg-cyan-500/15 blur-[135px]" />
      <div className="login-aurora-delayed absolute -bottom-44 -right-24 h-[500px] w-[500px] rounded-full bg-emerald-500/12 blur-[145px]" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 h-[380px] w-[560px] rounded-full bg-indigo-500/12 blur-[150px]" />

      <svg
        className="absolute inset-0 h-full w-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern
            id="dashboard-grid"
            width="48"
            height="48"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 48 0 L 0 0 0 48"
              fill="none"
              stroke="rgba(148, 163, 184, 0.06)"
              strokeWidth="1"
            />
          </pattern>
          <radialGradient id="dashboard-grid-fade" cx="50%" cy="25%" r="65%">
            <stop offset="0%" stopColor="white" stopOpacity="0.9" />
            <stop offset="65%" stopColor="white" stopOpacity="0.3" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <mask id="dashboard-grid-mask">
            <rect width="100%" height="100%" fill="url(#dashboard-grid-fade)" />
          </mask>
        </defs>

        <rect
          width="100%"
          height="100%"
          fill="url(#dashboard-grid)"
          mask="url(#dashboard-grid-mask)"
        />
      </svg>
    </div>
  );
}

export function GestaoAulasApp({
  currentUser,
  disciplinas,
  turmas,
  professores,
  aulas,
}: GestaoAulasAppProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>("aulas");
  const [feedback, setFeedback] = useState<{
    id: number;
    type: "success" | "error";
    title: string;
    text: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => {
      setFeedback((current) =>
        current?.id === feedback.id ? null : current
      );
    }, 4200);
    return () => window.clearTimeout(timer);
  }, [feedback?.id]);

  // Controle de Modais de Criação e Edição (shadcn Dialog pattern)
  const [openModal, setOpenModal] = useState<ActiveTab | null>(null);
  const [editingDisciplina, setEditingDisciplina] =
    useState<DisciplinaRow | null>(null);
  const [editingTurma, setEditingTurma] = useState<TurmaRow | null>(null);
  const [editingProfessor, setEditingProfessor] =
    useState<ProfessorRow | null>(null);
  const [editingAula, setEditingAula] = useState<AulaEnriched | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{
    kind: DeleteEntityKind;
    id: string;
    title: string;
    subtitle?: string;
    badge?: string;
  } | null>(null);

  // Filtros da Grade de Aulas
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterDate, setFilterDate] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("TODOS");
  const [filterTurmaId, setFilterTurmaId] = useState<string>("TODAS");
  const [filterProfId, setFilterProfId] = useState<string>("TODOS");
  const [onlyMyClasses, setOnlyMyClasses] = useState<boolean>(
    currentUser.role === "PROFESSOR"
  );

  // Estado dos selects e máscara em modais de Turma e Professor
  const [draftTurno, setDraftTurno] = useState<string>("NOTURNO");
  const [draftTitulacao, setDraftTitulacao] = useState<string>("Mestre");
  const [draftTelefone, setDraftTelefone] = useState<string>("");

  // Estado do formulário de Nova Aula para pré-validação de período
  const todayIso = new Date().toISOString().slice(0, 10);
  const [draftAula, setDraftAula] = useState({
    disciplina_id: disciplinas[0]?.id ?? "",
    turma_id: turmas[0]?.id ?? "",
    professor_id: professores[0]?.id ?? "",
    data_aula: todayIso,
    data_fim: todayIso,
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
        data_fim: todayIso,
        status: "AGENDADA" as AulaStatus,
        sala: "",
        conteudo_programatico: "",
        observacoes: "",
      });
    } else if (tab === "turmas") {
      setDraftTurno("NOTURNO");
    } else if (tab === "professores") {
      setDraftTitulacao("Mestre");
      setDraftTelefone("");
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
    setDraftTelefone(formatPhoneBr(p.telefone ?? ""));
    setOpenModal("professores");
  }

  function handleEditAula(a: AulaEnriched) {
    setEditingAula(a);
    setDraftAula({
      disciplina_id: a.disciplina_id,
      turma_id: a.turma_id,
      professor_id: a.professor_id,
      data_aula: a.data_aula,
      data_fim: a.data_fim ?? a.data_aula,
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
    setDraftTelefone("");
  }

  // Validação instantânea do período de datas no cliente
  const liveConflict = useMemo(() => {
    if (!draftAula.data_aula || !draftAula.data_fim) {
      return null;
    }
    if (draftAula.data_fim < draftAula.data_aula) {
      return {
        hasConflict: true,
        message: "A data final deve ser igual ou posterior à data inicial.",
      };
    }
    return null;
  }, [draftAula.data_aula, draftAula.data_fim]);

  const filteredAulas = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return aulas.filter((aula) => {
      if (filterDate) {
        const endDate = aula.data_fim || aula.data_aula;
        if (filterDate < aula.data_aula || filterDate > endDate) return false;
      }
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
    onSuccess?: () => void,
    successTitle = "Operação concluída"
  ) {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        setFeedback({
          id: Date.now(),
          type: "error",
          title: "Não foi possível concluir",
          text: res.error ?? "Não foi possível concluir a operação.",
        });
      } else {
        setFeedback({
          id: Date.now(),
          type: "success",
          title: successTitle,
          text: res.message ?? "Operação realizada com sucesso.",
        });
        onSuccess?.();
      }
    });
  }

  function handleConfirmDelete() {
    if (!pendingDelete) return;
    const { kind, id } = pendingDelete;
    const deleteActionByKind: Record<
      DeleteEntityKind,
      (targetId: string) => Promise<{ ok: boolean; error?: string; message?: string }>
    > = {
      aula: deleteAulaAction,
      disciplina: deleteDisciplinaAction,
      turma: deleteTurmaAction,
      professor: deleteProfessorAction,
    };

    runAction(
      async () => {
        try {
          return await deleteActionByKind[kind](id);
        } finally {
          setPendingDelete(null);
        }
      },
      undefined,
      "Exclusão concluída"
    );
  }

  const ctaButtonLabel: Record<ActiveTab, string> = {
    aulas: "Agendar Aula",
    disciplinas: "Nova Disciplina",
    turmas: "Nova Turma",
    professores: "Novo Professor",
  };

  return (
    <div className="relative min-h-screen flex flex-col bg-[#060913] text-slate-100 antialiased">
      <DashboardBackdrop />

      {/* Top Bar Orbital Glass */}
      <header className="sticky top-0 z-30 bg-[#070b17]/75 backdrop-blur-2xl border-b border-white/10">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/35 to-transparent"
        />
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-cyan-400/20 via-sky-500/10 to-emerald-400/20 border border-cyan-300/30 text-cyan-300 flex items-center justify-center shadow-[0_0_20px_-4px_rgba(34,211,238,0.45)] shrink-0">
              <BookOpenCheck className="h-4.5 w-4.5 drop-shadow-[0_0_6px_rgba(103,232,249,0.5)]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm tracking-tight text-white">
                  UNOPAR
                  <span className="bg-gradient-to-r from-cyan-300 via-sky-300 to-emerald-300 bg-clip-text text-transparent font-normal">
                    SYSTEM
                  </span>
                </span>
                <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md border border-white/10 bg-white/[0.06] text-cyan-300">
                  Gestão Acadêmica
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Controle unificado de disciplinas, turmas, corpo docente e diário de aulas
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden md:block">
              <div className="flex items-center justify-end gap-1.5">
                <span className="text-xs font-medium text-slate-100">
                  {currentUser.nome}
                </span>
                <span
                  className={`font-mono text-[10px] uppercase px-1.5 py-0.5 rounded border ${
                    isAdmin
                      ? "bg-cyan-400/15 text-cyan-200 border-cyan-400/30"
                      : "bg-white/[0.08] text-slate-300 border-white/10"
                  }`}
                >
                  {currentUser.role}
                </span>
              </div>
              <span className="text-[11px] font-mono text-slate-400 block">
                {currentUser.email}
              </span>
            </div>

            <form action={logoutAction}>
              <button
                type="submit"
                title="Sair do sistema"
                className="h-9 inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.05] px-3 text-xs font-medium text-slate-200 hover:bg-white/[0.1] hover:border-white/25 hover:text-white focus-visible:border-cyan-400/60 transition-colors cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5 text-slate-400" />
                <span>Sair</span>
              </button>
            </form>
          </div>
        </div>

        {/* Navigation Tabs + Primary Action Button */}
        <div className="max-w-7xl mx-auto px-4 sm:px-8 flex items-center justify-between gap-4 border-t border-white/[0.07]">
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
                      ? "border-cyan-400 text-white"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Icon
                    className={`h-3.5 w-3.5 ${
                      active ? "text-cyan-300" : "text-slate-400"
                    }`}
                  />
                  <span>{tab.label}</span>
                  <span
                    className={`font-mono text-[10px] px-1.5 py-0.5 rounded-md border ${
                      active
                        ? "bg-cyan-400/20 text-cyan-200 border-cyan-400/30"
                        : "bg-white/[0.06] text-slate-400 border-transparent"
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
              className="my-1.5 h-8 inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-400 via-sky-400 to-emerald-400 px-3 text-xs font-semibold text-slate-950 shadow-[0_4px_20px_-4px_rgba(34,211,238,0.45)] hover:brightness-105 transition-all cursor-pointer shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{ctaButtonLabel[activeTab]}</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-7xl w-full mx-auto px-4 sm:px-8 py-6 flex-1 space-y-5">
        {/* Compact KPI Strip */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <button
            type="button"
            onClick={() => {
              setActiveTab("aulas");
              setFilterStatus("TODOS");
            }}
            className={`text-left backdrop-blur-xl border rounded-xl p-4 transition-all cursor-pointer ${
              filterStatus === "TODOS" && activeTab === "aulas"
                ? "border-cyan-400/60 bg-cyan-400/[0.06] shadow-[0_0_25px_-8px_rgba(34,211,238,0.3)]"
                : "border-white/10 bg-[#0b1224]/65 hover:border-white/20 hover:bg-[#0e172e]/75"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-wider text-slate-400">
                Total na Grade
              </span>
              <span className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
            </div>
            <p className="text-2xl font-semibold mt-1.5 font-mono tracking-tight text-white">
              {metrics.total}
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("aulas");
              setFilterStatus("AGENDADA");
            }}
            className={`text-left backdrop-blur-xl border rounded-xl p-4 transition-all cursor-pointer ${
              filterStatus === "AGENDADA" && activeTab === "aulas"
                ? "border-sky-400/60 bg-sky-400/[0.06] shadow-[0_0_25px_-8px_rgba(56,189,248,0.3)]"
                : "border-white/10 bg-[#0b1224]/65 hover:border-white/20 hover:bg-[#0e172e]/75"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-wider text-sky-300/90">
                Agendadas
              </span>
              <span className="h-2 w-2 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.8)]" />
            </div>
            <p className="text-2xl font-semibold mt-1.5 font-mono tracking-tight text-sky-200">
              {metrics.agendadas}
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("aulas");
              setFilterStatus("EM_ANDAMENTO");
            }}
            className={`text-left backdrop-blur-xl border rounded-xl p-4 transition-all cursor-pointer ${
              filterStatus === "EM_ANDAMENTO" && activeTab === "aulas"
                ? "border-amber-400/60 bg-amber-400/[0.06] shadow-[0_0_25px_-8px_rgba(251,191,36,0.3)]"
                : "border-white/10 bg-[#0b1224]/65 hover:border-white/20 hover:bg-[#0e172e]/75"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-wider text-amber-300/90">
                Em Andamento
              </span>
              <span className="h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
            </div>
            <p className="text-2xl font-semibold mt-1.5 font-mono tracking-tight text-amber-200">
              {metrics.emAndamento}
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("aulas");
              setFilterStatus("CONCLUIDA");
            }}
            className={`text-left backdrop-blur-xl border rounded-xl p-4 transition-all cursor-pointer ${
              filterStatus === "CONCLUIDA" && activeTab === "aulas"
                ? "border-emerald-400/60 bg-emerald-400/[0.06] shadow-[0_0_25px_-8px_rgba(52,211,153,0.3)]"
                : "border-white/10 bg-[#0b1224]/65 hover:border-white/20 hover:bg-[#0e172e]/75"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-wider text-emerald-300/90">
                Concluídas
              </span>
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            </div>
            <p className="text-2xl font-semibold mt-1.5 font-mono tracking-tight text-emerald-200">
              {metrics.concluidas}
            </p>
          </button>
        </section>

        {/* RBAC Notice Banner for Professor */}
        {!isAdmin && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-cyan-400/20 bg-cyan-400/[0.05] backdrop-blur-xl px-4 py-3 text-xs text-slate-300">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-cyan-300 shrink-0" />
              <span>
                Modo <strong className="text-white">Professor</strong> ativo: você pode consultar toda a
                grade e atualizar o <strong className="text-white">Status da Aula</strong> das aulas alocadas ao seu perfil.
              </span>
            </div>
            <span className="font-mono text-[11px] text-cyan-300/70 shrink-0 hidden sm:inline">
              RLS: aulas_update_admin_or_assigned_professor
            </span>
          </div>
        )}

        {/* ===================================================================
            TAB 1: GRADE DE AULAS (FILTROS & CARDS GLASS)
           =================================================================== */}
        {activeTab === "aulas" && (
          <section className="space-y-4">
            {/* Barra de Filtros Glass */}
            <div className="bg-[#0b1224]/65 backdrop-blur-xl border border-white/10 rounded-2xl p-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 items-center">
                {/* Busca Textual */}
                <div className="relative lg:col-span-3">
                  <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar disciplina, sala, turma..."
                    className="h-9 w-full rounded-lg border border-white/12 bg-white/[0.04] pl-8 pr-3 text-xs text-slate-100 placeholder:text-slate-400 hover:border-white/25 focus:border-cyan-400/60 focus:bg-white/[0.08] focus:ring-2 focus:ring-cyan-400/15 focus:outline-none transition-all"
                  />
                </div>

                {/* DatePicker Customizado */}
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
                      className="h-9 px-2.5 inline-flex items-center gap-1 rounded-lg border border-white/12 bg-white/[0.05] text-xs font-medium text-slate-300 hover:bg-white/[0.1] hover:text-white transition-colors cursor-pointer shrink-0"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span className="hidden xl:inline">Limpar</span>
                    </button>
                  )}
                </div>
              </div>

              {currentUser.role === "PROFESSOR" && (
                <div className="mt-2.5 pt-2.5 border-t border-white/10 flex items-center justify-between">
                  <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={onlyMyClasses}
                      onChange={(e) => setOnlyMyClasses(e.target.checked)}
                      className="rounded border-white/25 bg-white/[0.06] text-cyan-400 accent-cyan-400"
                    />
                    <span>Exibir apenas aulas alocadas ao meu perfil docente</span>
                  </label>
                  <span className="text-[11px] font-mono text-slate-400">
                    {filteredAulas.length} aula(s) exibida(s)
                  </span>
                </div>
              )}
            </div>

            {/* Lista Concisa de Aulas */}
            {filteredAulas.length === 0 ? (
              <div className="bg-[#0b1224]/65 backdrop-blur-xl border border-white/10 rounded-2xl p-12 text-center">
                <Calendar className="h-8 w-8 text-cyan-300/40 mx-auto mb-2.5" />
                <p className="text-sm font-medium text-slate-100">
                  Nenhuma aula encontrada para os filtros selecionados.
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Ajuste os filtros na barra superior ou agende uma nova aula na grade.
                </p>
                <div className="mt-4 flex items-center justify-center gap-2">
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="h-8 px-3 rounded-lg border border-white/15 bg-white/[0.05] text-xs font-medium text-slate-200 hover:bg-white/[0.1] cursor-pointer transition-colors"
                    >
                      Limpar filtros
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => handleOpenCreate("aulas")}
                      className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-400 via-sky-400 to-emerald-400 text-xs font-semibold text-slate-950 hover:brightness-105 cursor-pointer transition-all"
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
                      className="bg-[#0b1224]/65 backdrop-blur-xl border border-white/10 rounded-2xl p-4 sm:p-5 hover:border-cyan-400/30 hover:bg-[#0e172e]/75 transition-all"
                    >
                      {/* Linha Superior: Metadados de Horário + Seletor Rápido de Status */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-white/[0.07]">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1.5 font-mono text-[11px] font-medium px-2.5 py-0.5 rounded-full border ${badgeStyle.pill}`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${badgeStyle.dot}`}
                            />
                            {STATUS_LABELS[aula.status]}
                          </span>

                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-200 bg-white/[0.05] border border-white/10 px-2.5 py-0.5 rounded-lg">
                            <Calendar className="h-3.5 w-3.5 text-cyan-300" />
                            {formatAulaPeriod(aula.data_aula, aula.data_fim)}
                          </span>

                          {aula.sala && (
                            <span className="inline-flex items-center gap-1 text-xs text-slate-300 px-2 py-0.5">
                              <MapPin className="h-3.5 w-3.5 text-emerald-300/80" />
                              {aula.sala}
                            </span>
                          )}
                        </div>

                        {/* Controle Rápido de Status via Custom Select + Ações Admin */}
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
                                    runAction(
                                      () =>
                                        updateAulaStatusAction({
                                          aulaId: aula.id,
                                          novoStatus: novoStatus as AulaStatus,
                                        }),
                                      undefined,
                                      "Atualização concluída"
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
                                aria-label="Editar dados da aula"
                                onClick={() => handleEditAula(aula)}
                                className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-transparent text-slate-400 hover:text-cyan-300 hover:bg-white/[0.08] hover:border-white/10 transition-colors cursor-pointer"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={isPending}
                                title="Excluir aula"
                                aria-label="Excluir aula"
                                onClick={() =>
                                  setPendingDelete({
                                    kind: "aula",
                                    id: aula.id,
                                    badge: aula.disciplina?.codigo ?? undefined,
                                    title:
                                      aula.disciplina?.nome ?? "Aula agendada",
                                    subtitle: `${formatAulaPeriod(
                                      aula.data_aula,
                                      aula.data_fim
                                    )}${
                                      aula.turma?.codigo
                                        ? ` · ${aula.turma.codigo}`
                                        : ""
                                    }`,
                                  })
                                }
                                className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-transparent text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 hover:border-rose-400/25 transition-colors cursor-pointer"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Grid Principal de 3 Colunas */}
                      <div className="mt-3.5 grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                        <div className="md:col-span-5 min-w-0">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
                            Disciplina
                          </span>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="font-mono text-[11px] font-semibold px-1.5 py-0.5 rounded bg-cyan-400/15 text-cyan-200 border border-cyan-400/25 shrink-0">
                              {aula.disciplina?.codigo}
                            </span>
                            <p className="text-sm font-semibold text-white truncate">
                              {aula.disciplina?.nome}
                            </p>
                          </div>
                        </div>

                        <div className="md:col-span-4 min-w-0">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
                            Turma & Período
                          </span>
                          <p className="text-xs font-medium text-slate-100 mt-1 truncate">
                            <span className="font-mono font-semibold text-cyan-200">
                              {aula.turma?.codigo}
                            </span>{" "}
                            · {aula.turma?.nome}
                          </p>
                          <span className="text-[11px] text-slate-400 block mt-0.5">
                            Semestre {aula.turma?.periodo} ·{" "}
                            {aula.turma?.turno
                              ? TURNO_LABELS[aula.turma.turno]
                              : ""}
                          </span>
                        </div>

                        <div className="md:col-span-3 min-w-0">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
                            Docente Responsável
                          </span>
                          <p className="text-xs font-medium text-slate-100 mt-1 truncate">
                            {aula.professor?.nome}
                          </p>
                          <span className="text-[11px] text-slate-400 block truncate mt-0.5">
                            {aula.professor?.email}
                          </span>
                        </div>
                      </div>

                      {(aula.conteudo_programatico || aula.observacoes) && (
                        <div className="mt-3.5 pt-3 border-t border-white/[0.07] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-300">
                          {aula.conteudo_programatico && (
                            <p className="truncate">
                              <strong className="font-medium text-white">
                                Conteúdo:
                              </strong>{" "}
                              {aula.conteudo_programatico}
                            </p>
                          )}
                          {aula.observacoes && (
                            <p className="text-slate-400 shrink-0">
                              <strong className="font-medium text-slate-200">
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
            TAB 2: DISCIPLINAS (TABELA GLASS COMPACTA)
           =================================================================== */}
        {activeTab === "disciplinas" && (
          <section className="bg-[#0b1224]/65 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/[0.08] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <h2 className="text-xs font-semibold text-white">
                  Catálogo de Disciplinas
                </h2>
                <span className="text-[11px] text-slate-400 hidden sm:inline">
                  · Matriz curricular disponível para alocação nas turmas
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.03] font-mono text-[10px] uppercase tracking-wider text-slate-400">
                    <th className="py-2.5 px-4 w-28">Código</th>
                    <th className="py-2.5 px-4">Disciplina</th>
                    <th className="py-2.5 px-4 w-32">Carga Horária</th>
                    {isAdmin && (
                      <th className="py-2.5 px-4 w-20 text-right">Ações</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06] text-xs">
                  {disciplinas.map((d) => (
                    <tr
                      key={d.id}
                      className="h-10 hover:bg-white/[0.04] transition-colors"
                    >
                      <td className="py-2 px-4 font-mono text-[11px] font-semibold whitespace-nowrap">
                        <span className="px-1.5 py-0.5 rounded bg-cyan-400/15 text-cyan-200 border border-cyan-400/25">
                          {d.codigo}
                        </span>
                      </td>
                      <td className="py-2 px-4 max-w-0 w-full">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-medium text-slate-100 shrink-0">
                            {d.nome}
                          </span>
                          {d.ementa && (
                            <span className="text-slate-400 truncate">
                              — {d.ementa}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-4 font-mono text-[11px] text-slate-300 whitespace-nowrap">
                        {d.carga_horaria}h
                      </td>
                      {isAdmin && (
                        <td className="py-2 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center justify-end gap-1">
                            <button
                              type="button"
                              disabled={isPending}
                              title="Editar disciplina"
                              aria-label="Editar disciplina"
                              onClick={() => handleEditDisciplina(d)}
                              className="p-1.5 rounded-md text-slate-400 hover:text-cyan-300 hover:bg-white/[0.08] transition-colors cursor-pointer"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={isPending}
                              title="Excluir disciplina"
                              aria-label="Excluir disciplina"
                              onClick={() =>
                                setPendingDelete({
                                  kind: "disciplina",
                                  id: d.id,
                                  badge: d.codigo,
                                  title: d.nome,
                                  subtitle: `${d.carga_horaria}h de carga horária`,
                                })
                              }
                              className="p-1.5 rounded-md text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors cursor-pointer"
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
            </div>
          </section>
        )}

        {/* ===================================================================
            TAB 3: TURMAS (TABELA GLASS COMPACTA)
           =================================================================== */}
        {activeTab === "turmas" && (
          <section className="bg-[#0b1224]/65 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/[0.08] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <h2 className="text-xs font-semibold text-white">
                  Turmas Ativas
                </h2>
                <span className="text-[11px] text-slate-400 hidden sm:inline">
                  · Organizadas por semestre letivo, turno e sala padrão
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.03] font-mono text-[10px] uppercase tracking-wider text-slate-400">
                    <th className="py-2.5 px-4 w-28">Código</th>
                    <th className="py-2.5 px-4">Turma</th>
                    <th className="py-2.5 px-4 w-44">Período / Turno</th>
                    <th className="py-2.5 px-4 w-44">Sala Padrão</th>
                    {isAdmin && (
                      <th className="py-2.5 px-4 w-20 text-right">Ações</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06] text-xs">
                  {turmas.map((t) => (
                    <tr
                      key={t.id}
                      className="h-10 hover:bg-white/[0.04] transition-colors"
                    >
                      <td className="py-2 px-4 font-mono text-[11px] font-semibold whitespace-nowrap">
                        <span className="px-1.5 py-0.5 rounded bg-cyan-400/15 text-cyan-200 border border-cyan-400/25">
                          {t.codigo}
                        </span>
                      </td>
                      <td className="py-2 px-4 font-medium text-slate-100">
                        {t.nome}
                      </td>
                      <td className="py-2 px-4 whitespace-nowrap">
                        <span className="font-mono text-[11px] text-slate-200">
                          {t.periodo}
                        </span>{" "}
                        ·{" "}
                        <span className="text-slate-400">
                          {TURNO_LABELS[t.turno as TurnoTipo]}
                        </span>
                      </td>
                      <td className="py-2 px-4 text-slate-300 whitespace-nowrap">
                        {t.sala_padrao ?? "—"}
                      </td>
                      {isAdmin && (
                        <td className="py-2 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center justify-end gap-1">
                            <button
                              type="button"
                              disabled={isPending}
                              title="Editar turma"
                              aria-label="Editar turma"
                              onClick={() => handleEditTurma(t)}
                              className="p-1.5 rounded-md text-slate-400 hover:text-cyan-300 hover:bg-white/[0.08] transition-colors cursor-pointer"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={isPending}
                              title="Excluir turma"
                              aria-label="Excluir turma"
                              onClick={() =>
                                setPendingDelete({
                                  kind: "turma",
                                  id: t.id,
                                  badge: t.codigo,
                                  title: t.nome,
                                  subtitle: `${t.periodo} · ${
                                    TURNO_LABELS[t.turno as TurnoTipo]
                                  }`,
                                })
                              }
                              className="p-1.5 rounded-md text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors cursor-pointer"
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
            </div>
          </section>
        )}

        {/* ===================================================================
            TAB 4: PROFESSORES (TABELA GLASS COMPACTA)
           =================================================================== */}
        {activeTab === "professores" && (
          <section className="bg-[#0b1224]/65 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/[0.08] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <h2 className="text-xs font-semibold text-white">
                  Corpo Docente
                </h2>
                <span className="text-[11px] text-slate-400 hidden sm:inline">
                  · Lista de professores e status de acesso ao sistema
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.03] font-mono text-[10px] uppercase tracking-wider text-slate-400">
                    <th className="py-2.5 px-4">Docente</th>
                    <th className="py-2.5 px-4 w-36">Titulação</th>
                    <th className="py-2.5 px-4">Contato</th>
                    <th className="py-2.5 px-4 w-36">Acesso ao Sistema</th>
                    {isAdmin && (
                      <th className="py-2.5 px-4 w-20 text-right">Ações</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06] text-xs">
                  {professores.map((p) => (
                    <tr
                      key={p.id}
                      className="h-10 hover:bg-white/[0.04] transition-colors"
                    >
                      <td className="py-2 px-4 font-medium text-slate-100 whitespace-nowrap">
                        {p.nome}
                      </td>
                      <td className="py-2 px-4 text-slate-300 whitespace-nowrap">
                        {p.titulacao}
                      </td>
                      <td className="py-2 px-4 whitespace-nowrap">
                        <span className="text-slate-200">{p.email}</span>
                        {p.telefone && (
                          <span className="text-slate-400 font-mono text-[11px] ml-2">
                            · {formatPhoneBr(p.telefone)}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-4 whitespace-nowrap">
                        {p.user_id ? (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-200 bg-emerald-400/12 border border-emerald-400/30 px-2 py-0.5 rounded-full">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                            Acesso Ativo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-400 bg-white/[0.06] border border-white/10 px-2 py-0.5 rounded-full">
                            <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
                            Sem Acesso
                          </span>
                        )}
                      </td>
                      {isAdmin && (
                        <td className="py-2 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center justify-end gap-1">
                            <button
                              type="button"
                              disabled={isPending}
                              title="Editar professor"
                              aria-label="Editar professor"
                              onClick={() => handleEditProfessor(p)}
                              className="p-1.5 rounded-md text-slate-400 hover:text-cyan-300 hover:bg-white/[0.08] transition-colors cursor-pointer"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={isPending}
                              title="Excluir professor"
                              aria-label="Excluir professor"
                              onClick={() =>
                                setPendingDelete({
                                  kind: "professor",
                                  id: p.id,
                                  badge: p.titulacao,
                                  title: p.nome,
                                  subtitle: p.email,
                                })
                              }
                              className="p-1.5 rounded-md text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors cursor-pointer"
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
            </div>
          </section>
        )}
      </main>

      {/* =====================================================================
          DIALOG 1: AGENDAR OU EDITAR AULA (COM SELECT & DATEPICKER)
         ===================================================================== */}
      <Dialog
        open={openModal === "aulas"}
        onClose={handleCloseModal}
        eyebrow="Agendamento Acadêmico"
        title={
          editingAula ? "Editar Aula na Grade" : "Agendar Nova Aula na Grade"
        }
        description={
          editingAula
            ? "Atualize o período, disciplina, turma ou docente desta aula."
            : "Defina a data inicial, data final, turma e docente responsável."
        }
      >
        {liveConflict && (
          <div className="mb-4 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-xs text-amber-200 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
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
                () => handleCloseModal(),
                "Atualização concluída"
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
                },
                "Cadastro realizado"
              );
            }
          }}
          className="space-y-4"
        >
          <div>
            <label className={GLASS_LABEL_CLASS}>Disciplina *</label>
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
              <label className={GLASS_LABEL_CLASS}>Turma *</label>
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
              <label className={GLASS_LABEL_CLASS}>Professor(a) *</label>
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={GLASS_LABEL_CLASS}>Data Inicial *</label>
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
              <label className={GLASS_LABEL_CLASS}>Data Final *</label>
              <DatePicker
                name="data_fim"
                value={draftAula.data_fim}
                onChange={(iso) =>
                  setDraftAula({ ...draftAula, data_fim: iso })
                }
                highlightedDates={scheduledDates}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={GLASS_LABEL_CLASS}>Status</label>
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
              <label className={GLASS_LABEL_CLASS}>Sala / Laboratório</label>
              <input
                type="text"
                name="sala"
                placeholder="Ex: Lab 03 - Bloco B"
                value={draftAula.sala}
                onChange={(e) =>
                  setDraftAula({ ...draftAula, sala: e.target.value })
                }
                className={GLASS_INPUT_CLASS}
              />
            </div>
          </div>

          <div>
            <label className={GLASS_LABEL_CLASS}>
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
              className={GLASS_TEXTAREA_CLASS}
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleCloseModal}
              className={GLASS_CANCEL_BTN_CLASS}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending || Boolean(liveConflict)}
              className={GLASS_PRIMARY_BTN_CLASS}
            >
              <Plus className="h-4 w-4" />
              <span>
                {editingAula ? "Salvar Alterações" : "Confirmar Agendamento"}
              </span>
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
        title={
          editingDisciplina ? "Editar Disciplina" : "Cadastrar Nova Disciplina"
        }
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
                () => handleCloseModal(),
                "Atualização concluída"
              );
            } else {
              runAction(
                () => createDisciplinaAction(fd),
                () => {
                  form.reset();
                  handleCloseModal();
                },
                "Cadastro realizado"
              );
            }
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={GLASS_LABEL_CLASS}>Código *</label>
              <input
                name="codigo"
                required
                defaultValue={editingDisciplina?.codigo ?? ""}
                placeholder="ENG-401"
                className={`${GLASS_INPUT_CLASS} font-mono uppercase`}
              />
            </div>
            <div>
              <label className={GLASS_LABEL_CLASS}>Carga Horária (h) *</label>
              <input
                name="carga_horaria"
                type="number"
                min={1}
                max={1000}
                defaultValue={editingDisciplina?.carga_horaria ?? 60}
                required
                className={`${GLASS_INPUT_CLASS} font-mono`}
              />
            </div>
          </div>

          <div>
            <label className={GLASS_LABEL_CLASS}>Nome da Disciplina *</label>
            <input
              name="nome"
              required
              defaultValue={editingDisciplina?.nome ?? ""}
              placeholder="Ex: Engenharia de Software II"
              className={GLASS_INPUT_CLASS}
            />
          </div>

          <div>
            <label className={GLASS_LABEL_CLASS}>Ementa Resumida</label>
            <textarea
              name="ementa"
              rows={3}
              defaultValue={editingDisciplina?.ementa ?? ""}
              placeholder="Principais tópicos da disciplina..."
              className={GLASS_TEXTAREA_CLASS}
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleCloseModal}
              className={GLASS_CANCEL_BTN_CLASS}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className={GLASS_PRIMARY_BTN_CLASS}
            >
              <Plus className="h-4 w-4" />
              <span>
                {editingDisciplina ? "Salvar Alterações" : "Salvar Disciplina"}
              </span>
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
                () => handleCloseModal(),
                "Atualização concluída"
              );
            } else {
              runAction(
                () => createTurmaAction(fd),
                () => {
                  form.reset();
                  handleCloseModal();
                },
                "Cadastro realizado"
              );
            }
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={GLASS_LABEL_CLASS}>Código *</label>
              <input
                name="codigo"
                required
                defaultValue={editingTurma?.codigo ?? ""}
                placeholder="ADS-4N"
                className={`${GLASS_INPUT_CLASS} font-mono uppercase`}
              />
            </div>
            <div>
              <label className={GLASS_LABEL_CLASS}>Período Letivo *</label>
              <input
                name="periodo"
                required
                defaultValue={editingTurma?.periodo ?? "2026.2"}
                placeholder="2026.2"
                className={`${GLASS_INPUT_CLASS} font-mono`}
              />
            </div>
          </div>

          <div>
            <label className={GLASS_LABEL_CLASS}>Nome da Turma *</label>
            <input
              name="nome"
              required
              defaultValue={editingTurma?.nome ?? ""}
              placeholder="Ex: Análise e Desenv. de Sistemas - 4º Sem"
              className={GLASS_INPUT_CLASS}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={GLASS_LABEL_CLASS}>Turno *</label>
              <Select
                name="turno"
                value={draftTurno}
                onChange={setDraftTurno}
                options={TURNO_OPTIONS}
                searchable={false}
              />
            </div>
            <div>
              <label className={GLASS_LABEL_CLASS}>Sala Padrão</label>
              <input
                name="sala_padrao"
                defaultValue={editingTurma?.sala_padrao ?? ""}
                placeholder="Lab 03 - Bloco B"
                className={GLASS_INPUT_CLASS}
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleCloseModal}
              className={GLASS_CANCEL_BTN_CLASS}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className={GLASS_PRIMARY_BTN_CLASS}
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
        title={
          editingProfessor ? "Editar Professor(a)" : "Cadastrar Professor(a)"
        }
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
                () => handleCloseModal(),
                "Atualização concluída"
              );
            } else {
              runAction(
                () => createProfessorAction(fd),
                () => {
                  form.reset();
                  setDraftTelefone("");
                  handleCloseModal();
                },
                "Cadastro realizado"
              );
            }
          }}
          className="space-y-4"
        >
          <div>
            <label className={GLASS_LABEL_CLASS}>Nome Completo *</label>
            <input
              name="nome"
              required
              defaultValue={editingProfessor?.nome ?? ""}
              placeholder="Ex: Prof. Dr. Marcos Vinicius"
              className={GLASS_INPUT_CLASS}
            />
          </div>

          <div>
            <label className={GLASS_LABEL_CLASS}>E-mail Institucional *</label>
            <input
              name="email"
              type="email"
              required
              defaultValue={editingProfessor?.email ?? ""}
              placeholder="marcos.vinicius@unopar.br"
              className={GLASS_INPUT_CLASS}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={GLASS_LABEL_CLASS}>Titulação *</label>
              <Select
                name="titulacao"
                value={draftTitulacao}
                onChange={setDraftTitulacao}
                options={TITULACAO_OPTIONS}
                searchable={false}
              />
            </div>
            <div>
              <label className={GLASS_LABEL_CLASS}>Telefone</label>
              <input
                name="telefone"
                type="tel"
                inputMode="numeric"
                maxLength={15}
                value={draftTelefone}
                onChange={(e) => setDraftTelefone(formatPhoneBr(e.target.value))}
                placeholder="(43) 99999-0000"
                className={GLASS_INPUT_CLASS}
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleCloseModal}
              className={GLASS_CANCEL_BTN_CLASS}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className={GLASS_PRIMARY_BTN_CLASS}
            >
              <Users className="h-4 w-4" />
              <span>
                {editingProfessor
                  ? "Salvar Alterações"
                  : "Salvar Professor(a)"}
              </span>
            </button>
          </div>
        </form>
      </Dialog>

      {/* =====================================================================
          DIALOG 5: CONFIRMAÇÃO DE EXCLUSÃO
         ===================================================================== */}
      <Dialog
        open={Boolean(pendingDelete)}
        onClose={() => {
          if (!isPending) setPendingDelete(null);
        }}
        eyebrow="Confirmação de Exclusão"
        title={
          pendingDelete ? DELETE_DIALOG_META[pendingDelete.kind].title : ""
        }
        description={
          pendingDelete
            ? DELETE_DIALOG_META[pendingDelete.kind].description
            : undefined
        }
      >
        {pendingDelete && (
          <div className="space-y-5">
            <div className="rounded-xl border border-rose-400/25 bg-rose-500/[0.08] p-4 flex items-start gap-3">
              <div className="h-9 w-9 rounded-lg bg-rose-500/15 border border-rose-400/30 text-rose-300 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {pendingDelete.badge && (
                    <span className="font-mono text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-rose-400/15 text-rose-200 border border-rose-400/30 shrink-0">
                      {pendingDelete.badge}
                    </span>
                  )}
                  <p className="text-sm font-semibold text-white truncate">
                    {pendingDelete.title}
                  </p>
                </div>
                {pendingDelete.subtitle && (
                  <p className="text-xs text-slate-300 mt-1 truncate">
                    {pendingDelete.subtitle}
                  </p>
                )}
              </div>
            </div>

            <div className="pt-1 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={isPending}
                onClick={() => setPendingDelete(null)}
                className={`${GLASS_CANCEL_BTN_CLASS} disabled:opacity-40`}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleConfirmDelete}
                className="h-9 inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-rose-500 via-red-500 to-orange-500 px-4 text-xs font-semibold text-white shadow-[0_4px_20px_-4px_rgba(244,63,94,0.5)] hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>
                  {isPending ? "Excluindo..." : "Confirmar Exclusão"}
                </span>
              </button>
            </div>
          </div>
        )}
      </Dialog>

      {/* =====================================================================
          FLOATING ORBITAL GLASS TOAST (VIEWPORT-FIXED)
         ===================================================================== */}
      {feedback && (
        <div
          key={feedback.id}
          role={feedback.type === "error" ? "alert" : "status"}
          aria-live="polite"
          className="fixed bottom-5 right-5 z-[60] max-w-sm w-[calc(100vw-2.5rem)] login-card-enter"
        >
          <div
            className={`relative overflow-hidden rounded-2xl border backdrop-blur-2xl p-4 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.85)] ring-1 ring-white/5 ${
              feedback.type === "success"
                ? "border-emerald-400/35 bg-[#0a1624]/92 shadow-[0_0_32px_-10px_rgba(52,211,153,0.45)]"
                : "border-rose-400/35 bg-[#190c17]/92 shadow-[0_0_32px_-10px_rgba(244,63,94,0.45)]"
            }`}
          >
            {/* Top specular highlight */}
            <div
              aria-hidden="true"
              className={`pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent to-transparent ${
                feedback.type === "success"
                  ? "via-emerald-300/70"
                  : "via-rose-300/70"
              }`}
            />

            <div className="flex items-start gap-3">
              <div
                className={`h-8 w-8 rounded-xl border flex items-center justify-center shrink-0 ${
                  feedback.type === "success"
                    ? "bg-emerald-400/15 border-emerald-400/30 text-emerald-300"
                    : "bg-rose-400/15 border-rose-400/30 text-rose-300"
                }`}
              >
                {feedback.type === "success" ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <AlertTriangle className="h-4 w-4" />
                )}
              </div>

              <div className="min-w-0 flex-1 pt-0.5">
                <p
                  className={`font-mono text-[10px] uppercase tracking-widest ${
                    feedback.type === "success"
                      ? "text-emerald-300"
                      : "text-rose-300"
                  }`}
                >
                  {feedback.title}
                </p>
                <p className="text-xs font-medium text-slate-100 mt-0.5 leading-relaxed">
                  {feedback.text}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setFeedback(null)}
                aria-label="Fechar notificação"
                className="h-7 w-7 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer shrink-0"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Auto-dismiss progress bar */}
            <div
              aria-hidden="true"
              className={`toast-progress-bar absolute inset-x-0 bottom-0 h-0.5 ${
                feedback.type === "success"
                  ? "bg-gradient-to-r from-cyan-400 to-emerald-400"
                  : "bg-gradient-to-r from-rose-400 to-orange-400"
              }`}
            />
          </div>
        </div>
      )}
    </div>
  );
}
