#!/usr/bin/env python3
"""
Teste de Rate Limit de Login — UnoparSystem
Executa 60 tentativas de login para `aluno@unopar.com.br` contra `/api/auth/login`
e exibe o status HTTP, saldo restante (`X-RateLimit-Remaining`) e momento do bloqueio (HTTP 429).

Uso:
  python3 scripts/test_rate_limit_login.py
  python3 scripts/test_rate_limit_login.py --email aluno@unopar.com.br --attempts 60
"""

import argparse
import json
import sys
import time
import urllib.error
import urllib.request


def run_login_rate_limit_test(
    url: str,
    email: str,
    password: str,
    attempts: int,
    delay_ms: int = 0,
) -> int:
    print("=" * 72)
    print("TESTE DE RATE LIMIT — TENTATIVAS DE LOGIN")
    print("=" * 72)
    print(f"Endpoint   : {url}")
    print(f"Usuário    : {email}")
    print(f"Tentativas : {attempts}")
    print("-" * 72)

    payload = json.dumps({"email": email, "password": password}).encode("utf-8")

    status_counts: dict[int, int] = {}
    first_blocked_attempt: int | None = None
    last_retry_after: str | None = None
    started_at = time.perf_counter()

    for attempt in range(1, attempts + 1):
        req = urllib.request.Request(
            url,
            data=payload,
            method="POST",
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
        )

        status_code = 0
        remaining = "-"
        limit = "-"
        retry_after = "-"
        message = ""

        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                status_code = resp.status
                limit = resp.headers.get("X-RateLimit-Limit", "-")
                remaining = resp.headers.get("X-RateLimit-Remaining", "-")
                body = resp.read().decode("utf-8", errors="replace")
                try:
                    data = json.loads(body)
                    message = data.get("message") or ("Login OK" if data.get("ok") else "")
                except json.JSONDecodeError:
                    message = body[:80]
        except urllib.error.HTTPError as err:
            status_code = err.code
            limit = err.headers.get("X-RateLimit-Limit", "-")
            remaining = err.headers.get("X-RateLimit-Remaining", "-")
            retry_after = err.headers.get("Retry-After", "-")
            body = err.read().decode("utf-8", errors="replace")
            try:
                data = json.loads(body)
                message = data.get("error", "")
            except json.JSONDecodeError:
                message = body[:80]
        except urllib.error.URLError as err:
            print(f"[ERRO DE CONEXÃO] Não foi possível conectar em {url}: {err.reason}")
            return 2

        status_counts[status_code] = status_counts.get(status_code, 0) + 1

        if status_code == 429 and first_blocked_attempt is None:
            first_blocked_attempt = attempt
            last_retry_after = retry_after

        tag = "BLOQUEADO (429)" if status_code == 429 else f"HTTP {status_code}"
        extra = f" | Retry-After: {retry_after}s" if retry_after != "-" else ""
        print(
            f"[{attempt:02d}/{attempts:02d}] {tag:<15} | "
            f"Limite: {limit:<3} | Restante: {remaining:<3}{extra} | {message}"
        )

        if delay_ms > 0:
            time.sleep(delay_ms / 1000.0)

    elapsed = time.perf_counter() - started_at

    print("-" * 72)
    print("RESUMO DO TESTE")
    print("-" * 72)
    for code in sorted(status_counts):
        print(f"  HTTP {code}: {status_counts[code]} requisição(ões)")
    print(f"  Tempo total: {elapsed:.2f}s")

    if first_blocked_attempt is not None:
        print(
            f"\n✅ RATE LIMIT FUNCIONOU! Bloqueio ativado na tentativa #{first_blocked_attempt} "
            f"(Retry-After: {last_retry_after}s)."
        )
        print(
            "👉 Acesse http://localhost:3000 como Admin > aba 'Parâmetros' para ver "
            f"'{email}' na lista de bloqueados, auditar os eventos e clicar em 'Liberar'."
        )
        return 0

    print("\n⚠️ Nenhuma requisição retornou HTTP 429. Verifique se o Rate Limit está ativo em Parâmetros.")
    return 1


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Testa o rate limit de login disparando N tentativas consecutivas."
    )
    parser.add_argument(
        "--url",
        default="http://localhost:3000/api/auth/login",
        help="URL do endpoint de login (padrão: http://localhost:3000/api/auth/login)",
    )
    parser.add_argument(
        "--email",
        default="aluno@unopar.com.br",
        help="E-mail do usuário para teste (padrão: aluno@unopar.com.br)",
    )
    parser.add_argument(
        "--password",
        default="SenhaIncorretaTeste123!",
        help="Senha usada nas tentativas (padrão: SenhaIncorretaTeste123!)",
    )
    parser.add_argument(
        "--attempts",
        type=int,
        default=60,
        help="Quantidade de tentativas de login (padrão: 60)",
    )
    parser.add_argument(
        "--delay-ms",
        type=int,
        default=0,
        help="Atraso opcional em milissegundos entre requisições (padrão: 0)",
    )
    args = parser.parse_args()
    return run_login_rate_limit_test(
        url=args.url,
        email=args.email,
        password=args.password,
        attempts=args.attempts,
        delay_ms=args.delay_ms,
    )


if __name__ == "__main__":
    sys.exit(main())
