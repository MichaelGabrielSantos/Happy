/** Compartilha pelo menu do celular ou copia para a área de transferência. Retorna a mensagem para o aviso. */
export async function compartilhar(texto: string): Promise<string> {
  try {
    if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) {
      await navigator.share({ text: texto });
      return '';
    }
    await navigator.clipboard.writeText(texto);
    return 'Resultado copiado!';
  } catch {
    return 'Não foi possível compartilhar';
  }
}
