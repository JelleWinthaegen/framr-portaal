/* De PDF-bouwer van het Framr.one Portaal.

   Een op een overgenomen uit het Oaklyn-portaal (shopify-themes/oaklyn/snippets/
   oaklyn-pdf.liquid): opslaan als PDF is een echte knop en geen printvenster. De bouwer
   krijgt een beschrijving van het document en levert bytes, zonder bibliotheek van buiten.

   De harde eis waar alles op rust: in het bestand staat geen inkoopprijs en geen marge,
   ook niet als verborgen gegeven. Deze bouwer weet niet wat inkoop is; de aanroeper geeft
   uitsluitend het klantvel door. Wat er niet in gaat kan er niet uit lekken.

   Het bestand is een PDF 1.4 met Helvetica en Helvetica vet, zonder compressie, met
   WinAnsi-codering. Bewust simpel: een offerte is tekst met lijnen eromheen. */

const A4 = { breedte: 595.28, hoogte: 841.89 };
const KANT = { links: 48, rechts: 48, boven: 52, onder: 56 };
const BREED = A4.breedte - KANT.links - KANT.rechts;

/* Letterbreedtes in duizendsten van de tekengrootte, codes 32 tot en met 126. Zonder deze
   tabel kan er niets rechts uitgelijnd worden. */
const BREEDTE_GEWOON = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
const BREEDTE_DIK = [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584];

/* Van Unicode naar WinAnsi; het euroteken is de belangrijkste vertaling. */
const WINANSI = {
  0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84, 0x2026: 0x85, 0x2020: 0x86,
  0x2021: 0x87, 0x02C6: 0x88, 0x2030: 0x89, 0x0160: 0x8A, 0x2039: 0x8B, 0x0152: 0x8C,
  0x017D: 0x8E, 0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95,
  0x2013: 0x96, 0x2014: 0x97, 0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B,
  0x0153: 0x9C, 0x017E: 0x9E, 0x0178: 0x9F,
};

function naarWinAnsi(tekst) {
  const uit = [];
  const bron = String(tekst == null ? '' : tekst);
  for (let i = 0; i < bron.length; i += 1) {
    const code = bron.charCodeAt(i);
    if (code === 0x2192) { uit.push(0x2D, 0x3E); continue; }
    if (WINANSI[code] !== undefined) uit.push(WINANSI[code]);
    else if (code <= 0xFF) uit.push(code);
    else uit.push(0x3F);
  }
  return uit;
}

function breedte(tekst, grootte, dik) {
  const tabel = dik ? BREEDTE_DIK : BREEDTE_GEWOON;
  let som = 0;
  for (const c of naarWinAnsi(tekst)) som += (c >= 32 && c <= 126) ? tabel[c - 32] : 556;
  return som * grootte / 1000;
}

function kap(tekst, maxBreedte, grootte, dik) {
  if (breedte(tekst, grootte, dik) <= maxBreedte) return String(tekst == null ? '' : tekst);
  let uit = String(tekst);
  while (uit.length > 1 && breedte(uit + '...', grootte, dik) > maxBreedte) uit = uit.slice(0, -1);
  return uit + '...';
}

function verdeel(tekst, maxBreedte, grootte, dik) {
  const woorden = String(tekst == null ? '' : tekst).split(/\s+/).filter(Boolean);
  const regels = [];
  let huidig = '';
  woorden.forEach((woord) => {
    const poging = huidig ? huidig + ' ' + woord : woord;
    if (breedte(poging, grootte, dik) > maxBreedte && huidig) { regels.push(huidig); huidig = woord; }
    else huidig = poging;
  });
  if (huidig) regels.push(huidig);
  return regels.length ? regels : [''];
}

function ontsnap(tekst) {
  let uit = '';
  for (const c of naarWinAnsi(tekst)) {
    if (c === 0x28 || c === 0x29 || c === 0x5C) uit += '\\';
    uit += String.fromCharCode(c);
  }
  return uit;
}

const rond = (n) => Math.round(n * 100) / 100;

function nieuwePagina() {
  return { opdrachten: [], y: A4.hoogte - KANT.boven, plaatjes: [] };
}

