import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  let email = "";
  let password = "";

  const contentType = request.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("application/json")) {
      const body = (await request.json()) as {
        email?: unknown;
        password?: unknown;
      };
      email = String(body.email ?? "")
        .trim()
        .toLowerCase();
      password = String(body.password ?? "");
    } else if (
      contentType.includes("application/x-www-form-urlencoded") ||
      contentType.includes("multipart/form-data")
    ) {
      const form = await request.formData();
      email = String(form.get("email") ?? "")
        .trim()
        .toLowerCase();
      password = String(form.get("password") ?? "");
    }
  } catch {
    return NextResponse.json(
      { ok: false, error: "Corpo da requisição inválido." },
      { status: 400 }
    );
  }

  if (!email || !password) {
    return NextResponse.json(
      { ok: false, error: "Informe e-mail e senha para autenticar." },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    return NextResponse.json(
      {
        ok: false,
        error: "Credenciais inválidas. Verifique seu e-mail e senha.",
      },
      { status: 401 }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      user: {
        id: data.user.id,
        email: data.user.email,
      },
    },
    { status: 200 }
  );
}
