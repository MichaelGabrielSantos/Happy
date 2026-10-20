"""Gera api/_lib/dicionario.ts (palavras de 4 a 8 letras aceitas como chute) a partir do corpus fserb/pt-br (MIT).

Uso:
  curl -O https://raw.githubusercontent.com/fserb/pt-br/master/lexico
  curl -O https://raw.githubusercontent.com/fserb/pt-br/master/icf
  curl -o conjugacoes "https://raw.githubusercontent.com/fserb/pt-br/master/conjuga%C3%A7%C3%B5es"
  python3 scripts/gerar_palavras.py <pasta-com-os-arquivos>
"""
import re
import sys
import unicodedata
from pathlib import Path

PADRAO = re.compile(r"^[a-záàâãéêíóôõúüç]{4,8}$")


def sem_acento(p):
    return "".join(c for c in unicodedata.normalize("NFD", p) if unicodedata.category(c) != "Mn")


def main(pasta):
    pasta = Path(pasta)
    lexico = {l.strip() for l in open(pasta / "lexico", encoding="utf-8") if l.strip()}
    conj = {l.strip() for l in open(pasta / "conjugacoes", encoding="utf-8") if l.strip()}
    icf = {}
    for l in open(pasta / "icf", encoding="utf-8"):
        partes = l.strip().split(",")
        if len(partes) == 2:
            icf[partes[0]] = float(partes[1])

    def plural(p):
        return p.endswith("s") and (p[:-1] in lexico or p[:-2] in lexico)

    # léxico + conjugações + plurais e palavras frequentes do corpus
    validas = {p for p in lexico | conj if PADRAO.match(p)}
    validas |= {p for p, v in icf.items() if PADRAO.match(p) and (v < 11.5 or (v < 14 and plural(p)))}
    # para cada forma sem acento, a grafia mais frequente (é a que aparece na tela)
    grafia = {}
    for p in sorted(validas, key=lambda p: icf.get(p, 99)):
        grafia.setdefault(sem_acento(p), p)

    saida = Path(__file__).resolve().parent.parent / "api" / "_lib" / "dicionario.ts"
    with open(saida, "w", encoding="utf-8") as f:
        f.write("// Gerado por scripts/gerar_palavras.py — não edite à mão.\n")
        f.write("export default '" + " ".join(grafia[k] for k in sorted(grafia)) + "';\n")
    print(len(grafia), "palavras")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else ".")
