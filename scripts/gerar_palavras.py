"""Gera src/data/respostas.ts e src/data/validas.txt a partir do corpus fserb/pt-br (MIT).

Uso:
  curl -O https://raw.githubusercontent.com/fserb/pt-br/master/lexico
  curl -O https://raw.githubusercontent.com/fserb/pt-br/master/icf
  curl -o conjugacoes "https://raw.githubusercontent.com/fserb/pt-br/master/conjuga%C3%A7%C3%B5es"
  python3 scripts/gerar_palavras.py <pasta-com-os-arquivos>
"""
import random
import re
import sys
import unicodedata
from pathlib import Path

N_RESPOSTAS = 1250

# Nomes próprios, estrangeirismos, palavrões, contrações e formas verbais/plurais
# que não fazem uma boa "palavra do dia".
BLOQUEADAS = set("""
maria jesus silva bruno goiás ceará japão porno black login braga cunha sousa bento chico
merda césar nunes moura piauí chile porra infra pires celso egito bunda anime laser ultra
abreu júlio diogo joana laura mauro green multi opala queen caput corsa weber adobe angra
henry diana milão bauru amapá guiné hélio luzia nobel ibope judas macau cache cover tesão
seios pênis vadia pornô crack skate light flash mouse drive jeans stand blues short spray
slide modem vasco simão roque marta pinto gozar media facto china índia suíça síria marte
deste desta neste nesta nesse dessa desse nessa disso nisso disto nisto delas daqui aonde
serão estou tinha passa deixa chega torna jogue fique penso tenta custa valeu manda tente
corre volte volto fecha chora chamo corta beija corra ataca trago usado vindo saído sairá
staff volvo lúcio siena jeová cisco corno trans bossa donde blush bosta foder sedan grife
chupa nylon grill veiga rally front paper close lobby remix dante romeu timor dunga swing
tietê cotia elena coach xerox fraga ávila match gávea cairo foste congo hasta anglo mafra
orgia póvoa reiki bangu lobão aedes apolo oxalá viado tecto quota bessa apart túlio araxá
barça caicó betão strip still rouge erica hacer romão derby ferry botox ibero error áries
tatuí buggy rolim gnome novel ítalo antão cusco célio tesla recta cólon povão guaçu train
reich quito xangô óscar piraí input blast judia modus monta pinta anima apaga pisca pondo
cruza torce cante clama brota parta enfia punha sofra dobre anexa choca cuido deita
mamãe papai merda break combo sushi sonda hobby panda pixel piora caçar torço corro risca
morra livra bebes canso logar relax hidro mixer timer tetra jumbo trial porca bicha sêmen
alana clean color logon penny prime round rugby toner curry drink islão guião
crato creta couto souto penha lauro vanda urano vênus tróia mento chica vilar carte
gases fiéis jóias anais ambos recua chuta grita veado
tinha rubro macro retro retrô supra micro extra alter frita frito fosso surra loiça
""".split())

PADRAO = re.compile(r"^[a-záàâãéêíóôõúüç]{5}$")


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

    # Respostas: palavras do léxico, comuns, que não sejam plurais nem bloqueadas.
    candidatas = sorted((p for p in lexico if PADRAO.match(p) and p in icf), key=icf.get)
    respostas, vistas = [], set()
    for p in candidatas:
        chave = sem_acento(p)
        if p in BLOQUEADAS or plural(p) or chave in vistas:
            continue
        vistas.add(chave)
        respostas.append(p)
        if len(respostas) == N_RESPOSTAS:
            break
    # Ordem fixa e embaralhada: a palavra do dia N é respostas[N].
    random.Random(20261020).shuffle(respostas)

    # Válidas: léxico + conjugações + plurais e palavras frequentes do corpus.
    validas = {p for p in lexico | conj if PADRAO.match(p)}
    validas |= {p for p, v in icf.items() if PADRAO.match(p) and (v < 11.5 or (v < 14 and plural(p)))}
    validas |= set(respostas)
    # Para cada forma sem acento, guarda a grafia mais frequente (para exibir).
    grafia = {}
    for p in sorted(validas, key=lambda p: icf.get(p, 99)):
        grafia.setdefault(sem_acento(p), p)

    saida = Path(__file__).resolve().parent.parent / "src" / "data"
    with open(saida / "respostas.ts", "w", encoding="utf-8") as f:
        f.write("// Gerado por scripts/gerar_palavras.py — não edite à mão.\n")
        f.write("export const RESPOSTAS: string[] = `\n")
        for i in range(0, len(respostas), 12):
            f.write(" ".join(respostas[i:i + 12]) + "\n")
        f.write("`.trim().split(/\\s+/);\n")
    with open(saida / "validas.txt", "w", encoding="utf-8") as f:
        f.write(" ".join(grafia[k] for k in sorted(grafia)))
    print(len(respostas), "respostas,", len(grafia), "válidas")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else ".")
