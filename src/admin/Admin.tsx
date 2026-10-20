import { useCallback, useEffect, useState } from 'react';
import { formatarDuracao } from '../lib/dia';
import { normalizar } from '../lib/texto';
import { useAviso } from '../lib/useAviso';
import type { Ranking } from '../termo/api';

interface Termo {
  palavra: string;
  dica: string;
}
interface ItemFila extends Termo {
  id: string;
}
interface Dia {
  data: string;
  palavra: (Termo & { origem: 'fila' | 'reserva' | 'admin' }) | null;
  iniciadas: number;
  vencedores: number;
  noRanking: number;
}
interface Painel {
  data: string;
  fila: ItemFila[];
  historico: Dia[];
  reserva: { total: number; proxima: Termo };
}

const CHAVE_SENHA = 'admin:senha';
const ORIGEM = { fila: '📋 da fila', reserva: '🎲 da reserva', admin: '✍️ definida no admin' };

function lerSenha() {
  try {
    return sessionStorage.getItem(CHAVE_SENHA) ?? '';
  } catch {
    return '';
  }
}

async function chamar<T>(senha: string, corpo?: unknown): Promise<T> {
  const r = await fetch('/api/admin', {
    method: corpo ? 'POST' : 'GET',
    headers: { 'x-admin-senha': senha, 'content-type': 'application/json' },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const dados = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(dados.erro ?? 'Erro'), { status: r.status });
  return dados as T;
}

const dataCurta = (data: string) => data.split('-').reverse().slice(0, 2).join('/');

function somarDias(data: string, n: number) {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Aceita "palavra - dica", "palavra | dica" ou "palavra; dica", uma por linha. */
function lerLote(texto: string): Termo[] {
  return texto
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [palavra, ...resto] = l.split(/\s+[-–|;]\s+|\s*[|;]\s*/);
      return { palavra: palavra.trim(), dica: resto.join(' - ').trim() };
    });
}

const letras = (p: string) => normalizar(p).replace(/[^A-Z]/g, '').length;

