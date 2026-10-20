import { armazem } from './_lib/armazem';
import { corpo, exigirAdmin, responder } from './_lib/http';
import { adicionarNaFila, editarFila, ErroJogo, painelAdmin, removerDoRanking, trocarPalavraDeHoje } from './_lib/jogo';

// GET /api/admin → fila, histórico e reserva (header x-admin-senha)
export function GET(req: Request) {
  return responder(async () => {
    exigirAdmin(req);
    return painelAdmin(armazem());
  });
}

// POST /api/admin { acao, ... }
export function POST(req: Request) {
  return responder(async () => {
    exigirAdmin(req);
    const b = await corpo(req);
    const a = armazem();
    switch (b.acao) {
      case 'adicionar':
        return { adicionadas: await adicionarNaFila(a, b.itens) };
      case 'remover':
      case 'subir':
      case 'descer':
        await editarFila(a, b.acao, String(b.id));
        return { ok: true };
      case 'trocarHoje':
        await trocarPalavraDeHoje(a, b.palavra, b.dica);
        return { ok: true };
      case 'removerRanking':
        await removerDoRanking(a, String(b.data), b.instagram);
        return { ok: true };
      default:
        throw new ErroJogo('Ação desconhecida');
    }
  });
}
