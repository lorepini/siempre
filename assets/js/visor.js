/* ─────────────────────────────────────────────
   Visor de una fotografía.
   Muestra la imagen entera, sin deformarla. Al cerrarse devuelve el
   foco y la posición a donde estaba. Nunca toca la música.
   ───────────────────────────────────────────── */
SIEMPRE.visor = (() => {
  const caja = document.getElementById('visor');
  const img = document.getElementById('visorImagen');
  const pie = document.getElementById('visorPie');
  const contador = document.getElementById('visorContador');
  const btnCerrar = document.getElementById('visorCerrar');
  const btnAnterior = document.getElementById('visorAnterior');
  const btnSiguiente = document.getElementById('visorSiguiente');

  let lista = [];
  let indice = 0;
  let abierto = false;
  let devolverFocoA = null;
  let alCerrar = () => {};
  let cargaEnCurso = 0;

  function pinta() {
    const fotoId = lista[indice];
    const f = SIEMPRE.foto(fotoId);
    if (!f) return;

    const miPeticion = ++cargaEnCurso;
    // Primero la versión intermedia (ya suele estar en caché por la galería)
    // y detrás la grande, para que no haya un hueco en blanco.
    img.src = SIEMPRE.rutaMedio(f);
    img.alt = `Fotografía ${indice + 1} de ${lista.length}`;
    if (f.w && f.h) { img.width = f.w; img.height = f.h; }

    const grande = new Image();
    grande.decoding = 'async';
    grande.src = SIEMPRE.rutaGrande(fotoId);
    grande.onload = () => { if (miPeticion === cargaEnCurso) img.src = grande.src; };

    const etapa = SIEMPRE.etapa(fotoId.slice(0, 8));
    const pies = etapa?.pies || {};
    const texto = pies[fotoId] || '';
    pie.textContent = texto || (f.fecha ? f.fecha.split('-').reverse().join('/') : '');
    contador.textContent = `${indice + 1} / ${lista.length}`;
    btnAnterior.disabled = indice === 0;
    btnSiguiente.disabled = indice === lista.length - 1;
    precarga(indice + 1); precarga(indice - 1);
  }

  function precarga(i) {
    if (i < 0 || i >= lista.length) return;
    const f = SIEMPRE.foto(lista[i]);
    if (f) new Image().src = SIEMPRE.rutaMedio(f);
  }

  function paso(delta) {
    const nuevo = indice + delta;
    if (nuevo < 0 || nuevo >= lista.length) return;
    indice = nuevo;
    pinta();
  }

  function teclado(ev) {
    if (!abierto) return;
    if (ev.key === 'Escape') { ev.preventDefault(); cerrar(); }
    else if (ev.key === 'ArrowLeft') { ev.preventDefault(); paso(-1); }
    else if (ev.key === 'ArrowRight') { ev.preventDefault(); paso(1); }
    else if (ev.key === 'Tab') atraparFoco(ev);
  }

  function atraparFoco(ev) {
    const focos = [...caja.querySelectorAll('button:not([disabled])')];
    if (!focos.length) return;
    const primero = focos[0], ultimo = focos[focos.length - 1];
    if (ev.shiftKey && document.activeElement === primero) { ev.preventDefault(); ultimo.focus(); }
    else if (!ev.shiftKey && document.activeElement === ultimo) { ev.preventDefault(); primero.focus(); }
  }

  function abrir(fotos, desde, volverA, cierre) {
    lista = fotos.slice();
    indice = Math.max(0, fotos.indexOf(desde));
    devolverFocoA = volverA || document.activeElement;
    alCerrar = cierre || (() => {});
    abierto = true;
    caja.hidden = false;
    pinta();
    btnCerrar.focus();
    document.addEventListener('keydown', teclado);
  }

  function cerrar() {
    if (!abierto) return;
    abierto = false;
    caja.hidden = true;
    img.removeAttribute('src');
    document.removeEventListener('keydown', teclado);
    if (devolverFocoA && document.contains(devolverFocoA)) devolverFocoA.focus();
    alCerrar();
  }

  /* Deslizar en el móvil, sin confundirlo con un toque. */
  let t0 = null;
  caja.addEventListener('pointerdown', (ev) => { t0 = { x: ev.clientX, y: ev.clientY, t: Date.now() }; });
  caja.addEventListener('pointerup', (ev) => {
    if (!t0) return;
    const dx = ev.clientX - t0.x, dy = ev.clientY - t0.y, dt = Date.now() - t0.t;
    t0 = null;
    if (dt < 600 && Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.6) paso(dx < 0 ? 1 : -1);
  });

  btnCerrar.addEventListener('click', cerrar);
  btnAnterior.addEventListener('click', () => paso(-1));
  btnSiguiente.addEventListener('click', () => paso(1));
  caja.addEventListener('click', (ev) => { if (ev.target === caja) cerrar(); });

  return { abrir, cerrar, abierto: () => abierto };
})();
