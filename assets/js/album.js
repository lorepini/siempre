/* ─────────────────────────────────────────────
   El álbum de una etapa: su carta, sus fotografías y su música.

   El álbum contiene TODAS las fotos de su carpeta, también las que no
   entraron en la letra. Nada se descarta por una segunda criba estética.
   ───────────────────────────────────────────── */
SIEMPRE.album = (() => {
  const caja = document.getElementById('album');
  const elLetra = document.getElementById('albumLetra');
  const elTitulo = document.getElementById('albumTitulo');
  const elFechas = document.getElementById('albumFechas');
  const galeria = document.getElementById('galeria');
  const carta = document.getElementById('carta');
  const cartaTitulo = document.getElementById('cartaTitulo');
  const cartaCuerpo = document.getElementById('cartaCuerpo');
  const cartaFirma = document.getElementById('cartaFirma');
  const cartaSeguir = document.getElementById('cartaSeguir');
  const btnSiguiente = document.getElementById('albumSiguiente');
  const btnIrCarta = document.getElementById('irCarta');
  const cajaMusica = document.getElementById('albumMusica');
  const musicaPlay = document.getElementById('musicaPlay');
  const musicaPista = document.getElementById('musicaPista');
  const musicaMute = document.getElementById('musicaMute');
  const musicaVolumen = document.getElementById('musicaVolumen');

  let etapaActual = null;
  let fotosActuales = [];
  let observador = null;
  let vigilanteMusica = null;
  let manejadores = {};

  const cartaAlPrincipio = () => (SIEMPRE.cfg.album?.cartaPosicion || 'inicio') !== 'final';

  /* ── Carta ── */
  function pintaCarta(etapa, texto) {
    cartaTitulo.textContent = SIEMPRE.cfg.album?.tituloCarta || 'Lo que quiero decirte de esta etapa';
    cartaCuerpo.textContent = '';
    if (texto) {
      // Respeta los párrafos y los saltos de línea tal y como los escribiste.
      texto.split(/\n{2,}/).forEach((parrafo) => {
        const p = document.createElement('p');
        parrafo.split('\n').forEach((linea, i) => {
          if (i) p.appendChild(document.createElement('br'));
          p.appendChild(document.createTextNode(linea));
        });
        cartaCuerpo.appendChild(p);
      });
    } else {
      const p = document.createElement('p');
      p.className = 'pendiente';
      p.textContent = `Carta pendiente de escribir — ${SIEMPRE.numero(etapa)}. `
        + `Cuando la guardes en contenido/textos/${etapa.id}.txt aparecerá aquí.`;
      cartaCuerpo.appendChild(p);
    }
    cartaFirma.textContent = SIEMPRE.cfg.proyecto?.firma || '';
  }

  /* ── Galería ── */
  function pintaGaleria(etapa) {
    galeria.textContent = '';
    observador?.disconnect();
    fotosActuales = SIEMPRE.fotosDe(etapa.id);

    if (!fotosActuales.length) {
      const vacio = document.createElement('p');
      vacio.className = 'pendiente';
      vacio.style.textAlign = 'center';
      vacio.textContent = 'Todavía no hay fotografías en esta etapa.';
      galeria.appendChild(vacio);
      return;
    }

    const frag = document.createDocumentFragment();
    fotosActuales.forEach((f, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'galeria__foto';
      b.dataset.foto = f.id;
      // Reservar la proporción evita que la página salte al cargar.
      b.style.aspectRatio = `${f.w} / ${f.h}`;
      b.setAttribute('aria-label', `Ver la fotografía ${i + 1} de ${fotosActuales.length}`);
      const img = document.createElement('img');
      img.alt = '';
      img.decoding = 'async';
      img.width = f.w; img.height = f.h;
      img.dataset.src = SIEMPRE.rutaMedio(f);
      b.appendChild(img);
      frag.appendChild(b);
    });
    galeria.appendChild(frag);

    observador = new IntersectionObserver((entradas) => {
      entradas.forEach((e) => {
        if (!e.isIntersecting) return;
        const img = e.target;
        observador.unobserve(img);
        if (!img.dataset.src) return;
        img.src = img.dataset.src;
        delete img.dataset.src;
        img.addEventListener('load', () => img.classList.add('puesta'), { once: true });
        img.addEventListener('error', () => img.classList.add('puesta'), { once: true });
      });
    }, { root: caja, rootMargin: '600px' });
    galeria.querySelectorAll('img').forEach((i) => observador.observe(i));
  }

  /* ── Música de la etapa ── */
  function preparaMusica(etapa) {
    const c = SIEMPRE.cancion(etapa.id);
    cajaMusica.hidden = !c;
    if (!c) return;
    const partes = [c.titulo, c.artista].filter(Boolean);
    musicaPista.textContent = partes.join(' · ');
    musicaPista.title = partes.join(' · ');

    vigilanteMusica?.();
    vigilanteMusica = SIEMPRE.audio.escucha((s) => {
      musicaPlay.textContent = s.pausada ? '▶' : '❚❚';
      musicaPlay.setAttribute('aria-label', s.pausada ? 'Reproducir' : 'Pausar');
      musicaMute.textContent = s.silenciado ? '🔇' : '🔊';
      musicaMute.setAttribute('aria-pressed', String(s.silenciado));
      if (document.activeElement !== musicaVolumen) musicaVolumen.value = Math.round(s.volumen * 100);
    });
  }

  /** La música arranca donde diga la configuración, siempre tras un gesto suyo. */
  function arrancaMusicaSiToca(momento) {
    if (!etapaActual) return;
    if (SIEMPRE.audio.arrancaEn() === momento) SIEMPRE.audio.pon(etapaActual.id);
  }

  function vigilarLlegadaALasFotos() {
    if (SIEMPRE.audio.arrancaEn() !== 'fotos') return;
    const centinela = galeria.firstElementChild;
    if (!centinela) return;
    const obs = new IntersectionObserver((entradas) => {
      if (entradas.some((e) => e.isIntersecting)) {
        obs.disconnect();
        arrancaMusicaSiToca('fotos');
      }
    }, { root: caja, threshold: .12 });
    obs.observe(centinela);
  }

  /* ── Apertura y cierre ── */
  async function abrir(etapaId, acciones) {
    const etapa = SIEMPRE.etapa(etapaId);
    if (!etapa) return;
    etapaActual = etapa;
    manejadores = acciones || {};

    elLetra.textContent = etapa.letra;
    elTitulo.textContent = SIEMPRE.rotulo(etapa) || SIEMPRE.numero(etapa);
    elFechas.textContent = (etapa.fechas || '').trim();

    // En la etapa 7 no hay una etapa 8. Si has escrito un texto de cierre,
    // ahí aparece la puerta al final del recorrido; si no, sólo se vuelve.
    const siguiente = SIEMPRE.siguiente(etapa.id);
    const cierre = SIEMPRE.cfg.proyecto?.cierre || {};
    const hayCierre = !!((cierre.titulo || '').trim() || (cierre.texto || '').trim());
    if (siguiente) {
      btnSiguiente.hidden = false;
      btnSiguiente.textContent = `Continuar a ${SIEMPRE.numero(siguiente)} →`;
      btnSiguiente.dataset.destino = siguiente.id;
    } else if (hayCierre) {
      btnSiguiente.hidden = false;
      btnSiguiente.textContent = 'Final del recorrido →';
      btnSiguiente.dataset.destino = '__cierre__';
    } else {
      btnSiguiente.hidden = true;
      delete btnSiguiente.dataset.destino;
    }

    // Orden de la página: carta y luego fotos, o al revés, según configuración.
    if (cartaAlPrincipio()) {
      caja.insertBefore(carta, galeria);
      cartaSeguir.hidden = false;
      btnIrCarta.hidden = true;
    } else {
      caja.insertBefore(galeria, carta);
      cartaSeguir.hidden = true;
      btnIrCarta.hidden = false;
    }

    pintaCarta(etapa, await SIEMPRE.carta(etapa.id));
    pintaGaleria(etapa);
    preparaMusica(etapa);

    caja.hidden = false;
    caja.scrollTop = 0;
    document.body.classList.add('con-album');
    caja.focus({ preventScroll: true });

    arrancaMusicaSiToca('album');
    vigilarLlegadaALasFotos();
  }

  function cerrar() {
    observador?.disconnect();
    vigilanteMusica?.();
    vigilanteMusica = null;
    caja.hidden = true;
    document.body.classList.remove('con-album');
    etapaActual = null;
  }

  /* ── Sucesos ── */
  galeria.addEventListener('click', (ev) => {
    const b = ev.target.closest('.galeria__foto');
    if (!b) return;
    const posicion = caja.scrollTop;
    SIEMPRE.visor.abrir(fotosActuales.map((f) => f.id), b.dataset.foto, b,
      () => { caja.scrollTop = posicion; });   // conserva la posición de lectura
  });

  cartaSeguir.addEventListener('click', () => {
    galeria.scrollIntoView({ behavior: 'smooth', block: 'start' });
    arrancaMusicaSiToca('fotos');
  });
  btnIrCarta.addEventListener('click', () => carta.scrollIntoView({ behavior: 'smooth', block: 'start' }));

  musicaPlay.addEventListener('click', () => {
    SIEMPRE.audio.permite(true);
    const s = SIEMPRE.audio.estado();
    if (s.pausada && s.etapa !== etapaActual?.id) SIEMPRE.audio.pon(etapaActual.id);
    else SIEMPRE.audio.alterna();
  });
  musicaMute.addEventListener('click', () => SIEMPRE.audio.silencia());
  musicaVolumen.addEventListener('input', () => SIEMPRE.audio.volumen(musicaVolumen.value / 100));

  btnSiguiente.addEventListener('click', () => {
    const destino = btnSiguiente.dataset.destino;
    if (destino === '__cierre__') manejadores.cierre?.();
    else if (destino) manejadores.irA?.(destino);
  });
  document.getElementById('albumVolver').addEventListener('click', () => manejadores.volver?.());
  document.getElementById('albumMosaico').addEventListener('click', () => manejadores.volver?.());

  return { abrir, cerrar, etapa: () => etapaActual };
})();
