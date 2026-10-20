import { describe, expect, it } from 'vitest';
import { BANCO } from '../cruzadas/banco';
import { casasDa, gerarCruzadinha, limpar } from '../cruzadas/gerador';
import { numeroDoDia } from '../lib/dia';
import { normalizar } from '../lib/texto';
import { avaliar, grafia, respostaDoDia } from '../termo/logica';

describe('termo', () => {
  it('marca letras certas, fora do lugar e erradas', () => {
    expect(avaliar('CARRO', 'CORTE')).toEqual(['certa', 'errada', 'certa', 'errada', 'lugar']);
  });

  it('não marca amarelo a mais quando a letra se repete', () => {
    // só um A na resposta, e ele já está certo na posição 1
    expect(avaliar('AAAAA', 'BANCO')).toEqual(['errada', 'certa', 'errada', 'errada', 'errada']);
    expect(avaliar('OSSOS', 'POSSO')).toEqual(['lugar', 'lugar', 'certa', 'lugar', 'errada']);
  });

  it('aceita palavras sem acento e devolve a grafia correta', () => {
    expect(grafia('ACUCAR')).toBeUndefined(); // 6 letras, fora da lista
    expect(grafia('MAIOR')).toBe('maior');
    expect(grafia(normalizar('saúde'))).toBe('saúde');
    expect(grafia('XYZWQ')).toBeUndefined();
  });

  it('toda resposta do dia é uma palavra válida de 5 letras', () => {
    for (let d = 0; d < 1300; d++) {
      const r = normalizar(respostaDoDia(d));
      expect(r).toHaveLength(5);
      expect(grafia(r)).toBeDefined();
    }
  });

  it('conta os dias a partir de 01/01/2026', () => {
    expect(numeroDoDia('2026-01-01')).toBe(0);
    expect(numeroDoDia('2026-10-20')).toBe(292);
  });
});

describe('palavras cruzadas', () => {
  it('é determinística para a mesma semente', () => {
    expect(gerarCruzadinha(BANCO, 42)).toEqual(gerarCruzadinha(BANCO, 42));
  });

  it('gera grades coerentes para muitas sementes', () => {
    for (let s = 1; s <= 60; s++) {
      const c = gerarCruzadinha(BANCO, s);
      expect(c.palavras.length).toBeGreaterThanOrEqual(8);
      expect(c.largura).toBeLessThanOrEqual(12);
      expect(c.altura).toBeLessThanOrEqual(12);
      for (const p of c.palavras) {
        const casas = casasDa(p);
        expect(casas.map(([l, col]) => c.grade[l][col]).join('')).toBe(p.resposta);
        expect(p.resposta).toBe(limpar(p.original));
      }
      // toda sequência de 2+ letras na grade precisa ser uma palavra do jogo
      const respostas = new Set(c.palavras.map((p) => `${p.direcao}${p.linha},${p.coluna}:${p.resposta}`));
      for (const direcao of ['H', 'V'] as const) {
        const linhas = direcao === 'H' ? c.altura : c.largura;
        const colunas = direcao === 'H' ? c.largura : c.altura;
        for (let a = 0; a < linhas; a++) {
          let b = 0;
          while (b < colunas) {
            const letra = (x: number) => (direcao === 'H' ? c.grade[a][x] : c.grade[x][a]);
            if (!letra(b)) { b++; continue; }
            let fim = b;
            while (fim < colunas && letra(fim)) fim++;
            if (fim - b >= 2) {
              const texto = Array.from({ length: fim - b }, (_, i) => letra(b + i)).join('');
              const [l, col] = direcao === 'H' ? [a, b] : [b, a];
              expect(respostas.has(`${direcao}${l},${col}:${texto}`)).toBe(true);
            }
            b = fim;
          }
        }
      }
    }
  });
});
