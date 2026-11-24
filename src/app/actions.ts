"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  disciplinaSchema,
  turmaSchema,
  aulaSchema,
  createUsuarioSchema,
  updateUsuarioSchema,
  termoUsoSchema,
  termoAceiteSchema,
  rateLimitConfigSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  normalizeUserRoles,
  resolvePrimaryRole,
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
    return {
      supabase,
      user: null,
      role: null as UserRole | null,
      roles: [] as UserRole[],
      profile: null,
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, roles, nome, email, titulacao, must_change_password")
    .eq("id", user.id)
    .single();

  const metaRoles = Array.isArray(user.app_metadata?.roles)
    ? (user.app_metadata.roles as string[])
    : undefined;
  const fallbackRole =
    profile?.role ??
    (user.app_metadata?.role as UserRole | undefined) ??
    "ALUNO";

  const roles = normalizeUserRoles(profile?.roles ?? metaRoles, fallbackRole);
  const role = resolvePrimaryRole(roles);

  return { supabase, user, role, roles, profile };
}

// ============================================================================
// 1. Autenticação (Login / Logout / Recuperação / Primeiro Acesso)
// ============================================================================

export async function loginAction(formData: FormData): Promise<ActionResponse> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { ok: false, error: "Informe e-mail e senha para entrar." };
  }

  // Verifica se o e-mail está com bloqueio ativo de Rate Limit
  try {
    const admin = createAdminClient();
    const { data: blockedState } = await admin
      .from("rate_limit_state")
      .select("blocked_until")
      .eq("identifier", `login:${email}`)
      .gt("blocked_until", new Date().toISOString())
      .maybeSingle();

    if (blockedState?.blocked_until) {
      const remMins = Math.max(
        1,
        Math.ceil(
          (new Date(blockedState.blocked_until).getTime() - Date.now()) / 60000
        )
      );
      return {
        ok: false,
        error: `Acesso bloqueado temporariamente por excesso de tentativas (aguarde ~${remMins} min ou solicite liberação ao Administrador).`,
      };
    }
  } catch {
    // Não interrompe login se consulta auxiliar falhar
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

export async function requestPasswordResetAction(
  formData: FormData
): Promise<ActionResponse> {
  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Informe um e-mail válido.",
    };
  }

  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") || headerStore.get("host");
  const proto = headerStore.get("x-forwarded-proto") || "http";
  const origin =
    headerStore.get("origin") ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    (host ? `${proto}://${host}` : "http://127.0.0.1:3000");

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(
    parsed.data.email,
    {
      redirectTo: `${origin}/auth/callback`,
    }
  );

  if (error) {
    const msg = error.message.toLowerCase();
    if (
      error.status === 429 ||
      error.code === "over_email_send_rate_limit" ||
      msg.includes("rate limit") ||
      msg.includes("security purposes")
    ) {
      return {
        ok: false,
        error:
          "Muitas solicitações em sequência. Aguarde alguns instantes antes de tentar novamente.",
      };
    }

    return {
      ok: false,
      error:
        "Não foi possível enviar o e-mail de recuperação no momento. Tente novamente em instantes.",
    };
  }

  return {
    ok: true,
    message:
      "Se o e-mail informado estiver cadastrado, você receberá um link (e um código de 6 dígitos) para redefinir sua senha em instantes.",
  };
}

export async function verifyRecoveryCodeAction(
  formData: FormData
): Promise<ActionResponse> {
  const emailParsed = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });

  if (!emailParsed.success) {
    return {
      ok: false,
      error: emailParsed.error.issues[0]?.message ?? "Informe um e-mail válido.",
    };
  }

  const token = String(formData.get("code") ?? "").replace(/\D/g, "").trim();
  if (token.length < 6) {
    return {
      ok: false,
      error: "Informe o código de 6 dígitos enviado para o seu e-mail.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    email: emailParsed.data.email,
    token,
    type: "recovery",
  });

  if (error) {
    return {
      ok: false,
      error:
        "Código inválido ou expirado. Solicite um novo e-mail de recuperação.",
    };
  }

  revalidatePath("/", "layout");
  redirect("/redefinir-senha");
}

