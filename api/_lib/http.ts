import { timingSafeEqual } from 'node:crypto';
import { ErroJogo } from './jogo';

export function json(dados: unknown, status = 200): Response {
  return new Response(JSON.stringify(dados), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

/** Executa o handler e transforma erros em JSON { erro }. */
export async function responder(fn: () => Promise<unknown>): Promise<Response> {
  try {
    return json(await fn());
  } catch (e) {
    if (e instanceof ErroJogo) return json({ erro: e.message }, e.status);
    console.error(e);
    return json({ erro: 'Erro no servidor. Tente de novo em instantes.' }, 500);
  }
}

export async function corpo(req: Request): Promise<Record<string, unknown>> {
  try {
    return (await req.json()) as Record<string, unknown>;
  } catch {
    throw new ErroJogo('Requisição inválida');
  }
}

export function ipDe(req: Request): string {
  return (req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'local').split(',')[0].trim();
}

/** Confere a senha do admin (variável ADMIN_SENHA). Fora da Vercel, sem variável, a senha é "admin". */
export function exigirAdmin(req: Request): void {
  const esperada = process.env.ADMIN_SENHA ?? (process.env.VERCEL ? '' : 'admin');
  if (!esperada) throw new ErroJogo('Defina a variável ADMIN_SENHA na Vercel', 503);
  const recebida = Buffer.from(req.headers.get('x-admin-senha') ?? '');
  const certa = Buffer.from(esperada);
  if (recebida.length !== certa.length || !timingSafeEqual(recebida, certa)) throw new ErroJogo('Senha incorreta', 401);
}
