import type { Estado } from '../termo/api';

const LINHAS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

interface Props {
  estados?: Record<string, Estado>;
  aoTeclar: (tecla: string) => void;
  textoEnter?: string;
}

/** Teclado na tela. Envia a letra, 'BACKSPACE' ou 'ENTER'. */
export function Teclado({ estados = {}, aoTeclar, textoEnter = 'ENTER' }: Props) {
  return (
    <div className="teclado" role="group" aria-label="Teclado">
      {LINHAS.map((linha, i) => (
        <div className="teclado-linha" key={linha}>
          {[...linha].map((letra) => (
            <button
              key={letra}
              type="button"
              className={`tecla ${estados[letra] ?? ''}`}
              onClick={() => aoTeclar(letra)}
            >
              {letra}
            </button>
          ))}
          {i === 1 && (
            <button type="button" className="tecla larga" aria-label="Apagar" onClick={() => aoTeclar('BACKSPACE')}>
              ⌫
            </button>
          )}
          {i === 2 && (
            <button type="button" className="tecla larga" onClick={() => aoTeclar('ENTER')}>
              {textoEnter}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
