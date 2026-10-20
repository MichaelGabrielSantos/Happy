import { hoje, numeroDoDia } from '../../src/lib/dia';
import { normalizar } from '../../src/lib/texto';
import type { Armazem } from './armazem';
import dicionario from './dicionario';
import { MEMES, type Termo } from './memes';

export const TENTATIVAS = 6;
export const MIN_LETRAS = 4;
export const MAX_LETRAS = 8;
const TRES_DIAS = 3 * 24 * 3600;
const LIMITE_RANKING_POR_IP = 5;

export type Estado = 'certa' | 'lugar' | 'errada';

export interface PalavraDia extends Termo {
  origem: 'fila' | 'reserva' | 'admin';
}

export interface ItemFila extends Termo {
  id: string;
  criadoEm: number;
}

export interface Fim {
  venceu: boolean;
  tentativas: number;
  tempoMs: number;
  pontos: number;
}

interface Partida {
  inicio: number;
  chutes: string[];
  fim: Fim | null;
  instagram?: string;
}

interface InfoRanking {
  pontos: number;
  tempoMs: number;
  tentativas: number;
}

export class ErroJogo extends Error {
  constructor(mensagem: string, public status = 400) {
    super(mensagem);
  }
}

// ---------- palavras ----------

let grafias: Map<string, string> | null = null;

/** Chave sem acento -> grafia exibida. Inclui o dicionário e as gírias da reserva. */
function mapaGrafias() {
  if (!grafias) {
    grafias = new Map();
    for (const p of dicionario.split(' ')) grafias.set(normalizar(p), p);
    for (const m of MEMES) grafias.set(chaveDe(m.palavra), m.palavra);
  }
  return grafias;
}

/** Só as letras, sem acento e em maiúsculas: "Glow-up" -> "GLOWUP". */
export function chaveDe(palavra: string): string {
  return normalizar(palavra).replace(/[^A-Z]/g, '');
}

export function validarPalavraAdmin(palavra: string): string | null {
  const limpa = palavra.trim();
  if (!/^[\p{L}]+$/u.test(limpa)) return 'Use só letras, sem espaço nem hífen';
  const n = chaveDe(limpa).length;
  if (n < MIN_LETRAS || n > MAX_LETRAS) return `A palavra precisa ter de ${MIN_LETRAS} a ${MAX_LETRAS} letras`;
  return null;
}

/** Compara chute e resposta (sem acento). Letras repetidas seguem a regra do Termo/Wordle. */
export function avaliar(chute: string, resposta: string): Estado[] {
  const resultado: Estado[] = Array(chute.length).fill('errada');
  const sobra = new Map<string, number>();
  for (let i = 0; i < resposta.length; i++) {
    if (chute[i] === resposta[i]) resultado[i] = 'certa';
    else sobra.set(resposta[i], (sobra.get(resposta[i]) ?? 0) + 1);
  }
  for (let i = 0; i < chute.length; i++) {
    if (resultado[i] === 'certa') continue;
    const n = sobra.get(chute[i]) ?? 0;
    if (n > 0) {
      resultado[i] = 'lugar';
      sobra.set(chute[i], n - 1);
    }
  }
  return resultado;
}

/** 1000 pontos, menos 100 por tentativa extra e 1 por segundo (até 300). Derrota vale 0. */
export function calcularPontos(venceu: boolean, tentativas: number, tempoMs: number): number {
  if (!venceu) return 0;
  return Math.max(100, 1000 - 100 * (tentativas - 1) - Math.min(300, Math.floor(tempoMs / 1000)));
}

// ---------- palavra do dia ----------

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Palavra do dia: na primeira vez que alguém pede, tira a próxima da fila do admin;
 * se a fila estiver vazia, usa a reserva de memes. Uma trava garante um único sorteio por dia.
 */
