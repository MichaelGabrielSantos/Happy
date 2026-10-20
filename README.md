# O Termo

A palavra do dia com **gírias, memes e o que está bombando na internet**. Acerte rápido, entre no ranking com seu @ do Instagram e compartilhe o resultado no Story.

- **Palavra do dia**: de 4 a 8 letras, 6 tentativas, cronômetro. Acertar vale 1000 pontos, −100 por tentativa extra e −1 por segundo (até 5 min).
- **Ranking**: do dia e geral (soma dos pontos). Só entra quem acerta.
- **Compartilhar**: gera uma imagem 1080×1920 (formato Story) e abre o menu do celular, onde aparece o Instagram.
- **Admin** (`/admin`): fila de palavras com significado, reordenar, adicionar várias de uma vez, trocar a palavra de hoje (enquanto ninguém jogou) e tirar alguém do ranking.
- **Palavras Cruzadas**: modo extra, local, sem ranking.

## Como a palavra do dia é escolhida

No primeiro acesso do dia (horário de Brasília) o servidor tira a **próxima palavra da fila do admin**. Se a fila estiver vazia, usa a **reserva de memes** (`api/_lib/memes.ts`, ~70 gírias com explicação). A resposta nunca vai para o navegador antes de a partida acabar, e o tempo é medido no servidor.

## Publicando na Vercel

1. Em [vercel.com/new](https://vercel.com/new), importe este repositório.
2. No projeto, vá em **Storage → Marketplace → Upstash (Redis)** e conecte um banco (o plano grátis basta). As variáveis de conexão são criadas sozinhas.
3. Em **Settings → Environment Variables**, crie `ADMIN_SENHA` com a senha do admin.
4. Faça um novo deploy. O jogo fica na raiz e o admin em `/admin`.

Sem o banco conectado a API responde com erro; sem `ADMIN_SENHA` o admin fica bloqueado.

## Rodando no computador

```bash
npm install
npm run dev      # http://localhost:5173 — a API roda junto, com banco em memória
npm test         # testes da lógica (pontuação, fila, ranking, cruzadas)
```

Localmente a senha do admin é `admin`, e o banco em memória zera quando o servidor reinicia.

## Estrutura

| Caminho | O que é |
| --- | --- |
| `api/jogo.ts`, `api/ranking.ts`, `api/admin.ts` | Funções da Vercel |
| `api/_lib/jogo.ts` | Regras: palavra do dia, chutes, pontuação, ranking, fila |
| `api/_lib/armazem.ts` | Redis (Upstash) em produção, memória no desenvolvimento |
| `api/_lib/dicionario.ts` | ~100 mil palavras de 4 a 8 letras aceitas como chute |
| `src/termo/` | Tela do jogo, ranking e imagem do Story |
| `src/admin/`, `admin/index.html` | Página do admin |
| `src/cruzadas/` | Palavras cruzadas |

O dicionário é gerado por `scripts/gerar_palavras.py` a partir do corpus [fserb/pt-br](https://github.com/fserb/pt-br) (MIT, © 2021 Fernando Serboncini).
