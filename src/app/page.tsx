import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GestaoAulasApp, type AulaEnriched } from "@/components/GestaoAulasApp";
import {
  canManageCatalog,
  normalizeUserRoles,
  resolvePrimaryRole,
} from "@/domain/gestao-aulas";
import type { Database, UserRole } from "@/types/database.types";

export const dynamic = "force-dynamic";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type TermoUsoRow = Database["public"]["Tables"]["termos_uso"]["Row"];
type TermoAceiteRow = Database["public"]["Tables"]["termos_aceites"]["Row"];
type RateLimitConfigRow =
  Database["public"]["Tables"]["rate_limit_config"]["Row"];
type RateLimitStateRow =
  Database["public"]["Tables"]["rate_limit_state"]["Row"];
type RateLimitAuditRow =
  Database["public"]["Tables"]["rate_limit_audit"]["Row"];

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [
    { data: profile },
    { data: disciplinas },
    { data: turmas },
    { data: professores },
    { data: aulasRaw },
    { data: termosUsoRaw },
    { data: aceitesRaw },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, nome, email, role, roles, titulacao, telefone, must_change_password, ativo, created_at, updated_at"
      )
      .eq("id", user.id)
      .single(),
    supabase
      .from("disciplinas")
      .select("*")
      .order("codigo", { ascending: true }),
    supabase.from("turmas").select("*").order("codigo", { ascending: true }),
    supabase
      .from("professores")
      .select("*")
      .eq("ativo", true)
      .order("nome", { ascending: true }),
    supabase
      .from("aulas")
      .select(
        `
        *,
        disciplina:disciplinas(id, codigo, nome),
        turma:turmas(id, codigo, nome, turno, periodo),
        professor:professores(id, nome, email, titulacao, user_id)
      `
      )
      .order("data_aula", { ascending: true })
      .order("hora_inicio", { ascending: true }),
    supabase
      .from("termos_uso")
      .select("*")
      .order("ativo", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("termos_aceites")
      .select("*")
      .order("accepted_at", { ascending: false }),
  ]);

  const metaRoles = Array.isArray(user.app_metadata?.roles)
    ? (user.app_metadata.roles as string[])
    : undefined;
  const fallbackRole =
    profile?.role ??
    (user.app_metadata?.role as UserRole | undefined) ??
    "ALUNO";

  const roles = normalizeUserRoles(profile?.roles ?? metaRoles, fallbackRole);
  const role = resolvePrimaryRole(roles);
  const isAdmin = canManageCatalog(roles);

  let usuarios: ProfileRow[] = [];
  let rateLimitConfig: RateLimitConfigRow | null = null;
  let rateLimitStates: RateLimitStateRow[] = [];
  let rateLimitAudits: RateLimitAuditRow[] = [];

  if (isAdmin) {
    const [
      { data: allProfiles },
      { data: rlConfig },
      { data: rlStates },
      { data: rlAudits },
    ] = await Promise.all([
      supabase.from("profiles").select("*").order("nome", { ascending: true }),
      supabase
        .from("rate_limit_config")
        .select("*")
        .eq("id", 1)
        .maybeSingle(),
      supabase
        .from("rate_limit_state")
        .select("*")
        .order("blocked_until", { ascending: false, nullsFirst: false })
        .order("last_request_at", { ascending: false })
        .limit(100),
      supabase
        .from("rate_limit_audit")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    usuarios = (allProfiles ?? []) as ProfileRow[];
    rateLimitConfig = (rlConfig ?? null) as RateLimitConfigRow | null;
    rateLimitStates = (rlStates ?? []) as RateLimitStateRow[];
    rateLimitAudits = (rlAudits ?? []) as RateLimitAuditRow[];
  }

  const termosUso = (termosUsoRaw ?? []) as TermoUsoRow[];
  const termosAceites = (aceitesRaw ?? []) as TermoAceiteRow[];

  const activeTermo = termosUso.find((t) => t.ativo) ?? null;
  const hasAcceptedActiveTermo = activeTermo
    ? termosAceites.some(
        (a) => a.termo_id === activeTermo.id && a.user_id === user.id
      )
    : true;

  const currentUser = {
    id: user.id,
    nome:
      profile?.nome ??
      (user.user_metadata?.nome as string | undefined) ??
      user.email ??
      "Usuário",
    email: user.email ?? "",
    role,
    roles,
    mustChangePassword: Boolean(profile?.must_change_password),
  };

  return (
    <GestaoAulasApp
      currentUser={currentUser}
      disciplinas={disciplinas ?? []}
      turmas={turmas ?? []}
      professores={professores ?? []}
      usuarios={usuarios}
      termosUso={termosUso}
      termosAceites={termosAceites}
      rateLimitConfig={rateLimitConfig}
      rateLimitStates={rateLimitStates}
      rateLimitAudits={rateLimitAudits}
      onboarding={{
        activeTermo,
        needsAcceptTerms: Boolean(activeTermo && !hasAcceptedActiveTermo),
        needsChangePassword: Boolean(profile?.must_change_password),
      }}
      aulas={(aulasRaw as unknown as AulaEnriched[]) ?? []}
    />
  );
}