export async function palavraDoDia(a: Armazem, data: string): Promise<PalavraDia> {
  const chave = `dia:${data}`;
  const pronta = await a.get<PalavraDia>(chave);
  if (pronta) return pronta;

  if (await a.set(`trava:${chave}`, 1, { nx: true, exSeg: 15 })) {
    const fila = (await a.get<ItemFila[]>('fila')) ?? [];
    const proximo = fila.shift();
    let escolhida: PalavraDia;
    if (proximo) {
      await a.set('fila', fila);
      escolhida = { palavra: proximo.palavra, dica: proximo.dica, origem: 'fila' };
    } else {
      const i = (await a.incr('reserva:proxima')) - 1;
      escolhida = { ...MEMES[i % MEMES.length], origem: 'reserva' };
    }
    await a.set(chave, escolhida);
    return escolhida;
  }
  for (let i = 0; i < 40; i++) {
    await esperar(100);
    const p = await a.get<PalavraDia>(chave);
    if (p) return p;
  }
  throw new ErroJogo('Não foi possível carregar a palavra do dia. Tente de novo.', 503);
}

// ---------- partida ----------

const chavePartida = (data: string, dispositivo: string) => `partida:${data}:${dispositivo}`;

function validarDispositivo(dispositivo: unknown): string {
  if (typeof dispositivo !== 'string' || !/^[a-zA-Z0-9-]{16,64}$/.test(dispositivo)) {
    throw new ErroJogo('Aparelho não identificado');
  }
  return dispositivo;
}

export async function estadoDoJogo(a: Armazem, dispositivoBruto: unknown, data = hoje()) {
  const dispositivo = validarDispositivo(dispositivoBruto);
  const dia = await palavraDoDia(a, data);
  const resposta = chaveDe(dia.palavra);
  const partida = await a.get<Partida>(chavePartida(data, dispositivo));
  const g = mapaGrafias();
  return {
    numero: numeroDoDia(data) + 1,
    data,
    tamanho: resposta.length,
    tentativas: TENTATIVAS,
    agora: Date.now(),
    inicio: partida?.inicio ?? null,
    chutes: (partida?.chutes ?? []).map((c) => ({
      palavra: c === resposta ? dia.palavra : (g.get(c) ?? c),
      estados: avaliar(c, resposta),
    })),
    fim: partida?.fim ?? null,
    instagram: partida?.instagram ?? null,
    // a resposta só sai do servidor quando a partida termina
    resposta: partida?.fim ? { palavra: dia.palavra, dica: dia.dica } : null,
  };
}

export async function iniciar(a: Armazem, dispositivoBruto: unknown, data = hoje()) {
  const dispositivo = validarDispositivo(dispositivoBruto);
  await palavraDoDia(a, data);
  const nova: Partida = { inicio: Date.now(), chutes: [], fim: null };
  if (await a.set(chavePartida(data, dispositivo), nova, { nx: true, exSeg: TRES_DIAS })) {
    await a.incr(`iniciadas:${data}`, TRES_DIAS * 10);
  }
  return estadoDoJogo(a, dispositivo, data);
}

export async function chutar(a: Armazem, dispositivoBruto: unknown, chuteBruto: unknown, data = hoje()) {
  const dispositivo = validarDispositivo(dispositivoBruto);
  const chave = chavePartida(data, dispositivo);
  const partida = await a.get<Partida>(chave);
  if (!partida) throw new ErroJogo('Toque em Jogar para começar');
  if (partida.fim) throw new ErroJogo('Você já jogou hoje');

  const dia = await palavraDoDia(a, data);
  const resposta = chaveDe(dia.palavra);
  const chute = typeof chuteBruto === 'string' ? chaveDe(chuteBruto) : '';
  if (chute.length !== resposta.length) throw new ErroJogo(`Só palavras com ${resposta.length} letras`);
  if (chute !== resposta && !mapaGrafias().has(chute)) throw new ErroJogo('Essa palavra não é aceita');

  partida.chutes.push(chute);
  const venceu = chute === resposta;
  if (venceu || partida.chutes.length >= TENTATIVAS) {
    const tempoMs = Date.now() - partida.inicio;
    const tentativas = partida.chutes.length;
    partida.fim = { venceu, tentativas, tempoMs, pontos: calcularPontos(venceu, tentativas, tempoMs) };
    await a.incr(`finalizadas:${data}`, TRES_DIAS * 10);
    if (venceu) await a.incr(`vencedores:${data}`, TRES_DIAS * 10);
  }
  await a.set(chave, partida, { exSeg: TRES_DIAS });
  return estadoDoJogo(a, dispositivo, data);
}

