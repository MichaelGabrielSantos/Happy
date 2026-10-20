import { RESPOSTAS } from '../data/respostas';
import validasTxt from '../data/validas.txt?raw';
import { normalizar } from '../lib/texto';

export const TAMANHO = 5;
export const TENTATIVAS = 6;

export type Estado = 'certa' | 'lugar' | 'errada';

/** Chave sem acento -> grafia com acento usada para exibir ("ACAO" -> "ação"). */
const GRAFIAS = new Map<string, string>();
for (const p of validasTxt.trim().split(/\s+/)) GRAFIAS.set(normalizar(p), p);

export function grafia(chave: string): string | undefined {
  return GRAFIAS.get(chave);
}

export function respostaDoDia(numero: number): string {
  const i = ((numero % RESPOSTAS.length) + RESPOSTAS.length) % RESPOSTAS.length;
  return RESPOSTAS[i];
}

/**
 * Compara o chute com a resposta (ambos já normalizados).
 * Letras repetidas seguem a regra do Wordle/Termo: primeiro marcam-se as certas,
 * e cada letra fora do lugar só é amarela enquanto houver sobra dela na resposta.
 */
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

const PRIORIDADE: Record<Estado, number> = { errada: 0, lugar: 1, certa: 2 };

/** Melhor estado conhecido de cada letra, para colorir o teclado. */
export function estadoDasTeclas(chutes: string[], resposta: string): Record<string, Estado> {
  const teclas: Record<string, Estado> = {};
  for (const chute of chutes) {
    avaliar(chute, resposta).forEach((estado, i) => {
      const atual = teclas[chute[i]];
      if (!atual || PRIORIDADE[estado] > PRIORIDADE[atual]) teclas[chute[i]] = estado;
    });
  }
  return teclas;
}
