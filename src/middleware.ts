import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  buildRateLimitBlockedHtml,
  consumeRateLimit,
  extractClientIp,
} from "@/lib/rate-limit";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(
        cookiesToSet: {
          name: string;
          value: string;
          options: CookieOptions;
        }[]
      ) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // Valida o JWT diretamente junto ao servidor GoTrue (seguro contra falsificação de sessão)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Rate limit global em todas as rotas (ignora prefetch invisível do Next.js e sw.js)
  const isPrefetch =
    request.headers.get("next-router-prefetch") === "1" ||
    request.headers.get("purpose") === "prefetch";
  const isServiceWorker = pathname === "/sw.js";

  let rateLimitResult: Awaited<ReturnType<typeof consumeRateLimit>> = null;

  if (!isPrefetch && !isServiceWorker) {
    const ip = extractClientIp(request.headers);
    let loginEmail: string | null = null;

    if (!user && pathname === "/api/auth/login" && request.method === "POST") {
      try {
        const contentType = request.headers.get("content-type") ?? "";
        if (contentType.includes("application/json")) {
          const cloned = request.clone();
          const body = (await cloned.json()) as { email?: unknown };
          const raw = String(body?.email ?? "")
            .trim()
            .toLowerCase();
          if (raw) loginEmail = raw;
        }
      } catch {
        // Ignora erro de parse; fallback segue por IP
      }
    }

    const identifier = user
      ? `user:${user.id}`
      : loginEmail
      ? `login:${loginEmail}`
      : `ip:${ip}`;

    rateLimitResult = await consumeRateLimit({
      identifier,
      userId: user?.id ?? null,
      userEmail: user?.email ?? loginEmail,
      ipAddress: ip,
      route: pathname,
      method: request.method,
    });

    if (rateLimitResult && !rateLimitResult.allowed) {
      const headers = new Headers({
        "X-RateLimit-Limit": String(rateLimitResult.limitMax),
        "X-RateLimit-Remaining": "0",
        "Retry-After": String(rateLimitResult.retryAfterSeconds),
      });

      const accept = request.headers.get("accept") ?? "";
      const isActionOrApi =
        request.headers.has("next-action") ||
        pathname.startsWith("/api/") ||
        (accept.includes("application/json") && !accept.includes("text/html"));

      if (isActionOrApi || request.method !== "GET") {
        return NextResponse.json(
          {
            error: `Limite de ${rateLimitResult.limitMax} requisições excedido. Acesso bloqueado temporariamente.`,
            blocked_until: rateLimitResult.blockedUntil,
            retry_after_seconds: rateLimitResult.retryAfterSeconds,
          },
          { status: 429, headers }
        );
      }

      headers.set("Content-Type", "text/html; charset=utf-8");
      return new NextResponse(buildRateLimitBlockedHtml(rateLimitResult), {
        status: 429,
        headers,
      });
    }
  }

  const isLoginPage = pathname.startsWith("/login");
  const isAuthCallback = pathname.startsWith("/auth/callback");
  const isResetPasswordPage = pathname.startsWith("/redefinir-senha");
  const isLoginApi = pathname === "/api/auth/login";
  const isPublicAuthRoute =
    isLoginPage || isAuthCallback || isResetPasswordPage || isLoginApi;

  // Se o link de recuperação cair em `/` ou `/login` trazendo `?code=...`, encaminha para `/auth/callback`
  const authCode = request.nextUrl.searchParams.get("code");
  if (!user && authCode && (pathname === "/" || isLoginPage)) {
    const callbackUrl = request.nextUrl.clone();
    callbackUrl.pathname = "/auth/callback";
    if (!callbackUrl.searchParams.has("next")) {
      callbackUrl.searchParams.set("next", "/redefinir-senha");
    }
    return NextResponse.redirect(callbackUrl);
  }

  if (!user && !isPublicAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    const redirectRes = NextResponse.redirect(url);
    if (rateLimitResult) {
      redirectRes.headers.set(
        "X-RateLimit-Limit",
        String(rateLimitResult.limitMax)
      );
      redirectRes.headers.set(
        "X-RateLimit-Remaining",
        String(rateLimitResult.remaining)
      );
    }
    return redirectRes;
  }

  if (user && isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    const redirectRes = NextResponse.redirect(url);
    if (rateLimitResult) {
      redirectRes.headers.set(
        "X-RateLimit-Limit",
        String(rateLimitResult.limitMax)
      );
      redirectRes.headers.set(
        "X-RateLimit-Remaining",
        String(rateLimitResult.remaining)
      );
    }
    return redirectRes;
  }

  if (rateLimitResult) {
    supabaseResponse.headers.set(
      "X-RateLimit-Limit",
      String(rateLimitResult.limitMax)
    );
    supabaseResponse.headers.set(
      "X-RateLimit-Remaining",
      String(rateLimitResult.remaining)
    );
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
