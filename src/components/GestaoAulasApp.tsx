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
  createUsuarioAction,
  updateUsuarioAction,
  deleteUsuarioAction,
  createTermoUsoAction,
  updateTermoUsoAction,
  activateTermoUsoAction,
  deleteTermoUsoAction,
  logoutAction,
} from "@/app/actions";
import {
  ALL_USER_ROLES,
  buildGoogleMapsDirectionsUrl,
  buildGoogleMapsEmbedUrl,
  buildGoogleMapsPinUrl,
  canManageCatalog,
  canUpdateAula,
  canViewAcademicCatalog,
  formatPhoneBr,
  hasRole,
  ROLE_LABELS,
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
import { FirstAccessOnboardingModal } from "@/components/FirstAccessOnboardingModal";
import { RateLimitAdminPanel } from "@/components/RateLimitAdminPanel";
import {
  BookOpen,
  BookOpenCheck,
  Calendar,
  FileText,
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
  Eye,
  EyeOff,
  Check,
  Lock,
  KeyRound,
  Map as MapIcon,
  Navigation,
  ExternalLink,
  Copy,
  SlidersHorizontal,
} from "lucide-react";

function formatAulaPeriod(dataInicio: string, dataFim?: string | null): string {
  const inicioLabel = formatIsoDatePtBr(dataInicio);
  if (!dataFim || dataFim === dataInicio) {
    return inicioLabel;
  }
  return `${inicioLabel} até ${formatIsoDatePtBr(dataFim)}`;
}

function formatDateTimePtBr(iso: string): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

type DisciplinaRow = Database["public"]["Tables"]["disciplinas"]["Row"];
type TurmaRow = Database["public"]["Tables"]["turmas"]["Row"];
type ProfessorRow = Database["public"]["Tables"]["professores"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type TermoUsoRow = Database["public"]["Tables"]["termos_uso"]["Row"];
type TermoAceiteRow = Database["public"]["Tables"]["termos_aceites"]["Row"];
type RateLimitConfigRow =
  Database["public"]["Tables"]["rate_limit_config"]["Row"];
type RateLimitStateRow =
  Database["public"]["Tables"]["rate_limit_state"]["Row"];
type RateLimitAuditRow =
  Database["public"]["Tables"]["rate_limit_audit"]["Row"];
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
    roles: UserRole[];
    mustChangePassword: boolean;
  };
  disciplinas: DisciplinaRow[];
  turmas: TurmaRow[];
  professores: ProfessorRow[];
  usuarios: ProfileRow[];
  termosUso: TermoUsoRow[];
  termosAceites: TermoAceiteRow[];
  rateLimitConfig: RateLimitConfigRow | null;
  rateLimitStates: RateLimitStateRow[];
  rateLimitAudits: RateLimitAuditRow[];
  onboarding: {
    activeTermo: TermoUsoRow | null;
    needsAcceptTerms: boolean;
    needsChangePassword: boolean;
  };
  aulas: AulaEnriched[];
}

type ActiveTab =
  | "aulas"
  | "disciplinas"
  | "turmas"
  | "usuarios"
  | "termos"
  | "parametros";

const ROLE_BADGE_STYLES: Record<UserRole, string> = {
  ADMIN: "bg-cyan-400/15 text-cyan-200 border-cyan-400/30",
  PROFESSOR: "bg-indigo-400/15 text-indigo-200 border-indigo-400/30",
  ALUNO: "bg-emerald-400/15 text-emerald-200 border-emerald-400/30",
};

const ROLE_CHECKBOX_DESCRIPTIONS: Record<UserRole, string> = {
  ADMIN: "Acesso total a todas as abas, cadastros, edições e exclusões.",
  PROFESSOR:
    "Visualiza Grade, Disciplinas e Turmas (somente leitura) e fica disponível na alocação de aulas.",
  ALUNO: "Visualiza exclusivamente a Grade de Aulas (somente leitura).",
};

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

