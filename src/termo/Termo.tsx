import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Contagem } from '../componentes/Contagem';
import { Modal } from '../componentes/Modal';
import { Teclado } from '../componentes/Teclado';
import { ler, salvar } from '../lib/armazenamento';
import { compartilhar } from '../lib/compartilhar';
import { numeroDoDia } from '../lib/dia';
import { normalizar } from '../lib/texto';
import { useAviso } from '../lib/useAviso';
import { TAMANHO, TENTATIVAS, avaliar, estadoDasTeclas, grafia, respostaDoDia } from './logica';

export type Painel = 'ajuda' | 'estatisticas' | null;

interface Partida {
  data: string;
  chutes: string[];
}

interface Estatisticas {
  jogos: number;
  vitorias: number;
  sequencia: number;
  melhorSequencia: number;
  /** distribuicao[i] = vitórias na tentativa i+1 */
  distribuicao: number[];
  ultimaData: string | null;
  ultimaVitoria: string | null;
}

const CHAVE_PARTIDA = 'termo:partida';
const CHAVE_ESTATISTICAS = 'termo:estatisticas';
const ELOGIOS = ['Genial!', 'Magnífico!', 'Impressionante!', 'Excelente!', 'Muito bem!', 'Ufa!'];
const DURACAO_VIRADA = 250; // ms entre cada letra revelada

const estatisticasVazias = (): Estatisticas => ({
  jogos: 0,
  vitorias: 0,
  sequencia: 0,
  melhorSequencia: 0,
  distribuicao: Array(TENTATIVAS).fill(0),
  ultimaData: null,
  ultimaVitoria: null,
});

