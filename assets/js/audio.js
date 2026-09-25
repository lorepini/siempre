/* ─────────────────────────────────────────────
   Música por etapa.

   Dos motores intercambiables:
     'youtube' → reproductor incrustado, para no subir archivos con copyright.
     'archivo' → mp3 locales en contenido/musica/.

   Reglas que cumple:
     · Sólo suena una etapa a la vez.
     · La reproducción nace siempre de un gesto de ella, nunca sola.
     · Si pausa, ni el zoom ni la navegación vuelven a encender el sonido.
     · Abrir fotos o cartas no reinicia la pista.
     · Si una etapa no tiene canción, la web sigue funcionando igual.
   ───────────────────────────────────────────── */
SIEMPRE.audio = (() => {
  let cfg = null;
  let motor = 'ninguno';
  let permitido = false;      // ella eligió "empezar con música"
  let pausadoPorElla = false; // pausa manual: manda sobre todo lo demás
  let etapaActual = null;
  let silenciado = false;
  let volumen = 0.55;

  let elemento = null;        // <audio> del motor de archivo
  let yt = null;              // reproductor de YouTube
  let ytListo = false;
  let ytPendiente = null;
  let temporizadorFundido = null;
  const oyentes = new Set();

  const avisa = () => oyentes.forEach((f) => f(estado()));

  function estado() {
    return {
      permitido, silenciado, volumen, etapa: etapaActual,
      pausada: pausadoPorElla || !sonando(),
      disponible: motor !== 'ninguno',
    };
  }

  function sonando() {
    if (motor === 'archivo') return elemento && !elemento.paused && !elemento.ended;
    if (motor === 'youtube') return yt && ytListo && yt.getPlayerState && yt.getPlayerState() === 1;
    return false;
  }

  /* ── Identificador de YouTube a partir de un enlace o del propio id ── */
  function idYoutube(valor) {
    const v = (valor || '').trim();
    if (!v) return null;
    if (/^[\w-]{11}$/.test(v)) return v;
    try {
      const u = new URL(v);
      if (u.hostname.includes('youtu.be')) return u.pathname.slice(1, 12) || null;
      if (u.searchParams.get('v')) return u.searchParams.get('v').slice(0, 11);
      const m = u.pathname.match(/\/(embed|shorts|live)\/([\w-]{11})/);
      if (m) return m[2];
    } catch { /* no era una URL */ }
    return null;
  }

  /* ── Arranque del motor de YouTube (sólo si hace falta de verdad) ── */
  function preparaYoutube() {
    if (yt || window.__cargandoYT) return;
    window.__cargandoYT = true;
    const guion = document.createElement('script');
    guion.src = 'https://www.youtube.com/iframe_api';
    window.onYouTubeIframeAPIReady = () => {
      yt = new YT.Player('reproductorAudio', {
        height: '0', width: '0',
        host: 'https://www.youtube-nocookie.com',
        playerVars: { autoplay: 0, controls: 0, disablekb: 1, playsinline: 1,
                      modestbranding: 1, rel: 0, origin: location.origin },
        events: {
          onReady: () => {
            ytListo = true;
            yt.setVolume(Math.round(volumen * 100));
            if (silenciado) yt.mute();
            if (ytPendiente) { const p = ytPendiente; ytPendiente = null; arrancaYT(p); }
            avisa();
          },
          onStateChange: (ev) => {
            if (ev.data === YT.PlayerState.ENDED && cfg.repetir) {
              yt.seekTo(0, true);
              yt.playVideo();            // repetir la misma: nunca salta sola a otra etapa
            }
            avisa();
          },
          onError: () => { SIEMPRE.avisos.push('Una canción de YouTube no se pudo reproducir.'); avisa(); },
        },
      });
    };
    document.head.appendChild(guion);
  }

  function arrancaYT(videoId) {
    if (!ytListo) { ytPendiente = videoId; return; }
    yt.loadVideoById(videoId);
    yt.setVolume(silenciado ? 0 : Math.round(volumen * 100));
    yt.playVideo();
  }

  /* ── Fundidos ── */
  function fundir(hacia, ms, alTerminar) {
    clearInterval(temporizadorFundido);
    const lee = () => (motor === 'archivo' ? (elemento ? elemento.volume : 0)
                                           : (yt && ytListo ? yt.getVolume() / 100 : 0));
    const pon = (v) => {
      if (motor === 'archivo' && elemento) elemento.volume = Math.max(0, Math.min(1, v));
      else if (motor === 'youtube' && yt && ytListo) yt.setVolume(Math.round(Math.max(0, Math.min(1, v)) * 100));
    };
    if (!ms || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      pon(hacia); alTerminar?.(); return;
    }
    const desde = lee();
    const t0 = performance.now();
    temporizadorFundido = setInterval(() => {
      const p = Math.min(1, (performance.now() - t0) / ms);
      pon(desde + (hacia - desde) * p);
      if (p >= 1) { clearInterval(temporizadorFundido); alTerminar?.(); }
    }, 40);
  }

  return {
    iniciar(configuracion, conMusica) {
      cfg = Object.assign({ motor: 'youtube', volumen: .55, repetir: true,
                            fundidoMs: 1200, arrancaEn: 'fotos' }, configuracion || {});
      volumen = cfg.volumen;
      permitido = !!conMusica;

      const hayYoutube = SIEMPRE.cfg.etapas.some((e) => idYoutube(e.cancion?.youtube));
      const hayArchivo = SIEMPRE.cfg.etapas.some((e) => (e.cancion?.archivo || '').trim());
      motor = cfg.motor === 'archivo' && hayArchivo ? 'archivo'
            : cfg.motor === 'youtube' && hayYoutube ? 'youtube'
            : hayArchivo ? 'archivo' : hayYoutube ? 'youtube' : 'ninguno';

      if (motor === 'archivo') {
        elemento = new Audio();
        elemento.preload = 'none';       // nada de cargar siete pistas al entrar
        elemento.loop = !!cfg.repetir;
        elemento.volume = volumen;
        elemento.addEventListener('play', avisa);
        elemento.addEventListener('pause', avisa);
        elemento.addEventListener('error', () => {
          SIEMPRE.avisos.push('No se pudo cargar una canción.'); avisa();
        });
      } else if (motor === 'youtube' && permitido) {
        preparaYoutube();               // sólo si ella pidió música
      }
      avisa();
    },

    /** Momento en que la música de una etapa debe empezar: 'mosaico' | 'album' | 'fotos'. */
    arrancaEn() { return cfg?.arrancaEn || 'fotos'; },
    motor() { return motor; },
    estado,
    escucha(f) { oyentes.add(f); f(estado()); return () => oyentes.delete(f); },

    /** Pone la etapa indicada. Si ya es la que suena, no reinicia nada. */
    pon(etapaId) {
      if (!permitido || motor === 'ninguno') { etapaActual = etapaId; avisa(); return; }
      if (etapaId === etapaActual && sonando()) return;

      const c = etapaId ? SIEMPRE.cancion(etapaId) : null;
      if (!c) {                                    // etapa sin canción: silencio limpio
        this.detener();
        etapaActual = etapaId;
        avisa();
        return;
      }
      if (etapaId === etapaActual && pausadoPorElla) return;  // respeta su pausa

      const cambia = etapaId !== etapaActual;
      etapaActual = etapaId;
      if (cambia) pausadoPorElla = false;

      const lanzar = () => {
        if (motor === 'archivo') {
          const ruta = `contenido/musica/${c.archivo}`;
          if (!elemento.src.endsWith(encodeURI(c.archivo))) { elemento.src = ruta; elemento.load(); }
          elemento.volume = 0;
          elemento.play().then(() => fundir(silenciado ? 0 : volumen, cfg.fundidoMs))
            .catch(() => { SIEMPRE.avisos.push('El navegador bloqueó la reproducción.'); avisa(); });
        } else {
          preparaYoutube();
          arrancaYT(idYoutube(c.youtube));
          fundir(silenciado ? 0 : volumen, cfg.fundidoMs);
        }
        avisa();
      };

      if (sonando() && cambia) fundir(0, cfg.fundidoMs * .6, lanzar);
      else lanzar();
    },

    alterna() {
      if (motor === 'ninguno') return;
      if (sonando()) {
        pausadoPorElla = true;
        fundir(0, 400, () => { motor === 'archivo' ? elemento.pause() : yt?.pauseVideo(); avisa(); });
      } else {
        permitido = true;
        pausadoPorElla = false;
        if (!etapaActual) { avisa(); return; }
        const c = SIEMPRE.cancion(etapaActual);
        if (!c) { avisa(); return; }
        if (motor === 'archivo' && elemento.src) {
          elemento.play().then(() => fundir(silenciado ? 0 : volumen, 500)).catch(() => {});
        } else if (motor === 'youtube' && yt && ytListo) {
          yt.playVideo(); fundir(silenciado ? 0 : volumen, 500);
        } else {
          const guarda = etapaActual; etapaActual = null; this.pon(guarda);
        }
        avisa();
      }
    },

    detener() {
      clearInterval(temporizadorFundido);
      if (motor === 'archivo' && elemento) { elemento.pause(); elemento.removeAttribute('src'); }
      if (motor === 'youtube' && yt && ytListo) yt.stopVideo();
      avisa();
    },

    silencia(valor) {
      silenciado = valor === undefined ? !silenciado : !!valor;
      if (motor === 'archivo' && elemento) elemento.muted = silenciado;
      else if (motor === 'youtube' && yt && ytListo) silenciado ? yt.mute() : yt.unMute();
      avisa();
    },

    volumen(v) {
      if (v === undefined) return volumen;
      volumen = Math.max(0, Math.min(1, v));
      if (motor === 'archivo' && elemento) elemento.volume = volumen;
      else if (motor === 'youtube' && yt && ytListo) yt.setVolume(Math.round(volumen * 100));
      avisa();
      return volumen;
    },

    permite(v) {
      permitido = !!v;
      if (permitido && motor === 'youtube') preparaYoutube();
      avisa();
    },
  };
})();
