#!/usr/bin/env python3
"""
Recorre la web en WebKit, el motor de Safari, con la pantalla y el modo táctil
de varios iPhone.

AVISO HONESTO: esto es WebKit sobre Linux, no un iPhone de verdad. Detecta lo
que depende del motor (transformaciones 3D, clip-path, backdrop-filter, zonas
seguras, eventos de puntero) pero NO el hardware táctil real, la barra de
direcciones de Safari ni el rendimiento del aparato.
"""
import os, sys
from playwright.sync_api import sync_playwright

URL = os.environ.get("URL", "https://lorepini.github.io/siempre/")
CAPTURAS = os.environ.get("CAPTURAS", "/tmp/capturas-iphone")
APARATOS = ["iPhone SE", "iPhone 13", "iPhone 14 Pro Max"]


def main():
    os.makedirs(CAPTURAS, exist_ok=True)
    pasos, problemas, terceros = [], [], set()

    with sync_playwright() as p:
        nav = p.webkit.launch()
        for nombre in APARATOS:
            if nombre not in p.devices:
                pasos.append(f"{nombre}: no disponible en esta versión"); continue
            ctx = nav.new_context(**p.devices[nombre])
            pg = ctx.new_page()
            pg.on("pageerror", lambda e, n=nombre: problemas.append(f"[{n}] EXCEPCIÓN: {e}"))
            pg.on("console", lambda m, n=nombre: problemas.append(f"[{n}] {m.text}")
                  if m.type == "error" else None)
            pg.on("request", lambda r: terceros.add(r.url.split('/')[2])
                  if 'lorepini.github.io' not in r.url else None)

            pg.goto(URL, wait_until="networkidle", timeout=120000)
            pg.wait_for_timeout(1500)
            v = pg.viewport_size
            pasos.append(f"{nombre} ({v['width']}×{v['height']}): carga")
            pg.screenshot(path=f"{CAPTURAS}/{nombre}-1-sobre.png")

            # ¿Se ve el sobre entero y centrado?
            caja = pg.eval_on_selector("#sobre", """e => { const r = e.getBoundingClientRect();
                return {x:Math.round(r.x), y:Math.round(r.y), w:Math.round(r.width),
                        h:Math.round(r.height), dentro: r.top >= 0 && r.bottom <= innerHeight}; }""")
            pasos.append(f"{nombre}: sobre {caja['w']}×{caja['h']} entero en pantalla={caja['dentro']}")

            # ¿Funciona la rotación 3D de la solapa?
            soporta3d = pg.evaluate("CSS.supports('transform', 'rotateX(45deg)') && CSS.supports('perspective', '100px')")
            soportaClip = pg.evaluate("CSS.supports('clip-path', 'polygon(0 0, 100% 0, 50% 100%)')")
            soportaRatio = pg.evaluate("CSS.supports('aspect-ratio', '3 / 2')")
            soportaBlur = pg.evaluate("CSS.supports('-webkit-backdrop-filter', 'blur(10px)') || CSS.supports('backdrop-filter', 'blur(10px)')")
            pasos.append(f"{nombre}: 3D={soporta3d} clip-path={soportaClip} aspect-ratio={soportaRatio} desenfoque={soportaBlur}")

            # Tocar el sobre con el dedo, no con el ratón
            pg.touchscreen.tap(caja["x"] + caja["w"] / 2, caja["y"] + caja["h"] / 2)
            pg.wait_for_timeout(700)
            pg.screenshot(path=f"{CAPTURAS}/{nombre}-2-abriendo.png")
            giro = pg.eval_on_selector(".sobre__solapa", "e => getComputedStyle(e).transform")
            pasos.append(f"{nombre}: la solapa gira -> {'sí' if giro and giro != 'none' else 'NO'}")
            pg.wait_for_timeout(2200)

            abierta = pg.is_visible("#cartaEntrada")
            parrafos = pg.eval_on_selector_all("#cartaEntradaCuerpo p", "e => e.length")
            pasos.append(f"{nombre}: carta visible={abierta}, {parrafos} párrafos")
            pg.screenshot(path=f"{CAPTURAS}/{nombre}-3-carta.png")

            # Desplazarse hasta el final de la carta con el dedo
            pg.evaluate("document.getElementById('entrada').scrollTo(0, 999999)")
            pg.wait_for_timeout(800)
            pg.screenshot(path=f"{CAPTURAS}/{nombre}-4-fin-carta.png")
            b = pg.eval_on_selector("#verRegalo", """e => { const r = e.getBoundingClientRect();
                return {x: r.x + r.width/2, y: r.y + r.height/2, alto: Math.round(r.height)}; }""")
            pasos.append(f"{nombre}: botón 'Ver regalo' de {b['alto']}px de alto")

            pg.touchscreen.tap(b["x"], b["y"])
            pg.wait_for_timeout(3000)
            pg.screenshot(path=f"{CAPTURAS}/{nombre}-5-mosaico.png")
            teselas = pg.eval_on_selector_all(".tesela img.puesta", "e => e.length")
            palabra = pg.evaluate("""() => {
              const ls = [...document.querySelectorAll('.letra')].map(e => e.getBoundingClientRect());
              return { arriba: Math.round(Math.min(...ls.map(r => r.top))),
                       abajo: Math.round(Math.max(...ls.map(r => r.bottom))),
                       ventana: innerHeight }; }""")
            pasos.append(f"{nombre}: mosaico con {teselas} teselas; la palabra ocupa de "
                         f"{palabra['arriba']} a {palabra['abajo']} de {palabra['ventana']}px")

            # ¿Tapan los controles la última letra?
            tope = pg.eval_on_selector(".controles", "e => Math.round(e.getBoundingClientRect().top)")
            pasos.append(f"{nombre}: controles desde {tope}px -> solapan={palabra['abajo'] > tope}")

            # Pellizco para acercar (eventos de puntero, como los envía iOS)
            pg.evaluate("""() => {
              const esc = document.getElementById('escena');
              const ev = (t, id, x, y) => esc.dispatchEvent(new PointerEvent(t, {
                pointerId: id, pointerType: 'touch', isPrimary: id === 1,
                clientX: x, clientY: y, bubbles: true, cancelable: true }));
              const cx = innerWidth/2, cy = innerHeight/2;
              ev('pointerdown', 1, cx - 30, cy); ev('pointerdown', 2, cx + 30, cy);
              for (let k = 1; k <= 10; k++) {
                ev('pointermove', 1, cx - 30 - k*12, cy);
                ev('pointermove', 2, cx + 30 + k*12, cy);
              }
              ev('pointerup', 1, cx - 150, cy); ev('pointerup', 2, cx + 150, cy);
            }""")
            pg.wait_for_timeout(1500)
            pasos.append(f"{nombre}: tras el pellizco, vista = {pg.get_attribute('#escena', 'data-vista')}")
            pg.screenshot(path=f"{CAPTURAS}/{nombre}-6-pellizco.png")

            # Entrar en una etapa tocando su letra
            pg.evaluate("SIEMPRE.mosaico.verTodo(false)")
            pg.wait_for_timeout(900)
            letra = pg.eval_on_selector(".letra[data-etapa='etapa-04']", """e => { const r = e.getBoundingClientRect();
                return {x: r.x + r.width/2, y: r.y + r.height/2}; }""")
            pg.touchscreen.tap(letra["x"], letra["y"])
            pg.wait_for_timeout(3000)
            pasos.append(f"{nombre}: etapa 4 -> {pg.eval_on_selector_all('.galeria__foto', 'e => e.length')} fotos")
            pg.screenshot(path=f"{CAPTURAS}/{nombre}-7-album.png")

            foto = pg.eval_on_selector(".galeria__foto", """e => { const r = e.getBoundingClientRect();
                return {x: r.x + r.width/2, y: r.y + r.height/2}; }""")
            pg.touchscreen.tap(foto["x"], foto["y"])
            pg.wait_for_timeout(3000)
            pasos.append(f"{nombre}: visor -> {pg.inner_text('#visorContador') if pg.is_visible('#visor') else 'NO ABRE'}")
            pg.screenshot(path=f"{CAPTURAS}/{nombre}-8-visor.png")

            desborde = pg.evaluate("document.documentElement.scrollWidth > innerWidth + 1")
            pasos.append(f"{nombre}: desborde horizontal = {desborde}")

            # Ningún control puede quedarse fuera de la pantalla ni cortado
            pg.evaluate("SIEMPRE.visor.cerrar(); SIEMPRE.album.cerrar();")
            pg.wait_for_timeout(600)
            fuera = pg.evaluate("""() => {
              const malos = [];
              document.querySelectorAll('.controles button').forEach(b => {
                const r = b.getBoundingClientRect();
                if (r.left < 0 || r.right > innerWidth + .5 || r.width < 36 || r.height < 40)
                  malos.push(`${b.textContent.trim()} (${Math.round(r.left)}→${Math.round(r.right)}, ${Math.round(r.height)}px alto)`);
              });
              const c = document.querySelector('.controles');
              return { malos, barraSeSale: c.scrollWidth > c.clientWidth + 1,
                       filas: new Set([...c.children].map(x => Math.round(x.getBoundingClientRect().top))).size };
            }""")
            pasos.append(f"{nombre}: controles fuera de pantalla = {fuera['malos'] or 'ninguno'}; "
                         f"barra cortada = {fuera['barraSeSale']}; filas = {fuera['filas']}")
            ctx.close()
        nav.close()

    print("── RECORRIDO EN WEBKIT (motor de Safari) ──")
    for s in pasos: print(" ·", s)
    print("\nservidores externos:", terceros or "ninguno")
    reales = [x for x in problemas if 'ERR_NETWORK' not in x and 'ERR_ADDRESS' not in x]
    print("problemas:", reales or "ninguno")
    print(f"\nCapturas en {CAPTURAS}")


if __name__ == "__main__":
    main()
