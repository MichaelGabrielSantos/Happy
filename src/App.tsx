import { useEffect, useState } from 'react';
import { Cruzadas } from './cruzadas/Cruzadas';
import { ler, salvar } from './lib/armazenamento';
import { hoje } from './lib/dia';
import { Termo, type Painel } from './termo/Termo';

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
        <button type="button" className="icone" aria-label="Como jogar" onClick={() => setPainel('ajuda')}>?</button>
        <h1>O Termo</h1>
        <button type="button" className="icone" aria-label="Estatísticas" onClick={() => setPainel('estatisticas')}>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path fill="currentColor" d="M4 20h4V10H4v10Zm6 0h4V4h-4v16Zm6 0h4v-7h-4v7Z" />
          </svg>
        </button>
      </header>

      <nav className="abas" role="tablist">
        <button type="button" role="tab" aria-selected={jogo === 'termo'} className={jogo === 'termo' ? 'ativa' : ''} onClick={() => trocar('termo')}>
          Termo
        </button>
        <button type="button" role="tab" aria-selected={jogo === 'cruzadas'} className={jogo === 'cruzadas' ? 'ativa' : ''} onClick={() => trocar('cruzadas')}>
          Palavras Cruzadas
        </button>
      </nav>

      <main>
        {jogo === 'termo' ? (
          <Termo key={data} data={data} painel={painel} setPainel={setPainel} />
        ) : (
          <Cruzadas key={data} data={data} painel={painel} setPainel={setPainel} />
        )}
      </main>
    </div>
  );
}
