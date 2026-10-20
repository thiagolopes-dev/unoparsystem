"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  disciplinaSchema,
  turmaSchema,
  professorSchema,
  aulaSchema,
  detectScheduleConflict,
  canManageCatalog,
  canUpdateAula,
} from "@/domain/gestao-aulas";
import type { AulaStatus, UserRole } from "@/types/database.types";

export interface ActionResponse {
  ok: boolean;
  error?: string;
  message?: string;
}

async function getAuthenticatedUserContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, user: null, role: null as UserRole | null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, nome, email")
    .eq("id", user.id)
    .single();

  const role: UserRole =
    profile?.role ??
    ((user.app_metadata?.role as UserRole | undefined) || "PROFESSOR");

  return { supabase, user, role, profile };
}

// ============================================================================
// 1. Autenticação (Login / Logout)
// ============================================================================

export async function loginAction(formData: FormData): Promise<ActionResponse> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { ok: false, error: "Informe e-mail e senha para entrar." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return {
      ok: false,
      error: "Credenciais inválidas. Verifique seu e-mail e senha.",
    };
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function logoutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

// ============================================================================
// 2. CRUD de Disciplinas (Apenas ADMIN)
// ============================================================================

export async function createDisciplinaAction(
  formData: FormData
): Promise<ActionResponse> {
  const { supabase, user, role } = await getAuthenticatedUserContext();
  if (!user || !canManageCatalog(role)) {
    return {
      ok: false,
      error: "Acesso negado: apenas a Coordenação (ADMIN) pode cadastrar disciplinas.",
    };
  }

  const parsed = disciplinaSchema.safeParse({
    codigo: formData.get("codigo"),
    nome: formData.get("nome"),
    carga_horaria: formData.get("carga_horaria"),
    ementa: formData.get("ementa") || null,
    ativa: true,
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
    };
  }

  const { error } = await supabase.from("disciplinas").insert(parsed.data);
  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Já existe uma disciplina com este código." };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/");
  return { ok: true, message: "Disciplina cadastrada com sucesso." };
}

