#!/usr/bin/env python3
"""Recorre la web en un navegador real y avisa de cualquier error."""
import http.server, socketserver, threading, os, sys, functools, time

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAPTURAS = os.path.join(os.environ.get("CAPTURAS", "/tmp"), "capturas")
PUERTO = 8777


def sirve():
    manejador = functools.partial(http.server.SimpleHTTPRequestHandler, directory=RAIZ)
    socketserver.TCPServer.allow_reuse_address = True
    s = socketserver.TCPServer(("127.0.0.1", PUERTO), manejador)
    threading.Thread(target=s.serve_forever, daemon=True).start()
    return s


def main():
    from playwright.sync_api import sync_playwright
    os.makedirs(CAPTURAS, exist_ok=True)
    servidor = sirve()
    problemas, pasos = [], []

    with sync_playwright() as p:
        nav = p.chromium.launch(args=["--no-sandbox", "--disable-gpu"])

        for etiqueta, tam, movil in [("escritorio", {"width": 1440, "height": 900}, False),
                                     ("movil", {"width": 390, "height": 844}, True)]:
            ctx = nav.new_context(viewport=tam, device_scale_factor=2,
                                  has_touch=movil, is_mobile=movil)
            pg = ctx.new_page()
            pg.on("console", lambda m: problemas.append(f"[{etiqueta}] consola {m.type}: {m.text}")
                  if m.type in ("error", "warning") else None)
            pg.on("pageerror", lambda e: problemas.append(f"[{etiqueta}] EXCEPCIÓN: {e}"))
            pg.on("requestfailed", lambda r: problemas.append(
                f"[{etiqueta}] petición fallida: {r.url.split('/')[-1]} — {r.failure}"))

            pg.goto(f"http://127.0.0.1:{PUERTO}/", wait_until="networkidle")
            pg.screenshot(path=f"{CAPTURAS}/{etiqueta}-1-puerta.png")
            pasos.append(f"{etiqueta}: portada cargada")

            pg.click("#btnSinMusica")
            pg.wait_for_timeout(2500)
            pesado = pg.evaluate("""() => {
              const r = performance.getEntriesByType('resource');
              const suma = (f) => r.filter(f).reduce((a, x) => a + (x.transferSize || x.encodedBodySize || 0), 0);
              return { total: suma(() => true), fotos: suma(x => x.name.includes('/medios/')),
                       peticiones: r.length };
            }""")
            pasos.append(f"{etiqueta}: primer vistazo = {pesado['total']/1e6:.1f} MB en "
                         f"{pesado['peticiones']} peticiones ({pesado['fotos']/1e6:.1f} MB de fotografías)")
            pg.screenshot(path=f"{CAPTURAS}/{etiqueta}-2-mosaico.png")
            n = pg.eval_on_selector_all(".tesela", "e => e.length")
            cargadas = pg.eval_on_selector_all(".tesela img.puesta", "e => e.length")
            micro = pg.eval_on_selector_all(".tesela img", "e => e.filter(i => i.currentSrc.includes('/micro/')).length")
            pasos.append(f"{etiqueta}: mosaico con {n} teselas, {cargadas} cargadas, {micro} en nivel diminuto")
            vista = pg.get_attribute("#escena", "data-vista")
            pasos.append(f"{etiqueta}: vista inicial = {vista}")

            # Acercarse con los botones hasta cambiar de vista
            for _ in range(4):
                pg.click("#btnAcercar")
                pg.wait_for_timeout(700)
            pg.wait_for_timeout(1500)
            pg.screenshot(path=f"{CAPTURAS}/{etiqueta}-3-acercado.png")
            finas = pg.eval_on_selector_all(".tesela img", "e => e.filter(i => i.currentSrc.includes('/mini/')).length")
            pasos.append(f"{etiqueta}: tras acercar, vista = {pg.get_attribute('#escena','data-vista')}, "
                         f"rótulo visible = {pg.is_visible('#rotulo')}, {finas} teselas ya nítidas")

            pg.click("#btnVerTodo")
            pg.wait_for_timeout(900)

            # Lista de etapas (acceso sin zoom)
            pg.click("#btnEtapas")
            pg.wait_for_timeout(400)
            pg.screenshot(path=f"{CAPTURAS}/{etiqueta}-4-lista.png")
            pg.click("#listaEtapasUl li:nth-child(4) button")
            pg.wait_for_timeout(2200)
            pg.screenshot(path=f"{CAPTURAS}/{etiqueta}-5-album-carta.png")
            pasos.append(f"{etiqueta}: álbum abierto, título = {pg.inner_text('#albumTitulo')!r}, "
                         f"letra = {pg.inner_text('#albumLetra')!r}")

            pg.click("#cartaSeguir")
            pg.wait_for_timeout(2500)
            pg.screenshot(path=f"{CAPTURAS}/{etiqueta}-6-galeria.png")
            nf = pg.eval_on_selector_all(".galeria__foto", "e => e.length")
            pasos.append(f"{etiqueta}: galería con {nf} fotografías")

            pg.click(".galeria__foto")
            pg.wait_for_timeout(2500)
            pg.screenshot(path=f"{CAPTURAS}/{etiqueta}-7-visor.png")
            pasos.append(f"{etiqueta}: visor abierto, contador = {pg.inner_text('#visorContador')!r}")

            pg.keyboard.press("ArrowRight"); pg.wait_for_timeout(1400)
            pasos.append(f"{etiqueta}: tras flecha derecha, contador = {pg.inner_text('#visorContador')!r}")
            pg.keyboard.press("Escape"); pg.wait_for_timeout(600)
            pasos.append(f"{etiqueta}: visor cerrado con Escape = {not pg.is_visible('#visor')}")

            pg.click("#albumSiguiente"); pg.wait_for_timeout(1800)
            pasos.append(f"{etiqueta}: etapa siguiente = {pg.inner_text('#albumTitulo')!r}")

            pg.go_back(); pg.wait_for_timeout(1200)
            pasos.append(f"{etiqueta}: Atrás del navegador → álbum visible = {pg.is_visible('#album')}, "
                         f"mosaico visible = {pg.is_visible('#escena')}")

            pg.click("#albumVolver"); pg.wait_for_timeout(1200)
            pg.screenshot(path=f"{CAPTURAS}/{etiqueta}-8-vuelta.png")
            pasos.append(f"{etiqueta}: de vuelta en el mosaico = {not pg.is_visible('#album')}")

            # ¿Se desborda la página a lo ancho?
            desborde = pg.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1")
            pasos.append(f"{etiqueta}: desbordamiento horizontal = {desborde}")
            ctx.close()

        nav.close()
    servidor.shutdown()

    print("\n── RECORRIDO ──")
    for s in pasos: print(" ·", s)
    if problemas:
        print(f"\n── PROBLEMAS ({len(problemas)}) ──")
        vistos = set()
        for x in problemas:
            if x not in vistos:
                vistos.add(x); print(" !", x)
    else:
        print("\nSin errores de consola ni peticiones fallidas.")
    print(f"\nCapturas en {CAPTURAS}")


if __name__ == "__main__":
    main()
