/* ─────────────────────────────────────────────
   El mosaico: SIEMPRE construida con fotografías.

   Es una superficie ampliable y desplazable. El nivel de acercamiento
   decide qué es interactivo, medido por el tamaño real en pantalla de
   una tesela, no por números atados a un tamaño de pantalla concreto.
   ───────────────────────────────────────────── */
SIEMPRE.mosaico = (() => {
  const escena = document.getElementById('escena');
  const lienzo = document.getElementById('lienzo');
  const mundo = document.getElementById('mundo');
  const rotulo = document.getElementById('rotulo');
  const rotuloEtapa = document.getElementById('rotuloEtapa');
  const rotuloNombre = document.getElementById('rotuloNombre');
  const rotuloEntrar = document.getElementById('rotuloEntrar');

  /* Umbrales expresados en píxeles de pantalla que ocupa una tesela. */
  const TESELA_MEDIA = 16;
  const TESELA_CERCA = 46;
  const TESELA_MAXIMA = 340;
  const TESELA_FINA = 38;       // a partir de aquí la tesela merece la versión nítida
  const MARGEN = 0.06;          // aire alrededor de la palabra
  let reservaAbajo = 132;       // sitio de la indicación y de los controles (se mide)
  const ARRASTRE_MINIMO = 6;    // px antes de considerar que está arrastrando

  let M = null;                 // datos del mosaico
  let letras = [];              // {etapa, nodo, x, y, ancho, alto}
  let W = 0, H = 0;             // tamaño del mundo en unidades
  let k = 1, tx = 0, ty = 0;    // escala y desplazamiento
  let kMin = .05, kMax = 4;
  let vertical = false;
  let vista = 'lejos';
  let enfocada = null;          // letra dominante ahora mismo
  let relojEnfoque = null;
  let observador = null;
  const aLaVista = new Set();
  let finoAhora = false;
  let alEntrar = () => {};
  let alAbrirFoto = () => {};

  /* ── Disposición ── */
  function disponer() {
    const sep = M.separacionLetras;
    vertical = window.innerWidth / window.innerHeight < 1.15;
    if (vertical) {
      const sepV = sep * .55;
      const ancho = Math.max(...M.letras.map((l) => l.ancho));
      let y = 0;
      letras.forEach((L, i) => {
        L.x = (ancho - L.ancho) / 2;
        L.y = y;
        y += L.alto + (i < letras.length - 1 ? sepV : 0);
      });
      W = ancho; H = y;
    } else {
      let x = 0;
      letras.forEach((L, i) => {
        L.x = x; L.y = 0;
        x += L.ancho + (i < letras.length - 1 ? sep : 0);
      });
      W = x; H = Math.max(...letras.map((l) => l.alto));
    }
    letras.forEach((L) => {
      L.nodo.style.transform = `translate(${L.x}px, ${L.y}px)`;
    });
    mundo.style.width = W + 'px';
    mundo.style.height = H + 'px';
  }

  /* Se mide lo que ocupan de verdad la indicación y los controles, porque
     en un móvil estrecho la indicación puede ocupar tres líneas. */
  function medirReserva() {
    const barra = document.querySelector('.controles');
    const indic = document.getElementById('indicacion');
    let tope = window.innerHeight;
    for (const nodo of [barra, indic]) {
      if (!nodo || nodo.hidden) continue;
      const r = nodo.getBoundingClientRect();
      if (r.height > 0) tope = Math.min(tope, r.top);
    }
    reservaAbajo = Math.max(72, window.innerHeight - tope + 14);
  }

  /* Zona donde la palabra puede vivir sin que nada la tape. */
  function areaUtil() {
    const arriba = window.innerHeight * MARGEN;
    const abajo = window.innerHeight - reservaAbajo;
    return {
      ancho: window.innerWidth * (1 - MARGEN * 2),
      alto: Math.max(120, abajo - arriba),
      centroY: (arriba + abajo) / 2,
    };
  }

  function escalaDeAjuste() {
    const a = areaUtil();
    return Math.min(a.ancho / W, a.alto / H);
  }

  function recalcularLimites() {
    medirReserva();
    const ajuste = escalaDeAjuste();
    kMin = ajuste * .82;
    kMax = Math.max(ajuste * 2.2, TESELA_MAXIMA / M.celda);
  }

  /* ── Construcción ── */
  function construir() {
    M = SIEMPRE.mosaicoDatos;
    const frag = document.createDocumentFragment();

    M.letras.slice().sort((a, b) => a.orden - b.orden).forEach((l) => {
      const etapa = SIEMPRE.etapa(l.id);
      // Un <button> no puede contener <div>, y las teselas lo son. Se usa un
      // div con papel de botón, que sí es válido y sigue siendo accesible.
      const nodo = document.createElement('div');
      nodo.className = 'letra';
      nodo.setAttribute('role', 'button');
      nodo.tabIndex = 0;
      nodo.style.width = l.ancho + 'px';
      nodo.style.height = l.alto + 'px';
      nodo.dataset.etapa = l.id;
      nodo.setAttribute('aria-label',
        `${SIEMPRE.numero(etapa)}${SIEMPRE.rotulo(etapa) ? ': ' + SIEMPRE.rotulo(etapa) : ''} — letra ${l.letra}. Entrar al álbum`);

      const lado = M.celda - M.hueco;
      l.teselas.forEach((t) => {
        if (!t.f) return;
        const c = document.createElement('div');
        c.className = 'tesela';
        c.style.cssText =
          `left:${t.x + M.hueco / 2}px;top:${t.y + M.hueco / 2}px;width:${lado}px;height:${lado}px`;
        c.dataset.foto = t.f;
        const img = document.createElement('img');
        img.alt = '';
        img.decoding = 'async';
        // Dos niveles: la versión diminuta para ver la palabra entera y la
        // nítida cuando se acerca. Así el primer vistazo no descarga 20 MB.
        img.dataset.src = SIEMPRE.rutaMicro(t.f);
        img.dataset.fino = SIEMPRE.rutaMini(t.f);
        c.appendChild(img);
        nodo.appendChild(c);
      });

      frag.appendChild(nodo);
      letras.push({ etapa, nodo, letra: l.letra, ancho: l.ancho, alto: l.alto, x: 0, y: 0 });
    });

    mundo.appendChild(frag);
    if ((SIEMPRE.cfg.aspecto?.veloColorLejos || 0) > 0) mundo.classList.add('con-velo');
    prepararCargaPerezosa();
  }

  /* Sólo se descargan las teselas que están a la vista, y en el nivel de
     detalle que corresponde al acercamiento actual. */
  function pon(img, ruta) {
    const previa = new Image();
    previa.decoding = 'async';
    const colocar = () => { img.src = ruta; img.classList.add('puesta'); };
    previa.onload = colocar;
    previa.onerror = () => { /* la tesela se queda en su color de fondo */ };
    previa.src = ruta;
    if (previa.complete) colocar();   // ya estaba en caché: cambio sin parpadeo
  }

  function cargaSegunNivel(img) {
    if (finoAhora && img.dataset.fino) {
      pon(img, img.dataset.fino);
      delete img.dataset.fino;
      delete img.dataset.src;
    } else if (img.dataset.src) {
      pon(img, img.dataset.src);
      delete img.dataset.src;
    }
  }

  function afinarLoVisible() {
    aLaVista.forEach(cargaSegunNivel);
  }

  function prepararCargaPerezosa() {
    observador = new IntersectionObserver((entradas) => {
      entradas.forEach((e) => {
        const img = e.target;
        if (e.isIntersecting) { aLaVista.add(img); cargaSegunNivel(img); }
        else aLaVista.delete(img);
      });
    }, { root: escena, rootMargin: '250px' });
    mundo.querySelectorAll('.tesela img').forEach((i) => observador.observe(i));
  }

  /* ── Cámara ── */
  function aplicar() {
    lienzo.style.transform = `translate(${tx}px, ${ty}px) scale(${k})`;
    const tesela = M.celda * k;
    const finoNuevo = tesela >= TESELA_FINA;
    if (finoNuevo !== finoAhora) {
      finoAhora = finoNuevo;
      if (finoAhora) afinarLoVisible();
    }
    const nueva = tesela < TESELA_MEDIA ? 'lejos' : tesela < TESELA_CERCA ? 'media' : 'cerca';
    if (nueva !== vista) {
      vista = nueva;
      escena.dataset.vista = vista;
      escena.style.cursor = vista === 'cerca' ? 'default' : '';
    }
    if ((SIEMPRE.cfg.aspecto?.veloColorLejos || 0) > 0) {
      const v = SIEMPRE.cfg.aspecto.veloColorLejos * Math.max(0, 1 - tesela / TESELA_CERCA);
      document.documentElement.style.setProperty('--velo', v.toFixed(3));
    }
    vigilarEnfoque();
    colocarRotulo();
  }

  function sujetar() {
    k = Math.max(kMin, Math.min(kMax, k));
    // No dejar que la palabra se escape: siempre queda parte en pantalla.
    const anchoVista = window.innerWidth, altoVista = window.innerHeight;
    const a = areaUtil();
    const w = W * k, h = H * k;
    const holgura = Math.min(anchoVista, altoVista) * .28;
    if (w <= anchoVista) tx = (anchoVista - w) / 2;
    else tx = Math.max(anchoVista - w - holgura, Math.min(holgura, tx));
    // Si cabe entera, se centra en la zona libre, no en toda la ventana:
    // así la indicación y los controles nunca se le echan encima.
    if (h <= a.alto) ty = a.centroY - h / 2;
    else ty = Math.max(altoVista - h - holgura, Math.min(holgura, ty));
  }

  function verTodo(animado = true) {
    recalcularLimites();
    const destino = escalaDeAjuste();
    const a = areaUtil();
    mover(destino,
          (window.innerWidth - W * destino) / 2,
          a.centroY - (H * destino) / 2,
          animado);
  }

  function mover(nk, nx, ny, animado) {
    const suave = animado && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!suave) { k = nk; tx = nx; ty = ny; sujetar(); aplicar(); return; }
    const k0 = k, x0 = tx, y0 = ty, t0 = performance.now(), dur = 620;
    const suavizar = (p) => 1 - Math.pow(1 - p, 3);
    lienzo.style.willChange = 'transform';
    (function paso(t) {
      const p = Math.min(1, (t - t0) / dur), e = suavizar(p);
      k = k0 + (nk - k0) * e; tx = x0 + (nx - x0) * e; ty = y0 + (ny - y0) * e;
      sujetar(); aplicar();
      if (p < 1) requestAnimationFrame(paso);
    })(t0);
  }

  function zoomEn(px, py, factor) {
    const previo = k;
    k = Math.max(kMin, Math.min(kMax, k * factor));
    const real = k / previo;
    tx = px - (px - tx) * real;
    ty = py - (py - ty) * real;
    sujetar(); aplicar();
  }

  function acercarACentro(factor) {
    zoomEn(window.innerWidth / 2, window.innerHeight / 2, factor);
  }

  /* ── Letra dominante (para el rótulo y, si procede, la música) ── */
  function marcoEnPantalla(L) {
    return { x: tx + L.x * k, y: ty + L.y * k, w: L.ancho * k, h: L.alto * k };
  }

  function letraDominante() {
    if (vista === 'lejos') return null;
    const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
    const areaVista = window.innerWidth * window.innerHeight;
    let mejor = null, mejorPeso = 0;
    for (const L of letras) {
      const m = marcoEnPantalla(L);
      const solapeX = Math.max(0, Math.min(m.x + m.w, window.innerWidth) - Math.max(m.x, 0));
      const solapeY = Math.max(0, Math.min(m.y + m.h, window.innerHeight) - Math.max(m.y, 0));
      const area = (solapeX * solapeY) / areaVista;
      if (area <= 0) continue;
      const centrada = m.x <= cx && cx <= m.x + m.w && m.y <= cy && cy <= m.y + m.h;
      const peso = area * (centrada ? 2.2 : 1);
      if (peso > mejorPeso) { mejorPeso = peso; mejor = { L, area, centrada }; }
    }
    // Histéresis: cuesta más ganar el foco que conservarlo.
    const umbral = enfocada && mejor && mejor.L === enfocada ? .16 : .3;
    return mejor && mejor.area >= umbral && mejor.centrada ? mejor.L : null;
  }

  function vigilarEnfoque() {
    const L = letraDominante();
    if (L === enfocada) return;
    enfocada = L;
    letras.forEach((x) => x.nodo.classList.toggle('mirada', x === L));
    clearTimeout(relojEnfoque);
    if (L && SIEMPRE.audio.arrancaEn() === 'mosaico') {
      // Un momento de calma antes de cambiar de canción, para que un
      // movimiento mínimo no alterne entre dos pistas.
      relojEnfoque = setTimeout(() => {
        if (enfocada === L) SIEMPRE.audio.pon(L.etapa.id);
      }, 900);
    }
  }

  function colocarRotulo() {
    if (!enfocada || vista === 'lejos') { rotulo.hidden = true; return; }
    const m = marcoEnPantalla(enfocada);
    const e = enfocada.etapa;
    rotuloEtapa.textContent = SIEMPRE.numero(e);
    rotuloNombre.textContent = SIEMPRE.rotulo(e);
    rotulo.dataset.etapa = e.id;
    rotulo.hidden = false;
    const x = Math.max(120, Math.min(window.innerWidth - 120, m.x + m.w / 2));
    let y = m.y - rotulo.offsetHeight - 16;
    if (y < 12) y = Math.min(window.innerHeight - rotulo.offsetHeight - 92, m.y + m.h + 16);
    rotulo.style.left = x + 'px';
    rotulo.style.top = Math.max(12, y) + 'px';
  }

  /* ── Gestos ── */
  function conectarGestos() {
    const punteros = new Map();
    let arrastrando = false, movido = 0, inicio = null, pellizco = null;
    // Al capturar el puntero para poder arrastrar, el navegador dirige el
    // 'click' a la escena y no a la letra. Por eso se guarda sobre qué se
    // apoyó el dedo: eso, y no el destino del clic, es lo que ella tocó.
    let apoyadoEn = null;

    // La barra de controles, la lista de etapas y el rótulo flotan por encima
    // del mosaico: ahí no se arrastra ni se captura el puntero, o sus botones
    // nunca llegarían a recibir el clic.
    const esMando = (nodo) => !!nodo.closest?.('.controles, .lista-etapas, .rotulo');

    escena.addEventListener('pointerdown', (ev) => {
      if (ev.button !== undefined && ev.button !== 0) return;
      if (esMando(ev.target)) return;
      apoyadoEn = ev.target;
      punteros.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (punteros.size === 1) {
        arrastrando = true; movido = 0;
        inicio = { x: ev.clientX, y: ev.clientY, tx, ty };
        escena.setPointerCapture(ev.pointerId);
        escena.classList.add('arrastrando');
      } else if (punteros.size === 2) {
        const [a, b] = [...punteros.values()];
        pellizco = { d: Math.hypot(a.x - b.x, a.y - b.y), k };
        arrastrando = false;
      }
    });

    escena.addEventListener('pointermove', (ev) => {
      if (!punteros.has(ev.pointerId)) return;
      punteros.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });

      if (punteros.size === 2 && pellizco) {
        const [a, b] = [...punteros.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pellizco.d > 0) {
          const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
          const objetivo = Math.max(kMin, Math.min(kMax, pellizco.k * (d / pellizco.d)));
          zoomEn(cx, cy, objetivo / k);
          movido = ARRASTRE_MINIMO + 1;   // un pellizco nunca es un clic
        }
        return;
      }
      if (!arrastrando || !inicio) return;
      const dx = ev.clientX - inicio.x, dy = ev.clientY - inicio.y;
      movido = Math.max(movido, Math.hypot(dx, dy));
      tx = inicio.tx + dx; ty = inicio.ty + dy;
      sujetar(); aplicar();
    });

    const soltar = (ev) => {
      punteros.delete(ev.pointerId);
      if (punteros.size < 2) pellizco = null;
      if (punteros.size === 0) {
        arrastrando = false;
        escena.classList.remove('arrastrando');
      }
    };
    escena.addEventListener('pointerup', soltar);
    escena.addEventListener('pointercancel', soltar);

    // Un arrastre no es un clic.
    escena.addEventListener('click', (ev) => {
      if (esMando(ev.target)) return;
      if (movido > ARRASTRE_MINIMO) { ev.stopPropagation(); ev.preventDefault(); movido = 0; return; }
      movido = 0;
      const tocado = apoyadoEn && apoyadoEn.closest ? apoyadoEn : ev.target;
      const letraNodo = tocado.closest('.letra');
      if (!letraNodo) return;
      const etapaId = letraNodo.dataset.etapa;
      const tesela = tocado.closest('.tesela');
      if (vista === 'cerca' && tesela && tesela.dataset.foto) {
        alAbrirFoto(etapaId, tesela.dataset.foto);
      } else {
        alEntrar(etapaId);
      }
    });

    escena.addEventListener('wheel', (ev) => {
      if (esMando(ev.target)) return;
      ev.preventDefault();
      const factor = Math.exp(-ev.deltaY * (ev.deltaMode === 1 ? .04 : .0016));
      zoomEn(ev.clientX, ev.clientY, factor);
    }, { passive: false });

    escena.addEventListener('dblclick', (ev) => {
      if (esMando(ev.target)) return;
      ev.preventDefault();
      zoomEn(ev.clientX, ev.clientY, 1.9);
    });

    // Enter y Espacio sobre una letra entran en su etapa.
    mundo.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Enter' && ev.key !== ' ' && ev.key !== 'Spacebar') return;
      const letraNodo = ev.target.closest?.('.letra');
      if (!letraNodo) return;
      ev.preventDefault();
      alEntrar(letraNodo.dataset.etapa);
    });

    window.addEventListener('resize', () => {
      const centroX = (window.innerWidth / 2 - tx) / k;
      const centroY = (window.innerHeight / 2 - ty) / k;
      disponer();
      recalcularLimites();
      k = Math.max(kMin, Math.min(kMax, k));
      tx = window.innerWidth / 2 - centroX * k;
      ty = window.innerHeight / 2 - centroY * k;
      sujetar(); aplicar();
    });
  }

  return {
    async iniciar({ alEntrar: entrar, alAbrirFoto: abrir }) {
      alEntrar = entrar; alAbrirFoto = abrir;
      construir();
      disponer();
      medirReserva();
      recalcularLimites();
      escena.dataset.vista = vista;
      verTodo(false);
      conectarGestos();
      rotuloEntrar.addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (rotulo.dataset.etapa) alEntrar(rotulo.dataset.etapa);
      });
    },
    verTodo,
    acercar: () => acercarACentro(1.45),
    alejar: () => acercarACentro(1 / 1.45),
    vista: () => vista,
    /** Encuadra una letra concreta sin abrir su álbum. */
    enfocarEtapa(id) {
      const L = letras.find((x) => x.etapa.id === id);
      if (!L) return;
      const a = areaUtil();
      const destino = Math.min(kMax, Math.min(a.ancho * .82 / L.ancho, a.alto * .82 / L.alto));
      mover(destino,
            window.innerWidth / 2 - (L.x + L.ancho / 2) * destino,
            a.centroY - (L.y + L.alto / 2) * destino, true);
    },
    /** Estado de cámara, para devolverla donde estaba al cerrar un álbum. */
    camara: () => ({ k, tx, ty }),
    ponCamara: (c) => { if (c) { k = c.k; tx = c.tx; ty = c.ty; sujetar(); aplicar(); } },
  };
})();