// ---------- ranking ----------

export function normalizarInstagram(bruto: unknown): string {
  const h = String(bruto ?? '')
    .trim()
    .replace(/^@+/, '')
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/\/.*$/, '')
    .toLowerCase();
  if (!/^[a-z0-9._]{1,30}$/.test(h)) throw new ErroJogo('@ inválido: use letras, números, ponto ou _');
  return h;
}

/** Ordena por pontos e, empatando, por menor tempo. */
const pontuacaoRanking = (i: InfoRanking) => i.pontos * 1e6 - Math.min(999_999, Math.floor(i.tempoMs / 10));

export async function entrarNoRanking(
  a: Armazem,
  dispositivoBruto: unknown,
  instagramBruto: unknown,
  ip: string,
  data = hoje(),
) {
  const dispositivo = validarDispositivo(dispositivoBruto);
  const instagram = normalizarInstagram(instagramBruto);
  const chave = chavePartida(data, dispositivo);
  const partida = await a.get<Partida>(chave);
  if (!partida?.fim) throw new ErroJogo('Termine a partida primeiro');
  if (!partida.fim.venceu) throw new ErroJogo('Só quem acerta entra no ranking');

  if (!partida.instagram) {
    // o primeiro aparelho que usa um @ vira o dono dele
    await a.set(`insta:${instagram}`, dispositivo, { nx: true });
    if ((await a.get<string>(`insta:${instagram}`)) !== dispositivo) {
      throw new ErroJogo('Esse @ já foi usado em outro aparelho');
    }
    if ((await a.incr(`ip:${data}:${ip}`, TRES_DIAS)) > LIMITE_RANKING_POR_IP) {
      throw new ErroJogo('Limite de entradas no ranking atingido nesta rede hoje', 429);
    }
    const info: InfoRanking = { pontos: partida.fim.pontos, tempoMs: partida.fim.tempoMs, tentativas: partida.fim.tentativas };
    await a.zadd(`ranking:${data}`, pontuacaoRanking(info), instagram);
    await a.hset(`ranking:${data}:info`, instagram, info);
    await a.zincrby('ranking:geral', info.pontos, instagram);
    await a.hincrby('ranking:geral:dias', instagram, 1);
    partida.instagram = instagram;
    await a.set(chave, partida, { exSeg: TRES_DIAS });
  }
  const posicao = (await a.zrevrank(`ranking:${data}`, partida.instagram)) ?? 0;
  return { instagram: partida.instagram, posicao: posicao + 1 };
}

export interface ItemRanking {
  posicao: number;
  instagram: string;
  pontos: number;
  tempoMs?: number;
  tentativas?: number;
  dias?: number;
}

export async function ranking(a: Armazem, periodo: 'dia' | 'geral', instagram?: string, data = hoje(), limite = 50) {
  const chave = periodo === 'dia' ? `ranking:${data}` : 'ranking:geral';
  const [topo, total, info] = await Promise.all([
    a.zrevrange(chave, 0, limite - 1),
    a.zcard(chave),
    periodo === 'dia' ? a.hgetall<InfoRanking>(`${chave}:info`) : a.hgetall<number>('ranking:geral:dias'),
  ]);
  const montar = (membro: string, posicao: number): ItemRanking => {
    const extra = info[membro];
    return periodo === 'dia'
      ? { posicao, instagram: membro, ...(extra as InfoRanking) }
      : { posicao, instagram: membro, pontos: 0, dias: Number(extra ?? 0) };
  };
  const itens = topo.map((t, i) => ({ ...montar(t.membro, i + 1), ...(periodo === 'geral' ? { pontos: t.pontuacao } : {}) }));

  let meu: ItemRanking | null = null;
  if (instagram) {
    const h = instagram.toLowerCase();
    const pos = await a.zrevrank(chave, h);
    if (pos !== null) {
      meu = itens[pos] ?? montar(h, pos + 1);
      if (periodo === 'geral' && !itens[pos]) {
        const [linha] = await a.zrevrange(chave, pos, pos);
        meu.pontos = linha?.pontuacao ?? 0;
      }
    }
  }
  const vencedores = periodo === 'dia' ? Number((await a.get<number>(`vencedores:${data}`)) ?? 0) : 0;
  return { periodo, data, total, vencedores, itens, meu };
}

