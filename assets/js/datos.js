/* ─────────────────────────────────────────────
   Carga y acceso al contenido.
   Todo lo editable vive en contenido/etapas.json.
   ───────────────────────────────────────────── */
const SIEMPRE = {
  cfg: null,
  fotos: null,
  mosaicoDatos: null,
  textos: Object.create(null),
  avisos: [],

  async cargar() {
    const pide = async (ruta) => {
      const r = await fetch(ruta, { cache: 'no-cache' });
      if (!r.ok) throw new Error(`No se pudo leer ${ruta} (${r.status})`);
      return r.json();
    };
    [this.cfg, this.fotos, this.mosaicoDatos] = await Promise.all([
      pide('contenido/etapas.json'),
      pide('datos/fotos.json'),
      pide('datos/mosaico.json'),
    ]);
    this.aplicarPaleta();
  },

  aplicarPaleta() {
    const a = this.cfg.aspecto || {};
    const raiz = document.documentElement.style;
    const mapa = {
      fondo: '--fondo', fondoHondo: '--fondo-hondo', tinta: '--tinta',
      tintaSuave: '--tinta-suave', acento: '--acento', acentoSuave: '--acento-suave',
      tipografiaTitulos: '--tipo-titulo', tipografiaTexto: '--tipo-texto',
    };
    for (const [clave, variable] of Object.entries(mapa)) {
      if (a[clave]) raiz.setProperty(variable, a[clave]);
    }
    raiz.setProperty('--velo', String(a.veloColorLejos || 0));
  },

  /* ── Etapas ── */
  etapas() { return this.cfg.etapas.slice().sort((x, y) => x.orden - y.orden); },
  etapa(id) { return this.cfg.etapas.find((e) => e.id === id) || null; },
  siguiente(id) {
    const lista = this.etapas();
    const i = lista.findIndex((e) => e.id === id);
    return i >= 0 && i < lista.length - 1 ? lista[i + 1] : null;
  },
  /** Nombre visible de una etapa: "Etapa 3" mientras no le pongas nombre. */
  rotulo(e) { return e.nombre?.trim() || ''; },
  numero(e) { return `Etapa ${e.orden}`; },

  /* ── Fotografías ── */
  fotosDe(id) { return this.fotos.etapas[id] || []; },
  foto(fotoId) {
    const etapaId = fotoId.slice(0, 8);
    return this.fotosDe(etapaId).find((f) => f.id === fotoId) || null;
  },
  rutaMicro(fotoId) { return `medios/${fotoId.slice(0, 8)}/micro/${fotoId}.jpg`; },
  rutaMini(fotoId) { return `medios/${fotoId.slice(0, 8)}/mini/${fotoId}.jpg`; },
  rutaGrande(fotoId) { return `medios/${fotoId.slice(0, 8)}/grande/${fotoId}.jpg`; },
  /** Nivel intermedio para la galería; si la foto era pequeña, no existe. */
  rutaMedio(f) {
    const obj = typeof f === 'string' ? this.foto(f) : f;
    if (!obj) return '';
    return obj.medio
      ? `medios/${obj.id.slice(0, 8)}/medio/${obj.id}.jpg`
      : this.rutaGrande(obj.id);
  },

  /* ── Cartas ── */
  async carta(id) {
    if (id in this.textos) return this.textos[id];
    let texto = null;
    try {
      const r = await fetch(`contenido/textos/${id}.txt`, { cache: 'no-cache' });
      if (r.ok) {
        const t = (await r.text()).trim();
        texto = t.length ? t : null;
      }
    } catch { /* sin carta todavía: la etapa sigue funcionando */ }
    this.textos[id] = texto;
    return texto;
  },

  /* ── Música ── */
  cancion(id) {
    const e = this.etapa(id);
    if (!e || !e.cancion) return null;
    const c = e.cancion;
    const tieneFuente = (c.youtube && c.youtube.trim()) || (c.archivo && c.archivo.trim());
    return tieneFuente ? c : null;
  },
};
