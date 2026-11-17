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

export function formatPhoneBr(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

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
  telefone: z
    .string()
    .trim()
    .optional()
    .nullable()
    .refine(
      (val) => {
        if (!val) return true;
        const digits = val.replace(/\D/g, "");
        return digits.length === 10 || digits.length === 11;
      },
      { message: "Informe um telefone válido com DDD: (00) 00000-0000" }
    )
    .transform((val) => {
      if (!val) return null;
      return formatPhoneBr(val);
    }),
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

const emptyToUndefined = (v: unknown) =>
  v === null || (typeof v === "string" && v.trim() === "") ? undefined : v;

export const aulaSchema = z
  .object({
    disciplina_id: z.string().uuid("Selecione uma disciplina válida"),
    turma_id: z.string().uuid("Selecione uma turma válida"),
    professor_id: z.string().uuid("Selecione um professor válido"),
    data_aula: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data inicial válida (AAAA-MM-DD)"),
    data_fim: z.preprocess(
      emptyToUndefined,
      z
        .string()
        .regex(
          /^\d{4}-\d{2}-\d{2}$/,
          "Informe uma data final válida (AAAA-MM-DD)"
        )
        .optional()
    ),
    hora_inicio: z.preprocess(
      emptyToUndefined,
      z
        .string()
        .regex(timeRegex, "Horário inicial inválido (HH:MM)")
        .transform(normalizeTime)
        .default("08:00")
    ),
    hora_fim: z.preprocess(
      emptyToUndefined,
      z
        .string()
        .regex(timeRegex, "Horário final inválido (HH:MM)")
        .transform(normalizeTime)
        .default("22:00")
    ),
    status: z
      .enum(["AGENDADA", "EM_ANDAMENTO", "CONCLUIDA", "CANCELADA"])
      .default("AGENDADA"),
    sala: z.string().trim().optional().nullable(),
    conteudo_programatico: z.string().trim().optional().nullable(),
    observacoes: z.string().trim().optional().nullable(),
  })
  .transform((data) => ({
    ...data,
    data_fim: data.data_fim ?? data.data_aula,
  }))
  .refine((data) => data.data_fim >= data.data_aula, {
    message: "A data final deve ser igual ou posterior à data inicial",
    path: ["data_fim"],
  })
  .refine((data) => data.hora_fim > data.hora_inicio, {
    message: "O horário de término deve ser posterior ao horário de início",
    path: ["hora_fim"],
  });

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Informe um e-mail institucional válido")
    .transform((v) => v.toLowerCase()),
});

export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(6, "A nova senha deve ter pelo menos 6 caracteres")
      .max(72, "A senha deve ter no máximo 72 caracteres"),
    confirmPassword: z
      .string()
      .min(1, "Confirme a nova senha"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas informadas não coincidem",
    path: ["confirmPassword"],
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
