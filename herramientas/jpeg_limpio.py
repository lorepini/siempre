"""
Quita metadatos de un JPEG sin recomprimirlo.

Copia los bytes de imagen tal cual y elimina sólo los segmentos de metadatos
(Exif con GPS, XMP, IPTC, comentarios). Conserva el perfil de color ICC para
que los colores no cambien. Resultado: píxeles idénticos al original.

Trata también los archivos MPO, que son JPEG con una segunda imagen incrustada
(muy habituales en fotos de móvil): se queda con la primera y descarta el resto.
"""

# Segmentos eliminados: APP1 (Exif/XMP), APP13 (IPTC), APP14 (Adobe), comentario.
FUERA = {0xE1, 0xED, 0xEE, 0xFE}
SIN_LONGITUD = {0x01, 0xD8, 0xD9}


def _fin_del_barrido(datos, desde):
    """Posición justo después del FFD9 que cierra la primera imagen."""
    i = desde
    n = len(datos)
    while i < n - 1:
        if datos[i] != 0xFF:
            i += 1
            continue
        m = datos[i + 1]
        # 0x00 es un byte de relleno, 0xFF es padding, FFD0-FFD7 son reinicios:
        # ninguno termina el barrido.
        if m == 0x00 or m == 0xFF or 0xD0 <= m <= 0xD7:
            i += 2
            continue
        if m == 0xD9:
            return i + 2
        i += 2
    return n


def limpia_bytes(datos: bytes):
    if not datos.startswith(b"\xff\xd8"):
        return None                                  # no es un JPEG
    salida = bytearray(b"\xff\xd8")
    i, n = 2, len(datos)
    while i < n - 1:
        while i < n and datos[i] == 0xFF and datos[i + 1] == 0xFF:
            i += 1                                   # relleno entre segmentos
        if i >= n - 1 or datos[i] != 0xFF:
            return None
        marca = datos[i + 1]
        if marca == 0xD9:
            salida += b"\xff\xd9"
            return bytes(salida)
        if marca == 0xDA:                            # comienzo del barrido
            if i + 4 > n:
                return None
            largo = (datos[i + 2] << 8) | datos[i + 3]
            fin = _fin_del_barrido(datos, i + 2 + largo)
            salida += datos[i:fin]
            if not salida.endswith(b"\xff\xd9"):
                salida += b"\xff\xd9"
            return bytes(salida)
        if marca in SIN_LONGITUD or 0xD0 <= marca <= 0xD7:
            salida += datos[i:i + 2]
            i += 2
            continue
        if i + 4 > n:
            return None
        largo = (datos[i + 2] << 8) | datos[i + 3]
        fin = i + 2 + largo
        if largo < 2 or fin > n:
            return None
        carga = datos[i + 4:fin]
        # APP2 se conserva porque suele llevar el perfil ICC, salvo cuando es
        # la tabla MPF que describe las imágenes extra de un MPO.
        es_mpf = marca == 0xE2 and carga[:4] == b"MPF\x00"
        if marca not in FUERA and not es_mpf:
            salida += datos[i:fin]
        i = fin
    return None


def copia_limpia(origen: str, destino: str) -> bool:
    """Devuelve True si se copió sin recomprimir."""
    with open(origen, "rb") as f:
        datos = f.read()
    limpio = limpia_bytes(datos)
    if limpio is None:
        return False
    with open(destino, "wb") as f:
        f.write(limpio)
    return True
