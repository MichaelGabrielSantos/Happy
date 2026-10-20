import { useEffect, useState } from 'react';
import { Cruzadas } from './cruzadas/Cruzadas';
import { ler, salvar } from './lib/armazenamento';
import { hoje } from './lib/dia';
import { Termo } from './termo/Termo';
import type { Painel } from './tipos';

type Jogo = 'termo' | 'cruzadas';

const jogoDaUrl = (): Jogo => (location.hash === '#cruzadas' ? 'cruzadas' : 'termo');

/** Data de hoje que se atualiza sozinha quando vira o dia com a página aberta. */
function useHoje() {
  const [data, setData] = useState(hoje);
  useEffect(() => {
    const id = setInterval(() => setData(hoje()), 30_000);
    return () => clearInterval(id);
  }, []);
  return data;
}

export function App() {
  const [jogo, setJogo] = useState<Jogo>(jogoDaUrl);
  // na primeira visita já abre o "como jogar"
  const [painel, setPainel] = useState<Painel>(() => {
    if (ler('visitou', false)) return null;
    salvar('visitou', true);
    return 'ajuda';
  });
  const data = useHoje();

  useEffect(() => {
    const aoMudar = () => setJogo(jogoDaUrl());
    window.addEventListener('hashchange', aoMudar);
    return () => window.removeEventListener('hashchange', aoMudar);
  }, []);

  const trocar = (j: Jogo) => {
    location.hash = j;
    setJogo(j);
    setPainel(null);
  };

  return (
    <div className="app">
      <header className="topo">
        <h1 className="logo">
          O <span>TERMO</span>
        </h1>
        <div className="topo-botoes">
          <button type="button" className="icone" aria-label="Como jogar" onClick={() => setPainel('ajuda')}>?</button>
          <button type="button" className="icone" aria-label={jogo === 'termo' ? 'Ranking' : 'Progresso'} onClick={() => setPainel('placar')}>
            {jogo === 'termo' ? '🏆' : '📊'}
          </button>
        </div>
      </header>

      <nav className="abas" role="tablist">
        <button type="button" role="tab" aria-selected={jogo === 'termo'} className={jogo === 'termo' ? 'ativa' : ''} onClick={() => trocar('termo')}>
          🔥 Palavra do dia
        </button>
        <button type="button" role="tab" aria-selected={jogo === 'cruzadas'} className={jogo === 'cruzadas' ? 'ativa' : ''} onClick={() => trocar('cruzadas')}>
          ✏️ Cruzadas
        </button>
      </nav>

      <main>
        {jogo === 'termo' ? (
          <Termo key={data} painel={painel} setPainel={setPainel} />
        ) : (
          <Cruzadas key={data} data={data} painel={painel} setPainel={setPainel} />
        )}
      </main>
    </div>
  );
}
