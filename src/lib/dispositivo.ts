import { ler, salvar } from './armazenamento';

/** Identificador aleatório deste aparelho: é o que liga a partida e o @ a quem está jogando. */
export function dispositivo(): string {
  let id = ler<string | null>('dispositivo', null);
  if (!id) {
    id = crypto.randomUUID();
    salvar('dispositivo', id);
  }
  return id;
}
