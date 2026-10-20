import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Confete } from '../componentes/Confete';
import { Contagem } from '../componentes/Contagem';
import { Modal } from '../componentes/Modal';
import { Teclado } from '../componentes/Teclado';
import { ler, salvar } from '../lib/armazenamento';
import { formatarDuracao } from '../lib/dia';
import { normalizar } from '../lib/texto';
import { useAviso } from '../lib/useAviso';
import type { Painel } from '../tipos';
import { api, type Estado, type EstadoJogo } from './api';
import { Ranking } from './Ranking';
import { compartilharImagem, gerarStory } from './story';

const ELOGIOS = ['GENIAL! 🤯', 'MAGNÍFICO! 🔥', 'IMPRESSIONANTE! ⚡', 'MANDOU BEM! 💪', 'BOA! 😎', 'UFA! 😅'];
const VIRADA = 220; // ms entre cada letra revelada
const PRIORIDADE: Record<Estado, number> = { errada: 0, lugar: 1, certa: 2 };

type Historico = Record<string, { venceu: boolean; pontos: number }>;

function sequenciaAtual(historico: Historico, data: string): number {
  const d = new Date(`${data}T12:00:00Z`);
  if (!historico[data]) d.setUTCDate(d.getUTCDate() - 1); // hoje ainda não jogado não quebra a sequência
  let n = 0;
  while (historico[d.toISOString().slice(0, 10)]?.venceu) {
    n++;
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return n;
}

/** Mesma conta do servidor, só para mostrar os pontos "em jogo" enquanto o relógio corre. */
const pontosEmJogo = (tentativa: number, ms: number) =>
  Math.max(100, 1000 - 100 * (tentativa - 1) - Math.min(300, Math.floor(ms / 1000)));

interface Props {
  painel: Painel;
  setPainel: (p: Painel) => void;
}

export function Termo({ painel, setPainel }: Props) {
  const [jogo, setJogo] = useState<EstadoJogo | null>(null);
  const [erroCarga, setErroCarga] = useState('');
  const [diferenca, setDiferenca] = useState(0); // relógio do servidor - relógio local
  const [agora, setAgora] = useState(Date.now());
  const [linha, setLinha] = useState<string[]>([]);
  const [cursor, setCursor] = useState(0);
  const [tremendo, setTremendo] = useState(false);
  const [revelando, setRevelando] = useState<number | null>(null);
  const [resultado, setResultado] = useState(false);
  const [confete, setConfete] = useState(false);
  const [instagram, setInstagram] = useState<string>(() => ler('instagram', ''));
  const [posicao, setPosicao] = useState<number | null>(null);
  const [historico, setHistorico] = useState<Historico>(() => ler('termo:historico', {}));
  const [aviso, mostrarAviso] = useAviso(2200);
  const ocupado = useRef(false);

  const receber = useCallback((e: EstadoJogo) => {
    setDiferenca(e.agora - Date.now());
    setJogo(e);
  }, []);

  const carregar = useCallback(() => {
    setErroCarga('');
    api
      .estado()
      .then((e) => {
        receber(e);
        setLinha(Array(e.tamanho).fill(''));
        setCursor(0);
      })
      .catch((e: Error) => setErroCarga(e.message));
  }, [receber]);

  useEffect(carregar, [carregar]);

  const jogando = !!jogo?.inicio && !jogo.fim;
  useEffect(() => {
    if (!jogando) return;
    const id = setInterval(() => setAgora(Date.now()), 250);
    return () => clearInterval(id);
  }, [jogando]);

  // partida terminou: guarda no histórico local e tenta entrar no ranking com o @ salvo
  const fim = jogo?.fim;
  useEffect(() => {
    if (!jogo?.fim || historico[jogo.data]) return;
    const novo = { ...historico, [jogo.data]: { venceu: jogo.fim.venceu, pontos: jogo.fim.pontos } };
    setHistorico(novo);
    salvar('termo:historico', novo);
  }, [jogo, historico]);

  const entrarNoRanking = useCallback(
    async (handle: string) => {
      try {
        const r = await api.entrarNoRanking(handle);
        setInstagram(r.instagram);
        salvar('instagram', r.instagram);
        setPosicao(r.posicao);
        setJogo((j) => (j ? { ...j, instagram: r.instagram } : j));
      } catch (e) {
        mostrarAviso((e as Error).message);
      }
    },
    [mostrarAviso],
  );

  useEffect(() => {
    if (!fim?.venceu || revelando !== null) return;
    const handle = jogo?.instagram ?? instagram;
    if (handle && posicao === null) entrarNoRanking(handle);
  }, [fim?.venceu, revelando]);

  const teclas = useMemo(() => {
    const t: Record<string, Estado> = {};
    jogo?.chutes.forEach((c, i) => {
      if (i === revelando) return;
      [...normalizar(c.palavra)].forEach((letra, j) => {
        const e = c.estados[j];
        if (!t[letra] || PRIORIDADE[e] > PRIORIDADE[t[letra]]) t[letra] = e;
      });
    });
    return t;
  }, [jogo, revelando]);

  const comecar = async () => {
    if (ocupado.current) return;
    ocupado.current = true;
    try {
      receber(await api.iniciar());
      setAgora(Date.now());
    } catch (e) {
      mostrarAviso((e as Error).message);
    } finally {
      ocupado.current = false;
    }
  };

  const enviar = useCallback(async () => {
    if (!jogo || ocupado.current) return;
    if (linha.some((l) => !l)) {
      mostrarAviso(`Só palavras com ${jogo.tamanho} letras`);
      setTremendo(true);
      return;
    }
    ocupado.current = true;
    try {
      const novo = await api.chutar(linha.join(''));
      const indice = novo.chutes.length - 1;
      setRevelando(indice);
      receber(novo);
      setLinha(Array(novo.tamanho).fill(''));
      setCursor(0);
      setTimeout(() => {
        setRevelando(null);
        ocupado.current = false;
        if (novo.fim?.venceu) {
          mostrarAviso(ELOGIOS[novo.fim.tentativas - 1]);
          setConfete(true);
          setTimeout(() => setResultado(true), 1400);
        } else if (novo.fim) {
          setTimeout(() => setResultado(true), 900);
        }
      }, VIRADA * novo.tamanho + 350);
    } catch (e) {
      ocupado.current = false;
      mostrarAviso((e as Error).message);
      setTremendo(true);
    }
  }, [jogo, linha, mostrarAviso, receber]);

  const teclar = useCallback(
    (tecla: string) => {
      if (!jogando || ocupado.current || !jogo) return;
      const n = jogo.tamanho;
      if (tecla === 'ENTER') return void enviar();
      if (tecla === 'BACKSPACE') {
        const alvo = linha[cursor] ? cursor : Math.max(0, cursor - 1);
        setLinha((l) => l.map((x, i) => (i === alvo ? '' : x)));
        setCursor(alvo);
        return;
      }
      if (tecla === 'ARROWLEFT') return setCursor((c) => Math.max(0, c - 1));
      if (tecla === 'ARROWRIGHT') return setCursor((c) => Math.min(n - 1, c + 1));
      if (/^[A-Z]$/.test(tecla)) {
        setLinha((l) => l.map((x, i) => (i === cursor ? tecla : x)));
        const proxima = linha.findIndex((x, i) => i > cursor && !x);
        setCursor(proxima === -1 ? Math.min(n - 1, cursor + 1) : proxima);
      }
    },
    [jogando, jogo, enviar, linha, cursor],
  );

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || painel || resultado) return;
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      const tecla = e.key === 'Enter' || e.key === 'Backspace' || e.key.startsWith('Arrow') ? e.key.toUpperCase() : normalizar(e.key);
      if (/^([A-Z]|ENTER|BACKSPACE|ARROWLEFT|ARROWRIGHT)$/.test(tecla)) {
        e.preventDefault();
        teclar(tecla);
      }
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [teclar, painel, resultado]);

  const compartilhar = async () => {
    if (!jogo?.fim) return;
    mostrarAviso('Gerando imagem…');
    try {
      const imagem = await gerarStory({
        numero: jogo.numero,
        estados: jogo.chutes.map((c) => c.estados),
        tentativasMax: jogo.tentativas,
        venceu: jogo.fim.venceu,
        pontos: jogo.fim.pontos,
        tempoMs: jogo.fim.tempoMs,
        posicao,
        instagram: jogo.instagram,
        site: location.host,
      });
      const texto = jogo.fim.venceu
        ? `Fiz ${jogo.fim.pontos} pontos no O Termo #${jogo.numero} em ${formatarDuracao(jogo.fim.tempoMs)}! Duvido você ganhar de mim 👉 ${location.origin}`
        : `O Termo #${jogo.numero} me pegou hoje 😵 ${location.origin}`;
      mostrarAviso(await compartilharImagem(imagem, texto));
    } catch {
      mostrarAviso('Não foi possível gerar a imagem');
    }
  };

  // ---------- telas ----------

  if (erroCarga) {
    return (
      <div className="termo centro">
        <div className="cartao">
          <p>😵 {erroCarga}</p>
          <button type="button" className="botao primario" onClick={carregar}>Tentar de novo</button>
        </div>
      </div>
    );
  }
  if (!jogo) {
    return <div className="termo centro"><div className="carregando" aria-label="Carregando" /></div>;
  }

  const tempoMs = jogo.fim ? jogo.fim.tempoMs : jogo.inicio ? agora + diferenca - jogo.inicio : 0;
  const sequencia = sequenciaAtual(historico, jogo.data);

  return (
    <div className="termo" style={{ ['--n' as string]: jogo.tamanho }}>
      {aviso && <div className="aviso" role="status">{aviso}</div>}
      {confete && <Confete />}

      {!jogo.inicio ? (
        <div className="centro">
          <div className="cartao inicio">
            <span className="selo">#{jogo.numero}</span>
            <h2>Palavra do dia</h2>
            <p className="subtitulo">Gírias, memes e o que está bombando na internet</p>
            <div className="fileira-demo" aria-hidden="true">
              {Array.from({ length: jogo.tamanho }, (_, i) => (
                <span key={i} className={`casa mini ${['certa', 'lugar', 'errada'][i % 3]}`} style={{ animationDelay: `${i * 90}ms` }}>?</span>
              ))}
            </div>
            <ul className="chips">
              <li>🔠 {jogo.tamanho} letras</li>
              <li>🎯 {jogo.tentativas} tentativas</li>
              <li>⏱ vale tempo</li>
            </ul>
            <button type="button" className="botao gigante" onClick={comecar}>JOGAR ▶</button>
            <p className="nota">O cronômetro começa quando você tocar em Jogar.</p>
            <div className="inicio-rodape">
              {sequencia > 0 && <span className="chama">🔥 {sequencia} {sequencia === 1 ? 'dia' : 'dias'} seguidos</span>}
              <button type="button" className="link" onClick={() => setPainel('placar')}>🏆 Ver ranking de hoje</button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="hud">
            <span className="hud-item">⏱ {formatarDuracao(tempoMs)}</span>
            <span className="hud-item">🎯 {Math.min(jogo.chutes.length + (jogo.fim ? 0 : 1), jogo.tentativas)}/{jogo.tentativas}</span>
            {jogo.fim ? (
              <button type="button" className="hud-item botao-hud" onClick={() => setResultado(true)}>
                {jogo.fim.venceu ? `💎 ${jogo.fim.pontos}` : '📊 resultado'}
              </button>
            ) : (
              <span className="hud-item pontos-vivos" title="Pontos se acertar agora">💎 {pontosEmJogo(jogo.chutes.length + 1, tempoMs)}</span>
            )}
          </div>

          <div className="tabuleiro" aria-label="Tabuleiro">
            {Array.from({ length: jogo.tentativas }, (_, i) => {
              const chute = jogo.chutes[i];
              if (chute) {
                const venceu = jogo.fim?.venceu && i === jogo.chutes.length - 1 && revelando === null;
                return (
                  <div className={`fileira ${venceu ? 'vitoria' : ''}`} key={i}>
                    {[...chute.palavra.toUpperCase()].map((letra, j) => (
                      <div
                        key={j}
                        className={`casa ${chute.estados[j]} ${revelando === i ? 'virando' : ''}`}
                        style={{ animationDelay: `${(revelando === i ? VIRADA : 90) * j}ms` }}
                      >
                        {letra}
                      </div>
                    ))}
                  </div>
                );
              }
              if (i === jogo.chutes.length && !jogo.fim) {
                return (
                  <div className={`fileira atual ${tremendo ? 'tremer' : ''}`} key={i} onAnimationEnd={() => setTremendo(false)}>
                    {linha.map((letra, j) => (
                      <button
                        type="button"
                        key={j}
                        className={`casa editavel ${letra ? 'cheia' : ''} ${j === cursor ? 'cursor' : ''}`}
                        onClick={() => setCursor(j)}
                        aria-label={`Letra ${j + 1}`}
                      >
                        {letra}
                      </button>
                    ))}
                  </div>
                );
              }
              return (
                <div className="fileira" key={i}>
                  {Array.from({ length: jogo.tamanho }, (_, j) => <div className="casa vazia" key={j} />)}
                </div>
              );
            })}
          </div>

          {jogo.fim ? (
            <div className="pos-jogo">
              <button type="button" className="botao instagram" onClick={compartilhar}>📸 Compartilhar no Instagram</button>
              <button type="button" className="botao" onClick={() => setResultado(true)}>Ver resultado</button>
            </div>
          ) : (
            <Teclado estados={teclas} aoTeclar={teclar} />
          )}
        </>
      )}

      {resultado && jogo.fim && (
        <Modal titulo={jogo.fim.venceu ? 'Acertou! 🎉' : 'Não foi dessa vez 😵'} aoFechar={() => setResultado(false)}>
          <div className="revelacao">
            <span className="revelacao-palavra">{jogo.resposta?.palavra.toUpperCase()}</span>
            {jogo.resposta?.dica && <p className="revelacao-dica">💡 {jogo.resposta.dica}</p>}
          </div>
          <div className="placar">
            <div className="placar-item destaque"><strong>{jogo.fim.pontos}</strong><span>pontos</span></div>
            <div className="placar-item"><strong>{formatarDuracao(jogo.fim.tempoMs)}</strong><span>tempo</span></div>
            <div className="placar-item"><strong>{jogo.fim.venceu ? jogo.fim.tentativas : 'X'}/{jogo.tentativas}</strong><span>tentativas</span></div>
            <div className="placar-item"><strong>🔥 {sequencia}</strong><span>sequência</span></div>
          </div>

          {jogo.fim.venceu &&
            (jogo.instagram ? (
              <p className="posicao">
                {posicao ? <>Você está em <b>{posicao}º lugar</b> hoje como <b>@{jogo.instagram}</b></> : <>No ranking como <b>@{jogo.instagram}</b></>}
              </p>
            ) : (
              <form
                className="entrar-ranking"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (instagram.trim()) entrarNoRanking(instagram);
                }}
              >
                <label htmlFor="insta">Entre no ranking com seu Instagram</label>
                <div className="campo-insta">
                  <span>@</span>
                  <input
                    id="insta"
                    value={instagram}
                    onChange={(e) => setInstagram(e.target.value.replace(/^@/, ''))}
                    placeholder="seu.perfil"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    maxLength={30}
                  />
                  <button type="submit" className="botao primario">Entrar</button>
                </div>
              </form>
            ))}

          <div className="acoes-resultado">
            <button type="button" className="botao instagram grande" onClick={compartilhar}>📸 Compartilhar no Instagram</button>
            <button type="button" className="botao" onClick={() => { setResultado(false); setPainel('placar'); }}>🏆 Ver ranking</button>
          </div>
          <p className="proxima">Nova palavra em <Contagem /></p>
        </Modal>
      )}

      {painel === 'placar' && <Ranking instagram={jogo.instagram ?? (instagram || null)} aoFechar={() => setPainel(null)} />}

      {painel === 'ajuda' && (
        <Modal titulo="Como jogar" aoFechar={() => setPainel(null)}>
          <p>Todo dia tem uma palavra nova, quase sempre uma <b>gíria, meme ou assunto do momento</b>. Ela pode ter de 4 a 8 letras.</p>
          <p>Você tem <b>6 tentativas</b>. Depois de cada chute, as cores mostram o quanto você chegou perto:</p>
          <div className="exemplo">
            <div className="casa certa">A</div><div className="casa">U</div><div className="casa">R</div><div className="casa">A</div>
          </div>
          <p><b>Verde:</b> a letra está na palavra e no lugar certo.</p>
          <div className="exemplo">
            <div className="casa">V</div><div className="casa lugar">I</div><div className="casa">B</div><div className="casa">E</div>
          </div>
          <p><b>Amarelo:</b> a letra está na palavra, mas em outro lugar.</p>
          <div className="exemplo">
            <div className="casa">M</div><div className="casa">E</div><div className="casa errada">M</div><div className="casa">E</div>
          </div>
          <p><b>Escuro:</b> a letra não está na palavra.</p>
          <h3>💎 Pontuação</h3>
          <p>Acertar vale <b>1000 pontos</b>. Cada tentativa a mais tira 100, e cada segundo tira 1 (até 5 minutos). O cronômetro começa quando você toca em <b>Jogar</b>.</p>
          <h3>🏆 Ranking</h3>
          <p>Acertou? Coloque seu @ do Instagram para entrar no ranking do dia e no geral. Depois é só compartilhar o resultado no seu Story.</p>
        </Modal>
      )}
    </div>
  );
}
