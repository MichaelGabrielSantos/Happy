import { criarAleatorio, embaralhar } from '../lib/aleatorio';
import { normalizar } from '../lib/texto';
import type { Entrada } from './banco';

export type Direcao = 'H' | 'V';

export interface Palavra {
  numero: number;
  resposta: string; // só letras A-Z, sem acento
  original: string; // como está no banco, para mostrar ao final
  dica: string;
  linha: number;
  coluna: number;
  direcao: Direcao;
}

export interface Cruzadinha {
  largura: number;
  altura: number;
  palavras: Palavra[];
  /** Letra correta de cada célula, ou null para casa vazia. */
  grade: (string | null)[][];
}

interface Opcoes {
  quantidade?: number;
  tamanhoMaximo?: number;
  tentativas?: number;
}

interface Colocada {
  entrada: Entrada;
  resposta: string;
  linha: number;
  coluna: number;
  direcao: Direcao;
}

const passo = (d: Direcao) => (d === 'H' ? [0, 1] : [1, 0]);
const chave = (l: number, c: number) => `${l},${c}`;

/** Monta uma grade tentando cruzar o máximo de palavras dentro de um quadrado limitado. */
function montar(banco: Entrada[], aleatorio: () => number, quantidade: number, maximo: number) {
  const letras = new Map<string, string>();
  const direcoes = new Map<string, Set<Direcao>>();
  const colocadas: Colocada[] = [];
  let limites = { l0: 0, l1: 0, c0: 0, c1: 0 };
  let cruzamentos = 0;

  const ocupa = (l: number, c: number) => letras.has(chave(l, c));

  function colocar(entrada: Entrada, resposta: string, linha: number, coluna: number, direcao: Direcao) {
    const [dl, dc] = passo(direcao);
    for (let i = 0; i < resposta.length; i++) {
      const k = chave(linha + dl * i, coluna + dc * i);
      letras.set(k, resposta[i]);
      if (!direcoes.has(k)) direcoes.set(k, new Set());
      direcoes.get(k)!.add(direcao);
    }
    const fimL = linha + dl * (resposta.length - 1);
    const fimC = coluna + dc * (resposta.length - 1);
    limites = colocadas.length
      ? {
          l0: Math.min(limites.l0, linha),
          l1: Math.max(limites.l1, fimL),
          c0: Math.min(limites.c0, coluna),
          c1: Math.max(limites.c1, fimC),
        }
      : { l0: linha, l1: fimL, c0: coluna, c1: fimC };
    colocadas.push({ entrada, resposta, linha, coluna, direcao });
  }

  /** Retorna quantos cruzamentos a posição gera, ou -1 se ela for inválida. */
  function avaliarPosicao(resposta: string, linha: number, coluna: number, direcao: Direcao): number {
    const [dl, dc] = passo(direcao);
    const n = resposta.length;
    const fimL = linha + dl * (n - 1);
    const fimC = coluna + dc * (n - 1);
    if (Math.max(limites.l1, fimL) - Math.min(limites.l0, linha) + 1 > maximo) return -1;
    if (Math.max(limites.c1, fimC) - Math.min(limites.c0, coluna) + 1 > maximo) return -1;
    // casas antes do início e depois do fim precisam estar livres
    if (ocupa(linha - dl, coluna - dc) || ocupa(fimL + dl, fimC + dc)) return -1;

    let cruza = 0;
    for (let i = 0; i < n; i++) {
      const l = linha + dl * i;
      const c = coluna + dc * i;
      const atual = letras.get(chave(l, c));
      if (atual !== undefined) {
        if (atual !== resposta[i] || direcoes.get(chave(l, c))!.has(direcao)) return -1;
        cruza++;
      } else if (ocupa(l + dc, c + dl) || ocupa(l - dc, c - dl)) {
        // letra nova não pode encostar de lado em outra palavra
        return -1;
      }
    }
    return cruza === n ? -1 : cruza;
  }

  const ordem = embaralhar(banco, aleatorio);
  const usadas = new Set<string>();
  // começa por uma palavra média para dar espaço aos cruzamentos
  const primeira = ordem.find((e) => {
    const r = limpar(e.palavra);
    return r.length >= 6 && r.length <= maximo;
  })!;
  colocar(primeira, limpar(primeira.palavra), 0, 0, aleatorio() < 0.5 ? 'H' : 'V');
  usadas.add(limpar(primeira.palavra));

  for (const entrada of ordem) {
    if (colocadas.length >= quantidade) break;
    const resposta = limpar(entrada.palavra);
    if (usadas.has(resposta) || resposta.length > maximo) continue;

    let melhor: { linha: number; coluna: number; direcao: Direcao; nota: number } | null = null;
    for (const [k, letra] of letras) {
      const [l, c] = k.split(',').map(Number);
      for (let i = 0; i < resposta.length; i++) {
        if (resposta[i] !== letra) continue;
        for (const direcao of ['H', 'V'] as Direcao[]) {
          const [dl, dc] = passo(direcao);
          const linha = l - dl * i;
          const coluna = c - dc * i;
          const cruza = avaliarPosicao(resposta, linha, coluna, direcao);
          if (cruza <= 0) continue;
          const nota = cruza * 10 + aleatorio() * 5;
          if (!melhor || nota > melhor.nota) melhor = { linha, coluna, direcao, nota };
        }
      }
    }
    if (melhor) {
      cruzamentos += Math.floor(melhor.nota / 10);
      colocar(entrada, resposta, melhor.linha, melhor.coluna, melhor.direcao);
      usadas.add(resposta);
    }
  }

  return { colocadas, limites, cruzamentos };
}