function schrijf(pg, tekst, x, y, grootte, dik, grijs) {
  if (tekst === '' || tekst === null || tekst === undefined) return;
  pg.opdrachten.push('BT /' + (dik ? 'F2' : 'F1') + ' ' + grootte + ' Tf '
    + (grijs ? rond(grijs) + ' ' + rond(grijs) + ' ' + rond(grijs) + ' rg ' : '0 0 0 rg ')
    + rond(x) + ' ' + rond(y) + ' Td (' + ontsnap(tekst) + ') Tj ET');
}

function schrijfRechts(pg, tekst, rechterKant, y, grootte, dik, grijs) {
  schrijf(pg, tekst, rechterKant - breedte(tekst, grootte, dik), y, grootte, dik, grijs);
}

function lijn(pg, x1, y, x2, dikte, grijs) {
  pg.opdrachten.push(rond(grijs === undefined ? 0.75 : grijs) + ' G ' + (dikte || 0.5) + ' w '
    + rond(x1) + ' ' + rond(y) + ' m ' + rond(x2) + ' ' + rond(y) + ' l S');
}

function vlak(pg, x, y, b, h, grijs) {
  pg.opdrachten.push(rond(grijs) + ' ' + rond(grijs) + ' ' + rond(grijs) + ' rg '
    + rond(x) + ' ' + rond(y) + ' ' + rond(b) + ' ' + rond(h) + ' re f');
}

function kader(pg, x, y, b, h, grijs) {
  pg.opdrachten.push(rond(grijs === undefined ? 0.75 : grijs) + ' G 0.6 w '
    + rond(x) + ' ' + rond(y) + ' ' + rond(b) + ' ' + rond(h) + ' re S');
}

