import { formatarDuracao } from '../lib/dia';
import type { Estado } from './api';

interface DadosStory {
  numero: number;
  estados: Estado[][];
  tentativasMax: number;
  venceu: boolean;
  pontos: number;
  tempoMs: number;
  posicao: number | null;
  instagram: string | null;
  site: string;
}

const CORES: Record<Estado, string> = { certa: '#22c55e', lugar: '#f5b70b', errada: '#3b3357' };

function retangulo(ctx: CanvasRenderingContext2D, x: number, y: number, l: number, a: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, l, a, r);
  ctx.fill();
}

/** Gera a imagem 1080×1920 (formato de Story) com o resultado — sem mostrar as letras. */
export async function gerarStory(d: DadosStory): Promise<Blob> {
  await document.fonts?.ready;
  const L = 1080;
  const A = 1920;
  const canvas = document.createElement('canvas');
  canvas.width = L;
  canvas.height = A;
  const ctx = canvas.getContext('2d')!;
  const fonte = (peso: number, px: number) => `${peso} ${px}px Fredoka, system-ui, sans-serif`;

  const fundo = ctx.createLinearGradient(0, 0, L, A);
  fundo.addColorStop(0, '#2a145c');
  fundo.addColorStop(0.55, '#140b2e');
  fundo.addColorStop(1, '#3b0f3f');
  ctx.fillStyle = fundo;
  ctx.fillRect(0, 0, L, A);

  // brilhos de fundo
  for (const [x, y, r, cor] of [[160, 260, 380, '#7c5cff33'], [940, 1500, 460, '#ff3d8133']] as const) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, cor);
    g.addColorStop(1, '#00000000');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, L, A);
  }

  // o Instagram cobre ~250px no topo (perfil) e embaixo (responder): o conteúdo fica entre eles
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = fonte(700, 110);
  ctx.fillText('O TERMO', L / 2, 330);
  ctx.fillStyle = '#b9aee0';
  ctx.font = fonte(500, 46);
  ctx.fillText(`Palavra do dia #${d.numero}`, L / 2, 400);

  // grade de quadradinhos (sem as letras, para não dar spoiler)
  const colunas = d.estados[0]?.length ?? 5;
  const espaco = 14;
  const lado = Math.min(80, Math.floor((640 - (colunas - 1) * espaco) / colunas));
  const largura = colunas * lado + (colunas - 1) * espaco;
  const x0 = (L - largura) / 2;
  const y0 = 450;
  for (let l = 0; l < d.tentativasMax; l++) {
    for (let c = 0; c < colunas; c++) {
      const estado = d.estados[l]?.[c];
      ctx.fillStyle = estado ? CORES[estado] : '#ffffff14';
      retangulo(ctx, x0 + c * (lado + espaco), y0 + l * (lado + espaco), lado, lado, 16);
    }
  }
  let y = y0 + d.tentativasMax * (lado + espaco) + 120;

  ctx.fillStyle = '#ffffff';
  ctx.font = fonte(700, 130);
  ctx.fillText(d.venceu ? `${d.pontos}` : 'X', L / 2, y);
  y += 60;
  ctx.font = fonte(600, 46);
  ctx.fillStyle = '#ff7ab0';
  ctx.fillText(d.venceu ? 'PONTOS' : 'não foi dessa vez', L / 2, y);

  y += 90;
  ctx.font = fonte(500, 50);
  ctx.fillStyle = '#ffffff';
  const tentativas = d.venceu ? `${d.estados.length}/${d.tentativasMax}` : `X/${d.tentativasMax}`;
  ctx.fillText(`⏱ ${formatarDuracao(d.tempoMs)}   ·   🎯 ${tentativas}`, L / 2, y);

  if (d.posicao) {
    y += 40;
    ctx.fillStyle = '#f5b70b';
    retangulo(ctx, L / 2 - 320, y, 640, 96, 48);
    ctx.fillStyle = '#140b2e';
    ctx.font = fonte(700, 50);
    ctx.fillText(`🏆 ${d.posicao}º no ranking de hoje`, L / 2, y + 64);
    y += 96;
  }
  if (d.instagram) {
    y += 80;
    ctx.fillStyle = '#ffffff';
    ctx.font = fonte(600, 50);
    ctx.fillText(`@${d.instagram}`, L / 2, y);
  }

  ctx.fillStyle = '#b9aee0';
  ctx.font = fonte(500, 42);
  ctx.fillText('Consegue fazer melhor?', L / 2, A - 330);
  ctx.fillStyle = '#ffffff';
  ctx.font = fonte(700, 48);
  ctx.fillText(d.site, L / 2, A - 270);

  return new Promise((ok, erro) => canvas.toBlob((b) => (b ? ok(b) : erro(new Error('Falha ao gerar imagem'))), 'image/png'));
}

/**
 * Abre o menu de compartilhar do celular com a imagem (o Instagram aparece lá → Story).
 * Sem suporte a arquivos (computador), baixa a imagem. Retorna o aviso para mostrar.
 */
export async function compartilharImagem(imagem: Blob, texto: string): Promise<string> {
  const arquivo = new File([imagem], 'o-termo.png', { type: 'image/png' });
  if (navigator.canShare?.({ files: [arquivo] })) {
    try {
      await navigator.share({ files: [arquivo], text: texto });
      return '';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return '';
    }
  }
  const link = document.createElement('a');
  link.href = URL.createObjectURL(imagem);
  link.download = 'o-termo.png';
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 5000);
  return 'Imagem salva! Poste no seu Story 📸';
}
