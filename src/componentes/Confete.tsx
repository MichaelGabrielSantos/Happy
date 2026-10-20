import { useEffect, useRef } from 'react';

const CORES = ['#22c55e', '#f5b70b', '#ff3d81', '#7c5cff', '#38bdf8', '#ffffff'];

/** Chuva de confete por alguns segundos (respeita "reduzir movimento"). */
export function Confete() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    const escala = devicePixelRatio || 1;
    canvas.width = innerWidth * escala;
    canvas.height = innerHeight * escala;
    ctx.scale(escala, escala);
    const pecas = Array.from({ length: 140 }, () => ({
      x: innerWidth / 2 + (Math.random() - 0.5) * 80,
      y: innerHeight * 0.35,
      vx: (Math.random() - 0.5) * 14,
      vy: -Math.random() * 14 - 4,
      giro: Math.random() * Math.PI,
      vgiro: (Math.random() - 0.5) * 0.3,
      tam: 6 + Math.random() * 6,
      cor: CORES[Math.floor(Math.random() * CORES.length)],
    }));
    const inicio = performance.now();
    let quadro = 0;
    const desenhar = (t: number) => {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      for (const p of pecas) {
        p.vy += 0.35;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.giro += p.vgiro;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.giro);
        ctx.fillStyle = p.cor;
        ctx.fillRect(-p.tam / 2, -p.tam / 4, p.tam, p.tam / 2);
        ctx.restore();
      }
      if (t - inicio < 3500) quadro = requestAnimationFrame(desenhar);
      else ctx.clearRect(0, 0, innerWidth, innerHeight);
    };
    quadro = requestAnimationFrame(desenhar);
    return () => cancelAnimationFrame(quadro);
  }, []);

  return <canvas ref={ref} className="confete" aria-hidden="true" />;
}