const TEKENAARS = {
  kop(el, h) {
    const p = h.pg();
    const boven = p.y;
    let linksOnder = boven;
    if (el.logo && el.logo.bytes && el.logo.breedte > 0) {
      const schaal = Math.min(150 / el.logo.breedte, 42 / el.logo.hoogte);
      const b = el.logo.breedte * schaal;
      const hh = el.logo.hoogte * schaal;
      const naam = 'Im' + (h.plaatjes.length + 1);
      h.plaatjes.push({ naam, plaatje: el.logo });
      p.plaatjes.push(naam);
      p.opdrachten.push('q ' + rond(b) + ' 0 0 ' + rond(hh) + ' ' + rond(KANT.links)
        + ' ' + rond(boven - hh) + ' cm /' + naam + ' Do Q');
      linksOnder = boven - hh - 10;
    }
    schrijf(p, el.bedrijfsnaam || '', KANT.links, linksOnder - 15, 15, true);
    linksOnder = linksOnder - 15 - 4;
    let rechtsY = boven - 9;
    (el.rechts || []).forEach((regel) => {
      if (!regel) return;
      schrijfRechts(p, regel, A4.breedte - KANT.rechts, rechtsY, 8.5, false, 0.35);
      rechtsY -= 12;
    });
    p.y = Math.min(linksOnder, rechtsY) - 8;
    lijn(p, KANT.links, p.y, A4.breedte - KANT.rechts, 1.1, 0.1);
    p.y -= 26;
  },

  titel(el, h) {
    h.ruimte(50);
    const p = h.pg();
    schrijf(p, el.tekst || '', KANT.links, p.y - 18, 21, false);
    if (el.rechts) schrijfRechts(p, el.rechts, A4.breedte - KANT.rechts, p.y - 14, 10, false, 0.4);
    p.y -= 34;
  },

  kolommen(el, h) {
    const kolommen = el.kolommen || [];
    let hoogste = 0;
    kolommen.forEach((k) => { hoogste = Math.max(hoogste, (k.regels || []).length); });
    h.ruimte(24 + hoogste * 12);
    const p = h.pg();
    const kolomBreed = BREED / (kolommen.length || 1);
    let laagste = p.y;
    kolommen.forEach((k, i) => {
      const x = KANT.links + i * kolomBreed;
      let y = p.y;
      schrijf(p, String(k.kop || '').toUpperCase(), x, y - 8, 7.5, false, 0.45);
      y -= 20;
      (k.regels || []).forEach((regel, j) => {
        if (regel === null || regel === undefined || regel === '') return;
        schrijf(p, kap(regel, kolomBreed - 12, 9.5, j === 0), x, y, 9.5, j === 0);
        y -= 12.5;
      });
      laagste = Math.min(laagste, y);
    });
    p.y = laagste - 12;
  },

  tabel(el, h) {
    const kolommen = el.kolommen || [];
    const totaalDeel = kolommen.reduce((s, k) => s + (k.deel || 1), 0);
    const xVan = [];
    const breedVan = [];
    let loop = KANT.links;
    kolommen.forEach((k) => {
      const b = BREED * (k.deel || 1) / totaalDeel;
      xVan.push(loop);
      breedVan.push(b);
      loop += b;
    });

    function kopregel() {
      const p = h.pg();
      kolommen.forEach((k, i) => {
        const tekst = String(k.titel || '').toUpperCase();
        if (k.rechts) schrijfRechts(p, tekst, xVan[i] + breedVan[i], p.y - 8, 7.5, false, 0.45);
        else schrijf(p, tekst, xVan[i], p.y - 8, 7.5, false, 0.45);
      });
      p.y -= 14;
      lijn(p, KANT.links, p.y, A4.breedte - KANT.rechts, 0.6, 0.55);
      p.y -= 4;
    }

    kopregel();
    (el.rijen || []).forEach((rij) => {
      const sub = rij.sub ? 1 : 0;
      if (h.ruimte(20 + sub * 10)) kopregel();
      const p = h.pg();
      if (rij.groep) {
        p.y -= 8;
        schrijf(p, String(rij.groep).toUpperCase(), KANT.links, p.y - 8, 7.5, true, 0.25);
        p.y -= 16;
        return;
      }
      let y = p.y - 11;
      (rij.cellen || []).forEach((cel, i) => {
        if (cel === null || cel === undefined) return;
        const dik = !!rij.dik;
        if (kolommen[i] && kolommen[i].rechts) schrijfRechts(p, kap(cel, breedVan[i] - 6, 9.5, dik), xVan[i] + breedVan[i], y, 9.5, dik, rij.grijs);
        else schrijf(p, kap(cel, breedVan[i] - 8, 9.5, dik), xVan[i], y, 9.5, dik, rij.grijs);
      });
      if (rij.sub) {
        y -= 10.5;
        schrijf(p, kap(rij.sub, breedVan[0] - 8, 8, false), xVan[0], y, 8, false, 0.45);
      }
      p.y = y - 8;
      lijn(p, KANT.links, p.y, A4.breedte - KANT.rechts, 0.4, 0.86);
      p.y -= 2;
    });
    h.pg().y -= 8;
  },

  kader(el, h) {
    const vakken = el.vakken || [];
    h.ruimte(78);
    const p = h.pg();
    const hoogte = 62;
    const top = p.y;
    vlak(p, KANT.links, top - hoogte, BREED, hoogte, 0.965);
    kader(p, KANT.links, top - hoogte, BREED, hoogte, 0.72);
    schrijf(p, String(el.kop || '').toUpperCase(), KANT.links + 14, top - 19, 7.5, false, 0.35);
    const vakBreed = (BREED - 28) / (vakken.length || 1);
    vakken.forEach((v, i) => {
      const x = KANT.links + 14 + i * vakBreed;
      schrijf(p, v.label || '', x, top - 36, 8, false, 0.45);
      schrijf(p, v.waarde || '', x, top - 51, v.groot ? 14 : 11, !!v.groot);
    });
    p.y = top - hoogte - 18;
  },

  totalen(el, h) {
    const regels = (el.regels || []).filter(Boolean);
    h.ruimte(18 + regels.length * 16);
    const p = h.pg();
    const links = A4.breedte - KANT.rechts - 230;
    regels.forEach((r) => {
      const grootte = r.groot ? 12 : 9.5;
      schrijf(p, r.label || '', links, p.y - grootte, grootte, !!r.dik);
      schrijfRechts(p, r.waarde || '', A4.breedte - KANT.rechts, p.y - grootte, grootte, !!r.dik);
      p.y -= grootte + 7;
      lijn(p, links, p.y, A4.breedte - KANT.rechts, 0.4, r.groot ? 0.4 : 0.86);
      p.y -= 3;
    });
    p.y -= 10;
  },

  tekst(el, h) {
    const grootte = el.klein ? 8.5 : 9.5;
    const regels = verdeel(el.tekst || '', BREED, grootte, false);
    h.ruimte(regels.length * (grootte + 3.5) + 10);
    const p = h.pg();
    regels.forEach((regel) => {
      schrijf(p, regel, KANT.links, p.y - grootte, grootte, false, el.klein ? 0.4 : 0);
      p.y -= grootte + 3.5;
    });
    p.y -= 8;
  },

  ondertekening(el, h) {
    h.ruimte(52);
    const p = h.pg();
    const half = BREED / 2 - 14;
    p.y -= 26;
    lijn(p, KANT.links, p.y, KANT.links + half, 0.5, 0.6);
    lijn(p, KANT.links + half + 28, p.y, A4.breedte - KANT.rechts, 0.5, 0.6);
    schrijf(p, el.links || '', KANT.links, p.y - 11, 8.5, false, 0.4);
    schrijf(p, el.rechts || '', KANT.links + half + 28, p.y - 11, 8.5, false, 0.4);
    p.y -= 22;
  },

  ruimte(el, h) {
    h.pg().y -= (el.hoogte || 14);
  },

  /* Een groep die niet uit elkaar getrokken hoort te worden: eerst op een kladpagina
     getekend om de hoogte te weten, dan echt. */
  bijeen(el, h) {
    const klad = nieuwePagina();
    const kladHulp = { pg: () => klad, ruimte: () => false, plaatjes: [] };
    (el.elementen || []).forEach((k) => { if (k && TEKENAARS[k.soort]) TEKENAARS[k.soort](k, kladHulp); });
    h.ruimte((A4.hoogte - KANT.boven) - klad.y);
    (el.elementen || []).forEach((k) => { if (k && TEKENAARS[k.soort]) TEKENAARS[k.soort](k, h); });
  },
};

