import { beforeEach, describe, expect, it } from 'vitest';
import { ArmazemMemoria } from '../../api/_lib/armazem';
import {
  adicionarNaFila,
  avaliar,
  calcularPontos,
  chutar,
  editarFila,
  entrarNoRanking,
  estadoDoJogo,
  iniciar,
  normalizarInstagram,
  painelAdmin,
  palavraDoDia,
  ranking,
  removerDoRanking,
  trocarPalavraDeHoje,
} from '../../api/_lib/jogo';
import { MEMES } from '../../api/_lib/memes';
import { BANCO } from '../cruzadas/banco';
import { casasDa, gerarCruzadinha, limpar } from '../cruzadas/gerador';
import { numeroDoDia } from '../lib/dia';

const DIA = '2026-10-20';
const APARELHO = 'aparelho-de-teste-0001';
const OUTRO = 'aparelho-de-teste-0002';

describe('avaliação das letras', () => {
  it('marca certas, fora do lugar e erradas', () => {
    expect(avaliar('CARRO', 'CORTE')).toEqual(['certa', 'errada', 'certa', 'errada', 'lugar']);
  });
  it('não marca amarelo a mais em letras repetidas', () => {
    expect(avaliar('AAAAA', 'BANCO')).toEqual(['errada', 'certa', 'errada', 'errada', 'errada']);
    expect(avaliar('OSSOS', 'POSSO')).toEqual(['lugar', 'lugar', 'certa', 'lugar', 'errada']);
  });
  it('pontua por tentativas e tempo', () => {
    expect(calcularPontos(true, 1, 10_000)).toBe(990);
    expect(calcularPontos(true, 3, 60_000)).toBe(740);
    expect(calcularPontos(true, 6, 3_600_000)).toBe(200);
    expect(calcularPontos(false, 6, 1000)).toBe(0);
  });
  it('a reserva de memes só tem palavras de 4 a 8 letras', () => {
    for (const m of MEMES) expect(limpar(m.palavra).length, m.palavra).toBeGreaterThanOrEqual(4);
    for (const m of MEMES) expect(limpar(m.palavra).length, m.palavra).toBeLessThanOrEqual(8);
  });
});

