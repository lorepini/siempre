#!/usr/bin/env python3
"""Comprueba la sintaxis de los archivos .js del proyecto."""
import sys, glob
import tree_sitter_javascript as tsjs
from tree_sitter import Language, Parser

parser = Parser(Language(tsjs.language()))


def revisa(ruta):
    fuente = open(ruta, "rb").read()
    arbol = parser.parse(fuente)
    fallos = []
    pila = [arbol.root_node]
    while pila:
        n = pila.pop()
        if n.type == "ERROR" or n.is_missing:
            linea = n.start_point[0] + 1
            txt = fuente[n.start_byte:n.start_byte + 70].decode("utf8", "replace").split("\n")[0]
            fallos.append((linea, "falta algo" if n.is_missing else "error", txt))
        pila.extend(n.children)
    return sorted(fallos)


def main():
    rutas = sys.argv[1:] or sorted(glob.glob("assets/js/*.js"))
    total = 0
    for r in rutas:
        fallos = revisa(r)
        if fallos:
            total += len(fallos)
            print(f"✗ {r}")
            for linea, clase, txt in fallos[:8]:
                print(f"    línea {linea}: {clase} → {txt}")
        else:
            print(f"✓ {r}")
    sys.exit(1 if total else 0)


if __name__ == "__main__":
    main()