function bytesVan(tekst) {
  const uit = new Uint8Array(tekst.length);
  for (let i = 0; i < tekst.length; i += 1) uit[i] = tekst.charCodeAt(i) & 0xFF;
  return uit;
}

function bouwBestand(paginas, plaatjes, doc) {
  const objecten = [];
  const nieuwObject = (inhoud) => { objecten.push(inhoud); return objecten.length; };

  const catalogNr = nieuwObject(null);
  const pagesNr = nieuwObject(null);
  const f1 = nieuwObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const f2 = nieuwObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');

  const plaatjeNr = {};
  plaatjes.forEach((p) => {
    plaatjeNr[p.naam] = nieuwObject({
      woordenboek: '<< /Type /XObject /Subtype /Image /Width ' + p.plaatje.breedte
        + ' /Height ' + p.plaatje.hoogte + ' /ColorSpace /DeviceRGB /BitsPerComponent 8'
        + ' /Filter /DCTDecode /Length ' + p.plaatje.bytes.length + ' >>',
      stroom: p.plaatje.bytes,
    });
  });

  const paginaNrs = [];
  paginas.forEach((p) => {
    const inhoudBytes = bytesVan(p.opdrachten.join('\n'));
    const inhoudNr = nieuwObject({ woordenboek: '<< /Length ' + inhoudBytes.length + ' >>', stroom: inhoudBytes });
    const xobj = p.plaatjes.length
      ? ' /XObject << ' + p.plaatjes.map((n) => '/' + n + ' ' + plaatjeNr[n] + ' 0 R').join(' ') + ' >>'
      : '';
    paginaNrs.push(nieuwObject('<< /Type /Page /Parent ' + pagesNr + ' 0 R /MediaBox [0 0 '
      + rond(A4.breedte) + ' ' + rond(A4.hoogte) + '] /Resources << /Font << /F1 ' + f1
      + ' 0 R /F2 ' + f2 + ' 0 R >>' + xobj + ' >> /Contents ' + inhoudNr + ' 0 R >>'));
  });

  objecten[catalogNr - 1] = '<< /Type /Catalog /Pages ' + pagesNr + ' 0 R >>';
  objecten[pagesNr - 1] = '<< /Type /Pages /Count ' + paginaNrs.length + ' /Kids ['
    + paginaNrs.map((n) => n + ' 0 R').join(' ') + '] >>';

  const infoNr = nieuwObject('<< /Title (' + ontsnap(doc.titel || 'Document')
    + ') /Producer (Jarvis) /Creator (Jarvis) >>');

  const stukken = [];
  let lengte = 0;
  const voegToe = (iets) => {
    const b = typeof iets === 'string' ? bytesVan(iets) : iets;
    stukken.push(b);
    lengte += b.length;
  };

  voegToe('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  const plekken = [];
  objecten.forEach((obj, i) => {
    plekken.push(lengte);
    voegToe((i + 1) + ' 0 obj\n');
    if (typeof obj === 'string') {
      voegToe(obj + '\nendobj\n');
    } else {
      voegToe(obj.woordenboek + '\nstream\n');
      voegToe(obj.stroom);
      voegToe('\nendstream\nendobj\n');
    }
  });

  const xrefPlek = lengte;
  let xref = 'xref\n0 ' + (objecten.length + 1) + '\n0000000000 65535 f \n';
  plekken.forEach((plek) => { xref += String(plek).padStart(10, '0') + ' 00000 n \n'; });
  voegToe(xref);
  voegToe('trailer\n<< /Size ' + (objecten.length + 1) + ' /Root ' + catalogNr + ' 0 R /Info '
    + infoNr + ' 0 R >>\nstartxref\n' + xrefPlek + '\n%%EOF\n');

  const alles = new Uint8Array(lengte);
  let plek = 0;
  stukken.forEach((s) => { alles.set(s, plek); plek += s.length; });
  return alles;
}

export function maak(doc) {
  const paginas = [nieuwePagina()];
  const plaatjes = [];
  const pg = () => paginas[paginas.length - 1];
  const ruimte = (nodig) => {
    if (pg().y - nodig < KANT.onder) { paginas.push(nieuwePagina()); return true; }
    return false;
  };
  (doc.elementen || []).forEach((el) => {
    if (el && TEKENAARS[el.soort]) TEKENAARS[el.soort](el, { pg, ruimte, plaatjes });
  });
  return bouwBestand(paginas, plaatjes, doc);
}

/* Het logo gaat via het tekendoek naar JPEG (DCTDecode); doorzichtig wordt wit, net als
   op papier. */
export function logo(dataUrl) {
  return new Promise((klaar) => {
    if (!dataUrl) { klaar(null); return; }
    try {
      const afbeelding = new Image();
      afbeelding.onload = () => {
        try {
          const b = Math.min(600, afbeelding.width);
          const h = Math.max(1, Math.round(afbeelding.height * (b / afbeelding.width)));
          const doek = document.createElement('canvas');
          doek.width = b;
          doek.height = h;
          const tekenaar = doek.getContext('2d');
          tekenaar.fillStyle = '#ffffff';
          tekenaar.fillRect(0, 0, b, h);
          tekenaar.drawImage(afbeelding, 0, 0, b, h);
          const ruw = atob(doek.toDataURL('image/jpeg', 0.92).split(',')[1]);
          const bytes = new Uint8Array(ruw.length);
          for (let i = 0; i < ruw.length; i += 1) bytes[i] = ruw.charCodeAt(i);
          klaar({ bytes, breedte: b, hoogte: h });
        } catch { klaar(null); }
      };
      afbeelding.onerror = () => klaar(null);
      afbeelding.src = dataUrl;
    } catch { klaar(null); }
  });
}

export function naarBase64(bytes) {
  const stukken = [];
  for (let i = 0; i < bytes.length; i += 8192) {
    stukken.push(String.fromCharCode.apply(null, bytes.subarray(i, i + 8192)));
  }
  return btoa(stukken.join(''));
}

export function uitBase64(tekst) {
  const ruw = atob(tekst);
  const bytes = new Uint8Array(ruw.length);
  for (let i = 0; i < ruw.length; i += 1) bytes[i] = ruw.charCodeAt(i);
  return bytes;
}

export function download(bytes, naam) {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const adres = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = adres;
  link.download = naam;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(adres), 4000);
}

export function bestandsnaam(delen) {
  return delen.filter(Boolean).join('-')
    .replace(/[^A-Za-z0-9\-_.]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() + '.pdf';
}