function diaAnterior(data: string): string {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

interface Props {
  data: string;
  painel: Painel;
  setPainel: (p: Painel) => void;
}

export function Termo({ data, painel, setPainel }: Props) {
  const numero = numeroDoDia(data);
  const respostaOriginal = respostaDoDia(numero);
  const resposta = normalizar(respostaOriginal);

  const [chutes, setChutes] = useState<string[]>(() => {
    const salva = ler<Partida | null>(CHAVE_PARTIDA, null);
    return salva?.data === data ? salva.chutes : [];
  });
  const [linha, setLinha] = useState<string[]>(Array(TAMANHO).fill(''));
  const [cursor, setCursor] = useState(0);
  const [tremendo, setTremendo] = useState(false);
  const [revelando, setRevelando] = useState<number | null>(null);
  const [estatisticas, setEstatisticas] = useState(() => ler(CHAVE_ESTATISTICAS, estatisticasVazias()));
  const [aviso, mostrarAviso] = useAviso();
  const animando = useRef(false);

  const ganhou = chutes.includes(resposta);
  const acabou = ganhou || chutes.length >= TENTATIVAS;

  useEffect(() => salvar(CHAVE_PARTIDA, { data, chutes } satisfies Partida), [data, chutes]);

  // O teclado só ganha as cores novas depois que a linha termina de virar.
  const chutesVisiveis = revelando === null ? chutes : chutes.slice(0, revelando);
  const teclas = useMemo(() => estadoDasTeclas(chutesVisiveis, resposta), [chutesVisiveis, resposta]);

  const registrarFim = useCallback(
    (venceu: boolean, tentativas: number) => {
      setEstatisticas((anterior) => {
        if (anterior.ultimaData === data) return anterior;
        const e = { ...anterior, distribuicao: [...anterior.distribuicao] };
        e.jogos++;
        e.ultimaData = data;
        if (venceu) {
          e.vitorias++;
          e.distribuicao[tentativas - 1]++;
          e.sequencia = e.ultimaVitoria === diaAnterior(data) ? e.sequencia + 1 : 1;
          e.melhorSequencia = Math.max(e.melhorSequencia, e.sequencia);
          e.ultimaVitoria = data;
        } else {
          e.sequencia = 0;
        }
        salvar(CHAVE_ESTATISTICAS, e);
        return e;
      });
    },
    [data],
  );

  const enviar = useCallback(() => {
    if (linha.some((l) => !l)) {
      mostrarAviso('Só palavras com 5 letras');
      setTremendo(true);
      return;
    }
    const chute = linha.join('');
    if (!grafia(chute)) {
      mostrarAviso('Essa palavra não é aceita');
      setTremendo(true);
      return;
    }
    const novos = [...chutes, chute];
    animando.current = true;
    setRevelando(chutes.length);
    setChutes(novos);
    setLinha(Array(TAMANHO).fill(''));
    setCursor(0);
    setTimeout(() => {
      animando.current = false;
      setRevelando(null);
      if (chute === resposta) {
        mostrarAviso(ELOGIOS[novos.length - 1]);
        registrarFim(true, novos.length);
        setTimeout(() => setPainel('estatisticas'), 1600);
      } else if (novos.length >= TENTATIVAS) {
        mostrarAviso(`A palavra era ${respostaOriginal.toUpperCase()}`);
        registrarFim(false, novos.length);
        setTimeout(() => setPainel('estatisticas'), 2200);
      }
    }, DURACAO_VIRADA * TAMANHO + 300);
  }, [linha, chutes, resposta, respostaOriginal, mostrarAviso, registrarFim, setPainel]);

  const teclar = useCallback(
    (tecla: string) => {
      if (acabou || animando.current) return;
      if (tecla === 'ENTER') return enviar();
      if (tecla === 'BACKSPACE') {
        const alvo = linha[cursor] ? cursor : Math.max(0, cursor - 1);
        setLinha((l) => l.map((x, i) => (i === alvo ? '' : x)));
        setCursor(alvo);
        return;
      }
      if (tecla === 'ARROWLEFT') return setCursor((c) => Math.max(0, c - 1));
      if (tecla === 'ARROWRIGHT') return setCursor((c) => Math.min(TAMANHO - 1, c + 1));
      if (/^[A-Z]$/.test(tecla)) {
        setLinha((l) => l.map((x, i) => (i === cursor ? tecla : x)));
        // avança para a próxima casa vazia à direita (ou só uma casa, se não houver)
        const proxima = linha.findIndex((x, i) => i > cursor && !x);
        setCursor(proxima === -1 ? Math.min(TAMANHO - 1, cursor + 1) : proxima);
      }
    },
    [acabou, enviar, linha, cursor],
  );

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || painel) return;
      const tecla = e.key === 'Enter' || e.key === 'Backspace' || e.key.startsWith('Arrow') ? e.key.toUpperCase() : normalizar(e.key);
      if (/^([A-Z]|ENTER|BACKSPACE|ARROWLEFT|ARROWRIGHT)$/.test(tecla)) {
        e.preventDefault();
        teclar(tecla);
      }
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [teclar, painel]);

  const textoCompartilhar = () => {
    const emojis = { certa: '🟩', lugar: '🟨', errada: '⬛' };
    const grade = chutes.map((c) => avaliar(c, resposta).map((e) => emojis[e]).join('')).join('\n');
    return `O Termo #${numero + 1} ${ganhou ? chutes.length : 'X'}/${TENTATIVAS}\n\n${grade}`;
  };

  return (
    <div className="termo">
      {aviso && <div className="aviso" role="status">{aviso}</div>}

      <div className="tabuleiro" aria-label="Tabuleiro">
        {Array.from({ length: TENTATIVAS }, (_, i) => {
          if (i < chutes.length) {
            const estados = avaliar(chutes[i], resposta);
            const exibida = (grafia(chutes[i]) ?? chutes[i]).toUpperCase();
            const venceuAqui = chutes[i] === resposta && revelando === null;
            return (
              <div className={`fileira ${venceuAqui ? 'vitoria' : ''}`} key={i}>
                {[...exibida].map((letra, j) => (
                  <div
                    key={j}
                    className={`casa ${estados[j]} ${revelando === i ? 'virando' : ''}`}
                    style={{ animationDelay: `${(revelando === i ? DURACAO_VIRADA : 100) * j}ms` }}
                  >
                    {letra}
                  </div>
                ))}
              </div>
            );
          }
          if (i === chutes.length && !acabou) {
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
              {Array.from({ length: TAMANHO }, (_, j) => (
                <div className="casa vazia" key={j} />
              ))}
            </div>
          );
        })}
      </div>

      <Teclado estados={teclas} aoTeclar={teclar} />

      {painel === 'ajuda' && (
        <Modal titulo="Como jogar o Termo" aoFechar={() => setPainel(null)}>
          <p>Descubra a palavra do dia em <b>6 tentativas</b>. Todo mundo recebe a mesma palavra, e ela muda à meia-noite.</p>
          <p>Cada tentativa precisa ser uma palavra válida de 5 letras. Depois de cada chute, as letras mudam de cor:</p>
          <div className="exemplo">
            <div className="casa certa">T</div><div className="casa">U</div><div className="casa">R</div><div className="casa">M</div><div className="casa">A</div>
          </div>
          <p><b>T</b> está na palavra e na posição certa.</p>
          <div className="exemplo">
            <div className="casa">V</div><div className="casa">I</div><div className="casa lugar">O</div><div className="casa">L</div><div className="casa">A</div>
          </div>
          <p><b>O</b> faz parte da palavra, mas em outra posição.</p>
          <div className="exemplo">
            <div className="casa">P</div><div className="casa">U</div><div className="casa">L</div><div className="casa errada">G</div><div className="casa">A</div>
          </div>
          <p><b>G</b> não faz parte da palavra.</p>
          <p>Acentos e cedilha são preenchidos sozinhos e não contam como dica. Letras podem se repetir.</p>
          <p>Toque numa casa da linha atual para editar uma letra específica.</p>
        </Modal>
      )}

      {painel === 'estatisticas' && (
        <Modal titulo="Progresso" aoFechar={() => setPainel(null)}>
          {acabou && (
            <p className="resposta-final">
              Palavra do dia: <b>{respostaOriginal.toUpperCase()}</b>
            </p>
          )}
          <div className="numeros">
            <div><strong>{estatisticas.jogos}</strong><span>jogos</span></div>
            <div><strong>{estatisticas.jogos ? Math.round((estatisticas.vitorias / estatisticas.jogos) * 100) : 0}%</strong><span>vitórias</span></div>
            <div><strong>{estatisticas.sequencia}</strong><span>sequência</span></div>
            <div><strong>{estatisticas.melhorSequencia}</strong><span>melhor seq.</span></div>
          </div>
          <h3>Distribuição de tentativas</h3>
          <div className="distribuicao">
            {estatisticas.distribuicao.map((n, i) => {
              const maior = Math.max(1, ...estatisticas.distribuicao);
              const destaque = ganhou && chutes.length === i + 1;
              return (
                <div className="barra-linha" key={i}>
                  <span>{i + 1}</span>
                  <div className={`barra ${destaque ? 'destaque' : ''}`} style={{ width: `${Math.max(8, (n / maior) * 100)}%` }}>
                    {n}
                  </div>
                </div>
              );
            })}
          </div>
          {acabou && (
            <div className="rodape-modal">
              <div>
                <small>próxima palavra em</small>
                <Contagem />
              </div>
              <button
                type="button"
                className="botao primario"
                onClick={async () => mostrarAviso(await compartilhar(textoCompartilhar()))}
              >
                Compartilhar
              </button>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
