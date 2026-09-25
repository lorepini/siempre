#!/usr/bin/env python3
"""
Construye el mosaico: convierte cada letra de SIEMPRE en una rejilla de teselas
y reparte las fotografías de su etapa entre ellas.

La tipografía (Arial Black) se usa SÓLO aquí, para calcular el molde. No se
distribuye con la web: lo que viaja al navegador son las coordenadas ya calculadas.

Reglas que respeta:
  - Cada letra usa únicamente fotos de su etapa.
  - No hace falta usar todas las fotos: las demás siguen en el álbum interior.
  - Las favoritas entran siempre.
  - Las copias de una misma foto quedan lo más separadas posible.
  - El resultado es estable: misma semilla, mismo reparto en cada recarga.
"""
import json, os, random
from PIL import Image, ImageDraw, ImageFont

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAP = 1000                 # altura de mayúscula en unidades del lienzo
RENDER = 1400              # resolución de trabajo del molde
UMBRAL_TINTA = 0.5         # cuánta letra debe cubrir una celda para conservarla

FUENTES = ["/mnt/c/Windows/Fonts/ariblk.ttf",
           "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"]


def carga_fuente(tam):
    for f in FUENTES:
        if os.path.exists(f):
            return ImageFont.truetype(f, tam), os.path.basename(f)
    raise SystemExit("No encuentro ninguna tipografía gruesa para el molde.")


def molde_letra(letra, fuente, celda_px):
    """Devuelve (cols, filas, [(col,fila)…]) de las celdas que caen dentro de la letra."""
    bb = fuente.getbbox(letra)
    w, h = bb[2] - bb[0], bb[3] - bb[1]
    g = Image.new("L", (w + 2, h + 2), 0)
    ImageDraw.Draw(g).text((-bb[0] + 1, -bb[1] + 1), letra, font=fuente, fill=255)
    cols = max(1, round(g.width / celda_px))
    filas = max(1, round(g.height / celda_px))
    cw, ch = g.width / cols, g.height / filas
    celdas = []
    for r in range(filas):
        for c in range(cols):
            reg = g.crop((round(c * cw), round(r * ch), round((c + 1) * cw), round((r + 1) * ch)))
            hist = reg.histogram()
            tinta = sum(hist[128:]) / max(1, reg.width * reg.height)
            if tinta >= UMBRAL_TINTA:
                celdas.append((c, r))
    return cols, filas, celdas


def reparte(fotos, favoritas, n_teselas, rnd):
    """Devuelve una lista de n_teselas identificadores de foto."""
    if not fotos:
        return []
    # Orden base por tono: crea armonía de color sin perder variedad.
    por_tono = sorted(fotos, key=lambda f: (f["tono"], f["lum"]))
    ids = [f["id"] for f in por_tono]
    favs = [i for i in ids if i in set(favoritas)]

    if n_teselas <= len(ids):
        # Sobran fotos: favoritas primero y el resto repartido uniformemente
        # a lo largo del orden de tono, para no coger sólo un extremo de la paleta.
        elegidas = list(favs)
        resto = [i for i in ids if i not in set(elegidas)]
        faltan = n_teselas - len(elegidas)
        if faltan > 0 and resto:
            paso = len(resto) / faltan
            elegidas += [resto[min(len(resto) - 1, int(k * paso))] for k in range(faltan)]
        seq = elegidas[:n_teselas]
        # vuelve a ordenarlas por tono para que el barrido de color sea suave
        pos = {i: k for k, i in enumerate(ids)}
        seq.sort(key=lambda i: pos[i])
        return seq

    # Faltan fotos: se repiten en turno rotatorio, así dos copias de la misma
    # quedan separadas por una vuelta entera de la lista.
    orden = list(ids)
    rnd.shuffle(orden)
    for f in reversed(favs):          # las favoritas al principio de la rueda
        orden.remove(f); orden.insert(0, f)
    return [orden[k % len(orden)] for k in range(n_teselas)]


def main():
    cfg = json.load(open(os.path.join(RAIZ, "contenido", "etapas.json"), encoding="utf-8"))
    datos = json.load(open(os.path.join(RAIZ, "datos", "fotos.json"), encoding="utf-8"))
    mos = cfg["mosaico"]
    objetivo = mos["teselasObjetivo"]
    hueco = mos["huecoEntreTeselas"]

    fuente, nombre_fuente = carga_fuente(RENDER)
    cap_px = fuente.getbbox("E")[3] - fuente.getbbox("E")[1]
    escala = CAP / cap_px

    # Celda calibrada para que la letra media ronde 'teselasObjetivo'.
    frac = 0.085 * (100 / objetivo) ** 0.5
    celda_px = cap_px * frac
    celda = celda_px * escala

    letras = []
    for etapa in cfg["etapas"]:
        cols, filas, celdas = molde_letra(etapa["letra"], fuente, celda_px)
        fotos = [f for f in datos["etapas"].get(etapa["id"], [])
                 if f["id"] not in set(etapa.get("excluirDelMosaico", []))]
        rnd = random.Random(f"{mos['semilla']}-{etapa['id']}")
        seq = reparte(fotos, etapa.get("favoritas", []), len(celdas), rnd)

        teselas = []
        for (c, r), fid in zip(celdas, seq):
            teselas.append({"x": round(c * celda, 2), "y": round(r * celda, 2), "f": fid})
        letras.append({
            "id": etapa["id"], "orden": etapa["orden"], "letra": etapa["letra"],
            "cols": cols, "filas": filas,
            "ancho": round(cols * celda, 2), "alto": round(filas * celda, 2),
            "teselas": teselas,
        })
        print(f"  {etapa['id']} {etapa['letra']}: rejilla {cols}x{filas}, "
              f"{len(celdas)} teselas, {len(set(seq))} fotos distintas "
              f"de {len(fotos)} disponibles")

    salida = {
        "capHeight": CAP,
        "celda": round(celda, 2),
        "hueco": round(celda * hueco, 2),
        "separacionLetras": round(CAP * mos["separacionLetras"], 2),
        "fuenteMolde": nombre_fuente,
        "letras": letras,
    }
    json.dump(salida, open(os.path.join(RAIZ, "datos", "mosaico.json"), "w", encoding="utf-8"),
              ensure_ascii=False, separators=(",", ":"))
    total = sum(len(l["teselas"]) for l in letras)
    print(f"Total {total} teselas, media {total/7:.0f} por letra -> datos/mosaico.json")
    dibuja_prueba(salida)


def dibuja_prueba(s):
    """PNG de control para comprobar que SIEMPRE se lee bien."""
    esc = 0.28
    sep = s["separacionLetras"]
    W = sum(l["ancho"] for l in s["letras"]) + sep * (len(s["letras"]) - 1)
    H = max(l["alto"] for l in s["letras"])
    img = Image.new("RGB", (round(W * esc) + 41, round(H * esc) + 41), (247, 241, 232))
    d = ImageDraw.Draw(img)
    x = 20
    for l in s["letras"]:
        for t in l["teselas"]:
            x0 = 20 + (x - 20 + t["x"]) * esc
            y0 = 20 + t["y"] * esc
            lado = s["celda"] * esc - 1
            d.rectangle([x0, y0, x0 + lado, y0 + lado], fill=(122, 34, 51))
        x += l["ancho"] + sep
    img.save(os.path.join(RAIZ, "datos", "prueba-mosaico.png"))
    print("Vista de control -> datos/prueba-mosaico.png")


if __name__ == "__main__":
    main()
