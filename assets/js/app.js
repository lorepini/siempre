/* ─────────────────────────────────────────────
   Montaje: une el mosaico, los álbumes, el visor y la música,
   y hace que el botón Atrás del navegador se comporte como ella espera.
   ───────────────────────────────────────────── */
(async () => {
  const puerta = document.getElementById('puerta');
  const escena = document.getElementById('escena');
  const indicacion = document.getElementById('indicacion');
  const btnSonido = document.getElementById('btnSonido');
  const btnEtapas = document.getElementById('btnEtapas');
  const lista = document.getElementById('listaEtapas');
  const listaUl = document.getElementById('listaEtapasUl');
  const cierre = document.getElementById('cierre');

  try {
    await SIEMPRE.cargar();
  } catch (e) {
    puerta.innerHTML = '<div class="puerta__caja"><p class="puerta__frase">No se pudo cargar el contenido</p>'
      + `<p class="puerta__intro">${e.message}</p></div>`;
    return;
  }

  /* ── Textos de la portada ── */
  const P = SIEMPRE.cfg.proyecto || {};
  document.getElementById('puertaFrase').textContent = P.portada?.frase || 'SIEMPRE';
  document.getElementById('puertaIntro').textContent = P.portada?.textoIntro || '';
  document.getElementById('puertaIndicacion').textContent = P.portada?.indicacion || '';
  indicacion.textContent = P.portada?.indicacion || '';
  document.getElementById('cierreTitulo').textContent = P.cierre?.titulo || '';
  document.getElementById('cierreTexto').textContent = P.cierre?.texto || '';
  if (P.destinataria?.mostrar !== 'ninguno') {
    const quien = P.destinataria?.[P.destinataria?.mostrar === 'nombre' ? 'nombre' : 'apodo'];
    if (quien) document.title = `SIEMPRE · para ${quien}`;
  }

  /* ── Historial: Atrás cierra lo que esté encima, no toda la experiencia ── */
  const Historia = {
    entrar(vista, datos) {
      history.pushState({ vista, ...datos }, '', vista === 'album' ? `#${datos.etapa}` : '#');
    },
    reemplazar(vista) { history.replaceState({ vista }, '', '#'); },
  };
  Historia.reemplazar('mosaico');

  /* ── Navegación ── */
  let camaraGuardada = null;

  function abrirEtapa(etapaId, desdeHistorial = false) {
    if (!SIEMPRE.etapa(etapaId)) return;
    if (!SIEMPRE.album.etapa()) camaraGuardada = SIEMPRE.mosaico.camara();
    cerrarLista();
    cierre.hidden = true;
    document.body.classList.remove('con-cierre');
    SIEMPRE.album.abrir(etapaId, {
      volver: volverAlMosaico,
      irA: (id) => abrirEtapa(id),
      cierre: mostrarCierre,
    });
    if (!desdeHistorial) Historia.entrar('album', { etapa: etapaId });
  }

  function volverAlMosaico(desdeHistorial = false) {
    if (SIEMPRE.visor.abierto()) SIEMPRE.visor.cerrar();
    SIEMPRE.album.cerrar();
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
    Historia.entrar('cierre', {});
  }

  window.addEventListener('popstate', (ev) => {
    const v = ev.state?.vista;
    if (SIEMPRE.visor.abierto()) { SIEMPRE.visor.cerrar(); return; }
    if (v === 'album' && ev.state.etapa) abrirEtapa(ev.state.etapa, true);
    else volverAlMosaico(true);
  });

  /* ── Mosaico ── */
  await SIEMPRE.mosaico.iniciar({
    alEntrar: (id) => abrirEtapa(id),
    alAbrirFoto: (etapaId, fotoId) => {
      const fotos = SIEMPRE.fotosDe(etapaId).map((f) => f.id);
      if (!fotos.includes(fotoId)) return;
      SIEMPRE.visor.abrir(fotos, fotoId, null, () => {});
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

  // Lista de las siete etapas: acceso sin depender del zoom.
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

  /* ── Sonido ── */
  function pintaBotonSonido(s) {
    const encendido = s.permitido && !s.silenciado && s.disponible;
    btnSonido.setAttribute('aria-pressed', String(encendido));
    btnSonido.textContent = '♪';
    btnSonido.setAttribute('aria-label',
      !s.disponible ? 'Todavía no hay música configurada'
                    : encendido ? 'Silenciar la música' : 'Activar la música');
    btnSonido.disabled = !s.disponible;
  }
  btnSonido.addEventListener('click', () => {
    const s = SIEMPRE.audio.estado();
    if (!s.permitido) SIEMPRE.audio.permite(true);
    else SIEMPRE.audio.silencia();
  });

  /* ── Puerta de entrada ── */
  function entrar(conMusica) {
    SIEMPRE.audio.iniciar(SIEMPRE.cfg.audio, conMusica);
    SIEMPRE.audio.escucha(pintaBotonSonido);
    puerta.classList.add('se-va');
    setTimeout(() => { puerta.hidden = true; }, 700);
    escena.focus?.();
    setTimeout(() => indicacion.classList.add('callada'), 6000);
  }
  document.getElementById('btnConMusica').addEventListener('click', () => entrar(true));
  document.getElementById('btnSinMusica').addEventListener('click', () => entrar(false));
  document.getElementById('cierreVolver').addEventListener('click', () => volverAlMosaico());

  // Si la dirección ya trae una etapa (#etapa-03), se abre al entrar.
  const inicial = location.hash.replace('#', '');
  if (SIEMPRE.etapa(inicial)) {
    puerta.addEventListener('transitionend', () => abrirEtapa(inicial), { once: true });
  }
})();
