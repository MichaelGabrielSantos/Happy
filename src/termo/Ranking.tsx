import { useEffect, useState } from 'react';
import { Modal } from '../componentes/Modal';
import { formatarDuracao } from '../lib/dia';
import { api, type ItemRanking, type Ranking as DadosRanking } from './api';

const MEDALHAS = ['🥇', '🥈', '🥉'];

function Linha({ item, destaque, periodo }: { item: ItemRanking; destaque: boolean; periodo: 'dia' | 'geral' }) {
  return (
    <li className={`ranking-linha ${destaque ? 'eu' : ''}`}>
      <span className="ranking-pos">{MEDALHAS[item.posicao - 1] ?? `${item.posicao}º`}</span>
      <a className="ranking-insta" href={`https://instagram.com/${item.instagram}`} target="_blank" rel="noopener noreferrer">
        @{item.instagram}
      </a>
      <span className="ranking-extra">
        {periodo === 'dia'
          ? `${formatarDuracao(item.tempoMs ?? 0)} · ${item.tentativas}/6`
          : `${item.dias} dia${item.dias === 1 ? '' : 's'}`}
      </span>
      <strong className="ranking-pontos">{item.pontos}</strong>
    </li>
  );
}

export function Ranking({ instagram, aoFechar }: { instagram: string | null; aoFechar: () => void }) {
  const [periodo, setPeriodo] = useState<'dia' | 'geral'>('dia');
  const [dados, setDados] = useState<DadosRanking | null>(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    let ativo = true;
    setDados(null);
    setErro('');
    api
      .ranking(periodo, instagram)
      .then((d) => ativo && setDados(d))
      .catch((e: Error) => ativo && setErro(e.message));
    return () => {
      ativo = false;
    };
  }, [periodo, instagram]);

  const meuForaDoTopo = dados?.meu && !dados.itens.some((i) => i.instagram === dados.meu!.instagram);

  return (
    <Modal titulo="🏆 Ranking" aoFechar={aoFechar}>
      <div className="alternar largo" role="tablist">
        <button type="button" role="tab" aria-selected={periodo === 'dia'} className={periodo === 'dia' ? 'ativo' : ''} onClick={() => setPeriodo('dia')}>
          Hoje
        </button>
        <button type="button" role="tab" aria-selected={periodo === 'geral'} className={periodo === 'geral' ? 'ativo' : ''} onClick={() => setPeriodo('geral')}>
          Geral
        </button>
      </div>

      {erro && <p className="vazio">{erro}</p>}
      {!dados && !erro && <p className="vazio">Carregando…</p>}
      {dados && dados.itens.length === 0 && (
        <p className="vazio">
          {periodo === 'dia' ? 'Ninguém entrou no ranking hoje. Seja a primeira pessoa! 🚀' : 'O ranking geral ainda está vazio.'}
        </p>
      )}
      {dados && dados.itens.length > 0 && (
        <>
          <p className="ranking-resumo">
            {periodo === 'dia'
              ? `${dados.vencedores} ${dados.vencedores === 1 ? 'pessoa acertou' : 'pessoas acertaram'} hoje · ${dados.total} no ranking`
              : `Soma dos pontos de todos os dias · ${dados.total} jogadores`}
          </p>
          <ol className="ranking-lista">
            {dados.itens.map((item) => (
              <Linha key={item.instagram} item={item} periodo={periodo} destaque={item.instagram === instagram} />
            ))}
          </ol>
          {meuForaDoTopo && (
            <ol className="ranking-lista separado">
              <Linha item={dados.meu!} periodo={periodo} destaque />
            </ol>
          )}
        </>
      )}
      <p className="nota">Pontos: 1000 por acerto, −100 por tentativa extra e −1 por segundo (até 5 min).</p>
    </Modal>
  );
}
