import { useEffect, type ReactNode } from 'react';

interface Props {
  titulo: string;
  aoFechar: () => void;
  children: ReactNode;
}

export function Modal({ titulo, aoFechar, children }: Props) {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar();
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [aoFechar]);

  return (
    <div className="modal-fundo" onClick={aoFechar}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={titulo} onClick={(e) => e.stopPropagation()}>
        <div className="modal-cabeca">
          <h2>{titulo}</h2>
          <button type="button" className="modal-fechar" aria-label="Fechar" onClick={aoFechar}>
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
