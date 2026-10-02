/* ─────────────────────────────────────────────
   Carga y acceso al contenido.
   Todo lo editable vive en contenido/etapas.json.
   ───────────────────────────────────────────── */
const SIEMPRE = {
  cfg: null,
  fotos: null,
  mosaicoDatos: null,
  textos: Object.create(null),
  cartaPrincipal: null,
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
    this.cartaPrincipal = await this.leeTexto('contenido/carta.txt');
    this.aplicarPaleta();
  },

  /** Lee un archivo de texto. Devuelve null si no existe o está vacío. */
  async leeTexto(ruta) {
    try {
      const r = await fetch(ruta, { cache: 'no-cache' });
      if (!r.ok) return null;
      const t = (await r.text()).trim();
      return t.length ? t : null;
    } catch {
      return null;
    }
  },

  /** Convierte un texto en párrafos respetando sus saltos de línea. */
  pintaParrafos(destino, texto) {
    destino.textContent = '';
    const partes = texto.split(/\n{2,}/).map((x) => x.trim()).filter(Boolean);
    partes.forEach((parrafo, i) => {
      const p = document.createElement('p');
      parrafo.split('\n').forEach((linea, j) => {
        if (j) p.appendChild(document.createElement('br'));
        p.appendChild(document.createTextNode(linea));
      });
      // Un último párrafo corto se lee como una despedida.
      if (i === partes.length - 1 && partes.length > 1 && parrafo.length < 70) {
        p.classList.add('despedida');
      }
      destino.appendChild(p);
    });
    return partes.length;
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

  /* ── Cartas de cada etapa ──
     Son opcionales. Si no las usas, ni se buscan: así no queda un 404
     dando vueltas por la consola del navegador. */
  async carta(id) {
    if (!this.cfg.album?.cartasPorEtapa) return null;
    if (!(id in this.textos)) {
      this.textos[id] = await this.leeTexto(`contenido/textos/${id}.txt`);
    }
    return this.textos[id];
  },

};
