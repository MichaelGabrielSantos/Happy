import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Em desenvolvimento, serve as funções de /api (as mesmas que rodam na Vercel)
 * dentro do próprio Vite, com o banco em memória. Assim `npm run dev` já tem tudo.
 */
function apiLocal(): Plugin {
  return {
    name: 'api-local',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        if (!url.pathname.startsWith('/api/')) return next();
        try {
          const modulo = await server.ssrLoadModule(`/api/${url.pathname.slice(5)}.ts`);
          const handler = modulo[req.method ?? 'GET'];
          if (!handler) {
            res.statusCode = 405;
            return res.end();
          }
          const partes: Buffer[] = [];
          for await (const p of req) partes.push(p as Buffer);
          const headers = new Headers();
          for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
          const resposta: Response = await handler(
            new Request(url, { method: req.method, headers, body: partes.length ? Buffer.concat(partes) : undefined }),
          );
          res.statusCode = resposta.status;
          resposta.headers.forEach((v, k) => res.setHeader(k, v));
          res.end(Buffer.from(await resposta.arrayBuffer()));
        } catch (e) {
          next(e);
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), apiLocal()],
  build: {
    rollupOptions: {
      input: {
        jogo: resolve(import.meta.dirname, 'index.html'),
        admin: resolve(import.meta.dirname, 'admin/index.html'),
      },
    },
  },
});