export async function deleteDisciplinaAction(
  id: string
): Promise<ActionResponse> {
  const { supabase, user, role } = await getAuthenticatedUserContext();
  if (!user || !canManageCatalog(role)) {
    return { ok: false, error: "Permissão negada." };
  }

  const { error } = await supabase.from("disciplinas").delete().eq("id", id);
  if (error) {
    if (error.code === "23503") {
      return {
        ok: false,
        error: "Não é possível excluir disciplina que já possui aulas vinculadas.",
      };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/");
  return { ok: true, message: "Disciplina removida." };
}

// ============================================================================
// 3. CRUD de Turmas (Apenas ADMIN)
// ============================================================================

export async function createTurmaAction(
  formData: FormData
): Promise<ActionResponse> {
  const { supabase, user, role } = await getAuthenticatedUserContext();
  if (!user || !canManageCatalog(role)) {
    return {
      ok: false,
      error: "Acesso negado: apenas a Coordenação (ADMIN) pode cadastrar turmas.",
    };
  }

  const parsed = turmaSchema.safeParse({
    codigo: formData.get("codigo"),
    nome: formData.get("nome"),
    periodo: formData.get("periodo"),
    turno: formData.get("turno"),
    sala_padrao: formData.get("sala_padrao") || null,
    ativa: true,
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
    };
  }

  const { error } = await supabase.from("turmas").insert(parsed.data);
  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Já existe uma turma com este código." };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/");
  return { ok: true, message: "Turma cadastrada com sucesso." };
}

export async function deleteTurmaAction(id: string): Promise<ActionResponse> {
  const { supabase, user, role } = await getAuthenticatedUserContext();
  if (!user || !canManageCatalog(role)) {
    return { ok: false, error: "Permissão negada." };
  }

  const { error } = await supabase.from("turmas").delete().eq("id", id);
  if (error) {
    if (error.code === "23503") {
      return {
        ok: false,
        error: "Não é possível excluir turma que já possui aulas vinculadas.",
      };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/");
  return { ok: true, message: "Turma removida." };
}

// ============================================================================
// 4. CRUD de Professores (Apenas ADMIN)
// ============================================================================

export async function createProfessorAction(
  formData: FormData
): Promise<ActionResponse> {
  const { supabase, user, role } = await getAuthenticatedUserContext();
  if (!user || !canManageCatalog(role)) {
    return {
      ok: false,
      error: "Acesso negado: apenas a Coordenação (ADMIN) pode cadastrar professores.",
    };
  }

  const parsed = professorSchema.safeParse({
    nome: formData.get("nome"),
    email: formData.get("email"),
    telefone: formData.get("telefone") || null,
    titulacao: formData.get("titulacao") || "Especialista",
    ativo: true,
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
    };
  }

  const { error } = await supabase.from("professores").insert(parsed.data);
  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        error: "Já existe um professor cadastrado com este e-mail.",
      };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/");
  return { ok: true, message: "Professor cadastrado com sucesso." };
}

export async function deleteProfessorAction(
  id: string
): Promise<ActionResponse> {
  const { supabase, user, role } = await getAuthenticatedUserContext();
  if (!user || !canManageCatalog(role)) {
    return { ok: false, error: "Permissão negada." };
  }

  const { error } = await supabase.from("professores").delete().eq("id", id);
  if (error) {
    if (error.code === "23503") {
      return {
        ok: false,
        error: "Não é possível excluir professor que já possui aulas alocadas.",
      };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/");
  return { ok: true, message: "Professor removido." };
}

// ============================================================================
// 5. Gestão de Aulas (Agendamento + Validação de Choque + Atualização de Status)
// ============================================================================

export async function createAulaAction(
  formData: FormData
): Promise<ActionResponse> {
  const { supabase, user, role } = await getAuthenticatedUserContext();
  if (!user || !canManageCatalog(role)) {
    return {
      ok: false,
      error: "Acesso negado: apenas a Coordenação (ADMIN) pode agendar novas aulas.",
    };
  }

  const parsed = aulaSchema.safeParse({
    disciplina_id: formData.get("disciplina_id"),
    turma_id: formData.get("turma_id"),
    professor_id: formData.get("professor_id"),
    data_aula: formData.get("data_aula"),
    hora_inicio: formData.get("hora_inicio"),
    hora_fim: formData.get("hora_fim"),
    status: (formData.get("status") as AulaStatus) || "AGENDADA",
    sala: formData.get("sala") || null,
    conteudo_programatico: formData.get("conteudo_programatico") || null,
    observacoes: formData.get("observacoes") || null,
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados da aula inválidos.",
    };
  }

  // Dupla checagem: camada de domínio + trigger PostgreSQL
  const { data: sameDayAulas } = await supabase
    .from("aulas")
    .select("id, professor_id, turma_id, data_aula, hora_inicio, hora_fim, status")
    .eq("data_aula", parsed.data.data_aula);

  const conflict = detectScheduleConflict(parsed.data, sameDayAulas ?? []);
  if (conflict.hasConflict) {
    return {
      ok: false,
      error: conflict.message ?? "Conflito de horário detectado.",
    };
  }

  const { error } = await supabase.from("aulas").insert(parsed.data);
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/");
  return { ok: true, message: "Aula agendada com sucesso." };
}

export async function updateAulaStatusAction(params: {
  aulaId: string;
  novoStatus: AulaStatus;
  conteudoProgramatico?: string;
}): Promise<ActionResponse> {
  const { supabase, user, role } = await getAuthenticatedUserContext();
  if (!user) {
    return { ok: false, error: "Sessão expirada." };
  }

  const { data: aula } = await supabase
    .from("aulas")
    .select("id, professor_id, professores(user_id)")
    .eq("id", params.aulaId)
    .single();

  if (!aula) {
    return { ok: false, error: "Aula não encontrada." };
  }

  const profRelation = aula.professores as unknown as
    | { user_id: string | null }
    | null;
  const aulaProfessorUserId = profRelation?.user_id ?? null;

  if (
    !canUpdateAula({
      userRole: role,
      userId: user.id,
      aulaProfessorUserId,
    })
  ) {
    return {
      ok: false,
      error:
        "Permissão negada: professores só podem atualizar o status de suas próprias aulas.",
    };
  }

  const updatePayload: { status: AulaStatus; conteudo_programatico?: string } = {
    status: params.novoStatus,
  };
  if (typeof params.conteudoProgramatico === "string") {
    updatePayload.conteudo_programatico = params.conteudoProgramatico.trim();
  }

  const { error } = await supabase
    .from("aulas")
    .update(updatePayload)
    .eq("id", params.aulaId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/");
  return { ok: true, message: "Status da aula atualizado." };
}

export async function deleteAulaAction(id: string): Promise<ActionResponse> {
  const { supabase, user, role } = await getAuthenticatedUserContext();
  if (!user || !canManageCatalog(role)) {
    return {
      ok: false,
      error: "Apenas a Coordenação (ADMIN) pode excluir registros de aula.",
    };
  }

  const { error } = await supabase.from("aulas").delete().eq("id", id);
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/");
  return { ok: true, message: "Aula excluída com sucesso." };
}
