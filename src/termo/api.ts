import { dispositivo } from '../lib/dispositivo';

export type Estado = 'certa' | 'lugar' | 'errada';

export interface Fim {
  venceu: boolean;
  tentativas: number;
  tempoMs: number;
  pontos: number;
}

export interface EstadoJogo {
  numero: number;
  data: string;
  tamanho: number;
  tentativas: number;
  agora: number;
  inicio: number | null;
  chutes: { palavra: string; estados: Estado[] }[];
  fim: Fim | null;
  instagram: string | null;
  resposta: { palavra: string; dica: string } | null;
}

export interface ItemRanking {
  posicao: number;
  instagram: string;
  pontos: number;
  tempoMs?: number;
  tentativas?: number;
  dias?: number;
}

export interface Ranking {
  periodo: 'dia' | 'geral';
  data: string;
  total: number;
  vencedores: number;
  itens: ItemRanking[];
  meu: ItemRanking | null;
}

export class ErroApi extends Error {}

async function chamar<T>(caminho: string, corpo?: unknown): Promise<T> {
  let resposta: Response;
  try {
    resposta = await fetch(caminho, corpo === undefined ? undefined : {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(corpo),
    });
  } catch {
    throw new ErroApi('Sem conexão. Confira sua internet.');
  }
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new ErroApi(dados.erro ?? 'Algo deu errado');
  return dados as T;
}

export const api = {
  estado: () => chamar<EstadoJogo>(`/api/jogo?dispositivo=${dispositivo()}`),
  iniciar: () => chamar<EstadoJogo>('/api/jogo', { dispositivo: dispositivo(), acao: 'iniciar' }),
  chutar: (chute: string) => chamar<EstadoJogo>('/api/jogo', { dispositivo: dispositivo(), acao: 'chutar', chute }),
  ranking: (periodo: 'dia' | 'geral', instagram?: string | null) =>
    chamar<Ranking>(`/api/ranking?periodo=${periodo}${instagram ? `&instagram=${encodeURIComponent(instagram)}` : ''}`),
  entrarNoRanking: (instagram: string) =>
    chamar<{ instagram: string; posicao: number }>('/api/ranking', { dispositivo: dispositivo(), instagram }),
};
