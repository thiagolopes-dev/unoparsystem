export interface RateLimitCheckResult {
  allowed: boolean;
  remaining: number;
  limitMax: number;
  windowSeconds: number;
  blockedUntil: string | null;
  requestCount: number;
  retryAfterSeconds: number;
}

export function extractClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "127.0.0.1";
}

export async function consumeRateLimit(params: {
  identifier: string;
  userId?: string | null;
  userEmail?: string | null;
  ipAddress?: string | null;
  route: string;
  method: string;
}): Promise<RateLimitCheckResult | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/rpc/consume_rate_limit`,
      {
        method: "POST",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          p_identifier: params.identifier,
          p_user_id: params.userId ?? null,
          p_user_email: params.userEmail ?? null,
          p_ip_address: params.ipAddress ?? null,
          p_route: params.route,
          p_method: params.method,
        }),
        cache: "no-store",
      }
    );

    if (!response.ok) {
      return null;
    }

    const rows = (await response.json()) as Array<{
      allowed: boolean;
      remaining: number;
      limit_max: number;
      window_seconds: number;
      blocked_until: string | null;
      request_count: number;
      retry_after_seconds: number;
    }>;

    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) return null;

    return {
      allowed: Boolean(row.allowed),
      remaining: Number(row.remaining ?? 0),
      limitMax: Number(row.limit_max ?? 50),
      windowSeconds: Number(row.window_seconds ?? 60),
      blockedUntil: row.blocked_until ?? null,
      requestCount: Number(row.request_count ?? 0),
      retryAfterSeconds: Number(row.retry_after_seconds ?? 0),
    };
  } catch {
    return null;
  }
}

export function buildRateLimitBlockedHtml(result: RateLimitCheckResult): string {
  const mins = Math.ceil(result.retryAfterSeconds / 60);
  const untilLabel = result.blockedUntil
    ? new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "medium",
        timeZone: "America/Sao_Paulo",
      }).format(new Date(result.blockedUntil))
    : `${mins} minuto(s)`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Acesso Temporariamente Bloqueado · UnoparSystem</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: radial-gradient(ellipse at top, #1a102b 0%, #060913 58%, #03050b 100%);
      color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      padding: 24px;
    }
    .card {
      max-width: 460px;
      width: 100%;
      background: rgba(11, 18, 36, 0.85);
      border: 1px solid rgba(251, 113, 133, 0.35);
      border-radius: 20px;
      padding: 32px;
      box-shadow: 0 24px 80px -16px rgba(0,0,0,0.85), 0 0 45px -16px rgba(244,63,94,0.3);
      text-align: center;
    }
    .badge {
      display: inline-block;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 11px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #fda4af;
      background: rgba(244, 63, 94, 0.14);
      border: 1px solid rgba(251, 113, 133, 0.3);
      padding: 4px 10px;
      border-radius: 999px;
      margin-bottom: 16px;
    }
    h1 { font-size: 20px; font-weight: 600; margin-bottom: 10px; }
    p { font-size: 13px; color: #cbd5e1; line-height: 1.6; margin-bottom: 16px; }
    .meta {
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px;
      padding: 12px 16px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 12px;
      color: #67e8f9;
      margin-bottom: 20px;
    }
    button {
      height: 38px;
      padding: 0 18px;
      border-radius: 10px;
      border: 1px solid rgba(255,255,255,0.18);
      background: rgba(255,255,255,0.07);
      color: #f8fafc;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
    }
    button:hover { background: rgba(255,255,255,0.14); }
  </style>
</head>
<body>
  <main class="card">
    <span class="badge">HTTP 429 · Rate Limit Excedido</span>
    <h1>Acesso Temporariamente Bloqueado</h1>
    <p>
      O limite de <strong>${result.limitMax} requisições</strong> foi excedido.
      Por segurança, novas solicitações estão temporariamente bloqueadas.
    </p>
    <div class="meta">
      Liberação automática prevista: ${untilLabel}<br/>
      Tempo restante: ~${mins} minuto(s)
    </div>
    <p style="font-size: 12px; color: #94a3b8;">
      Aguarde o término do bloqueio ou solicite a liberação manual a um Administrador na tela de Parâmetros.
    </p>
    <button onclick="window.location.reload()">Tentar novamente</button>
  </main>
</body>
</html>`;
}