export function limpar(palavra: string): string {
  return normalizar(palavra).replace(/[^A-Z]/g, '');
}

export function gerarCruzadinha(banco: Entrada[], semente: number, opcoes: Opcoes = {}): Cruzadinha {
  const { quantidade = 12, tamanhoMaximo = 12, tentativas = 25 } = opcoes;
  const aleatorio = criarAleatorio(semente);
  const validas = banco.filter((e) => limpar(e.palavra).length >= 3);

  // várias tentativas; fica com a que tiver mais palavras, depois mais cruzamentos e menor área
  let melhor: ReturnType<typeof montar> | null = null;
  let melhorNota = -Infinity;
  for (let t = 0; t < tentativas; t++) {
    const r = montar(validas, aleatorio, quantidade, tamanhoMaximo);
    const area = (r.limites.l1 - r.limites.l0 + 1) * (r.limites.c1 - r.limites.c0 + 1);
    const nota = r.colocadas.length * 1000 + r.cruzamentos * 20 - area;
    if (nota > melhorNota) {
      melhor = r;
      melhorNota = nota;
    }
  }

  const { colocadas, limites } = melhor!;
  const altura = limites.l1 - limites.l0 + 1;
  const largura = limites.c1 - limites.c0 + 1;
  const grade: (string | null)[][] = Array.from({ length: altura }, () => Array(largura).fill(null));
  const ajustadas = colocadas.map((p) => ({ ...p, linha: p.linha - limites.l0, coluna: p.coluna - limites.c0 }));
  for (const p of ajustadas) {
    const [dl, dc] = passo(p.direcao);
    for (let i = 0; i < p.resposta.length; i++) grade[p.linha + dl * i][p.coluna + dc * i] = p.resposta[i];
  }

  // numeração na ordem de leitura; palavras que começam na mesma casa dividem o número
  const inicios = [...new Set(ajustadas.map((p) => p.linha * largura + p.coluna))].sort((a, b) => a - b);
  const palavras: Palavra[] = ajustadas
    .map((p) => ({
      numero: inicios.indexOf(p.linha * largura + p.coluna) + 1,
      resposta: p.resposta,
      original: p.entrada.palavra,
      dica: p.entrada.dica,
      linha: p.linha,
      coluna: p.coluna,
      direcao: p.direcao,
    }))
    .sort((a, b) => a.numero - b.numero);

  return { largura, altura, palavras, grade };
}

/** Casas (linha, coluna) ocupadas por uma palavra. */
export function casasDa(p: Palavra): [number, number][] {
  const [dl, dc] = passo(p.direcao);
  return Array.from({ length: p.resposta.length }, (_, i) => [p.linha + dl * i, p.coluna + dc * i]);
}