describe('partida no servidor', () => {
  let a: ArmazemMemoria;
  beforeEach(async () => {
    a = new ArmazemMemoria();
    await adicionarNaFila(a, [
      { palavra: 'aura', dica: 'carisma' },
      { palavra: 'cringe', dica: 'vergonha alheia' },
    ]);
  });

  it('tira a palavra do dia da fila, uma vez por dia', async () => {
    expect((await palavraDoDia(a, DIA)).palavra).toBe('aura');
    expect((await palavraDoDia(a, DIA)).palavra).toBe('aura');
    expect((await palavraDoDia(a, '2026-10-21')).palavra).toBe('cringe');
    // fila vazia: usa a reserva
    expect((await palavraDoDia(a, '2026-10-22')).origem).toBe('reserva');
  });

  it('não revela a resposta antes do fim', async () => {
    const e = await estadoDoJogo(a, APARELHO, DIA);
    expect(e.tamanho).toBe(4);
    expect(e.resposta).toBeNull();
    expect(JSON.stringify(e)).not.toContain('aura');
  });

  it('exige começar, valida tamanho e dicionário', async () => {
    await expect(chutar(a, APARELHO, 'casa', DIA)).rejects.toThrow('Jogar');
    await iniciar(a, APARELHO, DIA);
    await expect(chutar(a, APARELHO, 'carro', DIA)).rejects.toThrow('4 letras');
    await expect(chutar(a, APARELHO, 'xqzw', DIA)).rejects.toThrow('não é aceita');
    const e = await chutar(a, APARELHO, 'casa', DIA);
    expect(e.chutes[0].estados).toEqual(['errada', 'lugar', 'errada', 'certa']);
  });

  it('vitória gera pontos, resposta e entrada no ranking', async () => {
    await iniciar(a, APARELHO, DIA);
    await chutar(a, APARELHO, 'casa', DIA);
    const e = await chutar(a, APARELHO, 'AURA', DIA);
    expect(e.fim?.venceu).toBe(true);
    expect(e.fim?.tentativas).toBe(2);
    expect(e.resposta).toEqual({ palavra: 'aura', dica: 'carisma' });
    await expect(chutar(a, APARELHO, 'aura', DIA)).rejects.toThrow('já jogou');

    expect(await entrarNoRanking(a, APARELHO, '@Fulano.Silva', '1.1.1.1', DIA)).toEqual({ instagram: 'fulano.silva', posicao: 1 });
    // o mesmo aparelho não troca de @ no mesmo dia
    expect((await entrarNoRanking(a, APARELHO, 'outro', '1.1.1.1', DIA)).instagram).toBe('fulano.silva');

    // outro aparelho não pode usar o mesmo @
    await iniciar(a, OUTRO, DIA);
    await chutar(a, OUTRO, 'aura', DIA);
    await expect(entrarNoRanking(a, OUTRO, 'fulano.silva', '2.2.2.2', DIA)).rejects.toThrow('outro aparelho');
    await entrarNoRanking(a, OUTRO, 'ciclano', '2.2.2.2', DIA);

    const r = await ranking(a, 'dia', 'ciclano', DIA);
    expect(r.itens.map((i) => i.instagram)).toEqual(['ciclano', 'fulano.silva']); // menos tentativas ganha
    expect(r.meu?.posicao).toBe(1);
    const g = await ranking(a, 'geral', undefined, DIA);
    expect(g.itens[0].dias).toBe(1);

    await removerDoRanking(a, DIA, 'ciclano');
    expect((await ranking(a, 'dia', undefined, DIA)).itens).toHaveLength(1);
    expect((await ranking(a, 'geral', undefined, DIA)).itens.find((i) => i.instagram === 'ciclano')?.pontos).toBe(0);
  });

  it('derrota depois de 6 tentativas não entra no ranking', async () => {
    await iniciar(a, APARELHO, DIA);
    let e;
    for (let i = 0; i < 6; i++) e = await chutar(a, APARELHO, 'casa', DIA);
    expect(e!.fim?.venceu).toBe(false);
    expect(e!.resposta?.palavra).toBe('aura');
    await expect(entrarNoRanking(a, APARELHO, 'fulano', '1.1.1.1', DIA)).rejects.toThrow('acerta');
  });

  it('valida o @ do Instagram', () => {
    expect(normalizarInstagram(' @Maria_123 ')).toBe('maria_123');
    expect(normalizarInstagram('https://www.instagram.com/joao.p/')).toBe('joao.p');
    expect(() => normalizarInstagram('com espaço')).toThrow();
    expect(() => normalizarInstagram('')).toThrow();
  });

  it('admin: fila, reordenação e troca da palavra de hoje', async () => {
    await expect(adicionarNaFila(a, [{ palavra: 'red flag' }])).rejects.toThrow('só letras');
    await expect(adicionarNaFila(a, [{ palavra: 'pix' }])).rejects.toThrow('4 a 8');
    await expect(adicionarNaFila(a, [{ palavra: 'Aura' }])).rejects.toThrow('já está na fila');
    await adicionarNaFila(a, [{ palavra: 'Skibidi', dica: '' }]);
    let p = await painelAdmin(a, DIA);
    expect(p.fila.map((f) => f.palavra)).toEqual(['aura', 'cringe', 'skibidi']);
    await editarFila(a, 'subir', p.fila[2].id);
    await editarFila(a, 'remover', p.fila[0].id);
    p = await painelAdmin(a, DIA);
    expect(p.fila.map((f) => f.palavra)).toEqual(['skibidi', 'cringe']);

    await trocarPalavraDeHoje(a, 'slay', 'arrasar', DIA);
    expect((await palavraDoDia(a, DIA)).palavra).toBe('slay');
    await iniciar(a, APARELHO, DIA);
    await expect(trocarPalavraDeHoje(a, 'goat', '', DIA)).rejects.toThrow('já começou');
  });
});

describe('dias', () => {
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
        expect(casasDa(p).map(([l, col]) => c.grade[l][col]).join('')).toBe(p.resposta);
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
