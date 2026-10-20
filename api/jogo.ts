import { armazem } from './_lib/armazem';
import { corpo, responder } from './_lib/http';
import { chutar, estadoDoJogo, iniciar } from './_lib/jogo';

// GET /api/jogo?dispositivo=...  → estado da partida de hoje
export function GET(req: Request) {
  return responder(() => estadoDoJogo(armazem(), new URL(req.url).searchParams.get('dispositivo')));
}

// POST /api/jogo { dispositivo, acao: 'iniciar' } ou { dispositivo, acao: 'chutar', chute }
export function POST(req: Request) {
  return responder(async () => {
    const b = await corpo(req);
    return b.acao === 'chutar' ? chutar(armazem(), b.dispositivo, b.chute) : iniciar(armazem(), b.dispositivo);
  });
}