type DeleteEntityKind = "aula" | "disciplina" | "turma" | "usuario" | "termo";

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
  usuario: {
    title: "Excluir Usuário",
    description:
      "Esta ação removerá permanentemente o usuário e seu acesso ao sistema.",
  },
  termo: {
    title: "Excluir Termo de Uso",
    description:
      "Esta ação removerá permanentemente esta versão do termo de uso.",
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
  usuarios,
  termosUso,
  termosAceites,
  rateLimitConfig,
  rateLimitStates,
  rateLimitAudits,
  onboarding,
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

  // Controle de Modais de Criação e Edição
  const [openModal, setOpenModal] = useState<ActiveTab | null>(null);
  const [editingDisciplina, setEditingDisciplina] =
    useState<DisciplinaRow | null>(null);
  const [editingTurma, setEditingTurma] = useState<TurmaRow | null>(null);
  const [editingUsuario, setEditingUsuario] = useState<ProfileRow | null>(null);
  const [editingTermo, setEditingTermo] = useState<TermoUsoRow | null>(null);
  const [viewingAceiteMap, setViewingAceiteMap] =
    useState<TermoAceiteRow | null>(null);
  const [copiedCoords, setCopiedCoords] = useState(false);
  const [editingAula, setEditingAula] = useState<AulaEnriched | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{
    kind: DeleteEntityKind;
    id: string;
    title: string;
    subtitle?: string;
    badge?: string;
  } | null>(null);

  // Permissões RBAC derivadas dos perfis marcados (checkboxes)
  const isAdmin = canManageCatalog(currentUser.roles);
  const isProfessor = hasRole(currentUser.roles, "PROFESSOR");
  const canViewCatalogTabs = canViewAcademicCatalog(currentUser.roles);
  const isAlunoOnly = !isAdmin && !isProfessor;

  // Filtros da Grade de Aulas
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterDate, setFilterDate] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("TODOS");
  const [filterTurmaId, setFilterTurmaId] = useState<string>("TODAS");
  const [filterProfId, setFilterProfId] = useState<string>("TODOS");
  const [onlyMyClasses, setOnlyMyClasses] = useState<boolean>(
    !isAdmin && isProfessor
  );

  // Estado dos formulários de Turma, Usuário e Termo de Uso
  const [draftTurno, setDraftTurno] = useState<string>("NOTURNO");
  const [draftUsuarioRole, setDraftUsuarioRole] = useState<UserRole>("ALUNO");
  const [draftTitulacao, setDraftTitulacao] = useState<string>("Mestre");
  const [draftTelefone, setDraftTelefone] = useState<string>("");
  const [showUserPassword, setShowUserPassword] = useState(false);
  const [showUserConfirmPassword, setShowUserConfirmPassword] = useState(false);
  const [draftTermoAtivo, setDraftTermoAtivo] = useState<boolean>(true);

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

  const userById = useMemo(
    () => new Map(usuarios.map((u) => [u.id, u])),
    [usuarios]
  );

  const termoById = useMemo(
    () => new Map(termosUso.map((t) => [t.id, t])),
    [termosUso]
  );

  const activeTermoId = useMemo(
    () => termosUso.find((t) => t.ativo)?.id ?? null,
    [termosUso]
  );

  const acceptedActiveUserIds = useMemo(() => {
    if (!activeTermoId) return new Set<string>();
    return new Set(
      termosAceites
        .filter((a) => a.termo_id === activeTermoId)
        .map((a) => a.user_id)
    );
  }, [termosAceites, activeTermoId]);

  const aceitesCountByTermo = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of termosAceites) {
      counts.set(a.termo_id, (counts.get(a.termo_id) ?? 0) + 1);
    }
    return counts;
  }, [termosAceites]);

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
    setEditingUsuario(null);
    setEditingTermo(null);
    setEditingAula(null);
    setShowUserPassword(false);
    setShowUserConfirmPassword(false);
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
    } else if (tab === "usuarios") {
      setDraftUsuarioRole("ALUNO");
      setDraftTitulacao("Mestre");
      setDraftTelefone("");
    } else if (tab === "termos") {
      setDraftTermoAtivo(true);
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

  function handleEditUsuario(u: ProfileRow) {
    setEditingUsuario(u);
    setDraftUsuarioRole(u.role);
    setDraftTitulacao(u.titulacao || "Mestre");
    setDraftTelefone(formatPhoneBr(u.telefone ?? ""));
    setShowUserPassword(false);
    setShowUserConfirmPassword(false);
    setOpenModal("usuarios");
  }

  function handleEditTermo(t: TermoUsoRow) {
    setEditingTermo(t);
    setDraftTermoAtivo(t.ativo);
    setOpenModal("termos");
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
    setEditingUsuario(null);
    setEditingTermo(null);
    setEditingAula(null);
    setDraftTelefone("");
    setShowUserPassword(false);
    setShowUserConfirmPassword(false);
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
      usuario: deleteUsuarioAction,
      termo: deleteTermoUsoAction,
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

  const activeBlockedCount = useMemo(() => {
    const now = Date.now();
    return rateLimitStates.filter(
      (s) => s.blocked_until && new Date(s.blocked_until).getTime() > now
    ).length;
  }, [rateLimitStates]);

  const ctaButtonLabel: Partial<Record<ActiveTab, string>> = {
    aulas: "Agendar Aula",
    disciplinas: "Nova Disciplina",
    turmas: "Nova Turma",
    usuarios: "Novo Usuário",
    termos: "Novo Termo",
  };

  const visibleTabs = useMemo(() => {
    const tabs: {
      id: ActiveTab;
      label: string;
      count: number;
      icon: typeof Calendar;
      alert?: boolean;
    }[] = [
      {
        id: "aulas",
        label: "Grade de Aulas",
        count: aulas.length,
        icon: Calendar,
      },
    ];

    if (canViewCatalogTabs) {
      tabs.push(
        {
          id: "disciplinas",
          label: "Disciplinas",
          count: disciplinas.length,
          icon: BookOpen,
        },
        {
          id: "turmas",
          label: "Turmas",
          count: turmas.length,
          icon: Layers,
        }
      );
    }

    if (isAdmin) {
      tabs.push(
        {
          id: "usuarios",
          label: "Usuários",
          count: usuarios.length,
          icon: Users,
        },
        {
          id: "termos",
          label: "Termos de Uso",
          count: termosUso.length,
          icon: FileText,
        },
        {
          id: "parametros",
          label: "Parâmetros",
          count: activeBlockedCount,
          icon: SlidersHorizontal,
          alert: activeBlockedCount > 0,
        }
      );
    }

    return tabs;
  }, [
    activeBlockedCount,
    aulas.length,
    canViewCatalogTabs,
    disciplinas.length,
    isAdmin,
    termosUso.length,
    turmas.length,
    usuarios.length,
  ]);

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
              <div className="flex items-center justify-end gap-1.5 flex-wrap">
                <span className="text-xs font-medium text-slate-100">
                  {currentUser.nome}
                </span>
                {currentUser.roles.map((r) => (
                  <span
                    key={r}
                    className={`font-mono text-[10px] uppercase px-1.5 py-0.5 rounded border ${ROLE_BADGE_STYLES[r]}`}
                  >
                    {ROLE_LABELS[r]}
                  </span>
                ))}
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

        {/* Navigation Tabs + Primary Action Button (oculta para Aluno, que visualiza apenas a Grade) */}
        {!isAlunoOnly && (
          <div className="max-w-7xl mx-auto px-4 sm:px-8 flex items-center justify-between gap-4 border-t border-white/[0.07]">
            <div className="flex items-center gap-1 overflow-x-auto">
              {visibleTabs.map((tab) => {
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
                        tab.alert
                          ? "bg-rose-500/20 text-rose-200 border-rose-400/40"
                          : active
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

            {isAdmin && ctaButtonLabel[activeTab] && (
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
        )}
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-7xl w-full mx-auto px-4 sm:px-8 py-6 flex-1 space-y-5">
        {/* Compact KPI Strip (exibido somente na aba Grade de Aulas) */}
        {activeTab === "aulas" && (
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
        )}

        {/* RBAC Notice Banner para perfis somente leitura (Professor / Aluno) */}
        {!isAdmin && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-cyan-400/20 bg-cyan-400/[0.05] backdrop-blur-xl px-4 py-3 text-xs text-slate-300">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-cyan-300 shrink-0" />
              {isProfessor ? (
                <span>
                  Modo <strong className="text-white">Professor</strong> ativo:
                  visualização completa da Grade de Aulas, Disciplinas e Turmas
                  (somente leitura).
                </span>
              ) : (
                <span>
                  Modo <strong className="text-white">Aluno</strong> ativo:
                  visualização exclusiva da Grade de Aulas.
                </span>
              )}
            </div>
            <span className="font-mono text-[11px] text-cyan-300/70 shrink-0 hidden sm:inline">
              Somente Leitura
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

              {isProfessor && !isAdmin && (
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
                    userRoles: currentUser.roles,
                    userId: currentUser.id,
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
        {activeTab === "disciplinas" && canViewCatalogTabs && (
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
        {activeTab === "turmas" && canViewCatalogTabs && (
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
            TAB 4: USUÁRIOS (GESTÃO UNIFICADA MULTI-PERFIL — APENAS ADMIN)
           =================================================================== */}
        {activeTab === "usuarios" && isAdmin && (
          <section className="bg-[#0b1224]/65 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/[0.08] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <h2 className="text-xs font-semibold text-white">
                  Usuários do Sistema
                </h2>
                <span className="text-[11px] text-slate-400 hidden sm:inline">
                  · Perfis via checkbox (Admin, Professor, Aluno), titulação
                  docente e status de primeiro acesso
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.03] font-mono text-[10px] uppercase tracking-wider text-slate-400">
                    <th className="py-2.5 px-4">Usuário</th>
                    <th className="py-2.5 px-4">Perfis</th>
                    <th className="py-2.5 px-4 w-36">Titulação</th>
                    <th className="py-2.5 px-4 w-52">Primeiro Acesso / Termo</th>
                    <th className="py-2.5 px-4 w-20 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06] text-xs">
                  {usuarios.map((u) => {
                    const userRoles = u.roles?.length ? u.roles : [u.role];
                    const isSelf = u.id === currentUser.id;
                    const acceptedTerm = acceptedActiveUserIds.has(u.id);
                    return (
                      <tr
                        key={u.id}
                        className="h-12 hover:bg-white/[0.04] transition-colors"
                      >
                        <td className="py-2 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-100">
                              {u.nome}
                            </span>
                            {isSelf && (
                              <span className="font-mono text-[9px] uppercase px-1.5 py-0.5 rounded bg-white/10 text-slate-300 border border-white/10">
                                Você
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            <span>{u.email}</span>
                            {u.telefone && (
                              <span className="font-mono ml-2">
                                · {formatPhoneBr(u.telefone)}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-4 whitespace-nowrap">
                          <div className="flex flex-wrap items-center gap-1">
                            {userRoles.map((r) => (
                              <span
                                key={r}
                                className={`font-mono text-[10px] uppercase px-2 py-0.5 rounded-md border ${ROLE_BADGE_STYLES[r]}`}
                              >
                                {ROLE_LABELS[r]}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-2 px-4 text-slate-300 whitespace-nowrap">
                          {userRoles.includes("PROFESSOR") && u.titulacao
                            ? u.titulacao
                            : "—"}
                        </td>
                        <td className="py-2 px-4 whitespace-nowrap">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {u.must_change_password ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-200 bg-amber-400/12 border border-amber-400/30 px-2 py-0.5 rounded-full">
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                                1º Acesso Pendente
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-200 bg-emerald-400/12 border border-emerald-400/30 px-2 py-0.5 rounded-full">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                Senha Definida
                              </span>
                            )}
                            {activeTermoId && (
                              <span
                                className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                                  acceptedTerm
                                    ? "text-cyan-200 bg-cyan-400/12 border-cyan-400/30"
                                    : "text-slate-400 bg-white/[0.05] border-white/10"
                                }`}
                              >
                                {acceptedTerm
                                  ? "Termo Aceito"
                                  : "Termo Pendente"}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center justify-end gap-1">
                            <button
                              type="button"
                              disabled={isPending}
                              title="Editar usuário"
                              aria-label="Editar usuário"
                              onClick={() => handleEditUsuario(u)}
                              className="p-1.5 rounded-md text-slate-400 hover:text-cyan-300 hover:bg-white/[0.08] transition-colors cursor-pointer"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={isPending || isSelf}
                              title={
                                isSelf
                                  ? "Você não pode excluir sua própria conta"
                                  : "Excluir usuário"
                              }
                              aria-label="Excluir usuário"
                              onClick={() =>
                                setPendingDelete({
                                  kind: "usuario",
                                  id: u.id,
                                  badge: userRoles
                                    .map((r) => ROLE_LABELS[r])
                                    .join(" · "),
                                  title: u.nome,
                                  subtitle: u.email,
                                })
                              }
                              className="p-1.5 rounded-md text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ===================================================================
            TAB 5: TERMOS DE USO & AUDITORIA DE ACEITES (APENAS ADMIN)
           =================================================================== */}
        {activeTab === "termos" && isAdmin && (
          <div className="space-y-4">
            <section className="bg-[#0b1224]/65 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-white/[0.08] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-xs font-semibold text-white">
                    Termos de Uso Cadastrados
                  </h2>
                  <span className="text-[11px] text-slate-400 hidden sm:inline">
                    · O termo vigente é exibido obrigatoriamente no 1º acesso de
                    cada usuário
                  </span>
                </div>
              </div>

              {termosUso.length === 0 ? (
                <div className="p-10 text-center">
                  <FileText className="h-8 w-8 text-cyan-300/40 mx-auto mb-2" />
                  <p className="text-sm font-medium text-slate-100">
                    Nenhum termo de uso cadastrado.
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Cadastre um termo vigente para exigir confirmação e captura
                    de geolocalização no primeiro acesso.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-white/[0.06]">
                  {termosUso.map((termo) => {
                    const totalAceites = aceitesCountByTermo.get(termo.id) ?? 0;
                    return (
                      <article
                        key={termo.id}
                        className="p-4 sm:p-5 hover:bg-white/[0.02] transition-colors"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded bg-cyan-400/15 text-cyan-200 border border-cyan-400/25">
                                v{termo.versao}
                              </span>
                              <h3 className="text-sm font-semibold text-white">
                                {termo.titulo}
                              </h3>
                              {termo.ativo ? (
                                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-200 bg-emerald-400/12 border border-emerald-400/30 px-2 py-0.5 rounded-full">
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                                  Vigente
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-400 bg-white/[0.05] border border-white/10 px-2 py-0.5 rounded-full">
                                  Inativo
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] font-mono text-slate-400">
                              Criado em {formatDateTimePtBr(termo.created_at)} ·{" "}
                              {totalAceites} aceite(s) registrado(s)
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {!termo.ativo && (
                              <button
                                type="button"
                                disabled={isPending}
                                onClick={() =>
                                  runAction(
                                    () => activateTermoUsoAction(termo.id),
                                    undefined,
                                    "Termo ativado"
                                  )
                                }
                                className="h-8 px-2.5 rounded-lg border border-emerald-400/30 bg-emerald-400/10 text-[11px] font-medium text-emerald-200 hover:bg-emerald-400/20 transition-colors cursor-pointer"
                              >
                                Definir Vigente
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={isPending}
                              title="Editar termo"
                              aria-label="Editar termo"
                              onClick={() => handleEditTermo(termo)}
                              className="p-1.5 rounded-md text-slate-400 hover:text-cyan-300 hover:bg-white/[0.08] transition-colors cursor-pointer"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={isPending}
                              title="Excluir termo"
                              aria-label="Excluir termo"
                              onClick={() =>
                                setPendingDelete({
                                  kind: "termo",
                                  id: termo.id,
                                  badge: `v${termo.versao}`,
                                  title: termo.titulo,
                                  subtitle: `${totalAceites} aceite(s) vinculado(s)`,
                                })
                              }
                              className="p-1.5 rounded-md text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="mt-3 rounded-xl border border-white/[0.07] bg-[#060b18]/65 p-3 text-xs text-slate-300 whitespace-pre-wrap max-h-36 overflow-y-auto leading-relaxed">
                          {termo.conteudo}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Auditoria de Aceites com Latitude e Longitude */}
            <section className="bg-[#0b1224]/65 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-white/[0.08] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-xs font-semibold text-white">
                    Registro de Aceites & Geolocalização
                  </h2>
                  <span className="text-[11px] text-slate-400 hidden sm:inline">
                    · Auditoria com data/hora, latitude e longitude capturadas
                    no aceite
                  </span>
                </div>
                <span className="font-mono text-[11px] text-cyan-300">
                  {termosAceites.length} registro(s)
                </span>
              </div>

              {termosAceites.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  Nenhum aceite registrado até o momento.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/[0.03] font-mono text-[10px] uppercase tracking-wider text-slate-400">
                        <th className="py-2.5 px-4">Usuário</th>
                        <th className="py-2.5 px-4 w-28">Termo</th>
                        <th className="py-2.5 px-4 w-40">Data / Hora</th>
                        <th className="py-2.5 px-4">Geolocalização (Lat / Lng)</th>
                        <th className="py-2.5 px-4 w-56 text-right">
                          Mapa & Rota
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.06] text-xs">
                      {termosAceites.map((aceite) => {
                        const u = userById.get(aceite.user_id);
                        const t = termoById.get(aceite.termo_id);
                        const routeUrl = buildGoogleMapsDirectionsUrl(
                          aceite.latitude,
                          aceite.longitude
                        );
                        return (
                          <tr
                            key={aceite.id}
                            className="h-12 hover:bg-white/[0.04] transition-colors"
                          >
                            <td className="py-2 px-4 whitespace-nowrap">
                              <span className="font-medium text-slate-100 block">
                                {u?.nome ?? "Usuário"}
                              </span>
                              <span className="text-[11px] text-slate-400 font-mono">
                                {u?.email ?? aceite.user_id}
                              </span>
                            </td>
                            <td className="py-2 px-4 whitespace-nowrap">
                              <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-cyan-400/15 text-cyan-200 border border-cyan-400/25">
                                v{t?.versao ?? "—"}
                              </span>
                            </td>
                            <td className="py-2 px-4 font-mono text-[11px] text-slate-300 whitespace-nowrap">
                              {formatDateTimePtBr(aceite.accepted_at)}
                            </td>
                            <td className="py-2 px-4 font-mono text-[11px] text-emerald-200 whitespace-nowrap">
                              <span className="inline-flex items-center gap-1.5">
                                <MapPin className="h-3.5 w-3.5 text-emerald-300" />
                                {aceite.latitude.toFixed(6)},{" "}
                                {aceite.longitude.toFixed(6)}
                              </span>
                            </td>
                            <td className="py-2 px-4 text-right whitespace-nowrap">
                              <div className="inline-flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCopiedCoords(false);
                                    setViewingAceiteMap(aceite);
                                  }}
                                  className="h-7 px-2.5 inline-flex items-center gap-1.5 rounded-lg border border-cyan-400/30 bg-cyan-400/10 text-[11px] font-medium text-cyan-200 hover:bg-cyan-400/20 hover:text-white transition-colors cursor-pointer"
                                >
                                  <MapIcon className="h-3.5 w-3.5" />
                                  <span>Ver no Mapa</span>
                                </button>
                                <a
                                  href={routeUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="h-7 px-2.5 inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/30 bg-emerald-400/10 text-[11px] font-medium text-emerald-200 hover:bg-emerald-400/20 hover:text-white transition-colors"
                                >
                                  <Navigation className="h-3.5 w-3.5" />
                                  <span>Montar Rota</span>
                                </a>
                              </div>
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
        )}

        {/* ===================================================================
            TAB 6: PARÂMETROS DE RATE LIMIT, BLOQUEADOS & AUDITORIA (ADMIN)
           =================================================================== */}
        {activeTab === "parametros" && isAdmin && (
          <RateLimitAdminPanel
            config={rateLimitConfig}
            states={rateLimitStates}
            audits={rateLimitAudits}
            usuarios={usuarios}
            isPending={isPending}
            onRunAction={runAction}
          />
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
          DIALOG 4: CADASTRAR OU EDITAR USUÁRIO (SELEÇÃO ÚNICA DE PERFIL)
         ===================================================================== */}
      <Dialog
        open={openModal === "usuarios"}
        onClose={handleCloseModal}
        eyebrow="Controle de Acesso"
        title={editingUsuario ? "Editar Usuário" : "Cadastrar Novo Usuário"}
        description={
          editingUsuario
            ? "Atualize os dados, o perfil de acesso ou redefina a senha deste usuário."
            : "Selecione o perfil de acesso (apenas uma opção) e defina a senha inicial. No 1º login o usuário aceitará os Termos de Uso e definirá uma nova senha."
        }
      >
        <form
          key={editingUsuario ? editingUsuario.id : "new-usuario"}
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const fd = new FormData(form);
            fd.delete("roles");
            fd.append("roles", draftUsuarioRole);
            if (editingUsuario) {
              runAction(
                () => updateUsuarioAction(editingUsuario.id, fd),
                () => handleCloseModal(),
                "Atualização concluída"
              );
            } else {
              runAction(
                () => createUsuarioAction(fd),
                () => {
                  form.reset();
                  setDraftTelefone("");
                  handleCloseModal();
                },
                "Usuário cadastrado"
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
              defaultValue={editingUsuario?.nome ?? ""}
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
              defaultValue={editingUsuario?.email ?? ""}
              placeholder="usuario@unopar.br"
              className={GLASS_INPUT_CLASS}
            />
          </div>

          {/* Perfil de Acesso (Seleção Única Exclusiva) */}
          <fieldset>
            <legend className={GLASS_LABEL_CLASS}>Perfil de Acesso *</legend>
            <div className="space-y-2">
              {ALL_USER_ROLES.map((roleOption) => {
                const checked = draftUsuarioRole === roleOption;
                return (
                  <label
                    key={roleOption}
                    className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer select-none transition-all ${
                      checked
                        ? "border-cyan-400/50 bg-cyan-400/[0.08]"
                        : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="roles"
                      value={roleOption}
                      checked={checked}
                      onChange={() => setDraftUsuarioRole(roleOption)}
                      className="sr-only"
                    />
                    <span
                      aria-hidden="true"
                      className={`mt-0.5 h-4 w-4 rounded-full flex items-center justify-center border shrink-0 transition-colors ${
                        checked
                          ? "bg-cyan-400 border-cyan-300 text-slate-950"
                          : "border-white/25 bg-white/[0.05] text-transparent"
                      }`}
                    >
                      <Check className="h-2.5 w-2.5 stroke-[3.5]" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-white">
                          {ROLE_LABELS[roleOption]}
                        </span>
                        <span
                          className={`font-mono text-[9px] uppercase px-1.5 py-0.5 rounded border ${ROLE_BADGE_STYLES[roleOption]}`}
                        >
                          {roleOption}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                        {ROLE_CHECKBOX_DESCRIPTIONS[roleOption]}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {/* Campos condicionais quando o perfil PROFESSOR está selecionado */}
          {draftUsuarioRole === "PROFESSOR" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-indigo-400/25 bg-indigo-500/[0.06] p-3">
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
                  onChange={(e) =>
                    setDraftTelefone(formatPhoneBr(e.target.value))
                  }
                  placeholder="(43) 99999-0000"
                  className={GLASS_INPUT_CLASS}
                />
              </div>
            </div>
          )}

          {/* Senha e Confirmar Senha */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={GLASS_LABEL_CLASS}>
                {editingUsuario ? "Nova Senha (opcional)" : "Senha *"}
              </label>
              <div className="relative">
                <Lock className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  name="password"
                  type={showUserPassword ? "text" : "password"}
                  required={!editingUsuario}
                  minLength={editingUsuario ? undefined : 6}
                  autoComplete="new-password"
                  placeholder={
                    editingUsuario
                      ? "Manter senha atual"
                      : "Mínimo 6 caracteres"
                  }
                  className={`${GLASS_INPUT_CLASS} pl-9 pr-9`}
                />
                <button
                  type="button"
                  onClick={() => setShowUserPassword((prev) => !prev)}
                  aria-label={
                    showUserPassword ? "Ocultar senha" : "Mostrar senha"
                  }
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-cyan-300 cursor-pointer"
                >
                  {showUserPassword ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className={GLASS_LABEL_CLASS}>
                {editingUsuario
                  ? "Confirmar Nova Senha"
                  : "Confirmar Senha *"}
              </label>
              <div className="relative">
                <KeyRound className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  name="confirmPassword"
                  type={showUserConfirmPassword ? "text" : "password"}
                  required={!editingUsuario}
                  minLength={editingUsuario ? undefined : 6}
                  autoComplete="new-password"
                  placeholder="Repita a senha"
                  className={`${GLASS_INPUT_CLASS} pl-9 pr-9`}
                />
                <button
                  type="button"
                  onClick={() => setShowUserConfirmPassword((prev) => !prev)}
                  aria-label={
                    showUserConfirmPassword
                      ? "Ocultar confirmação"
                      : "Mostrar confirmação"
                  }
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-cyan-300 cursor-pointer"
                >
                  {showUserConfirmPassword ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
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
                {editingUsuario ? "Salvar Alterações" : "Cadastrar Usuário"}
              </span>
            </button>
          </div>
        </form>
      </Dialog>

      {/* =====================================================================
          DIALOG 5: CADASTRAR OU EDITAR TERMO DE USO
         ===================================================================== */}
      <Dialog
        open={openModal === "termos"}
        onClose={handleCloseModal}
        maxWidthClass="max-w-2xl"
        eyebrow="Conformidade & LGPD"
        title={
          editingTermo ? "Editar Termo de Uso" : "Cadastrar Novo Termo de Uso"
        }
        description="Defina o texto que será apresentado obrigatoriamente aos usuários no primeiro acesso com captura de geolocalização."
      >
        <form
          key={editingTermo ? editingTermo.id : "new-termo"}
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const fd = new FormData(form);
            fd.set("ativo", draftTermoAtivo ? "true" : "false");
            if (editingTermo) {
              runAction(
                () => updateTermoUsoAction(editingTermo.id, fd),
                () => handleCloseModal(),
                "Termo atualizado"
              );
            } else {
              runAction(
                () => createTermoUsoAction(fd),
                () => {
                  form.reset();
                  handleCloseModal();
                },
                "Termo cadastrado"
              );
            }
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className={GLASS_LABEL_CLASS}>Título do Termo *</label>
              <input
                name="titulo"
                required
                defaultValue={editingTermo?.titulo ?? ""}
                placeholder="Ex: Termos de Uso e Política de Privacidade"
                className={GLASS_INPUT_CLASS}
              />
            </div>
            <div>
              <label className={GLASS_LABEL_CLASS}>Versão *</label>
              <input
                name="versao"
                required
                defaultValue={editingTermo?.versao ?? "1.1"}
                placeholder="Ex: 1.1"
                className={`${GLASS_INPUT_CLASS} font-mono`}
              />
            </div>
          </div>

          <div>
            <label className={GLASS_LABEL_CLASS}>
              Conteúdo Completo do Termo *
            </label>
            <textarea
              name="conteudo"
              required
              rows={8}
              defaultValue={editingTermo?.conteudo ?? ""}
              placeholder="Descreva integralmente as cláusulas e condições de uso do sistema..."
              className={`${GLASS_TEXTAREA_CLASS} leading-relaxed`}
            />
          </div>

          <label className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-xs text-slate-200 cursor-pointer select-none hover:border-white/20 transition-colors">
            <input
              type="checkbox"
              checked={draftTermoAtivo}
              onChange={(e) => setDraftTermoAtivo(e.target.checked)}
              className="h-4 w-4 rounded border-white/25 bg-white/[0.06] accent-cyan-400 cursor-pointer"
            />
            <span>
              Definir como <strong className="text-white">Termo Vigente</strong>{" "}
              (desativa a versão anterior automaticamente)
            </span>
          </label>

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
              <FileText className="h-4 w-4" />
              <span>
                {editingTermo ? "Salvar Alterações" : "Salvar Termo de Uso"}
              </span>
            </button>
          </div>
        </form>
      </Dialog>

      {/* =====================================================================
          DIALOG 6: VISUALIZAÇÃO NO MAPA & ROTA DO ACEITE DE TERMOS
         ===================================================================== */}
      <Dialog
        open={Boolean(viewingAceiteMap)}
        onClose={() => setViewingAceiteMap(null)}
        maxWidthClass="max-w-2xl"
        eyebrow="Auditoria de Geolocalização"
        title="Localização do Aceite no Mapa"
        description={
          viewingAceiteMap
            ? `${
                userById.get(viewingAceiteMap.user_id)?.nome ?? "Usuário"
              } · Termo v${
                termoById.get(viewingAceiteMap.termo_id)?.versao ?? "—"
              } · ${formatDateTimePtBr(viewingAceiteMap.accepted_at)}`
            : undefined
        }
      >
        {viewingAceiteMap && (
          <div className="space-y-4">
            {/* Cards de Latitude, Longitude e Precisão */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5">
                <span className="block font-mono text-[10px] uppercase tracking-wider text-slate-400">
                  Latitude
                </span>
                <span className="font-mono text-xs font-semibold text-cyan-200 mt-0.5 block">
                  {viewingAceiteMap.latitude.toFixed(6)}
                </span>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5">
                <span className="block font-mono text-[10px] uppercase tracking-wider text-slate-400">
                  Longitude
                </span>
                <span className="font-mono text-xs font-semibold text-emerald-200 mt-0.5 block">
                  {viewingAceiteMap.longitude.toFixed(6)}
                </span>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5">
                <span className="block font-mono text-[10px] uppercase tracking-wider text-slate-400">
                  Precisão GPS
                </span>
                <span className="font-mono text-xs font-semibold text-slate-200 mt-0.5 block">
                  {viewingAceiteMap.accuracy
                    ? `± ${Math.round(viewingAceiteMap.accuracy)} m`
                    : "Padrão"}
                </span>
              </div>
            </div>

            {/* Mapa Interativo Embutido */}
            <div className="relative overflow-hidden rounded-xl border border-white/15 bg-[#060b18]">
              <iframe
                title="Mapa da localização do aceite dos termos"
                src={buildGoogleMapsEmbedUrl(
                  viewingAceiteMap.latitude,
                  viewingAceiteMap.longitude
                )}
                className="h-[340px] w-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>

            {/* Ações: Copiar, Abrir no Google Maps e Montar Rota */}
            <div className="pt-1 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={async () => {
                  const coordsText = `${viewingAceiteMap.latitude.toFixed(
                    6
                  )}, ${viewingAceiteMap.longitude.toFixed(6)}`;
                  try {
                    await navigator.clipboard.writeText(coordsText);
                    setCopiedCoords(true);
                    window.setTimeout(() => setCopiedCoords(false), 2200);
                  } catch {
                    // fallback silencioso
                  }
                }}
                className="h-9 px-3.5 inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.05] text-xs font-medium text-slate-200 hover:bg-white/[0.1] hover:text-white transition-colors cursor-pointer"
              >
                {copiedCoords ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-300" />
                    <span className="text-emerald-200">Coordenadas copiadas</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 text-slate-400" />
                    <span>Copiar Lat/Lng</span>
                  </>
                )}
              </button>

              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={buildGoogleMapsPinUrl(
                    viewingAceiteMap.latitude,
                    viewingAceiteMap.longitude
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-9 px-3.5 inline-flex items-center gap-1.5 rounded-xl border border-cyan-400/35 bg-cyan-400/10 text-xs font-medium text-cyan-200 hover:bg-cyan-400/20 hover:text-white transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>Abrir no Google Maps</span>
                </a>

                <a
                  href={buildGoogleMapsDirectionsUrl(
                    viewingAceiteMap.latitude,
                    viewingAceiteMap.longitude
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={GLASS_PRIMARY_BTN_CLASS}
                >
                  <Navigation className="h-3.5 w-3.5" />
                  <span>Montar Rota</span>
                </a>
              </div>
            </div>
          </div>
        )}
      </Dialog>

      {/* =====================================================================
          FLUXO OBRIGATÓRIO DE PRIMEIRO ACESSO (TERMO + LAT/LNG -> NOVA SENHA)
         ===================================================================== */}
      <FirstAccessOnboardingModal
        activeTermo={onboarding.activeTermo}
        initialNeedsAcceptTerms={onboarding.needsAcceptTerms}
        initialNeedsChangePassword={onboarding.needsChangePassword}
        userName={currentUser.nome}
        onCompleted={(message) =>
          setFeedback({
            id: Date.now(),
            type: "success",
            title: "Primeiro acesso concluído",
            text: message,
          })
        }
      />

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
