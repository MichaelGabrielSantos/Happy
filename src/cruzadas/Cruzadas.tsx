import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../componentes/Modal';
import { Teclado } from '../componentes/Teclado';
import { ler, salvar } from '../lib/armazenamento';
import { compartilhar } from '../lib/compartilhar';
import { formatarDuracao, numeroDoDia } from '../lib/dia';
import { normalizar } from '../lib/texto';
import { useAviso } from '../lib/useAviso';
import type { Painel } from '../tipos';
import { BANCO } from './banco';
import { casasDa, gerarCruzadinha, type Direcao, type Palavra } from './gerador';

type Modo = 'dia' | 'treino';

interface Partida {
  id: string;
  letras: Record<string, string>;
  reveladas: string[];
  decorrido: number;
  concluida: boolean;
}

interface Historico {
  /** data -> tempo em ms das cruzadinhas do dia concluídas */
  tempos: Record<string, number>;
}

interface Selecao {
  l: number;
  c: number;
  direcao: Direcao;
}

const k = (l: number, c: number) => `${l},${c}`;
const semDia = (data: string) => numeroDoDia(data) * 7919 + 104729;
const partidaNova = (id: string): Partida => ({ id, letras: {}, reveladas: [], decorrido: 0, concluida: false });

interface Props {
  data: string;
  painel: Painel;
  setPainel: (p: Painel) => void;
}

