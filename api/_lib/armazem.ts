import { Redis } from '@upstash/redis';

/**
 * Operações de armazenamento usadas pelo jogo. Em produção é o Redis (Upstash, pelo
 * Marketplace da Vercel); sem as variáveis de ambiente, fora da produção, usa memória.
 */
export interface Armazem {
  get<T>(chave: string): Promise<T | null>;
  set(chave: string, valor: unknown, opcoes?: { nx?: boolean; exSeg?: number }): Promise<boolean>;
  del(chave: string): Promise<void>;
  incr(chave: string, exSeg?: number): Promise<number>;
  zadd(chave: string, pontuacao: number, membro: string): Promise<void>;
  zincrby(chave: string, incremento: number, membro: string): Promise<void>;
  /** Membros do maior para o menor, com a pontuação. */
  zrevrange(chave: string, inicio: number, fim: number): Promise<{ membro: string; pontuacao: number }[]>;
  zrevrank(chave: string, membro: string): Promise<number | null>;
  zcard(chave: string): Promise<number>;
  zrem(chave: string, membro: string): Promise<void>;
  hset(chave: string, campo: string, valor: unknown): Promise<void>;
  hgetall<T>(chave: string): Promise<Record<string, T>>;
  hdel(chave: string, campo: string): Promise<void>;
  hincrby(chave: string, campo: string, incremento: number): Promise<void>;
}

class ArmazemRedis implements Armazem {
  constructor(private r: Redis) {}
  get<T>(chave: string) {
    return this.r.get<T>(chave);
  }
  async set(chave: string, valor: unknown, o: { nx?: boolean; exSeg?: number } = {}) {
    const opcoes = { ...(o.nx ? { nx: true } : {}), ...(o.exSeg ? { ex: o.exSeg } : {}) } as { nx: true; ex: number };
    return (await this.r.set(chave, valor, opcoes)) === 'OK';
  }
  async del(chave: string) {
    await this.r.del(chave);
  }
  async incr(chave: string, exSeg?: number) {
    const n = await this.r.incr(chave);
    if (exSeg && n === 1) await this.r.expire(chave, exSeg);
    return n;
  }
  async zadd(chave: string, pontuacao: number, membro: string) {
    await this.r.zadd(chave, { score: pontuacao, member: membro });
  }
  async zincrby(chave: string, incremento: number, membro: string) {
    await this.r.zincrby(chave, incremento, membro);
  }
  async zrevrange(chave: string, inicio: number, fim: number) {
    const bruto = await this.r.zrange<(string | number)[]>(chave, inicio, fim, { rev: true, withScores: true });
    const saida = [];
    for (let i = 0; i < bruto.length; i += 2) saida.push({ membro: String(bruto[i]), pontuacao: Number(bruto[i + 1]) });
    return saida;
  }
  zrevrank(chave: string, membro: string) {
    return this.r.zrevrank(chave, membro);
  }
  zcard(chave: string) {
    return this.r.zcard(chave);
  }
  async zrem(chave: string, membro: string) {
    await this.r.zrem(chave, membro);
  }
  async hset(chave: string, campo: string, valor: unknown) {
    await this.r.hset(chave, { [campo]: valor });
  }
  async hgetall<T>(chave: string) {
    return ((await this.r.hgetall(chave)) ?? {}) as Record<string, T>;
  }
  async hdel(chave: string, campo: string) {
    await this.r.hdel(chave, campo);
  }
  async hincrby(chave: string, campo: string, incremento: number) {
    await this.r.hincrby(chave, campo, incremento);
  }
}

/** Implementação em memória para desenvolvimento e testes. */
export class ArmazemMemoria implements Armazem {
  private valores = new Map<string, { valor: unknown; expira?: number }>();
  private zsets = new Map<string, Map<string, number>>();
  private hashes = new Map<string, Map<string, unknown>>();

  private vivo(chave: string) {
    const v = this.valores.get(chave);
    if (v?.expira && v.expira < Date.now()) this.valores.delete(chave);
    return this.valores.get(chave);
  }
  private zset(chave: string) {
    if (!this.zsets.has(chave)) this.zsets.set(chave, new Map());
    return this.zsets.get(chave)!;
  }
  private hash(chave: string) {
    if (!this.hashes.has(chave)) this.hashes.set(chave, new Map());
    return this.hashes.get(chave)!;
  }
  private ordenado(chave: string) {
    return [...this.zset(chave)].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? 1 : -1));
  }
  // structuredClone imita a serialização do Redis: quem lê não altera o que está guardado
  async get<T>(chave: string) {
    const v = this.vivo(chave);
    return v ? (structuredClone(v.valor) as T) : null;
  }
  async set(chave: string, valor: unknown, o: { nx?: boolean; exSeg?: number } = {}) {
    if (o.nx && this.vivo(chave)) return false;
    this.valores.set(chave, { valor: structuredClone(valor), expira: o.exSeg ? Date.now() + o.exSeg * 1000 : undefined });
    return true;
  }
  async del(chave: string) {
    this.valores.delete(chave);
  }
  async incr(chave: string, exSeg?: number) {
    const n = Number(this.vivo(chave)?.valor ?? 0) + 1;
    const expira = this.vivo(chave)?.expira ?? (exSeg ? Date.now() + exSeg * 1000 : undefined);
    this.valores.set(chave, { valor: n, expira });
    return n;
  }
  async zadd(chave: string, pontuacao: number, membro: string) {
    this.zset(chave).set(membro, pontuacao);
  }
  async zincrby(chave: string, incremento: number, membro: string) {
    const z = this.zset(chave);
    z.set(membro, (z.get(membro) ?? 0) + incremento);
  }
  async zrevrange(chave: string, inicio: number, fim: number) {
    const lista = this.ordenado(chave);
    return lista.slice(inicio, fim < 0 ? lista.length + fim + 1 : fim + 1).map(([membro, pontuacao]) => ({ membro, pontuacao }));
  }
  async zrevrank(chave: string, membro: string) {
    const i = this.ordenado(chave).findIndex(([m]) => m === membro);
    return i === -1 ? null : i;
  }
  async zcard(chave: string) {
    return this.zset(chave).size;
  }
  async zrem(chave: string, membro: string) {
    this.zset(chave).delete(membro);
  }
  async hset(chave: string, campo: string, valor: unknown) {
    this.hash(chave).set(campo, structuredClone(valor));
  }
  async hgetall<T>(chave: string) {
    return structuredClone(Object.fromEntries(this.hash(chave))) as Record<string, T>;
  }
  async hdel(chave: string, campo: string) {
    this.hash(chave).delete(campo);
  }
  async hincrby(chave: string, campo: string, incremento: number) {
    const h = this.hash(chave);
    h.set(campo, Number(h.get(campo) ?? 0) + incremento);
  }
}

const global = globalThis as unknown as { __armazem?: Armazem };

export function armazem(): Armazem {
  if (global.__armazem) return global.__armazem;
  // o Marketplace da Vercel pode criar as variáveis com prefixo KV_ ou UPSTASH_REDIS_REST_
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (url && token) {
    global.__armazem = new ArmazemRedis(new Redis({ url, token }));
  } else if (process.env.VERCEL) {
    // na Vercel cada função roda isolada: memória não serve como banco
    throw new Error('Banco não configurado: conecte o Upstash Redis ao projeto na Vercel.');
  } else {
    global.__armazem = new ArmazemMemoria();
  }
  return global.__armazem;
}
