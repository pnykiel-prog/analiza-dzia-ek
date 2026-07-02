// <grunt-map> — schematic GIS-style parcel map. Plain custom element.
// attrs: mode = ok|notfound|nonadjacent ; layers = JSON {parcel,env,iso_m,iso_s,plan} ; view = start|level2
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const C = {
    bg: '#EFF2F6', water: '#DCE7EE', block: '#E4E9EF', blockStroke: '#D5DCE5',
    green: '#E4E9EF', road: '#FFFFFF', roadEdge: '#D5DCE5', roadMajor: '#FBFCFD',
    ink: '#16263F', parcel: '#16263F', parcelFill: 'rgba(22,38,63,.10)',
    young: '#0E7C8B', senior: '#7A4A86', envGreen: '#1C8A5A',
    red: '#C0392B', amber: '#B5790B', muted: '#6B7A92',
  };

  class GruntMap extends HTMLElement {
    static get observedAttributes() { return ['mode', 'layers', 'view', 'shape']; }
    connectedCallback() { this.render(); }
    attributeChangedCallback() { if (this.isConnected) this.render(); }

    get layers() {
      try { return JSON.parse(this.getAttribute('layers') || '{}'); }
      catch (e) { return {}; }
    }

    render() {
      const mode = this.getAttribute('mode') || 'ok';
      const view = this.getAttribute('view') || 'start';
      const shape = (this.getAttribute('shape') || '').trim(); // realny kontur działki (punkty SVG)
      const L = this.layers;
      const W = 600, H = 420;
      let svg = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" style="display:block;font-family:'IBM Plex Mono',monospace">`;

      // defs
      svg += `<defs>
        <pattern id="gm-hatch" width="7" height="7" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="7" stroke="${C.envGreen}" stroke-width="1.1" opacity=".5"/>
        </pattern>
        <pattern id="gm-plan" width="9" height="9" patternTransform="rotate(0)" patternUnits="userSpaceOnUse">
          <rect width="9" height="9" fill="none"/>
          <circle cx="2" cy="2" r="1" fill="${C.muted}" opacity=".55"/>
        </pattern>
        <radialGradient id="gm-isoM" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="${C.young}" stop-opacity=".02"/>
          <stop offset="100%" stop-color="${C.young}" stop-opacity=".14"/>
        </radialGradient>
        <radialGradient id="gm-isoS" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="${C.senior}" stop-opacity=".02"/>
          <stop offset="100%" stop-color="${C.senior}" stop-opacity=".14"/>
        </radialGradient>
      </defs>`;

      // base
      svg += `<rect width="${W}" height="${H}" fill="${C.bg}"/>`;

      if (mode === 'notfound') {
        svg += this.notFound(W, H);
        svg += `</svg>`;
        this.innerHTML = svg;
        return;
      }

      // surrounding city blocks (deterministic)
      const blocks = [
        [40, 40, 120, 90], [180, 40, 150, 70], [350, 30, 110, 80], [480, 50, 90, 110],
        [40, 160, 90, 120], [40, 300, 130, 80], [470, 200, 100, 90], [490, 310, 80, 70],
        [200, 320, 120, 70], [350, 330, 90, 60],
      ];
      blocks.forEach(b => {
        svg += `<rect x="${b[0]}" y="${b[1]}" width="${b[2]}" height="${b[3]}" rx="3" fill="${C.block}" stroke="${C.blockStroke}" stroke-width="1"/>`;
      });
      // a green/park patch
      svg += `<rect x="350" y="200" width="95" height="95" rx="4" fill="#E3ECE4" stroke="#D2E0D4" stroke-width="1"/>`;
      svg += `<text x="397" y="252" fill="#9FB3A2" font-size="9" text-anchor="middle">park</text>`;
      // water sliver
      svg += `<path d="M0,395 C120,380 200,408 320,392 C440,376 540,402 600,388 L600,420 L0,420 Z" fill="${C.water}" opacity=".8"/>`;

      // roads
      const roads = [
        { x1: 170, y1: 0, x2: 170, y2: 420, w: 14, major: true },
        { x1: 460, y1: 0, x2: 460, y2: 420, w: 10, major: false },
        { x1: 0, y1: 145, x2: 600, y2: 150, w: 14, major: true },
        { x1: 0, y1: 295, x2: 600, y2: 300, w: 10, major: false },
      ];
      roads.forEach(r => {
        svg += `<line x1="${r.x1}" y1="${r.y1}" x2="${r.x2}" y2="${r.y2}" stroke="${C.roadEdge}" stroke-width="${r.w + 2}"/>`;
        svg += `<line x1="${r.x1}" y1="${r.y1}" x2="${r.x2}" y2="${r.y2}" stroke="${C.road}" stroke-width="${r.w}"/>`;
      });
      // road label
      svg += `<text x="178" y="200" fill="${C.muted}" font-size="9" opacity=".7" transform="rotate(90 178 200)">ul. Kwiatowa</text>`;

      // isochrone overlays (under parcel)
      const px = 250, py = 215; // parcel centroid
      if (view === 'level2' && L.iso_s) {
        [120, 80, 45].forEach(r => { svg += `<circle cx="${px}" cy="${py}" r="${r}" fill="url(#gm-isoS)" stroke="${C.senior}" stroke-width="1" stroke-dasharray="3 3" opacity=".7"/>`; });
      }
      if (view === 'level2' && L.iso_m) {
        [150, 100, 55].forEach(r => { svg += `<circle cx="${px}" cy="${py}" r="${r}" fill="url(#gm-isoM)" stroke="${C.young}" stroke-width="1" stroke-dasharray="3 3" opacity=".7"/>`; });
      }
      // environment overlay
      if (view === 'level2' && L.env) {
        svg += `<path d="M300,150 L420,150 L440,250 L360,300 L300,260 Z" fill="url(#gm-hatch)" stroke="${C.envGreen}" stroke-width="1.2" stroke-dasharray="4 3" opacity=".85"/>`;
        svg += `<text x="372" y="210" fill="${C.envGreen}" font-size="8.5" opacity=".9">Natura 2000</text>`;
      }
      // planning overlay (white-plama)
      if (view === 'level2' && L.plan) {
        svg += `<rect x="185" y="160" width="130" height="120" fill="url(#gm-plan)" stroke="${C.muted}" stroke-width="1.2" stroke-dasharray="5 4"/>`;
        svg += `<text x="250" y="155" fill="${C.muted}" font-size="8.5" text-anchor="middle">brak MPZP — biała plama</text>`;
      }

      // the parcel(s)
      if (mode === 'nonadjacent') {
        // two separate parcels with a gap
        svg += this.poly('195,175 250,168 262,232 205,243', C.parcel, C.parcelFill, false);
        svg += this.poly('300,250 360,258 352,312 296,300', C.parcel, C.parcelFill, false);
        // gap highlight
        svg += `<line x1="258" y1="225" x2="305" y2="258" stroke="${C.red}" stroke-width="2.5" stroke-dasharray="5 4"/>`;
        svg += `<circle cx="282" cy="242" r="13" fill="${C.red}" opacity=".12"/>`;
        svg += `<text x="282" y="246" fill="${C.red}" font-size="13" font-weight="700" text-anchor="middle">!</text>`;
        svg += `<text x="282" y="335" fill="${C.red}" font-size="9.5" text-anchor="middle" font-weight="600">przerwa ≈140 m</text>`;
        svg += `<text x="222" y="160" fill="${C.ink}" font-size="9">142/7</text>`;
        svg += `<text x="322" y="330" fill="${C.ink}" font-size="9">151/5</text>`;
      } else if (shape) {
        // REALNY kontur działki z geometrii ULDK (punkty SVG przekazane w atrybucie `shape`).
        svg += this.poly(shape, C.parcel, C.parcelFill, true);
        // wierzchołki
        shape.split(' ').forEach(p => {
          const [x, y] = p.split(',');
          if (x && y) svg += `<circle cx="${x}" cy="${y}" r="2.4" fill="#fff" stroke="${C.parcel}" stroke-width="1.3"/>`;
        });
        // etykieta nad górnym wierzchołkiem
        const ys = shape.split(' ').map(p => parseFloat(p.split(',')[1])).filter(v => !isNaN(v));
        const topY = ys.length ? Math.min(...ys) : 160;
        svg += `<text x="250" y="${(topY - 8).toFixed(0)}" fill="${C.ink}" font-size="9.5" font-weight="600" text-anchor="middle">Teren inwestycji</text>`;
        if (view === 'level2') {
          svg += this.pin(305, 150, C.young, 'P');
          svg += this.pin(150, 290, C.young, 'S');
          svg += this.pin(420, 250, C.senior, '+');
        }
      } else {
        // merged parcel (ok) — schemat, gdy brak realnej geometrii
        const pts = '188,168 252,160 268,196 262,238 205,250 182,212';
        svg += this.poly(pts, C.parcel, C.parcelFill, true);
        // internal division line (the two original parcels)
        svg += `<line x1="225" y1="164" x2="218" y2="246" stroke="${C.parcel}" stroke-width="1" stroke-dasharray="3 3" opacity=".5"/>`;
        // vertices
        '188,168 252,160 268,196 262,238 205,250 182,212'.split(' ').forEach(p => {
          const [x, y] = p.split(',');
          svg += `<circle cx="${x}" cy="${y}" r="2.6" fill="#fff" stroke="${C.parcel}" stroke-width="1.4"/>`;
        });
        svg += `<text x="205" y="148" fill="${C.ink}" font-size="9.5" font-weight="600">Teren inwestycji</text>`;
        svg += `<text x="200" y="206" fill="${C.ink}" font-size="8.5" opacity=".6">142/7</text>`;
        svg += `<text x="235" y="226" fill="${C.ink}" font-size="8.5" opacity=".6">142/8</text>`;
        // amenity pins for level2
        if (view === 'level2') {
          svg += this.pin(305, 150, C.young, 'P');   // przystanek
          svg += this.pin(150, 290, C.young, 'S');   // szkoła
          svg += this.pin(420, 250, C.senior, '+');  // przychodnia
        }
      }

      // chrome: north + scale + grid ticks
      svg += `<g opacity=".9"><circle cx="565" cy="38" r="15" fill="#fff" stroke="${C.blockStroke}" stroke-width="1"/><path d="M565,27 L569,41 L565,38 L561,41 Z" fill="${C.ink}"/><text x="565" y="58" fill="${C.muted}" font-size="8" text-anchor="middle">N</text></g>`;
      svg += `<g><rect x="24" y="392" width="60" height="4" fill="${C.ink}" opacity=".7"/><rect x="24" y="392" width="30" height="4" fill="#fff" stroke="${C.ink}" stroke-width=".6" opacity=".7"/><text x="24" y="386" fill="${C.muted}" font-size="8">0      100 m</text></g>`;

      svg += `</svg>`;
      this.innerHTML = svg;
    }

    poly(pts, stroke, fill, glow) {
      let s = '';
      if (glow) s += `<polygon points="${pts}" fill="none" stroke="${stroke}" stroke-width="7" opacity=".10"/>`;
      s += `<polygon points="${pts}" fill="${fill}" stroke="${stroke}" stroke-width="2.2" stroke-linejoin="round"/>`;
      return s;
    }
    pin(x, y, color, ch) {
      return `<g><circle cx="${x}" cy="${y}" r="9" fill="#fff" stroke="${color}" stroke-width="1.6"/><text x="${x}" y="${y + 3.5}" fill="${color}" font-size="9" font-weight="700" text-anchor="middle">${ch}</text></g>`;
    }
    notFound(W, H) {
      let s = `<rect width="${W}" height="${H}" fill="${C.bg}"/>`;
      // faint grid
      for (let x = 0; x < W; x += 40) s += `<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="#E2E7ED" stroke-width="1"/>`;
      for (let y = 0; y < H; y += 40) s += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="#E2E7ED" stroke-width="1"/>`;
      s += `<g transform="translate(300,200)">
        <circle cx="-10" cy="-10" r="34" fill="none" stroke="${C.muted}" stroke-width="3" opacity=".5"/>
        <line x1="14" y1="14" x2="38" y2="38" stroke="${C.muted}" stroke-width="3" stroke-linecap="round" opacity=".5"/>
        <text x="-2" y="76" fill="${C.muted}" font-size="11" text-anchor="middle" font-family="'IBM Plex Sans',sans-serif">Brak geometrii w rejestrze ULDK</text>
      </g>`;
      return s;
    }
  }
  if (!customElements.get('grunt-map')) customElements.define('grunt-map', GruntMap);
})();