// ---------- admin ----------

function novoId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function diasAtras(data: string, n: number): string {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

export async function painelAdmin(a: Armazem, data = hoje()) {
  const contar = async (k: string) => Number((await a.get<number>(k)) ?? 0);
  const historico = await Promise.all(
    Array.from({ length: 14 }, (_, i) => diasAtras(data, i)).map(async (d) => ({
      data: d,
      palavra: await a.get<PalavraDia>(`dia:${d}`),
      iniciadas: await contar(`iniciadas:${d}`),
      vencedores: await contar(`vencedores:${d}`),
      noRanking: await a.zcard(`ranking:${d}`),
    })),
  );
  const proximaReserva = await contar('reserva:proxima');
  return {
    data,
    fila: (await a.get<ItemFila[]>('fila')) ?? [],
    historico,
    reserva: { total: MEMES.length, proxima: MEMES[proximaReserva % MEMES.length] },
  };
}

export async function adicionarNaFila(a: Armazem, itens: unknown) {
  if (!Array.isArray(itens) || itens.length === 0) throw new ErroJogo('Nada para adicionar');
  const novos: ItemFila[] = itens.map((bruto) => {
    const palavra = String(bruto?.palavra ?? '').trim().toLowerCase();
    const erro = validarPalavraAdmin(palavra);
    if (erro) throw new ErroJogo(`"${palavra}": ${erro}`);
    return { id: novoId(), palavra, dica: String(bruto?.dica ?? '').trim().slice(0, 280), criadoEm: Date.now() };
  });
  const fila = (await a.get<ItemFila[]>('fila')) ?? [];
  const vistas = new Set(fila.map((f) => chaveDe(f.palavra)));
  for (const n of novos) {
    if (vistas.has(chaveDe(n.palavra))) throw new ErroJogo(`"${n.palavra}" já está na fila`);
    vistas.add(chaveDe(n.palavra));
  }
  await a.set('fila', [...fila, ...novos]);
  return novos.length;
}

export async function editarFila(a: Armazem, acao: 'remover' | 'subir' | 'descer', id: string) {
  const fila = (await a.get<ItemFila[]>('fila')) ?? [];
  const i = fila.findIndex((x) => x.id === id);
  if (i === -1) throw new ErroJogo('Palavra não encontrada na fila', 404);
  if (acao === 'remover') fila.splice(i, 1);
  else {
    const j = acao === 'subir' ? i - 1 : i + 1;
    if (j >= 0 && j < fila.length) [fila[i], fila[j]] = [fila[j], fila[i]];
  }
  await a.set('fila', fila);
}

/** Troca a palavra de hoje — só enquanto ninguém começou a jogar. */
export async function trocarPalavraDeHoje(a: Armazem, palavraBruta: unknown, dica: unknown, data = hoje()) {
  const palavra = String(palavraBruta ?? '').trim().toLowerCase();
  const erro = validarPalavraAdmin(palavra);
  if (erro) throw new ErroJogo(erro);
  if (Number((await a.get<number>(`iniciadas:${data}`)) ?? 0) > 0) {
    throw new ErroJogo('Alguém já começou a jogar hoje; adicione na fila para amanhã', 409);
  }
  await a.set(`dia:${data}`, { palavra, dica: String(dica ?? '').trim().slice(0, 280), origem: 'admin' } satisfies PalavraDia);
}

export async function removerDoRanking(a: Armazem, data: string, instagramBruto: unknown) {
  const instagram = normalizarInstagram(instagramBruto);
  const info = (await a.hgetall<InfoRanking>(`ranking:${data}:info`))[instagram];
  if (!info) throw new ErroJogo('Esse @ não está no ranking desse dia', 404);
  await a.zrem(`ranking:${data}`, instagram);
  await a.hdel(`ranking:${data}:info`, instagram);
  await a.zincrby('ranking:geral', -info.pontos, instagram);
  await a.hincrby('ranking:geral:dias', instagram, -1);
}
