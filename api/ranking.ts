import { armazem } from './_lib/armazem';
import { corpo, ipDe, responder } from './_lib/http';
import { entrarNoRanking, ranking } from './_lib/jogo';

// GET /api/ranking?periodo=dia|geral&instagram=...&data=AAAA-MM-DD
export function GET(req: Request) {
  return responder(() => {
    const p = new URL(req.url).searchParams;
    const data = p.get('data');
    return ranking(
      armazem(),
      p.get('periodo') === 'geral' ? 'geral' : 'dia',
      p.get('instagram') ?? undefined,
      data && /^\d{4}-\d{2}-\d{2}$/.test(data) ? data : undefined,
    );
  });
}

// POST /api/ranking { dispositivo, instagram }
export function POST(req: Request) {
  return responder(async () => {
    const b = await corpo(req);
    return entrarNoRanking(armazem(), b.dispositivo, b.instagram, ipDe(req));
  });
}
