#!/usr/bin/env python3
"""
Prepara las fotografías para la web SIEMPRE.

NO TOCA NI BORRA NINGÚN ORIGINAL. Lee de PHOTOS/ y escribe copias derivadas
en medios/. Los duplicados exactos se detectan por hash y simplemente no se
copian; el archivo original sigue donde estaba.

Genera tres niveles por foto:
  micro/   cuadrada 112px  -> teselas vistas de lejos (la palabra entera)
  mini/    cuadrada 400px  -> teselas vistas de cerca (única versión recortada)
  medio/   1600px lado largo, proporción intacta -> galería del álbum
  grande/  resolución original, calidad 95, proporción intacta -> visor

Elimina TODOS los metadatos (incluidas coordenadas GPS) de las copias.
"""
import json, os, sys, hashlib
from concurrent.futures import ProcessPoolExecutor
from PIL import Image, ImageOps

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from jpeg_limpio import copia_limpia

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MEDIOS = os.path.join(RAIZ, "medios")
DATOS = os.path.join(RAIZ, "datos")

MICRO, MINI, MEDIO = 112, 400, 1400
Q_MICRO, Q_MINI, Q_MEDIO, Q_GRANDE = 72, 82, 84, 95

# Punto focal por defecto para el recorte cuadrado del mosaico.
# Heurística, no detección de caras: en vertical las caras suelen caer arriba.
FOCO_VERTICAL = (0.50, 0.36)
FOCO_HORIZONTAL = (0.50, 0.45)


def recorte_cuadrado(im, foco):
    w, h = im.size
    lado = min(w, h)
    fx, fy = foco
    x = max(0, min(w - lado, int(w * fx - lado / 2)))
    y = max(0, min(h - lado, int(h * fy - lado / 2)))
    return im.crop((x, y, x + lado, y + lado))


# Nota: Pillow sólo escribe EXIF si se le pasa exif=... explícitamente.
# Al guardar sin ese argumento, las copias salen ya sin metadatos ni GPS.


def color_dominante(im):
    p = im.convert("RGB").resize((16, 16), Image.Resampling.BILINEAR)
    px = list(p.getdata())
    n = len(px)
    r = sum(c[0] for c in px) // n
    g = sum(c[1] for c in px) // n
    b = sum(c[2] for c in px) // n
    lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
    mx, mn = max(r, g, b), min(r, g, b)
    sat = 0 if mx == 0 else (mx - mn) / mx
    # tono aproximado en grados
    if mx == mn:
        tono = 0
    elif mx == r:
        tono = (60 * ((g - b) / (mx - mn)) + 360) % 360
    elif mx == g:
        tono = 60 * ((b - r) / (mx - mn)) + 120
    else:
        tono = 60 * ((r - g) / (mx - mn)) + 240
    return f"#{r:02x}{g:02x}{b:02x}", round(lum, 3), round(sat, 3), round(tono)


def fecha_exif(im):
    try:
        ex = im.getexif()
        for clave in (36867, 36868, 306):
            v = ex.get(clave)
            if v and isinstance(v, str) and len(v) >= 10:
                d = v[:10].replace(":", "-")
                if d[:4].isdigit() and 1990 < int(d[:4]) < 2100:
                    return d
    except Exception:
        pass
    return None