export function Cruzadas({ data, painel, setPainel }: Props) {
  const [modo, setModo] = useState<Modo>('dia');
  const [sementeTreino, setSementeTreino] = useState(() => ler('cruzadas:semente-treino', 1));
  const semente = modo === 'dia' ? semDia(data) : sementeTreino;
  const id = modo === 'dia' ? `dia:${data}` : `treino:${sementeTreino}`;
  const chaveSalva = `cruzadas:${modo}`;

  const cruzadinha = useMemo(() => gerarCruzadinha(BANCO, semente), [semente]);
  const { grade, palavras, largura, altura } = cruzadinha;

  const [partida, setPartida] = useState<Partida>(() => {
    const salva = ler<Partida | null>(chaveSalva, null);
    return salva?.id === id ? salva : partidaNova(id);
  });
  // troca de modo ou de dia: carrega a partida certa
  if (partida.id !== id) {
    const salva = ler<Partida | null>(chaveSalva, null);
    setPartida(salva?.id === id ? salva : partidaNova(id));
  }

  const [selecao, setSelecao] = useState<Selecao>(() => ({
    l: palavras[0].linha,
    c: palavras[0].coluna,
    direcao: palavras[0].direcao,
  }));
  const [erradas, setErradas] = useState<Set<string>>(new Set());
  const [historico, setHistorico] = useState<Historico>(() => ler('cruzadas:historico', { tempos: {} }));
  const [aviso, mostrarAviso] = useAviso();
  const [parabens, setParabens] = useState(false);

  useEffect(() => salvar(chaveSalva, partida), [chaveSalva, partida]);

  // relógio: só conta com a aba visível e a partida em andamento
  useEffect(() => {
    if (partida.concluida) return;
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') setPartida((p) => ({ ...p, decorrido: p.decorrido + 1000 }));
    }, 1000);
    return () => clearInterval(id);
  }, [partida.concluida, partida.id]);

  /** Palavras que passam por cada casa, por direção. */
  const indice = useMemo(() => {
    const mapa = new Map<string, Partial<Record<Direcao, Palavra>>>();
    for (const p of palavras) {
      for (const [l, c] of casasDa(p)) {
        const atual = mapa.get(k(l, c)) ?? {};
        atual[p.direcao] = p;
        mapa.set(k(l, c), atual);
      }
    }
    return mapa;
  }, [palavras]);

  // se a seleção apontar para uma casa que não existe mais (nova grade), volta para a primeira palavra
  const selecaoValida = indice.get(k(selecao.l, selecao.c))?.[selecao.direcao];
  const sel: Selecao = selecaoValida
    ? selecao
    : { l: palavras[0].linha, c: palavras[0].coluna, direcao: palavras[0].direcao };
  const palavraAtual = indice.get(k(sel.l, sel.c))![sel.direcao]!;
  const casasAtuais = useMemo(() => new Set(casasDa(palavraAtual).map(([l, c]) => k(l, c))), [palavraAtual]);

  const reveladas = useMemo(() => new Set(partida.reveladas), [partida.reveladas]);

  const atualizarLetras = (mudancas: Record<string, string>, novasReveladas: string[] = []) => {
    setErradas((e) => {
      const n = new Set(e);
      Object.keys(mudancas).forEach((x) => n.delete(x));
      return n;
    });
    setPartida((p) =>
      p.concluida
        ? p
        : { ...p, letras: { ...p.letras, ...mudancas }, reveladas: [...new Set([...p.reveladas, ...novasReveladas])] },
    );
  };

  // grade toda certa: encerra a partida e guarda o tempo da cruzadinha do dia
  const completa = grade.every((linha, l) => linha.every((certa, c) => !certa || partida.letras[k(l, c)] === certa));
  useEffect(() => {
    if (!completa || partida.concluida) return;
    setPartida((p) => ({ ...p, concluida: true }));
    setParabens(true);
    if (partida.id.startsWith('dia:')) {
      setHistorico((h) => {
        const novo = { tempos: { ...h.tempos, [data]: h.tempos[data] ?? partida.decorrido } };
        salvar('cruzadas:historico', novo);
        return novo;
      });
    }
  }, [completa, partida.concluida, partida.id, partida.decorrido, data]);

  const selecionarPalavra = (p: Palavra) => {
    const casas = casasDa(p);
    const vazia = casas.find(([l, c]) => !partida.letras[k(l, c)]) ?? casas[0];
    setSelecao({ l: vazia[0], c: vazia[1], direcao: p.direcao });
  };

  const tocarCasa = (l: number, c: number) => {
    const aqui = indice.get(k(l, c));
    if (!aqui) return;
    if (l === sel.l && c === sel.c && aqui.H && aqui.V) {
      setSelecao({ l, c, direcao: sel.direcao === 'H' ? 'V' : 'H' });
    } else {
      setSelecao({ l, c, direcao: aqui[sel.direcao] ? sel.direcao : aqui.H ? 'H' : 'V' });
    }
  };

  const mover = (delta: number) => {
    const casas = casasDa(palavraAtual);
    const i = casas.findIndex(([l, c]) => l === sel.l && c === sel.c);
    const j = Math.min(casas.length - 1, Math.max(0, i + delta));
    setSelecao({ ...sel, l: casas[j][0], c: casas[j][1] });
  };

  const ordem = useMemo(
    () => [...palavras.filter((p) => p.direcao === 'H'), ...palavras.filter((p) => p.direcao === 'V')],
    [palavras],
  );
  const proximaPalavra = (delta: number) => {
    const i = ordem.indexOf(palavraAtual);
    selecionarPalavra(ordem[(i + delta + ordem.length) % ordem.length]);
  };

  const teclar = (tecla: string) => {
    if (partida.concluida) return;
    const chave = k(sel.l, sel.c);
    if (tecla === 'ENTER') return proximaPalavra(1);
    if (tecla === 'BACKSPACE') {
      if (partida.letras[chave] && !reveladas.has(chave)) return atualizarLetras({ [chave]: '' });
      const casas = casasDa(palavraAtual);
      const i = casas.findIndex(([l, c]) => l === sel.l && c === sel.c);
      if (i > 0) {
        const anterior = k(...casas[i - 1]);
        if (!reveladas.has(anterior)) atualizarLetras({ [anterior]: '' });
        mover(-1);
      }
      return;
    }
    if (/^[A-Z]$/.test(tecla)) {
      if (!reveladas.has(chave)) atualizarLetras({ [chave]: tecla });
      mover(1);
    }
  };

  const setas = (tecla: string) => {
    const [dl, dc] = { ARROWUP: [-1, 0], ARROWDOWN: [1, 0], ARROWLEFT: [0, -1], ARROWRIGHT: [0, 1] }[tecla]!;
    const direcao: Direcao = dl === 0 ? 'H' : 'V';
    let [l, c] = [sel.l + dl, sel.c + dc];
    while (l >= 0 && c >= 0 && l < altura && c < largura) {
      const aqui = indice.get(k(l, c));
      if (aqui) return setSelecao({ l, c, direcao: aqui[direcao] ? direcao : aqui.H ? 'H' : 'V' });
      l += dl;
      c += dc;
    }
  };

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || painel || parabens) return;
      if (e.key === 'Tab') {
        e.preventDefault();
        return proximaPalavra(e.shiftKey ? -1 : 1);
      }
      if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        return setas(e.key.toUpperCase());
      }
      const tecla = e.key === 'Enter' || e.key === 'Backspace' ? e.key.toUpperCase() : normalizar(e.key);
      if (/^([A-Z]|ENTER|BACKSPACE)$/.test(tecla)) {
        e.preventDefault();
        teclar(tecla);
      }
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  });

  const verificar = () => {
    const erros = new Set<string>();
    grade.forEach((linha, l) =>
      linha.forEach((certa, c) => {
        const escrita = partida.letras[k(l, c)];
        if (certa && escrita && escrita !== certa) erros.add(k(l, c));
      }),
    );
    setErradas(erros);
    mostrarAviso(erros.size ? `${erros.size} letra${erros.size > 1 ? 's' : ''} errada${erros.size > 1 ? 's' : ''}` : 'Nenhum erro até aqui!');
  };

  const revelar = (casas: [number, number][]) => {
    const mudancas: Record<string, string> = {};
    for (const [l, c] of casas) mudancas[k(l, c)] = grade[l][c]!;
    atualizarLetras(mudancas, Object.keys(mudancas));
  };

  const novaTreino = () => {
    const nova = Math.floor(Math.random() * 1e9);
    salvar('cruzadas:semente-treino', nova);
    setSementeTreino(nova);
    setParabens(false);
  };

  const trocarModo = (m: Modo) => {
    setModo(m);
    setParabens(false);
    setErradas(new Set());
  };

  const tempos = Object.values(historico.tempos);
  const listas: [string, Direcao][] = [['Horizontais', 'H'], ['Verticais', 'V']];

  return (
    <div className="cruzadas">
      {aviso && <div className="aviso" role="status">{aviso}</div>}

      <div className="cruzadas-barra">
        <div className="alternar" role="tablist">
          <button type="button" role="tab" aria-selected={modo === 'dia'} className={modo === 'dia' ? 'ativo' : ''} onClick={() => trocarModo('dia')}>
            Do dia
          </button>
          <button type="button" role="tab" aria-selected={modo === 'treino'} className={modo === 'treino' ? 'ativo' : ''} onClick={() => trocarModo('treino')}>
            Treino
          </button>
        </div>
        <span className="relogio" aria-label="Tempo">⏱ {formatarDuracao(partida.decorrido)}</span>
      </div>

      <div className="cruzadas-corpo">
        <div className="cruzadas-esquerda">
          <div className="grade" style={{ ['--colunas' as string]: largura }}>
            {grade.map((linha, l) =>
              linha.map((certa, c) => {
                if (!certa) return <div key={k(l, c)} className="celula bloqueada" />;
                const chave = k(l, c);
                const numero = palavras.find((p) => p.linha === l && p.coluna === c)?.numero;
                const classes = [
                  'celula',
                  casasAtuais.has(chave) ? 'na-palavra' : '',
                  l === sel.l && c === sel.c ? 'selecionada' : '',
                  erradas.has(chave) ? 'errada' : '',
                  reveladas.has(chave) ? 'revelada' : '',
                  partida.concluida ? 'resolvida' : '',
                ].join(' ');
                return (
                  <button type="button" key={chave} className={classes} onClick={() => tocarCasa(l, c)} aria-label={`Linha ${l + 1}, coluna ${c + 1}`}>
                    {numero && <span className="numero">{numero}</span>}
                    {partida.letras[chave]}
                  </button>
                );
              }),
            )}
          </div>

          <div className="dica-atual">
            <button type="button" aria-label="Dica anterior" onClick={() => proximaPalavra(-1)}>‹</button>
            <p>
              <b>{palavraAtual.numero} {palavraAtual.direcao === 'H' ? '→' : '↓'}</b> {palavraAtual.dica}
              <small> ({palavraAtual.resposta.length} letras)</small>
            </p>
            <button type="button" aria-label="Próxima dica" onClick={() => proximaPalavra(1)}>›</button>
          </div>

          {!partida.concluida ? (
            <div className="acoes">
              <button type="button" className="botao" onClick={verificar}>Verificar</button>
              <button type="button" className="botao" onClick={() => revelar([[sel.l, sel.c]])}>Revelar letra</button>
              <button type="button" className="botao" onClick={() => revelar(casasDa(palavraAtual))}>Revelar palavra</button>
            </div>
          ) : (
            <div className="acoes">
              {modo === 'treino' ? (
                <button type="button" className="botao primario" onClick={novaTreino}>Nova cruzadinha</button>
              ) : (
                <button type="button" className="botao primario" onClick={() => trocarModo('treino')}>Jogar no treino</button>
              )}
            </div>
          )}

          <Teclado aoTeclar={teclar} textoEnter="PRÓX." />
        </div>

        <div className="dicas">
          {listas.map(([titulo, direcao]) => (
            <section key={direcao}>
              <h3>{titulo}</h3>
              <ol>
                {palavras
                  .filter((p) => p.direcao === direcao)
                  .map((p) => {
                    const completa = casasDa(p).every(([l, c]) => partida.letras[k(l, c)]);
                    return (
                      <li key={`${direcao}${p.numero}`}>
                        <button
                          type="button"
                          className={`${p === palavraAtual ? 'ativa' : ''} ${completa ? 'completa' : ''}`}
                          onClick={() => selecionarPalavra(p)}
                        >
                          <b>{p.numero}</b> {p.dica}
                        </button>
                      </li>
                    );
                  })}
              </ol>
            </section>
          ))}
          {modo === 'treino' && !partida.concluida && (
            <button type="button" className="botao" onClick={novaTreino}>Gerar outra cruzadinha</button>
          )}
        </div>
      </div>

      {parabens && (
        <Modal titulo="Cruzadinha completa!" aoFechar={() => setParabens(false)}>
          <p className="resposta-final">
            Tempo: <b>{formatarDuracao(partida.decorrido)}</b>
            {partida.reveladas.length > 0 && <> · {partida.reveladas.length} letra{partida.reveladas.length > 1 ? 's' : ''} revelada{partida.reveladas.length > 1 ? 's' : ''}</>}
          </p>
          <ul className="gabarito">
            {palavras.map((p) => (
              <li key={`${p.direcao}${p.numero}`}>
                <b>{p.original.toUpperCase()}</b> — {p.dica}
              </li>
            ))}
          </ul>
          <div className="rodape-modal">
            <button
              type="button"
              className="botao primario"
              onClick={async () =>
                mostrarAviso(
                  await compartilhar(
                    `O Termo — Palavras Cruzadas${modo === 'dia' ? ` #${numeroDoDia(data) + 1}` : ''}\n⏱ ${formatarDuracao(partida.decorrido)}${partida.reveladas.length ? ` · ${partida.reveladas.length} ajuda(s)` : ' · sem ajuda'}`,
                  ),
                )
              }
            >
              Compartilhar
            </button>
          </div>
        </Modal>
      )}

      {painel === 'ajuda' && (
        <Modal titulo="Como jogar as Palavras Cruzadas" aoFechar={() => setPainel(null)}>
          <p>Descubra as palavras a partir das dicas. Cada número na grade marca o começo de uma palavra: <b>→</b> horizontal, <b>↓</b> vertical.</p>
          <p>Toque numa casa para escolher a palavra; toque de novo para trocar entre horizontal e vertical. No computador, use as setas, <b>Tab</b> e <b>Enter</b>.</p>
          <p>Acentos e cedilha não entram na grade: <b>AÇÚCAR</b> vira <b>ACUCAR</b>.</p>
          <p><b>Verificar</b> mostra as letras erradas. <b>Revelar</b> preenche uma letra ou a palavra inteira, mas fica registrado.</p>
          <p>A cruzadinha <b>do dia</b> é a mesma para todo mundo. No <b>treino</b> você gera quantas quiser.</p>
        </Modal>
      )}

      {painel === 'placar' && (
        <Modal titulo="Progresso nas cruzadas" aoFechar={() => setPainel(null)}>
          <div className="numeros">
            <div><strong>{tempos.length}</strong><span>cruzadinhas do dia</span></div>
            <div><strong>{tempos.length ? formatarDuracao(Math.min(...tempos)) : '--'}</strong><span>melhor tempo</span></div>
            <div><strong>{tempos.length ? formatarDuracao(tempos.reduce((a, b) => a + b, 0) / tempos.length) : '--'}</strong><span>tempo médio</span></div>
          </div>
          {historico.tempos[data] !== undefined && <p className="resposta-final">Hoje: <b>{formatarDuracao(historico.tempos[data])}</b></p>}
        </Modal>
      )}
    </div>
  );
}
