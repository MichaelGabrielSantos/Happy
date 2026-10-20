# O Termo

Jogo de palavras em português, direto no navegador, com dois modos:

- **Termo** — adivinhe a palavra de 5 letras do dia em 6 tentativas. Verde = letra certa no lugar certo, amarelo = letra existe em outro lugar, escuro = não existe. A palavra é a mesma para todo mundo e troca à meia-noite (horário de Brasília). Acentos são preenchidos sozinhos.
- **Palavras Cruzadas** — descubra as palavras pelas dicas e preencha a grade. Tem a cruzadinha do dia (igual para todos) e o modo treino, que gera grades novas à vontade.

Progresso, sequência de vitórias e tempos ficam salvos no próprio navegador (`localStorage`); não há servidor.

## Rodando

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # testes da lógica (avaliação de letras, gerador da grade)
npm run build    # gera a versão estática em dist/
```

## Publicando (Vercel)

1. Em [vercel.com/new](https://vercel.com/new), importe este repositório do GitHub.
2. A Vercel detecta o Vite sozinha (as configurações estão em `vercel.json`); é só clicar em **Deploy**.

Depois disso, todo push na `main` publica em produção, e todo outro branch ou PR ganha um link de prévia. O build roda os testes antes: se algum falhar, não publica.

## Como funciona

| Arquivo | O que faz |
| --- | --- |
| `src/termo/logica.ts` | Avaliação das letras (inclusive letras repetidas) e palavra do dia |
| `src/data/respostas.ts` | 1.250 palavras comuns que podem ser a resposta, em ordem embaralhada fixa |
| `src/data/validas.txt` | ~8.800 palavras de 5 letras aceitas como tentativa |
| `src/cruzadas/banco.ts` | Banco de palavras e dicas das cruzadas — **é só acrescentar linhas** |
| `src/cruzadas/gerador.ts` | Monta a grade cruzando as palavras a partir de uma semente (o dia) |

As listas de palavras do Termo são geradas por `scripts/gerar_palavras.py` a partir do corpus [fserb/pt-br](https://github.com/fserb/pt-br) (licença MIT, © 2021 Fernando Serboncini). O script tem uma lista de palavras bloqueadas (nomes próprios, estrangeirismos, palavrões) para manter as respostas limpas.