function mapPasswordUpdateError(error: {
  code?: string;
  status?: number;
  message: string;
}): string {
  const msg = error.message.toLowerCase();
  if (
    error.code === "same_password" ||
    msg.includes("different from the old password") ||
    msg.includes("same password")
  ) {
    return "A nova senha deve ser diferente da senha atual.";
  }
  if (
    error.code === "weak_password" ||
    msg.includes("weak") ||
    msg.includes("at least")
  ) {
    return "A senha informada não atende aos requisitos mínimos de segurança.";
  }
  if (error.status === 401 || error.status === 403) {
    return "Sessão inválida ou expirada. Faça login novamente.";
  }
  return "Não foi possível atualizar a senha. Tente novamente.";
}

export async function updatePasswordAction(
  formData: FormData
): Promise<ActionResponse> {
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      error:
        "Sessão de recuperação inválida ou expirada. Solicite um novo link na tela de login.",
    };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    return { ok: false, error: mapPasswordUpdateError(error) };
  }

  try {
    const admin = createAdminClient();
    await admin
      .from("profiles")
      .update({ must_change_password: false })
      .eq("id", user.id);
  } catch {
    // Não bloqueia recuperação de senha caso o cliente admin não esteja disponível
  }

  revalidatePath("/", "layout");
  return {
    ok: true,
    message: "Senha atualizada com sucesso!",
  };
}

export async function acceptTermoUsoAction(params: {
  termoId: string;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
}): Promise<ActionResponse> {
  const { supabase, user } = await getAuthenticatedUserContext();
  if (!user) {
    return { ok: false, error: "Sessão expirada. Faça login novamente." };
  }

  const parsed = termoAceiteSchema.safeParse({
    termo_id: params.termoId,
    latitude: params.latitude,
    longitude: params.longitude,
    accuracy: params.accuracy ?? null,
  });

  if (!parsed.success) {
    return {
      ok: false,
      error:
        parsed.error.issues[0]?.message ??
        "Não foi possível validar os dados de aceite e geolocalização.",
    };
  }

  const headerStore = await headers();
  const userAgent = headerStore.get("user-agent") ?? null;

  const { error } = await supabase.from("termos_aceites").upsert(
    {
      termo_id: parsed.data.termo_id,
      user_id: user.id,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      accuracy: parsed.data.accuracy ?? null,
      user_agent: userAgent,
    },
    { onConflict: "termo_id,user_id" }
  );

  if (error) {
    return {
      ok: false,
      error: "Não foi possível registrar o aceite dos termos: " + error.message,
    };
  }

  revalidatePath("/");
  return {
    ok: true,
    message: "Termos de uso aceitos com registro de geolocalização.",
  };
}

export async function completeFirstAccessPasswordAction(
  formData: FormData
): Promise<ActionResponse> {
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
    };
  }

  const { supabase, user, roles } = await getAuthenticatedUserContext();
  if (!user) {
    return { ok: false, error: "Sessão expirada. Faça login novamente." };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    return { ok: false, error: mapPasswordUpdateError(error) };
  }

  const admin = createAdminClient();
  const { error: profileError } = await admin
    .from("profiles")
    .update({ must_change_password: false })
    .eq("id", user.id);

  if (profileError) {
    return {
      ok: false,
      error:
        "Senha alterada, mas houve erro ao concluir o primeiro acesso: " +
        profileError.message,
    };
  }

  await admin.auth.admin.updateUserById(user.id, {
    app_metadata: {
      ...(user.app_metadata ?? {}),
      role: resolvePrimaryRole(roles),
      roles,
      must_change_password: false,
    },
  });

  revalidatePath("/", "layout");
  return {
    ok: true,
    message: "Nova senha definida com sucesso! Bem-vindo ao UnoparSystem.",
  };
}

// ============================================================================
// 2. CRUD de Disciplinas (Apenas ADMIN)
// ============================================================================

