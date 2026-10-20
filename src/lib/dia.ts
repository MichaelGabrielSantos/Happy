const FUSO = 'America/Sao_Paulo';
const INICIO = Date.UTC(2026, 0, 1);
const UM_DIA = 24 * 60 * 60 * 1000;

/** Data de hoje no horário de Brasília, no formato AAAA-MM-DD. */
export function hoje(agora = new Date()): string {
  // en-CA formata como AAAA-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }).format(agora);
}

/** Número do dia contado a partir de 01/01/2026 (dia 0). */
export function numeroDoDia(data: string): number {
  const [a, m, d] = data.split('-').map(Number);
  return Math.round((Date.UTC(a, m - 1, d) - INICIO) / UM_DIA);
}

/** Milissegundos até a meia-noite de Brasília. */
export function msAteAmanha(agora = new Date()): number {
  const partes = new Intl.DateTimeFormat('en-GB', {
    timeZone: FUSO,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(agora);
  const v = (t: string) => Number(partes.find((p) => p.type === t)?.value ?? 0);
  const passados = ((v('hour') * 60 + v('minute')) * 60 + v('second')) * 1000 + agora.getMilliseconds();
  return UM_DIA - passados;
}

export function formatarDuracao(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const seg = s % 60;
  const dois = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${dois(h)}:${dois(m)}:${dois(seg)}` : `${dois(m)}:${dois(seg)}`;
}
