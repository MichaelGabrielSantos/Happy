/** Remove acentos e cedilha e coloca em maiúsculas: "Ação" -> "ACAO". */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase();
}