export function Admin() {
  const [senha, setSenha] = useState(lerSenha);
  const [entrada, setEntrada] = useState('');
  const [painel, setPainel] = useState<Painel | null>(null);
  const [erroLogin, setErroLogin] = useState('');
  const [aviso, mostrarAviso] = useAviso(2500);

  const [palavra, setPalavra] = useState('');
  const [dica, setDica] = useState('');
  const [lote, setLote] = useState('');
  const [modoLote, setModoLote] = useState(false);
  const [troca, setTroca] = useState({ palavra: '', dica: '' });
  const [aberto, setAberto] = useState<string | null>(null);
  const [rankingDia, setRankingDia] = useState<Ranking | null>(null);

  const carregar = useCallback(
    async (s = senha) => {
      if (!s) return;
      try {
        setPainel(await chamar<Painel>(s));
        setErroLogin('');
      } catch (e) {
        if ((e as { status?: number }).status === 401) {
          setSenha('');
          try { sessionStorage.removeItem(CHAVE_SENHA); } catch { /* sem armazenamento */ }
        }
        setErroLogin((e as Error).message);
      }
    },
    [senha],
  );

  useEffect(() => {
    carregar();
  }, [carregar]);

  const acao = async (corpo: Record<string, unknown>, sucesso: string) => {
    try {
      await chamar(senha, corpo);
      mostrarAviso(sucesso);
      await carregar();
      return true;
    } catch (e) {
      mostrarAviso((e as Error).message);
      return false;
    }
  };

  const verRanking = async (data: string) => {
    if (aberto === data) return setAberto(null);
    setAberto(data);
    setRankingDia(null);
    const r = await fetch(`/api/ranking?periodo=dia&data=${data}`);
    setRankingDia(await r.json());
  };

  if (!senha || !painel) {
    return (
      <div className="app admin">
        {aviso && <div className="aviso">{aviso}</div>}
        <form
          className="cartao login"
          onSubmit={(e) => {
            e.preventDefault();
            try { sessionStorage.setItem(CHAVE_SENHA, entrada); } catch { /* sem armazenamento */ }
            setSenha(entrada);
            carregar(entrada);
          }}
        >
          <h1 className="logo">O <span>TERMO</span></h1>
          <p className="subtitulo">Área do admin</p>
          <input className="campo" type="password" placeholder="Senha" value={entrada} onChange={(e) => setEntrada(e.target.value)} autoFocus />
          {erroLogin && <p className="erro">{erroLogin}</p>}
          <button type="submit" className="botao primario grande">Entrar</button>
        </form>
      </div>
    );
  }

  const [hoje, ...anteriores] = painel.historico;
  // se a palavra de hoje ainda não foi sorteada, o primeiro da fila é o de hoje
  const deslocamento = hoje.palavra ? 1 : 0;
  const previaLote = lerLote(lote);

  return (
    <div className="app admin">
      {aviso && <div className="aviso" role="status">{aviso}</div>}
      <header className="topo">
        <h1 className="logo">O <span>TERMO</span> <small>admin</small></h1>
        <div className="topo-botoes">
          <a className="icone" href="/" aria-label="Abrir o jogo">🎮</a>
          <button type="button" className="icone" aria-label="Atualizar" onClick={() => carregar()}>↻</button>
        </div>
      </header>

      <section className="cartao bloco">
        <h2>Hoje · {dataCurta(hoje.data)}</h2>
        {hoje.palavra ? (
          <>
            <span className="palavra-grande">{hoje.palavra.palavra.toUpperCase()}</span>
            <span className="etiqueta">{ORIGEM[hoje.palavra.origem]}</span>
            {hoje.palavra.dica && <p className="dica">💡 {hoje.palavra.dica}</p>}
          </>
        ) : (
          <p className="dica">Ainda não sorteada: sai quando o primeiro jogador abrir o jogo ({painel.fila[0] ? `"${painel.fila[0].palavra}", da fila` : `"${painel.reserva.proxima.palavra}", da reserva`}).</p>
        )}
        <div className="numeros">
          <div><strong>{hoje.iniciadas}</strong><span>começaram</span></div>
          <div><strong>{hoje.vencedores}</strong><span>acertaram</span></div>
          <div><strong>{hoje.noRanking}</strong><span>no ranking</span></div>
        </div>
        {hoje.iniciadas === 0 && (
          <details>
            <summary>Trocar a palavra de hoje</summary>
            <form
              className="formulario"
              onSubmit={async (e) => {
                e.preventDefault();
                if (await acao({ acao: 'trocarHoje', ...troca }, 'Palavra de hoje trocada')) setTroca({ palavra: '', dica: '' });
              }}
            >
              <input className="campo" placeholder="palavra" value={troca.palavra} onChange={(e) => setTroca({ ...troca, palavra: e.target.value })} />
              <textarea className="campo" placeholder="O que significa (aparece no fim da partida)" value={troca.dica} onChange={(e) => setTroca({ ...troca, dica: e.target.value })} />
              <button type="submit" className="botao primario">Trocar</button>
            </form>
            <p className="nota">Só funciona enquanto ninguém começou a jogar hoje.</p>
          </details>
        )}
      </section>

      <section className="cartao bloco">
        <h2>Fila de palavras <span className="contador">{painel.fila.length}</span></h2>
        <p className="nota">
          Cada dia usa a próxima da fila. Fila vazia → entra a reserva de memes ({painel.reserva.total} palavras; a próxima é "{painel.reserva.proxima.palavra}").
        </p>

        <div className="alternar largo">
          <button type="button" className={!modoLote ? 'ativo' : ''} onClick={() => setModoLote(false)}>Uma palavra</button>
          <button type="button" className={modoLote ? 'ativo' : ''} onClick={() => setModoLote(true)}>Várias de uma vez</button>
        </div>
        {!modoLote ? (
          <form
            className="formulario"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await acao({ acao: 'adicionar', itens: [{ palavra, dica }] }, `"${palavra}" entrou na fila`)) {
                setPalavra('');
                setDica('');
              }
            }}
          >
            <div className="campo-com-contador">
              <input className="campo" placeholder="palavra (4 a 8 letras)" value={palavra} onChange={(e) => setPalavra(e.target.value)} autoCapitalize="none" />
              <span className={letras(palavra) >= 4 && letras(palavra) <= 8 ? 'ok' : ''}>{letras(palavra)}</span>
            </div>
            <textarea className="campo" placeholder="O que significa? Ex.: Charme pra conquistar alguém." value={dica} onChange={(e) => setDica(e.target.value)} />
            <button type="submit" className="botao primario" disabled={!palavra.trim()}>Adicionar à fila</button>
          </form>
        ) : (
          <form
            className="formulario"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await acao({ acao: 'adicionar', itens: previaLote }, `${previaLote.length} palavras adicionadas`)) setLote('');
            }}
          >
            <textarea
              className="campo alto"
              placeholder={'Uma por linha, no formato palavra - significado\n\nrizz - charme pra conquistar\naura - a moral da pessoa'}
              value={lote}
              onChange={(e) => setLote(e.target.value)}
            />
            {previaLote.length > 0 && (
              <ul className="previa">
                {previaLote.map((t, i) => (
                  <li key={i} className={letras(t.palavra) >= 4 && letras(t.palavra) <= 8 && /^\p{L}+$/u.test(t.palavra) ? '' : 'invalida'}>
                    <b>{t.palavra}</b> {t.dica && `— ${t.dica}`}
                  </li>
                ))}
              </ul>
            )}
            <button type="submit" className="botao primario" disabled={!previaLote.length}>Adicionar {previaLote.length || ''} à fila</button>
          </form>
        )}

        {painel.fila.length === 0 ? (
          <p className="vazio">Fila vazia. Os próximos dias vão usar a reserva de memes.</p>
        ) : (
          <ol className="fila">
            {painel.fila.map((item, i) => (
              <li key={item.id}>
                <span className="fila-data">{dataCurta(somarDias(hoje.data, i + deslocamento))}</span>
                <div className="fila-texto">
                  <b>{item.palavra.toUpperCase()}</b> <small>{letras(item.palavra)} letras</small>
                  {item.dica && <p>{item.dica}</p>}
                </div>
                <div className="fila-botoes">
                  <button type="button" aria-label="Subir" disabled={i === 0} onClick={() => acao({ acao: 'subir', id: item.id }, 'Movida')}>↑</button>
                  <button type="button" aria-label="Descer" disabled={i === painel.fila.length - 1} onClick={() => acao({ acao: 'descer', id: item.id }, 'Movida')}>↓</button>
                  <button
                    type="button"
                    aria-label="Remover"
                    className="perigo"
                    onClick={() => confirm(`Remover "${item.palavra}" da fila?`) && acao({ acao: 'remover', id: item.id }, 'Removida')}
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="cartao bloco">
        <h2>Últimos dias</h2>
        <ul className="historico">
          {[hoje, ...anteriores].filter((d) => d.palavra).map((d) => (
            <li key={d.data}>
              <button type="button" className="historico-linha" onClick={() => verRanking(d.data)}>
                <span>{dataCurta(d.data)}</span>
                <b>{d.palavra!.palavra.toUpperCase()}</b>
                <span className="nota">{d.vencedores}/{d.iniciadas} acertos · {d.noRanking} no ranking</span>
              </button>
              {aberto === d.data && (
                <div className="ranking-admin">
                  {!rankingDia ? (
                    <p className="nota">Carregando…</p>
                  ) : rankingDia.itens.length === 0 ? (
                    <p className="nota">Ninguém no ranking.</p>
                  ) : (
                    <ol>
                      {rankingDia.itens.map((r) => (
                        <li key={r.instagram}>
                          <span>{r.posicao}º @{r.instagram} · {r.pontos} pts · {formatarDuracao(r.tempoMs ?? 0)}</span>
                          <button
                            type="button"
                            className="perigo"
                            onClick={async () => {
                              if (!confirm(`Tirar @${r.instagram} do ranking de ${dataCurta(d.data)}?`)) return;
                              if (await acao({ acao: 'removerRanking', data: d.data, instagram: r.instagram }, 'Removido do ranking')) {
                                setAberto(null);
                                verRanking(d.data);
                              }
                            }}
                          >
                            remover
                          </button>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <button
        type="button"
        className="link sair"
        onClick={() => {
          try { sessionStorage.removeItem(CHAVE_SENHA); } catch { /* sem armazenamento */ }
          setSenha('');
          setPainel(null);
        }}
      >
        Sair
      </button>
    </div>
  );
}