export async function createDisciplinaAction(
  formData: FormData
): Promise<ActionResponse> {
  const { supabase, user, roles } = await getAuthenticatedUserContext();
  if (!user || !canManageCatalog(roles)) {
    return {
      ok: false,
      error: "Acesso negado: apenas Administradores podem cadastrar disciplinas.",
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

export async function updateDisciplinaAction(
  id: string,
  formData: FormData
): Promise<ActionResponse> {
  const { supabase, user, roles } = await getAuthenticatedUserContext();
  if (!user || !canManageCatalog(roles)) {
    return {
      ok: false,
      error: "Acesso negado: apenas Administradores podem editar disciplinas.",
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

  const { error } = await supabase
    .from("disciplinas")
    .update(parsed.data)
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Já existe uma disciplina com este código." };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/");
  return { ok: true, message: "Disciplina atualizada com sucesso." };
}

export async function deleteDisciplinaAction(
  id: string
): Promise<ActionResponse> {
  const { supabase, user, roles } = await getAuthenticatedUserContext();
  if (!user || !canManageCatalog(roles)) {
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
  const { supabase, user, roles } = await getAuthenticatedUserContext();
  if (!user || !canManageCatalog(roles)) {
    return {
      ok: false,
      error: "Acesso negado: apenas Administradores podem cadastrar turmas.",
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

export async function updateTurmaAction(
  id: string,
  formData: FormData
): Promise<ActionResponse> {
  const { supabase, user, roles } = await getAuthenticatedUserContext();
  if (!user || !canManageCatalog(roles)) {
    return {
      ok: false,
      error: "Acesso negado: apenas Administradores podem editar turmas.",
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

  const { error } = await supabase
    .from("turmas")
    .update(parsed.data)
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Já existe uma turma com este código." };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/");
  return { ok: true, message: "Turma atualizada com sucesso." };
}

export async function deleteTurmaAction(id: string): Promise<ActionResponse> {
  const { supabase, user, roles } = await getAuthenticatedUserContext();
  if (!user || !canManageCatalog(roles)) {
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
// 4. CRUD Unificado de Usuários (Multi-Perfil via Checkbox — Apenas ADMIN)
// ============================================================================

async function syncProfessorRecord(params: {
  userId: string;
  nome: string;
  email: string;
  telefone: string | null;
  titulacao: string | null;
  isProfessor: boolean;
}) {
  const admin = createAdminClient();

  const { data: existingByUser } = await admin
    .from("professores")
    .select("id")
    .eq("user_id", params.userId)
    .maybeSingle();

  const { data: existingByEmail } = existingByUser
    ? { data: null }
    : await admin
        .from("professores")
        .select("id")
        .ilike("email", params.email)
        .maybeSingle();

  const existing = existingByUser ?? existingByEmail;

  if (params.isProfessor) {
    const payload = {
      user_id: params.userId,
      nome: params.nome,
      email: params.email,
      telefone: params.telefone,
      titulacao: params.titulacao || "Especialista",
      ativo: true,
    };

    if (existing) {
      await admin.from("professores").update(payload).eq("id", existing.id);
    } else {
      await admin.from("professores").insert(payload);
    }
    return;
  }

  // Perfil PROFESSOR foi removido
  if (existing) {
    const { count } = await admin
      .from("aulas")
      .select("id", { count: "exact", head: true })
      .eq("professor_id", existing.id);

    if ((count ?? 0) > 0) {
      await admin
        .from("professores")
        .update({ ativo: false })
        .eq("id", existing.id);
    } else {
      await admin.from("professores").delete().eq("id", existing.id);
    }
  }
}

export async function createUsuarioAction(
  formData: FormData
): Promise<ActionResponse> {
  const { user, roles: currentRoles } = await getAuthenticatedUserContext();
  if (!user || !canManageCatalog(currentRoles)) {
    return {
      ok: false,
      error: "Acesso negado: apenas Administradores podem cadastrar usuários.",
    };
  }

  const rawRoles = formData.getAll("roles").map((v) => String(v));

  const parsed = createUsuarioSchema.safeParse({
    nome: formData.get("nome"),
    email: formData.get("email"),
    roles: rawRoles,
    titulacao: formData.get("titulacao") || null,
    telefone: formData.get("telefone") || null,
    password: String(formData.get("password") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados do usuário inválidos.",
    };
  }

  const { nome, email, roles, titulacao, telefone, password } = parsed.data;
  const primaryRole = resolvePrimaryRole(roles);
  const admin = createAdminClient();

  const { data: created, error: createAuthError } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: {
        role: primaryRole,
        roles,
        must_change_password: true,
      },
      user_metadata: {
        nome,
        titulacao,
        telefone,
      },
    });

  if (createAuthError || !created.user) {
    const msg = createAuthError?.message?.toLowerCase() ?? "";
    if (
      msg.includes("already been registered") ||
      msg.includes("already exists") ||
      msg.includes("duplicate")
    ) {
      return {
        ok: false,
        error: "Já existe um usuário cadastrado com este e-mail.",
      };
    }
    return {
      ok: false,
      error: createAuthError?.message ?? "Não foi possível criar o usuário.",
    };
  }

  const newUserId = created.user.id;

  const { error: profileError } = await admin.from("profiles").upsert({
    id: newUserId,
    nome,
    email,
    role: primaryRole,
    roles,
    titulacao,
    telefone,
    must_change_password: true,
    ativo: true,
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(newUserId);
    return {
      ok: false,
      error: "Não foi possível salvar o perfil do usuário: " + profileError.message,
    };
  }

  await syncProfessorRecord({
    userId: newUserId,
    nome,
    email,
    telefone,
    titulacao,
    isProfessor: roles.includes("PROFESSOR"),
  });

  revalidatePath("/");
  return {
    ok: true,
    message:
      "Usuário cadastrado com sucesso. No 1º login será exigido aceite dos Termos de Uso e criação de nova senha.",
  };
}

export async function updateUsuarioAction(
  targetUserId: string,
  formData: FormData
): Promise<ActionResponse> {
  const { user, roles: currentRoles } = await getAuthenticatedUserContext();
  if (!user || !canManageCatalog(currentRoles)) {
    return {
      ok: false,
      error: "Acesso negado: apenas Administradores podem editar usuários.",
    };
  }

  const rawRoles = formData.getAll("roles").map((v) => String(v));

  const parsed = updateUsuarioSchema.safeParse({
    nome: formData.get("nome"),
    email: formData.get("email"),
    roles: rawRoles,
    titulacao: formData.get("titulacao") || null,
    telefone: formData.get("telefone") || null,
    password: String(formData.get("password") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados do usuário inválidos.",
    };
  }

  const { nome, email, roles, titulacao, telefone, password } = parsed.data;

  if (targetUserId === user.id && !roles.includes("ADMIN")) {
    return {
      ok: false,
      error: "Você não pode remover o perfil ADMIN da sua própria conta.",
    };
  }

  const primaryRole = resolvePrimaryRole(roles);
  const admin = createAdminClient();

  const { data: existingProfile } = await admin
    .from("profiles")
    .select("must_change_password")
    .eq("id", targetUserId)
    .maybeSingle();

  const shouldRequirePasswordChange =
    Boolean(password && targetUserId !== user.id) ||
    Boolean(existingProfile?.must_change_password);

  const authUpdatePayload: Parameters<typeof admin.auth.admin.updateUserById>[1] =
    {
      email,
      email_confirm: true,
      app_metadata: {
        role: primaryRole,
        roles,
        must_change_password: shouldRequirePasswordChange,
      },
      user_metadata: {
        nome,
        titulacao,
        telefone,
      },
    };

  if (password) {
    authUpdatePayload.password = password;
  }

  const { error: authError } = await admin.auth.admin.updateUserById(
    targetUserId,
    authUpdatePayload
  );

  if (authError) {
    const msg = authError.message.toLowerCase();
    if (
      msg.includes("already been registered") ||
      msg.includes("already exists") ||
      msg.includes("duplicate")
    ) {
      return {
        ok: false,
        error: "Já existe outro usuário cadastrado com este e-mail.",
      };
    }
    return { ok: false, error: authError.message };
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({
      nome,
      email,
      role: primaryRole,
      roles,
      titulacao,
      telefone,
      must_change_password: shouldRequirePasswordChange,
    })
    .eq("id", targetUserId);

  if (profileError) {
    return { ok: false, error: profileError.message };
  }

  await syncProfessorRecord({
    userId: targetUserId,
    nome,
    email,
    telefone,
    titulacao,
    isProfessor: roles.includes("PROFESSOR"),
  });

  revalidatePath("/");
  return { ok: true, message: "Usuário atualizado com sucesso." };
}

export async function deleteUsuarioAction(
  targetUserId: string
): Promise<ActionResponse> {
  const { user, roles } = await getAuthenticatedUserContext();
  if (!user || !canManageCatalog(roles)) {
    return { ok: false, error: "Permissão negada." };
  }

  if (targetUserId === user.id) {
    return {
      ok: false,
      error: "Você não pode excluir sua própria conta de administrador.",
    };
  }

  const admin = createAdminClient();

  const { data: prof } = await admin
    .from("professores")
    .select("id")
    .eq("user_id", targetUserId)
    .maybeSingle();

  if (prof) {
    const { count } = await admin
      .from("aulas")
      .select("id", { count: "exact", head: true })
      .eq("professor_id", prof.id);

    if ((count ?? 0) > 0) {
      return {
        ok: false,
        error:
          "Não é possível excluir este usuário porque ele possui aulas alocadas como professor.",
      };
    }

    await admin.from("professores").delete().eq("id", prof.id);
  }

  const { error } = await admin.auth.admin.deleteUser(targetUserId);
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/");
  return { ok: true, message: "Usuário removido com sucesso." };
}

// ============================================================================
// 5. CRUD de Termos de Uso (Apenas ADMIN)
// ============================================================================

export async function createTermoUsoAction(
  formData: FormData
): Promise<ActionResponse> {
  const { supabase, user, roles } = await getAuthenticatedUserContext();
  if (!user || !canManageCatalog(roles)) {
    return {
      ok: false,
      error: "Acesso negado: apenas Administradores podem cadastrar termos de uso.",
    };
  }

  const parsed = termoUsoSchema.safeParse({
    titulo: formData.get("titulo"),
    versao: formData.get("versao"),
    conteudo: formData.get("conteudo"),
    ativo: formData.get("ativo") === "on" || formData.get("ativo") === "true",
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados do termo inválidos.",
    };
  }

  if (parsed.data.ativo) {
    await supabase
      .from("termos_uso")
      .update({ ativo: false })
      .eq("ativo", true);
  }

  const { error } = await supabase.from("termos_uso").insert({
    ...parsed.data,
    created_by: user.id,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/");
  return { ok: true, message: "Termo de uso cadastrado com sucesso." };
}

export async function updateTermoUsoAction(
  id: string,
  formData: FormData
): Promise<ActionResponse> {
  const { supabase, user, roles } = await getAuthenticatedUserContext();
  if (!user || !canManageCatalog(roles)) {
    return {
      ok: false,
      error: "Acesso negado: apenas Administradores podem editar termos de uso.",
    };
  }

  const parsed = termoUsoSchema.safeParse({
    titulo: formData.get("titulo"),
    versao: formData.get("versao"),
    conteudo: formData.get("conteudo"),
    ativo: formData.get("ativo") === "on" || formData.get("ativo") === "true",
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados do termo inválidos.",
    };
  }

  if (parsed.data.ativo) {
    await supabase
      .from("termos_uso")
      .update({ ativo: false })
      .eq("ativo", true)
      .neq("id", id);
  }

  const { error } = await supabase
    .from("termos_uso")
    .update(parsed.data)
    .eq("id", id);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/");
  return { ok: true, message: "Termo de uso atualizado com sucesso." };
}

export async function activateTermoUsoAction(
  id: string
): Promise<ActionResponse> {
  const { supabase, user, roles } = await getAuthenticatedUserContext();
  if (!user || !canManageCatalog(roles)) {
    return { ok: false, error: "Permissão negada." };
  }

  await supabase
    .from("termos_uso")
    .update({ ativo: false })
    .eq("ativo", true)
    .neq("id", id);

  const { error } = await supabase
    .from("termos_uso")
    .update({ ativo: true })
    .eq("id", id);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/");
  return { ok: true, message: "Termo de uso definido como vigente." };
}

export async function deleteTermoUsoAction(
  id: string
): Promise<ActionResponse> {
  const { supabase, user, roles } = await getAuthenticatedUserContext();
  if (!user || !canManageCatalog(roles)) {
    return { ok: false, error: "Permissão negada." };
  }

  const { error } = await supabase.from("termos_uso").delete().eq("id", id);
  if (error) {
    if (error.code === "23503") {
      return {
        ok: false,
        error:
          "Não é possível excluir este termo porque já existem aceites registrados por usuários.",
      };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/");
  return { ok: true, message: "Termo de uso excluído com sucesso." };
}

// ============================================================================
// 6. Gestão de Aulas (Agendamento / Edição / Exclusão — Apenas ADMIN)
// ============================================================================

export async function createAulaAction(
  formData: FormData
): Promise<ActionResponse> {
  const { supabase, user, roles } = await getAuthenticatedUserContext();
  if (!user || !canManageCatalog(roles)) {
    return {
      ok: false,
      error: "Acesso negado: apenas Administradores podem agendar novas aulas.",
    };
  }

  const parsed = aulaSchema.safeParse({
    disciplina_id: formData.get("disciplina_id"),
    turma_id: formData.get("turma_id"),
    professor_id: formData.get("professor_id"),
    data_aula: formData.get("data_aula"),
    data_fim: formData.get("data_fim") || undefined,
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
  const { supabase, user, roles } = await getAuthenticatedUserContext();
  if (!user) {
    return { ok: false, error: "Sessão expirada." };
  }

  if (!canUpdateAula({ userRoles: roles, userId: user.id })) {
    return {
      ok: false,
      error:
        "Permissão negada: apenas Administradores podem alterar o status da aula.",
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

export async function updateAulaAction(
  id: string,
  formData: FormData
): Promise<ActionResponse> {
  const { supabase, user, roles } = await getAuthenticatedUserContext();
  if (!user || !canManageCatalog(roles)) {
    return {
      ok: false,
      error: "Acesso negado: apenas Administradores podem editar a aula.",
    };
  }

  const parsed = aulaSchema.safeParse({
    disciplina_id: formData.get("disciplina_id"),
    turma_id: formData.get("turma_id"),
    professor_id: formData.get("professor_id"),
    data_aula: formData.get("data_aula"),
    data_fim: formData.get("data_fim") || undefined,
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

  const { error } = await supabase
    .from("aulas")
    .update(parsed.data)
    .eq("id", id);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/");
  return { ok: true, message: "Aula atualizada com sucesso." };
}

export async function deleteAulaAction(id: string): Promise<ActionResponse> {
  const { supabase, user, roles } = await getAuthenticatedUserContext();
  if (!user || !canManageCatalog(roles)) {
    return {
      ok: false,
      error: "Apenas Administradores podem excluir registros de aula.",
    };
  }

  const { error } = await supabase.from("aulas").delete().eq("id", id);
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/");
  return { ok: true, message: "Aula excluída com sucesso." };
}

// ============================================================================
// 7. Parâmetros de Rate Limit e Liberação de Usuários Bloqueados (Apenas ADMIN)
// ============================================================================

export async function updateRateLimitConfigAction(
  formData: FormData
): Promise<ActionResponse> {
  const { supabase, user, roles } = await getAuthenticatedUserContext();
  if (!user || !canManageCatalog(roles)) {
    return {
      ok: false,
      error: "Acesso negado: apenas Administradores podem alterar os parâmetros.",
    };
  }

  const parsed = rateLimitConfigSchema.safeParse({
    enabled:
      formData.get("enabled") === "on" || formData.get("enabled") === "true",
    bypass_admin:
      formData.get("bypass_admin") === "on" ||
      formData.get("bypass_admin") === "true",
    max_requests: formData.get("max_requests"),
    window_seconds: formData.get("window_seconds"),
    block_duration_minutes: formData.get("block_duration_minutes"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error:
        parsed.error.issues[0]?.message ?? "Parâmetros de rate limit inválidos.",
    };
  }

  const { error } = await supabase
    .from("rate_limit_config")
    .update({
      ...parsed.data,
      updated_by: user.id,
    })
    .eq("id", 1);

  if (error) {
    return { ok: false, error: error.message };
  }

  await supabase.from("rate_limit_audit").insert({
    identifier: `config:global`,
    user_id: user.id,
    user_email: user.email ?? null,
    route: "/parametros",
    method: "POST",
    event_type: "CONFIG_UPDATED",
    request_count: 0,
    limit_threshold: parsed.data.max_requests,
    actor_user_id: user.id,
    details: `Parâmetros atualizados: ${
      parsed.data.enabled ? "Ativo" : "Desativado"
    }, limite ${parsed.data.max_requests} req / ${
      parsed.data.window_seconds
    }s, bloqueio de ${parsed.data.block_duration_minutes} min, isentar admin: ${
      parsed.data.bypass_admin ? "Sim" : "Não"
    }.`,
  });

  revalidatePath("/");
  return {
    ok: true,
    message: "Parâmetros de Rate Limit atualizados com sucesso.",
  };
}

export async function unblockRateLimitIdentifierAction(
  identifier: string
): Promise<ActionResponse> {
  const { supabase, user, roles } = await getAuthenticatedUserContext();
  if (!user || !canManageCatalog(roles)) {
    return {
      ok: false,
      error: "Acesso negado: apenas Administradores podem liberar bloqueios.",
    };
  }

  const { data: stateRow } = await supabase
    .from("rate_limit_state")
    .select("*")
    .eq("identifier", identifier)
    .maybeSingle();

  if (!stateRow) {
    return { ok: false, error: "Registro de bloqueio não encontrado." };
  }

  const { error } = await supabase
    .from("rate_limit_state")
    .update({
      blocked_until: null,
      request_count: 0,
      window_started_at: new Date().toISOString(),
    })
    .eq("identifier", identifier);

  if (error) {
    return { ok: false, error: error.message };
  }

  await supabase.from("rate_limit_audit").insert({
    identifier: stateRow.identifier,
    user_id: stateRow.user_id,
    user_email: stateRow.user_email,
    ip_address: stateRow.ip_address,
    route: stateRow.last_route ?? "/",
    method: "ADMIN",
    event_type: "UNBLOCKED_ADMIN",
    request_count: stateRow.request_count,
    limit_threshold: 50,
    blocked_until: null,
    actor_user_id: user.id,
    details: `Desbloqueado manualmente por ${user.email ?? "Administrador"}.`,
  });

  revalidatePath("/");
  return {
    ok: true,
    message: "Usuário/IP liberado com sucesso.",
  };
}

export async function unblockAllRateLimitAction(): Promise<ActionResponse> {
  const { supabase, user, roles } = await getAuthenticatedUserContext();
  if (!user || !canManageCatalog(roles)) {
    return { ok: false, error: "Permissão negada." };
  }

  const nowIso = new Date().toISOString();
  const { data: blockedRows } = await supabase
    .from("rate_limit_state")
    .select("*")
    .gt("blocked_until", nowIso);

  if (!blockedRows || blockedRows.length === 0) {
    return { ok: true, message: "Não há bloqueios ativos no momento." };
  }

  const identifiers = blockedRows.map((r) => r.identifier);
  const { error } = await supabase
    .from("rate_limit_state")
    .update({
      blocked_until: null,
      request_count: 0,
      window_started_at: nowIso,
    })
    .in("identifier", identifiers);

  if (error) {
    return { ok: false, error: error.message };
  }

  await supabase.from("rate_limit_audit").insert(
    blockedRows.map((row) => ({
      identifier: row.identifier,
      user_id: row.user_id,
      user_email: row.user_email,
      ip_address: row.ip_address,
      route: row.last_route ?? "/",
      method: "ADMIN",
      event_type: "UNBLOCKED_ADMIN" as const,
      request_count: row.request_count,
      limit_threshold: 50,
      blocked_until: null,
      actor_user_id: user.id,
      details: `Liberação em massa executada por ${
        user.email ?? "Administrador"
      }.`,
    }))
  );

  revalidatePath("/");
  return {
    ok: true,
    message: `${blockedRows.length} bloqueio(s) liberado(s) com sucesso.`,
  };
}
