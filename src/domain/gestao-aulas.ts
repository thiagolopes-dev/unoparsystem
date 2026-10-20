import { z } from "zod";
import type { AulaStatus, TurnoTipo, UserRole } from "@/types/database.types";

// ============================================================================
// 1. Schemas de Validação (Zod) — Camada de Domínio
// ============================================================================

export const disciplinaSchema = z.object({
  codigo: z
    .string()
    .trim()
    .min(3, "O código deve ter pelo menos 3 caracteres")
    .max(20, "O código deve ter no máximo 20 caracteres")
    .transform((v) => v.toUpperCase()),
  nome: z
    .string()
    .trim()
    .min(3, "O nome da disciplina deve ter pelo menos 3 caracteres")
    .max(120, "O nome da disciplina é muito longo"),
  carga_horaria: z.coerce
    .number()
    .int("A carga horária deve ser um número inteiro")
    .min(1, "A carga horária deve ser maior que zero")
    .max(1000, "A carga horária máxima é 1000h"),
  ementa: z.string().trim().optional().nullable(),
  ativa: z.boolean().default(true),
});

export const turmaSchema = z.object({
  codigo: z
    .string()
    .trim()
    .min(3, "O código da turma deve ter pelo menos 3 caracteres")
    .max(20, "O código deve ter no máximo 20 caracteres")
    .transform((v) => v.toUpperCase()),
  nome: z
    .string()
    .trim()
    .min(3, "O nome da turma deve ter pelo menos 3 caracteres")
    .max(120, "O nome da turma é muito longo"),
  periodo: z
    .string()
    .trim()
    .regex(/^\d{4}\.[1-2]$/, "Use o formato AAAA.1 ou AAAA.2 (ex: 2026.2)"),
  turno: z.enum(["MATUTINO", "VESPERTINO", "NOTURNO"]),
  sala_padrao: z.string().trim().optional().nullable(),
  ativa: z.boolean().default(true),
});

export const professorSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(3, "O nome do professor deve ter pelo menos 3 caracteres")
    .max(120, "O nome do professor é muito longo"),
  email: z
    .string()
    .trim()
    .email("Informe um e-mail institucional válido")
    .transform((v) => v.toLowerCase()),
  telefone: z.string().trim().optional().nullable(),
  titulacao: z
    .string()
    .trim()
    .min(2, "Informe a titulação")
    .default("Especialista"),
  ativo: z.boolean().default(true),
});

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/;

export function normalizeTime(time: string): string {
  return time.trim().slice(0, 5);
}

export const aulaSchema = z
  .object({
    disciplina_id: z.string().uuid("Selecione uma disciplina válida"),
    turma_id: z.string().uuid("Selecione uma turma válida"),
    professor_id: z.string().uuid("Selecione um professor válido"),
    data_aula: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida (AAAA-MM-DD)"),
    hora_inicio: z
      .string()
      .regex(timeRegex, "Horário inicial inválido (HH:MM)")
      .transform(normalizeTime),
    hora_fim: z
      .string()
      .regex(timeRegex, "Horário final inválido (HH:MM)")
      .transform(normalizeTime),
    status: z
      .enum(["AGENDADA", "EM_ANDAMENTO", "CONCLUIDA", "CANCELADA"])
      .default("AGENDADA"),
    sala: z.string().trim().optional().nullable(),
    conteudo_programatico: z.string().trim().optional().nullable(),
    observacoes: z.string().trim().optional().nullable(),
  })
  .refine((data) => data.hora_fim > data.hora_inicio, {
    message: "O horário de término deve ser posterior ao horário de início",
    path: ["hora_fim"],
  });

// ============================================================================
// 2. Regra de Domínio: Prevenção de Choque de Horário (Professor e Turma)
// ============================================================================

export interface ExistingAulaSlot {
  id: string;
  professor_id: string;
  turma_id: string;
  data_aula: string;
  hora_inicio: string;
  hora_fim: string;
  status: AulaStatus;
}

export interface CandidateAulaSlot {
  id?: string;
  professor_id: string;
  turma_id: string;
  data_aula: string;
  hora_inicio: string;
  hora_fim: string;
  status: AulaStatus;
}

export interface ScheduleConflictResult {
  hasConflict: boolean;
  reason?: "PROFESSOR_CONFLICT" | "TURMA_CONFLICT";
  conflictingAulaId?: string;
  message?: string;
}

export function detectScheduleConflict(
  candidate: CandidateAulaSlot,
  existingSlots: ExistingAulaSlot[]
): ScheduleConflictResult {
  if (candidate.status === "CANCELADA") {
    return { hasConflict: false };
  }

  const candStart = normalizeTime(candidate.hora_inicio);
  const candEnd = normalizeTime(candidate.hora_fim);

  for (const slot of existingSlots) {
    if (candidate.id && slot.id === candidate.id) {
      continue;
    }
    if (slot.status === "CANCELADA") {
      continue;
    }
    if (slot.data_aula !== candidate.data_aula) {
      continue;
    }

    const slotStart = normalizeTime(slot.hora_inicio);
    const slotEnd = normalizeTime(slot.hora_fim);

    const overlaps = slotStart < candEnd && slotEnd > candStart;
    if (!overlaps) {
      continue;
    }

    if (slot.professor_id === candidate.professor_id) {
      return {
        hasConflict: true,
        reason: "PROFESSOR_CONFLICT",
        conflictingAulaId: slot.id,
        message: `Choque de horário: o professor selecionado já possui aula agendada das ${slotStart} às ${slotEnd} nesta data.`,
      };
    }

    if (slot.turma_id === candidate.turma_id) {
      return {
        hasConflict: true,
        reason: "TURMA_CONFLICT",
        conflictingAulaId: slot.id,
        message: `Choque de horário: a turma selecionada já possui aula agendada das ${slotStart} às ${slotEnd} nesta data.`,
      };
    }
  }

  return { hasConflict: false };
}

// ============================================================================
// 3. Regras de Autorização RBAC (Admin vs Professor)
// ============================================================================

export function canManageCatalog(role: UserRole | null | undefined): boolean {
  return role === "ADMIN";
}

export function canUpdateAula(params: {
  userRole: UserRole | null | undefined;
  userId: string | null | undefined;
  aulaProfessorUserId: string | null | undefined;
}): boolean {
  if (!params.userRole || !params.userId) {
    return false;
  }
  if (params.userRole === "ADMIN") {
    return true;
  }
  if (
    params.userRole === "PROFESSOR" &&
    Boolean(params.aulaProfessorUserId) &&
    params.userId === params.aulaProfessorUserId
  ) {
    return true;
  }
  return false;
}

export const TURNO_LABELS: Record<TurnoTipo, string> = {
  MATUTINO: "Matutino",
  VESPERTINO: "Vespertino",
  NOTURNO: "Noturno",
};

export const STATUS_LABELS: Record<AulaStatus, string> = {
  AGENDADA: "Agendada",
  EM_ANDAMENTO: "Em Andamento",
  CONCLUIDA: "Concluída",
  CANCELADA: "Cancelada",
};
