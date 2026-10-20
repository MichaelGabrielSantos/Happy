import { useCallback, useEffect, useRef, useState } from 'react';

/** Mensagem curta que some sozinha. */
export function useAviso(duracao = 1800) {
  const [aviso, setAviso] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const mostrar = useCallback(
    (texto: string) => {
      clearTimeout(timer.current);
      setAviso(texto);
      if (texto) timer.current = setTimeout(() => setAviso(''), duracao);
    },
    [duracao],
  );
  useEffect(() => () => clearTimeout(timer.current), []);
  return [aviso, mostrar] as const;
}
