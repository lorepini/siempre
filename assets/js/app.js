/* ─────────────────────────────────────────────
   Montaje y recorrido.

   El regalo empieza cerrado: un sobre. Al abrirlo aparece la carta, y al
   final de la carta se entra al mosaico. Desde ahí se puede volver a leerla
   cuando quiera.
   ───────────────────────────────────────────── */
(async () => {
  const entrada = document.getElementById('entrada');
  const sobreEscena = document.getElementById('sobreEscena');
  const sobre = document.getElementById('sobre');
  const cartaEntrada = document.getElementById('cartaEntrada');
  const escena = document.getElementById('escena');
  const indicacion = document.getElementById('indicacion');
  const btnEtapas = document.getElementById('btnEtapas');
  const btnCarta = document.getElementById('btnCarta');
  const lista = document.getElementById('listaEtapas');
  const listaUl = document.getElementById('listaEtapasUl');
  const cierre = document.getElementById('cierre');

  const sinMovimiento = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  try {
    await SIEMPRE.cargar();
  } catch (e) {
    sobreEscena.innerHTML = '<p class="sobre__para">No se pudo cargar el contenido</p>'
      + `<p class="sobre__pista">${e.message}</p>`;
    return;
  }

  /* ── Textos ── */
  const P = SIEMPRE.cfg.proyecto || {};
  const E = P.entrada || {};
  document.getElementById('sobrePara').textContent = E.para || '';
  document.getElementById('sobrePista').textContent = E.pista || '';
  document.getElementById('sobreEtiqueta').textContent = `Abrir la carta${E.para ? ' ' + E.para : ''}`;
  sobre.setAttribute('aria-describedby', 'sobreEtiqueta');
  sobre.setAttribute('aria-label', `Abrir la carta${E.para ? ' ' + E.para : ''}`);
  document.getElementById('cartaEntradaTitulo').textContent = E.tituloCarta || '';
  document.getElementById('cartaEntradaFirma').textContent = E.firmaCarta || '';
  document.getElementById('verRegalo').textContent = E.botonRegalo || 'Ver regalo';
  indicacion.textContent = P.mosaico?.indicacion || '';
  document.getElementById('cierreTitulo').textContent = P.cierre?.titulo || '';
  document.getElementById('cierreTexto').textContent = P.cierre?.texto || '';

  const cuerpoCarta = document.getElementById('cartaEntradaCuerpo');
  if (SIEMPRE.cartaPrincipal) {
    SIEMPRE.pintaParrafos(cuerpoCarta, SIEMPRE.cartaPrincipal);
  } else {
    const aviso = document.createElement('p');
    aviso.className = 'pendiente';
    aviso.textContent = 'La carta todavía está por escribir.';
    cuerpoCarta.appendChild(aviso);
  }

  const quien = P.destinataria?.[P.destinataria?.mostrar === 'nombre' ? 'nombre' : 'apodo'];
  if (quien && P.destinataria?.mostrar !== 'ninguno') document.title = `SIEMPRE · para ${quien}`;

  /* ── Historial: Atrás cierra lo que esté encima ── */
  const Historia = {
    entrar(vista, datos = {}) {
      history.pushState({ vista, ...datos }, '',
        vista === 'album' ? `#${datos.etapa}` : vista === 'mosaico' ? '#mosaico' : '#');
    },
    reemplazar(vista) { history.replaceState({ vista }, '', vista === 'mosaico' ? '#mosaico' : '#'); },
  };
  Historia.reemplazar('carta');

  /* ── El sobre ── */
  let sobreAbierto = false;

  function abrirSobre() {
    if (sobreAbierto) return;
    sobreAbierto = true;
    sobre.classList.add('abierto');
    sobre.disabled = true;
    sobreEscena.classList.add('se-abre');
    const espera = sinMovimiento() ? 0 : 1550;
    setTimeout(() => {
      sobreEscena.hidden = true;
      cartaEntrada.hidden = false;
      entrada.scrollTop = 0;
      cartaEntrada.focus({ preventScroll: true });
    }, espera);
  }

  sobre.addEventListener('click', abrirSobre);

  /* ── De la carta al mosaico ── */
  function alMosaico(desdeHistorial = false) {
    const cerrar = () => { entrada.hidden = true; entrada.classList.remove('se-va'); };
    if (sinMovimiento()) cerrar();
    else {
      entrada.classList.add('se-va');
      setTimeout(cerrar, 760);
    }
    SIEMPRE.mosaico.verTodo(false);
    if (!desdeHistorial) Historia.entrar('mosaico');
    setTimeout(() => indicacion.classList.add('callada'), 7000);
  }

  /** Volver a leer la carta desde el mosaico. */
  function aLaCarta(desdeHistorial = false) {
    cerrarLista();
    SIEMPRE.album.cerrar();
    cierre.hidden = true;
    document.body.classList.remove('con-cierre');
    sobreAbierto = true;
    sobreEscena.hidden = true;
    cartaEntrada.hidden = false;
    entrada.hidden = false;
    entrada.classList.remove('se-va');
    entrada.scrollTop = 0;
    cartaEntrada.focus({ preventScroll: true });
    if (!desdeHistorial) Historia.reemplazar('carta');
  }

  document.getElementById('verRegalo').addEventListener('click', () => alMosaico());
  btnCarta.addEventListener('click', () => aLaCarta());

  /* ── Etapas ── */
  let camaraGuardada = null;

  function abrirEtapa(etapaId, desdeHistorial = false) {
    if (!SIEMPRE.etapa(etapaId)) return;
    if (!SIEMPRE.album.etapa()) camaraGuardada = SIEMPRE.mosaico.camara();
    cerrarLista();
    entrada.hidden = true;
    cierre.hidden = true;
    document.body.classList.remove('con-cierre');
    SIEMPRE.album.abrir(etapaId, {
      volver: () => volverAlMosaico(),
      irA: (id) => abrirEtapa(id),
      cierre: mostrarCierre,
    });
    if (!desdeHistorial) Historia.entrar('album', { etapa: etapaId });
  }

  function volverAlMosaico(desdeHistorial = false) {
    if (SIEMPRE.visor.abierto()) SIEMPRE.visor.cerrar();
    SIEMPRE.album.cerrar();
    entrada.hidden = true;
    cierre.hidden = true;
    document.body.classList.remove('con-cierre');
    SIEMPRE.mosaico.ponCamara(camaraGuardada);
    if (!desdeHistorial) Historia.reemplazar('mosaico');
  }

  function mostrarCierre() {
    SIEMPRE.album.cerrar();
    cierre.hidden = false;
    document.body.classList.add('con-cierre');
    cierre.focus({ preventScroll: true });
    Historia.entrar('cierre');
  }

  window.addEventListener('popstate', (ev) => {
    if (SIEMPRE.visor.abierto()) { SIEMPRE.visor.cerrar(); return; }
    const v = ev.state?.vista;
    if (v === 'album' && ev.state.etapa) abrirEtapa(ev.state.etapa, true);
    else if (v === 'carta') aLaCarta(true);
    else volverAlMosaico(true);
  });

  /* ── Mosaico ── */
  await SIEMPRE.mosaico.iniciar({
    alEntrar: (id) => abrirEtapa(id),
    alAbrirFoto: (etapaId, fotoId) => {
      const fotos = SIEMPRE.fotosDe(etapaId).map((f) => f.id);
      if (fotos.includes(fotoId)) SIEMPRE.visor.abrir(fotos, fotoId, null, () => {});
    },
  });

  /* ── Controles ── */
  document.getElementById('btnAcercar').addEventListener('click', () => SIEMPRE.mosaico.acercar());
  document.getElementById('btnAlejar').addEventListener('click', () => SIEMPRE.mosaico.alejar());
  document.getElementById('btnVerTodo').addEventListener('click', () => { cerrarLista(); SIEMPRE.mosaico.verTodo(); });

  function cerrarLista() { lista.hidden = true; btnEtapas.setAttribute('aria-expanded', 'false'); }
  btnEtapas.addEventListener('click', (ev) => {
    ev.stopPropagation();
    const abierta = !lista.hidden;
    lista.hidden = abierta;
    btnEtapas.setAttribute('aria-expanded', String(!abierta));
    if (!abierta) lista.querySelector('button')?.focus();
  });
  document.addEventListener('click', (ev) => {
    if (!lista.hidden && !lista.contains(ev.target) && ev.target !== btnEtapas) cerrarLista();
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && !lista.hidden) { cerrarLista(); btnEtapas.focus(); }
  });

  // Las siete etapas, accesibles sin depender del zoom.
  SIEMPRE.etapas().forEach((e) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    const letra = document.createElement('span');
    letra.className = 'letra-mini';
    letra.textContent = e.letra;
    const rot = document.createElement('span');
    rot.className = 'rotulo-mini';
    rot.textContent = SIEMPRE.rotulo(e) || SIEMPRE.numero(e);
    if (SIEMPRE.rotulo(e)) {
      const sub = document.createElement('span');
      sub.textContent = ` · ${SIEMPRE.numero(e)}`;
      rot.appendChild(sub);
    }
    b.append(letra, rot);
    b.addEventListener('click', () => abrirEtapa(e.id));
    li.appendChild(b);
    listaUl.appendChild(li);
  });

  document.getElementById('cierreVolver').addEventListener('click', () => volverAlMosaico());

  // Una dirección con etapa (#etapa-03) entra directamente a esa etapa.
  const inicial = location.hash.replace('#', '');
  if (SIEMPRE.etapa(inicial)) { entrada.hidden = true; abrirEtapa(inicial, true); }
  else if (inicial === 'mosaico') { entrada.hidden = true; }
})();