def procesa(tarea):
    etapa_id, idx, ruta = tarea
    nombre = f"{etapa_id}-{idx:04d}"
    try:
        im = Image.open(ruta)
        fmt = im.format
        rotacion = im.getexif().get(274, 1)
        fecha = fecha_exif(im)
        im = ImageOps.exif_transpose(im)
        if im.mode not in ("RGB", "L"):
            im = im.convert("RGB")
        w, h = im.size
        foco = FOCO_VERTICAL if h > w else FOCO_HORIZONTAL

        for carpeta in ("micro", "mini", "medio", "grande"):
            os.makedirs(os.path.join(MEDIOS, etapa_id, carpeta), exist_ok=True)

        cuad = recorte_cuadrado(im, foco).resize((MINI, MINI), Image.Resampling.LANCZOS)
        cuad.save(os.path.join(MEDIOS, etapa_id, "mini", nombre + ".jpg"),
                  "JPEG", quality=Q_MINI, optimize=True)
        cuad.resize((MICRO, MICRO), Image.Resampling.LANCZOS).save(
            os.path.join(MEDIOS, etapa_id, "micro", nombre + ".jpg"),
            "JPEG", quality=Q_MICRO, optimize=True)

        # El nivel intermedio sólo tiene sentido si la foto es mayor que él.
        tiene_medio = max(w, h) > MEDIO * 1.08
        if tiene_medio:
            med = im.copy()
            med.thumbnail((MEDIO, MEDIO), Image.Resampling.LANCZOS)
            med.save(os.path.join(MEDIOS, etapa_id, "medio", nombre + ".jpg"),
                     "JPEG", quality=Q_MEDIO, optimize=True)

        # Máxima calidad: si el original es JPEG y no necesita rotación, se copian
        # sus bytes tal cual quitando sólo los metadatos. Cero pérdida añadida.
        destino_grande = os.path.join(MEDIOS, etapa_id, "grande", nombre + ".jpg")
        # copia_limpia devuelve False si el archivo no es un JPEG/MPO válido.
        sin_perdida = False
        if rotacion in (0, 1):
            sin_perdida = copia_limpia(ruta, destino_grande)
        if not sin_perdida:
            im.save(destino_grande, "JPEG", quality=Q_GRANDE, optimize=True, subsampling=0)

        hexc, lum, sat, tono = color_dominante(im)
        return {"id": nombre, "w": w, "h": h, "color": hexc, "lum": lum,
                "sat": sat, "tono": tono, "fecha": fecha,
                "medio": 1 if tiene_medio else 0, "exacta": 1 if sin_perdida else 0,
                "orientacion": "v" if h > w else ("h" if w > h else "c"),
                "origen": os.path.basename(ruta)}
    except Exception as e:
        print(f"  !! fallo con {ruta}: {e}", file=sys.stderr)
        return None


def main():
    cfg = json.load(open(os.path.join(RAIZ, "contenido", "etapas.json"), encoding="utf-8"))
    origen = cfg.get("origenFotos") or "../PHOTOS"
    if not os.path.isabs(origen):
        origen = os.path.normpath(os.path.join(RAIZ, origen))
    if not os.path.isdir(origen):
        raise SystemExit(f"No encuentro las fotografías en {origen}.\n"
                         f"Corrige 'origenFotos' en contenido/etapas.json.")
    print(f"Fotografías originales: {origen}")
    tareas, informe = [], {}

    for etapa in cfg["etapas"]:
        carpeta = os.path.join(origen, etapa["carpetaOrigen"])
        if not os.path.isdir(carpeta):
            print(f"  !! no existe {carpeta}"); continue
        vistos, elegidos, dup, corruptas = {}, [], 0, 0
        for f in sorted(os.listdir(carpeta)):
            if not f.lower().endswith((".jpg", ".jpeg", ".png", ".heic", ".webp")):
                continue
            ruta = os.path.join(carpeta, f)
            try:
                h = hashlib.md5(open(ruta, "rb").read()).hexdigest()
            except Exception:
                corruptas += 1; continue
            if h in vistos:
                dup += 1; continue
            vistos[h] = f
            elegidos.append(ruta)
        informe[etapa["id"]] = {"carpeta": etapa["carpetaOrigen"], "unicas": len(elegidos),
                                "duplicados_omitidos": dup, "ilegibles": corruptas}
        for i, ruta in enumerate(elegidos, 1):
            tareas.append((etapa["id"], i, ruta))

    print(f"Procesando {len(tareas)} fotografías únicas en 3 tamaños…")
    resultados = {}
    with ProcessPoolExecutor(max_workers=os.cpu_count()) as ex:
        for i, r in enumerate(ex.map(procesa, tareas, chunksize=4), 1):
            if r:
                resultados.setdefault(r["id"].rsplit("-", 1)[0], []).append(r)
            if i % 50 == 0:
                print(f"  {i}/{len(tareas)}")

    salida = {"etapas": {}}
    for etapa in cfg["etapas"]:
        fotos = sorted(resultados.get(etapa["id"], []), key=lambda x: x["id"])
        salida["etapas"][etapa["id"]] = fotos
        inf = informe.get(etapa["id"], {})
        print(f"  {etapa['id']} ({etapa['letra']}) origen {inf.get('carpeta')}: "
              f"{len(fotos)} fotos, {inf.get('duplicados_omitidos',0)} duplicados omitidos")

    os.makedirs(DATOS, exist_ok=True)
    json.dump(salida, open(os.path.join(DATOS, "fotos.json"), "w", encoding="utf-8"),
              ensure_ascii=False, separators=(",", ":"))
    json.dump(informe, open(os.path.join(DATOS, "informe-fotos.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=2)
    print("Listo -> datos/fotos.json")


if __name__ == "__main__":
    main()
