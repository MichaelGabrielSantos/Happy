import { useEffect, useState } from 'react';
import { formatarDuracao, msAteAmanha } from '../lib/dia';

/** Relógio regressivo até a próxima palavra (meia-noite de Brasília). */
export function Contagem() {
  const [ms, setMs] = useState(msAteAmanha());
  useEffect(() => {
    const id = setInterval(() => setMs(msAteAmanha()), 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="contagem">{formatarDuracao(ms)}</span>;
}
