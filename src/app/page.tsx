import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GestaoAulasApp, type AulaEnriched } from "@/components/GestaoAulasApp";
import type { UserRole } from "@/types/database.types";

export const dynamic = "force-dynamic";

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
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, nome, email, role")
      .eq("id", user.id)
      .single(),
    supabase
      .from("disciplinas")
      .select("*")
      .order("codigo", { ascending: true }),
    supabase.from("turmas").select("*").order("codigo", { ascending: true }),
    supabase.from("professores").select("*").order("nome", { ascending: true }),
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
  ]);

  const role: UserRole =
    profile?.role ??
    ((user.app_metadata?.role as UserRole | undefined) || "PROFESSOR");

  const currentUser = {
    id: user.id,
    nome:
      profile?.nome ??
      (user.user_metadata?.nome as string | undefined) ??
      user.email ??
      "Usuário",
    email: user.email ?? "",
    role,
  };

  return (
    <GestaoAulasApp
      currentUser={currentUser}
      disciplinas={disciplinas ?? []}
      turmas={turmas ?? []}
      professores={professores ?? []}
      aulas={(aulasRaw as unknown as AulaEnriched[]) ?? []}
    />
  );
}
