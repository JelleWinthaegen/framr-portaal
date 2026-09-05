/* De inmeetkaart van het Framr.one Portaal: het gezamenlijke portaal voor vloeren en kozijnen.

   Sinds 03-09-2026 (stap 1 en 2 van de schermbouw op fase C) praat de kaart met het inmeetmodel
   van fase C: instellingen en werkzaamheden per niveau, met overerving per eigenschap. De vakman
   beantwoordt de vaststel-vragen een keer voor de hele opname; wat ergens anders is zet hij per
   verdieping of per ruimte om onder "Anders dan de rest", en overal staat erbij waar een waarde
   vandaan komt: standaard, van de opname, van een verdieping of eigen keuze. Welke instellingen en
   werkzaamheden er bestaan, met hun keuzes en voorstellen, komt uit de registry van de motor en
   staat hier niet nog een keer.

   Een verdieping (in het domein een zone) is optioneel en licht: een naam met ruimtes eronder. Er
   is er geen tot iemand op Verdieping toevoegen drukt; tot dan hangt elke ruimte rechtstreeks aan
   de opname en is er niets te zien.

   De maat waarop dit scherm is afgerekend is de slaapkamer: een ruimte, lengte, breedte, plint
   rondom, bewaren. Dat schrijft een inmeting en een ruimte weg en verder niets; elke rij in de
   nieuwe tabellen is een bewuste keuze. Een keuze die gelijk is aan wat er toch al geerfd werd,
   wordt geen rij. Voorstellen zetten alleen aan, nooit uit, en raken nooit een vinkje waar hij
   zelf aan heeft gezeten.

   De motor is de echte resolver; wat hier staat is dezelfde keten (ruimte, zone, opname,
   standaard) om het scherm te kunnen tonen voordat er bewaard is. Na het bewaren is wat de motor
   teruggeeft de waarheid. */

import { koppelAdresvelden } from './adres.js?v=4e0bba9';

const KOZIJNTYPES = ['draaikiep', 'vast glas', 'raam', 'deur', 'schuifpui', 'anders'];

/* De zes vaststel-vragen, in de volgorde van de kaart. Wat ze inhouden staat in de registry. */
const VRAGEN = ['vloer.soort', 'vloer.legpatroon', 'ondergrond.type', 'ondergrond.vlakheid', 'ondergrond.vloerverwarming', 'woning.soort'];

/* Het niveau van het scherm tegenover het niveau in de motor. */
const NIVEAU = { opname: 'inmeting', zone: 'zone', ruimte: 'ruimte' };

/* De vier afspraken. Dezelfde sleutels als het Oaklyn-portaal ze wegschrijft, want ze landen in
   dezelfde kolom `afspraken` van dezelfde tabel; een andere naam zou hetzelfde veld twee keer
   maken. */
const AFSPRAKEN = [
  { id: 'start', label: 'Wanneer kan het werk starten', hint: 'over twee weken, in overleg' },
  { id: 'dagen', label: 'Hoeveel dagen werk', hint: '2' },
  { id: 'bezorging', label: 'Waar moet het materiaal heen', hint: 'op het werk, of naar je loods' },
  { id: 'sleutel', label: 'Wie doet open, welke werktijden', hint: 'klant is thuis, 8 tot 17 uur' },
];

/* De klantvelden op de kaart. Dezelfde namen als de klantroute van de motor ze verwacht, zodat
   de kaart er ongewijzigd doorheen kan. */
const KLANTVELDEN = [
  { id: 'naam', label: 'Naam of bedrijf', hint: 'M. Peeters' },
  { id: 'contact', label: 'Contactpersoon', hint: '' },
  { id: 'telefoon', label: 'Telefoon', hint: '' },
  { id: 'email', label: 'E-mail', hint: '' },
  { id: 'adres', label: 'Adres van het werk', hint: '' },
  { id: 'postcode', label: 'Postcode', hint: '' },
  { id: 'plaats', label: 'Plaats', hint: '' },
];

export function maakInmeetkaart({ motor, schoon, meldRegel, naBewaren }) {
  const $ = (id) => document.getElementById(id);
  const num = (v) => { const n = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };
  const heeft = (bak, sleutel) => Object.prototype.hasOwnProperty.call(bak, sleutel);

  let registry = { instellingen: [], werkzaamheden: [], voorstellen: {} };
  let inmeting = null;
  let klanten = [];
  let projecten = [];
  let meet = { vloer: true, kozijnen: false };
  let eigenWerk = [];
  /* Een vloer die hij uit de catalogus meenam (?vloer=handle&vloernaam=...). Wordt de vloer van
     de opname; de handle reist mee op de ruimtes zoals de calculator hem verwacht. */
  let meegenomen = null;

  /* De rijen zoals de kaart ze bewaart: per niveau een bak met sleutel naar waarde en taak naar
     aan of uit. Geen sleutel in de bak is erven. Ruimtes en verdiepingen hebben een sleutel op
     het scherm: het id als ze al bestaan, anders een tijdelijke. */
  const opname = { inst: {}, taken: {} };
  const perRuimte = new Map();
  const perZone = new Map();
  /* De verdiepingen op het scherm, op volgorde, en bij welke verdieping elke ruimte hoort. */
  let zonesLokaal = [];
  const ruimteZone = new Map();
  /* Welke werkzaamheden hij zelf aanraakte op de opname: daar komt geen voorstel meer overheen. */
  let zelfGezet = new Set();
  const viaVoorstel = new Set();
  let teller = 0;
  const open = new Set();

  /* De geometrie van een ruimte die van de rechthoek afwijkt (stap 3 en 4): meetvlakken met een
     eventueel handmatig oppervlak, en wanden met hun onderbrekingen. Alleen ruimtes die hier iets
     hebben of waar hij aan gezeten heeft sturen het mee; de rest blijft een rechthoek en schrijft
     niets. Oppervlak en omtrek zijn losse werelden: een trapgat haalt geen meter plint weg. */
  const vlakkenVan = new Map();
  const handmatigVan = new Map();
  const wandenVan = new Map();
  const vlakkenGeraakt = new Set();
  const wandenGeraakt = new Set();

  const def = (sleutel) => registry.instellingen.find((i) => i.sleutel === sleutel);
  const taakDef = (id) => registry.werkzaamheden.find((w) => w.id === id);
  const bakVan = (niv, key) => {
    if (niv === 'opname') return opname;
    const kaart = niv === 'zone' ? perZone : perRuimte;
    if (!kaart.has(key)) kaart.set(key, { inst: {}, taken: {} });
    return kaart.get(key);
  };
  const zoneNaam = (zk) => zonesLokaal.find((z) => z.key === zk)?.naam || 'de verdieping';
  const paneelSleutel = (niv, key) => `${niv}:${key}`;

  /* ---------- de resolver, dezelfde keten als de motor ---------- */

  function keten(niv, key) {
    const stappen = [];
    if (niv === 'ruimte') {
      stappen.push({ niveau: 'ruimte', bak: bakVan('ruimte', key), naam: 'eigen keuze' });
      const zk = ruimteZone.get(key) || '';
      if (zk) stappen.push({ niveau: 'zone', bak: bakVan('zone', zk), naam: `van ${zoneNaam(zk)}` });
    } else if (niv === 'zone') {
      stappen.push({ niveau: 'zone', bak: bakVan('zone', key), naam: 'eigen keuze' });
    }
    stappen.push({ niveau: 'inmeting', bak: opname, naam: 'van de opname' });
    return stappen;
  }

  /* Wat er geldt voor een sleutel, vanaf een niveau. `vanafStap` slaat de eerste stappen over: zo
     is ook te vragen wat een niveau zou erven als het zelf niets zei. */
  function resolveer(sleutel, niv, key, vanafStap = 0) {
    const stappen = keten(niv, key).slice(vanafStap);
    for (let i = 0; i < stappen.length; i++) {
      if (heeft(stappen[i].bak.inst, sleutel)) {
        return { waarde: stappen[i].bak.inst[sleutel], vanaf: stappen[i].niveau, naam: stappen[i].naam };
      }
    }
    const d = def(sleutel);
    return { waarde: d ? d.standaard : null, vanaf: 'standaard', naam: 'standaard' };
  }

  function resolveerTaak(id, niv, key, vanafStap = 0) {
    const stappen = keten(niv, key).slice(vanafStap);
    for (let i = 0; i < stappen.length; i++) {
      if (heeft(stappen[i].bak.taken, id)) {
        return { aan: stappen[i].bak.taken[id] === 'aan', vanaf: stappen[i].niveau, naam: stappen[i].naam };
      }
    }
    return { aan: !!taakDef(id)?.standaard, vanaf: 'standaard', naam: 'standaard' };
  }

  /* Een keuze die gelijk is aan wat er toch al geerfd werd, is geen keuze en dus geen rij. */
  function zetInst(niv, key, sleutel, waarde) {
    const bak = bakVan(niv, key);
    const boven = resolveer(sleutel, niv, key, 1);
    if (waarde === undefined || waarde === boven.waarde) delete bak.inst[sleutel];
    else bak.inst[sleutel] = waarde;
  }
  function zetTaak(niv, key, id, aan) {
    const bak = bakVan(niv, key);
    const boven = resolveerTaak(id, niv, key, 1);
    if (aan === undefined || aan === boven.aan) delete bak.taken[id];
    else bak.taken[id] = aan ? 'aan' : 'uit';
  }

  /* ---------- voorstellen ---------- */

  function voorgesteldNu() {
    const wil = new Set();
    VRAGEN.forEach((sleutel) => {
      const h = resolveer(sleutel, 'opname', null);
      if (h.waarde === null || h.waarde === undefined) return;
      (registry.voorstellen[`${sleutel}:${h.waarde}`] ?? []).forEach((t) => wil.add(t));
    });
    return wil;
  }

  function pasVoorstellenToe() {
    const wil = voorgesteldNu();
    registry.werkzaamheden.forEach((w) => {
      if (zelfGezet.has(w.id)) return;
      if (wil.has(w.id)) {
        if (!resolveerTaak(w.id, 'opname', null).aan) { opname.taken[w.id] = 'aan'; viaVoorstel.add(w.id); }
      } else if (viaVoorstel.has(w.id)) {
        delete opname.taken[w.id];
        viaVoorstel.delete(w.id);
      }
    });
  }

  /* ---------- tekenen ---------- */

  const herkomstTekst = (h, niv) => {
    if (niv === 'opname') return h.vanaf === 'standaard' && h.waarde !== null && h.waarde !== undefined && h.waarde !== false ? 'standaard' : '';
    return h.vanaf === NIVEAU[niv] ? '' : h.naam;
  };

  /* Een vraag als rij met keuzes, op de opname, een verdieping of een ruimte. De keuze die geldt
     is aan; komt hij van boven, dan staat hij er gedempt bij met waar hij vandaan komt. */
  function vraagRij(sleutel, niv, key) {
    const d = def(sleutel);
    if (!d) return '';
    const h = resolveer(sleutel, niv, key);
    const eigen = h.vanaf === NIVEAU[niv];
    const attrs = `data-niv="${niv}" data-k="${key ?? ''}" data-s="${d.sleutel}"`;
    const klas = (waarde) => (h.waarde === waarde ? (eigen ? ' aan' : ' aan geerfd') : '');
    let keuzes = '';
    if (d.soort === 'enum') {
      keuzes = d.opties.map((o) => `<button type="button" class="fr-keuze${klas(o.waarde)}" ${attrs} data-kies="${o.waarde}">${schoon(o.label)}</button>`).join('');
    } else if (d.soort === 'ja-nee') {
      keuzes = [[false, 'Nee'], [true, 'Ja']].map(([w, l]) => `<button type="button" class="fr-keuze${klas(w)}" ${attrs} data-kies="${w}">${l}</button>`).join('');
    } else if (d.soort === 'getal') {
      keuzes = `<input class="fr-in klein" inputmode="decimal" ${attrs} data-getal="${d.sleutel}" value="${h.waarde ?? ''}">`;
    } else {
      keuzes = `<input class="fr-in" ${attrs} data-tekst="${d.sleutel}" value="${schoon(h.waarde ?? '')}" placeholder="${niv === 'opname' ? 'naam of artikel van de vloer' : 'zelfde als de rest'}">`;
    }
    const herkomst = herkomstTekst(h, niv);
    const erf = eigen && niv !== 'opname'
      ? `<button type="button" class="fr-erf" ${attrs} data-erf>weer ${schoon(resolveer(sleutel, niv, key, 1).naam)}</button>` : '';
    return `<div class="vraag"><span class="v">${schoon(d.label)}${herkomst ? ` <span class="fr-herkomst">${schoon(herkomst)}</span>` : ''}${erf}</span>
      <div class="keuzes">${keuzes}</div></div>`;
  }

  /* De vragen van een niveau: de zes, de vloer, en band en bies zodra het patroon erom vraagt.
     Alleen de vragen die op dit niveau gezet mogen worden; de woning hoort niet op een ruimte. */
  function vragenVan(niv, key) {
    const lijst = [...VRAGEN, 'vloer.product'];
    const patroon = resolveer('vloer.legpatroon', niv, key).waarde;
    if (patroon === 'visgraat' || patroon === 'chevron') lijst.push('vloer.band_bies');
    return lijst
      .filter((s) => def(s)?.niveaus?.includes(NIVEAU[niv]))
      .map((s) => vraagRij(s, niv, key)).join('');
  }

  /* De getallen die bij een werkzaamheid horen: een aantal bij stuks of vast, de laagdikte bij
     egaliseren. Alleen zichtbaar als de taak aanstaat. */
  function taakVelden(w, niv, key) {
    return registry.instellingen
      .filter((i) => i.hoortBij === w.id && i.soort === 'getal' && i.niveaus.includes(NIVEAU[niv]))
      .map((i) => {
        const h = resolveer(i.sleutel, niv, key);
        const eenheid = i.sleutel.endsWith('.aantal') ? (w.eenheid === 'vast' ? 'keer' : 'stuks') : 'mm';
        return `<span class="fr-taakgetal"><input class="cnum" inputmode="decimal" data-niv="${niv}" data-k="${key ?? ''}" data-s="${i.sleutel}" data-getal="${i.sleutel}" value="${h.waarde ?? ''}" title="${schoon(i.label)}"> ${eenheid}</span>`;
      }).join('');
  }

  function taakRij(w, niv, key, compact) {
    const h = resolveerTaak(w.id, niv, key);
    const eigen = h.vanaf === NIVEAU[niv];
    const attrs = `data-niv="${niv}" data-k="${key ?? ''}" data-t="${w.id}"`;
    let badge = '';
    if (niv === 'opname' && voorgesteldNu().has(w.id) && !zelfGezet.has(w.id) && h.aan) badge = '<span class="cvoorstel">voorgesteld</span>';
    else if (!eigen && h.aan && h.vanaf === 'standaard') badge = '<span class="cvoorstel stil">standaard</span>';
    else if (!eigen && h.vanaf !== 'standaard') badge = `<span class="cvoorstel stil">${schoon(h.naam)}</span>`;
    const erf = eigen && niv !== 'opname' ? `<button type="button" class="fr-erf" ${attrs} data-erf-taak>weer ${schoon(resolveerTaak(w.id, niv, key, 1).naam)}</button>` : '';
    return `<label><input type="checkbox" ${attrs} data-taak="${w.id}" ${h.aan ? 'checked' : ''}>
      <span><b>${schoon(w.label)}</b>${badge}${h.aan ? taakVelden(w, niv, key) : ''}${erf}
      ${compact ? '' : `<span class="o">${schoon(w.uitleg)}</span>`}</span></label>`;
  }

  function checklistVan(niv, key, compact) {
    let groep = null;
    return registry.werkzaamheden.map((w) => {
      const kop = w.groep !== groep ? `<div class="cgroep">${schoon(w.groep)}</div>` : '';
      groep = w.groep;
      return kop + taakRij(w, niv, key, compact);
    }).join('');
  }

  function tekenVast() {
    if (!$('im-vast')) return;
    $('im-vast').innerHTML = vragenVan('opname', null);
    const beantwoord = VRAGEN.filter((s) => resolveer(s, 'opname', null).vanaf === 'inmeting').length;
    $('im-vastmeter').textContent = beantwoord ? `${beantwoord} van ${VRAGEN.length} beantwoord` : 'nog leeg';
  }

  function tekenChecklist() {
    if (!$('im-checklist')) return;
    $('im-checklist').innerHTML = checklistVan('opname', null, false);
    const n = registry.werkzaamheden.filter((w) => resolveerTaak(w.id, 'opname', null).aan).length;
    $('im-checkmeter').textContent = n ? `${n} aan` : '';
  }

  /* Wat er per verdieping of ruimte afwijkt: alleen te zien als hij het openklapt. Het knopje zegt
     hoeveel er afwijkt, zodat een afwijking niet stilletjes in een dichtgeklapt paneel zit. */
  function afwijkKnop(niv, key) {
    const bak = (niv === 'zone' ? perZone : perRuimte).get(key);
    const n = bak ? Object.keys(bak.inst).length + Object.keys(bak.taken).length : 0;
    const isOpen = open.has(paneelSleutel(niv, key));
    return `<button type="button" class="fr-knop klein tweede" data-afwijk="${key}" data-niv="${niv}">${isOpen ? 'Paneel dicht' : (n ? `Anders dan de rest (${n})` : 'Anders dan de rest')}</button>`;
  }

  function afwijkPaneel(niv, key) {
    if (!open.has(paneelSleutel(niv, key))) return '';
    const uitleg = niv === 'zone'
      ? 'Wat hier staat geldt voor alle ruimtes op deze verdieping, tenzij een ruimte zelf iets anders zegt. De rest volgt de opname.'
      : 'Wat hier staat geldt alleen voor deze ruimte. Alles wat je niet aanraakt volgt de verdieping of de opname.';
    return `<div class="fr-afwijk">
      <p class="fr-hint">${uitleg}</p>
      <div class="fr-vast">${vragenVan(niv, key)}</div>
      <p class="fr-calc-pt">Werk ${niv === 'zone' ? 'op deze verdieping' : 'in deze ruimte'}</p>
      <div class="fr-checklist compact">${checklistVan(niv, key, true)}</div>
    </div>`;
  }

  function tekenAfwijk(niv, key) {
    const houder = niv === 'zone'
      ? document.querySelector(`#im-ruimtes .fr-zone[data-zone="${key}"]`)
      : document.querySelector(`#im-ruimtes .fr-ruimte[data-key="${key}"]`);
    if (!houder) return;
    houder.querySelector(`[data-afwijkplek="${niv}"]`).innerHTML = afwijkKnop(niv, key);
    houder.querySelector(`[data-paneel="${niv}"]`).innerHTML = afwijkPaneel(niv, key);
  }

  /* ---------- vlakken en wanden ---------- */

  const komma = (n, d = 2) => Number(n || 0).toFixed(d).replace('.', ',');
  const maten = (blok) => ({
    l: num(blok.querySelector('[name=r-lengte]')?.value),
    b: num(blok.querySelector('[name=r-breedte]')?.value),
    aftrek: num(blok.querySelector('[name=r-aftrek]')?.value),
    plintEraf: num(blok.querySelector('[name=r-plint]')?.value),
  });

  /* Het netto oppervlak van een ruimte zoals de motor het bepaalt: handmatig wint, dan de vlakken,
     dan de rechthoek. Voor het oog; de motor rekent het zelf na. */
  function nettoVan(rk, m) {
    const hand = num(handmatigVan.get(rk));
    if (handmatigVan.get(rk) && hand > 0) return { m2: hand, bron: 'handmatig' };
    const vlakken = vlakkenVan.get(rk) ?? [];
    if (vlakken.length) {
      const som = vlakken.reduce((s, v) => s + (v.teken === 'min' ? -1 : 1) * num(v.lengte) * num(v.breedte), 0);
      return { m2: Math.max(0, som), bron: 'vlakken' };
    }
    return { m2: Math.max(0, m.l * m.b - m.aftrek), bron: 'rechthoek' };
  }

  /* De plintmeters: zijn er wanden, dan zijn die de bron; anders de rechthoekregel. */
  function plintVan(rk, m) {
    const wanden = wandenVan.get(rk) ?? [];
    const plintAan = resolveer('plint.toepassen', 'ruimte', rk).waarde !== false;
    if (wanden.length) {
      const wand = wanden.reduce((s, w) => s + Math.max(0, num(w.lengte)), 0);
      const plint = wanden.reduce((s, w) => {
        const aan = w.plint === 'aan' ? true : w.plint === 'uit' ? false : plintAan;
        if (!aan) return s;
        const eraf = (w.openingen ?? []).reduce((t, o) => t + Math.max(0, num(o.lengte)), 0);
        return s + Math.max(0, num(w.lengte) - eraf);
      }, 0);
      return { m: plint, wand, bron: 'wanden' };
    }
    const wand = 2 * (m.l + m.b);
    return { m: plintAan ? Math.max(0, wand - m.plintEraf) : 0, wand, bron: 'rechthoek' };
  }

  function geoKnop(soort, rk) {
    const isOpen = open.has(paneelSleutel(soort, rk));
    const n = soort === 'vlakken' ? (vlakkenVan.get(rk) ?? []).length : (wandenVan.get(rk) ?? []).length;
    const hand = soort === 'vlakken' && handmatigVan.get(rk);
    let tekst;
    if (isOpen) tekst = 'Paneel dicht';
    else if (soort === 'vlakken') tekst = hand ? 'Oppervlak zelf opgegeven' : (n ? `Vlakken (${n})` : 'Niet rechthoekig');
    else tekst = n ? `Wanden (${n})` : 'Plint aanpassen';
    return `<button type="button" class="fr-knop klein tweede" data-geo="${soort}" data-k="${rk}">${tekst}</button>`;
  }

  function vlakkenPaneel(rk) {
    if (!open.has(paneelSleutel('vlakken', rk))) return '';
    const vlakken = vlakkenVan.get(rk) ?? [];
    const attrs = `data-k="${rk}"`;
    return `<div class="fr-afwijk fr-geo">
      <p class="fr-hint">Tel de vlakken op die samen de vloer vormen; een trapgat of een uitsparing gaat eraf.
        De plint blijft uit de maten hierboven komen (of uit de wanden), want een trapgat haalt geen meter plint weg.</p>
      ${vlakken.map((v, i) => `<div class="fr-veldrij fr-vlak" data-vlak="${i}" ${attrs}>
        <label>Naam<input data-v="naam" value="${schoon(v.naam ?? '')}" placeholder="${v.teken === 'min' ? 'Trapgat' : 'Hoofdvlak'}"></label>
        <label style="max-width:150px">Telt<div class="fr-seg klein">
          <button type="button" data-vteken="plus" class="${v.teken !== 'min' ? 'aan' : ''}">Erbij</button>
          <button type="button" data-vteken="min" class="${v.teken === 'min' ? 'aan' : ''}">Eraf</button></div></label>
        <label style="max-width:110px">Lengte (m)<input data-v="lengte" inputmode="decimal" value="${v.lengte ?? ''}"></label>
        <label style="max-width:110px">Breedte (m)<input data-v="breedte" inputmode="decimal" value="${v.breedte ?? ''}"></label>
        <span class="maatje">${v.teken === 'min' ? '-' : ''}${komma(num(v.lengte) * num(v.breedte))} m2</span>
        <button type="button" class="fr-knop klein tweede" data-vlak-weg="${i}">Weg</button>
      </div>`).join('')}
      <div class="fr-knoppenrij">
        <button type="button" class="fr-knop klein tweede" data-vlak-erbij="plus" ${attrs}>Vlak erbij</button>
        <button type="button" class="fr-knop klein tweede" data-vlak-erbij="min" ${attrs}>Trapgat of uitsparing eraf</button>
        <button type="button" class="fr-knop klein tweede" data-rechthoek ${attrs}>Weer een rechthoek</button>
      </div>
      <div class="fr-veldrij" style="margin-top:10px">
        <label style="max-width:260px">Of het netto oppervlak zelf (m²)<input data-handmatig inputmode="decimal" ${attrs} value="${schoon(handmatigVan.get(rk) ?? '')}" placeholder="alleen als je het al weet"></label>
      </div>
      <p class="fr-hint" data-geosom="vlakken"></p>
    </div>`;
  }

  function wandenPaneel(rk) {
    if (!open.has(paneelSleutel('wanden', rk))) return '';
    const wanden = wandenVan.get(rk) ?? [];
    const attrs = `data-k="${rk}"`;
    const plintKeuze = (w, i) => [[null, 'Volgt de ruimte'], ['aan', 'Plint'], ['uit', 'Geen plint']].map(([waarde, label]) =>
      `<button type="button" data-wplint="${waarde ?? ''}" data-wand="${i}" class="${(w.plint ?? null) === waarde ? 'aan' : ''}">${label}</button>`).join('');
    return `<div class="fr-afwijk fr-geo">
      <p class="fr-hint">De plint volgt de wanden: zet een wand op geen plint waar er geen komt, en trek een deur, een keukenblok of een
        pui eraf. De maten blijven staan als de plint uit gaat, dus "hier komt toch wel een plint" kost geen meetwerk.</p>
      ${wanden.map((w, i) => `<div class="fr-wand" data-wand="${i}" ${attrs}>
        <div class="fr-veldrij">
          <label style="max-width:80px">Wand<input data-w="label" value="${schoon(w.label ?? '')}" placeholder="${String.fromCharCode(65 + i)}"></label>
          <label style="max-width:110px">Lengte (m)<input data-w="lengte" inputmode="decimal" value="${w.lengte ?? ''}"></label>
          <label>Plint<div class="fr-seg klein">${plintKeuze(w, i)}</div></label>
          <button type="button" class="fr-knop klein tweede" data-wand-weg="${i}">Weg</button>
        </div>
        ${(w.openingen ?? []).map((o, j) => `<div class="fr-veldrij fr-opening" data-opening="${j}" data-wand="${i}">
          <span class="fr-hint" style="align-self:center">eraf</span>
          <label style="max-width:110px">Lengte (m)<input data-o="lengte" inputmode="decimal" value="${o.lengte ?? ''}"></label>
          <label style="max-width:200px">Wat<input data-o="reden" value="${schoon(o.reden ?? '')}" placeholder="deur, keukenblok, pui"></label>
          <button type="button" class="fr-knop klein tweede" data-opening-weg="${j}" data-wand="${i}">Weg</button>
        </div>`).join('')}
        <div class="fr-knoppenrij"><button type="button" class="fr-erf" data-opening-erbij="${i}" ${attrs}>onderbreking erbij (deur, keukenblok, pui)</button></div>
      </div>`).join('')}
      <div class="fr-knoppenrij">
        <button type="button" class="fr-knop klein tweede" data-wand-erbij ${attrs}>Wand erbij</button>
        <button type="button" class="fr-knop klein tweede" data-rondom ${attrs}>Weer rondom</button>
      </div>
      <p class="fr-hint" data-geosom="wanden"></p>
    </div>`;
  }

  function tekenGeo(soort, rk) {
    const blok = document.querySelector(`#im-ruimtes .fr-ruimte[data-key="${rk}"]`);
    if (!blok) return;
    blok.querySelector(`[data-afwijkplek="${soort}"]`).innerHTML = geoKnop(soort, rk);
    blok.querySelector(`[data-paneel="${soort}"]`).innerHTML = soort === 'vlakken' ? vlakkenPaneel(rk) : wandenPaneel(rk);
    vloerSom($('im-form'));
  }

  /* Het paneel voor het eerst openen: de vlakken beginnen als de rechthoek die er stond, de
     wanden als de vier van de rechthoek. Tot dat moment bestond er niets. */
  function openGeo(soort, rk) {
    const sleutel = paneelSleutel(soort, rk);
    if (open.has(sleutel)) { open.delete(sleutel); tekenGeo(soort, rk); return; }
    open.add(sleutel);
    const blok = document.querySelector(`#im-ruimtes .fr-ruimte[data-key="${rk}"]`);
    const m = maten(blok);
    if (soort === 'vlakken' && !(vlakkenVan.get(rk) ?? []).length && !handmatigVan.get(rk)) {
      vlakkenVan.set(rk, [{ naam: 'Hoofdvlak', teken: 'plus', lengte: m.l || '', breedte: m.b || '' }]);
      vlakkenGeraakt.add(rk);
    }
    if (soort === 'wanden' && !(wandenVan.get(rk) ?? []).length) {
      wandenVan.set(rk, ['A', 'B', 'C', 'D'].map((label, i) => ({ label, lengte: (i % 2 === 0 ? m.l : m.b) || '', plint: null, openingen: [] })));
      wandenGeraakt.add(rk);
    }
    tekenGeo(soort, rk);
  }

  /* ---------- ruimtes en verdiepingen ---------- */

  const metZones = () => zonesLokaal.length > 0;

  function zoneKeuze(rk) {
    if (!metZones()) return '';
    const huidig = ruimteZone.get(rk) || '';
    return `<label style="max-width:190px">Verdieping<select name="r-zone" data-zonekeuze="${rk}">
      <option value="" ${huidig ? '' : 'selected'}>geen verdieping</option>
      ${zonesLokaal.map((z) => `<option value="${z.key}" ${z.key === huidig ? 'selected' : ''}>${schoon(z.naam || 'Zonder naam')}</option>`).join('')}
    </select></label>`;
  }

  function ruimteBlok(r = {}, n = 1, key = null) {
    const rk = key ?? r.id ?? `n${++teller}`;
    if (!ruimteZone.has(rk)) ruimteZone.set(rk, r.zone_id ?? '');
    return `<fieldset class="fr-ruimte" data-key="${rk}" ${r.id ? `data-id="${r.id}"` : ''} ${r.vloer_handle ? `data-handle="${schoon(r.vloer_handle)}"` : ''}>
      <legend>Ruimte ${n}</legend>
      <div class="fr-veldrij">
        <label>Naam<input name="r-naam" value="${schoon(r.naam ?? '')}" placeholder="Woonkamer"></label>
        <label style="max-width:120px">Lengte (m)<input name="r-lengte" inputmode="decimal" value="${r.lengte ?? ''}"></label>
        <label style="max-width:120px">Breedte (m)<input name="r-breedte" inputmode="decimal" value="${r.breedte ?? ''}"></label>
        <label style="max-width:120px">Aftrek (m²)<input name="r-aftrek" inputmode="decimal" value="${r.aftrek ?? ''}" placeholder="0"></label>
        <label style="max-width:130px">Geen plint (m)<input name="r-plint" inputmode="decimal" value="${r.plint_eraf ?? ''}" placeholder="0"></label>
        <span data-zonekeuzeplek>${zoneKeuze(rk)}</span>
      </div>
      <div class="fr-ruimtevoet">
        <p class="fr-ruimtesom fr-hint"></p>
        <span class="fr-knoppenrij" style="margin:0">
          <span data-afwijkplek="vlakken">${geoKnop('vlakken', rk)}</span>
          <span data-afwijkplek="wanden">${geoKnop('wanden', rk)}</span>
          <span data-afwijkplek="ruimte">${afwijkKnop('ruimte', rk)}</span>
          <button type="button" class="fr-knop klein tweede" data-ruimte-weg="${rk}">Weg</button>
        </span>
      </div>
      <div data-paneel="vlakken">${vlakkenPaneel(rk)}</div>
      <div data-paneel="wanden">${wandenPaneel(rk)}</div>
      <div data-paneel="ruimte">${afwijkPaneel('ruimte', rk)}</div>
    </fieldset>`;
  }

  /* De vlakken en wanden van een bestaande ruimte, zoals de motor ze meegeeft. */
  function laadGeometrie(r) {
    if (!r.id) return;
    const vlakken = (r.portal_measurement_areas ?? []).slice().sort((a, b) => (a.volgorde ?? 0) - (b.volgorde ?? 0));
    if (vlakken.length) vlakkenVan.set(r.id, vlakken.map((v) => ({ naam: v.naam ?? '', teken: v.teken, lengte: v.lengte, breedte: v.breedte })));
    if (r.oppervlak_handmatig !== null && r.oppervlak_handmatig !== undefined) handmatigVan.set(r.id, String(r.oppervlak_handmatig));
    const wanden = (r.portal_measurement_walls ?? []).slice().sort((a, b) => (a.volgorde ?? 0) - (b.volgorde ?? 0));
    if (wanden.length) {
      wandenVan.set(r.id, wanden.map((w) => ({
        label: w.label ?? '', lengte: w.lengte, plint: w.plint ?? null,
        openingen: (w.portal_measurement_wall_openings ?? []).slice().sort((a, b) => (a.volgorde ?? 0) - (b.volgorde ?? 0))
          .map((o) => ({ lengte: o.lengte, reden: o.reden ?? '' })),
      })));
    }
  }

  /* Een verdieping als groep met haar ruimtes eronder. De groep zonder verdieping heeft geen kop
     zolang er geen verdiepingen zijn; dan is de kaart precies wat hij altijd was. */
  function zoneGroep(z) {
    return `<div class="fr-zone" data-zone="${z.key}">
      <div class="fr-zonekop">
        <span class="fr-eyebrow" style="color:var(--label)">Verdieping</span>
        <input class="fr-in" name="z-naam" data-zonenaam="${z.key}" value="${schoon(z.naam ?? '')}" placeholder="Begane grond">
        <span class="fr-knoppenrij" style="margin:0">
          <span data-afwijkplek="zone">${afwijkKnop('zone', z.key)}</span>
          <button type="button" class="fr-knop klein tweede" data-zone-ruimte="${z.key}">Ruimte erbij</button>
          <button type="button" class="fr-knop klein tweede" data-zone-weg="${z.key}">Verdieping weg</button>
        </span>
      </div>
      <div data-paneel="zone">${afwijkPaneel('zone', z.key)}</div>
      <div class="fr-zoneruimtes" data-ruimtes></div>
    </div>`;
  }

  function geenZoneGroep() {
    return `<div class="fr-zone" data-zone="">
      <div class="fr-zonekop stil" ${metZones() ? '' : 'hidden'}><span class="fr-eyebrow" style="color:var(--label)">Zonder verdieping</span></div>
      <div class="fr-zoneruimtes" data-ruimtes></div>
    </div>`;
  }

  function hernummer() {
    let n = 0;
    document.querySelectorAll('#im-ruimtes .fr-ruimte legend').forEach((l) => { l.textContent = `Ruimte ${++n}`; });
    const geen = document.querySelector('#im-ruimtes .fr-zone[data-zone=""] .fr-zonekop');
    if (geen) geen.hidden = !metZones();
    const los = $('im-ruimte-erbij');
    if (los) los.hidden = metZones();
    document.querySelectorAll('#im-ruimtes .fr-ruimte').forEach((blok) => {
      const plek = blok.querySelector('[data-zonekeuzeplek]');
      if (plek) plek.innerHTML = zoneKeuze(blok.dataset.key);
    });
  }

  /* Een ruimte in de groep van haar verdieping zetten. Het blok verhuist als geheel, dus wat er
     ingevuld staat blijft staan; alleen de herkomst in het paneel verandert. */
  function verplaatsBlok(rk, zk) {
    const blok = document.querySelector(`#im-ruimtes .fr-ruimte[data-key="${rk}"]`);
    const doel = document.querySelector(`#im-ruimtes .fr-zone[data-zone="${zk}"] [data-ruimtes]`);
    if (!blok || !doel) return;
    doel.appendChild(blok);
    ruimteZone.set(rk, zk);
    hernummer();
    tekenAfwijk('ruimte', rk);
  }

  function voegZoneToe(naam = '') {
    const key = `z${++teller}`;
    zonesLokaal.push({ key, id: null, naam });
    const geen = document.querySelector('#im-ruimtes .fr-zone[data-zone=""]');
    geen.insertAdjacentHTML('beforebegin', zoneGroep({ key, naam }));
    hernummer();
    return key;
  }

  function haalZoneWeg(zk) {
    const groep = document.querySelector(`#im-ruimtes .fr-zone[data-zone="${zk}"]`);
    if (!groep) return;
    [...groep.querySelectorAll('.fr-ruimte')].forEach((blok) => verplaatsBlok(blok.dataset.key, ''));
    groep.remove();
    zonesLokaal = zonesLokaal.filter((z) => z.key !== zk);
    perZone.delete(zk);
    open.delete(paneelSleutel('zone', zk));
    hernummer();
    /* De ruimtes die erin hingen erven nu weer van de opname; dat hoort meteen te zien te zijn. */
    open.forEach((p) => { const [niv, key] = p.split(':'); if (niv === 'ruimte') tekenAfwijk('ruimte', key); });
  }

  function tekenRuimtes(ruimtes) {
    const doos = $('im-ruimtes');
    doos.innerHTML = zonesLokaal.map((z) => zoneGroep(z)).join('') + geenZoneGroep();
    ruimtes.forEach((r, i) => {
      const rk = r.id ?? `n${++teller}`;
      laadGeometrie(r);
      ruimteZone.set(rk, r.zone_id && zonesLokaal.some((z) => z.key === r.zone_id) ? r.zone_id : '');
      const doel = doos.querySelector(`.fr-zone[data-zone="${ruimteZone.get(rk)}"] [data-ruimtes]`);
      doel.insertAdjacentHTML('beforeend', ruimteBlok(r, i + 1, rk));
    });
    hernummer();
  }

  function kozijnBlok(k = {}, n = 1) {
    return `<fieldset class="fr-ruimte fr-kozijn">
      <legend>Kozijn ${n}</legend>
      <div class="fr-veldrij">
        <label>Plaats<input name="k-plaats" value="${schoon(k.plaats ?? '')}" placeholder="Voorgevel woonkamer"></label>
        <label style="max-width:130px">Breedte (mm)<input name="k-breedte" inputmode="numeric" value="${k.breedte_mm ?? ''}"></label>
        <label style="max-width:130px">Hoogte (mm)<input name="k-hoogte" inputmode="numeric" value="${k.hoogte_mm ?? ''}"></label>
        <label style="max-width:90px">Aantal<input name="k-aantal" inputmode="numeric" value="${k.aantal ?? 1}"></label>
        <label style="max-width:150px">Type<select name="k-type">${KOZIJNTYPES.map((t) => `<option ${t === (k.type ?? 'draaikiep') ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      </div>
      <div class="fr-veldrij"><label>Notitie<input name="k-notitie" value="${schoon(k.notitie ?? '')}" placeholder="Bijvoorbeeld: hout, enkel glas, dorpel rot"></label></div>
      <p class="fr-kozijnsom fr-hint"></p>
    </fieldset>`;
  }

  function schil() {
    const klantOpties = klanten.map((k) => `<option value="${k.id}" ${k.id === inmeting?.customer_id ? 'selected' : ''}>${schoon(k.naam)}</option>`).join('');
    const projectOpties = projecten.map((p) => `<option value="${p.id}" ${p.id === inmeting?.project_id ? 'selected' : ''}>${schoon(p.naam)}</option>`).join('');
    const kozijnen = (inmeting?.kozijnen ?? []);
    return `
    <form id="im-form" class="fr-form fr-form-breed" data-id="${inmeting?.id ?? ''}">
      <div class="fr-veldrij">
        <label>Wat voor werk is het<input name="naam" value="${schoon(inmeting?.naam ?? '')}" placeholder="Woonkamer en keuken"></label>
        <label>Klus<select name="project_id"><option value="">losse inmeting</option>${projectOpties}</select></label>
      </div>

      ${meegenomen ? `<p class="fr-note"><b>Je nam ${schoon(meegenomen.naam)} mee.</b> Die staat als vloer op de opname;
        een ruimte die een andere vloer krijgt zet je onder Anders dan de rest.</p>` : ''}

      <p class="fr-calc-pt">1. Meten</p>
      <div class="fr-seg" id="im-meet">
        <button type="button" data-m="vloer" class="aan">Vloer</button>
        <button type="button" data-m="kozijnen">Kozijnen</button>
        <button type="button" data-m="beide">Allebei</button>
      </div>

      <div id="im-vloerdeel">
        <div id="im-ruimtes"></div>
        <div class="fr-knoppenrij">
          <button class="fr-knop tweede klein" type="button" id="im-ruimte-erbij">Ruimte erbij</button>
          <button class="fr-knop tweede klein" type="button" id="im-zone-erbij">Verdieping toevoegen</button>
        </div>
        <div class="fr-blokkop"><h2>Vloer totaal</h2><span class="maatje" id="im-vloersom"></span></div>
      </div>

      <div id="im-kozijndeel" hidden>
        <div id="im-kozijnen">${(kozijnen.length ? kozijnen : [{}]).map((k, i) => kozijnBlok(k, i + 1)).join('')}</div>
        <div class="fr-knoppenrij"><button class="fr-knop tweede klein" type="button" id="im-kozijn-erbij">Kozijn erbij</button></div>
        <div class="fr-blokkop"><h2>Kozijnen totaal</h2><span class="maatje" id="im-kozijnsom"></span></div>
      </div>

      <div id="im-vastdeel">
        <p class="fr-calc-pt">2. Vaststellen <span class="fr-hint" id="im-vastmeter"></span></p>
        <p class="fr-hint">Zes vragen die je ter plekke in een tik beantwoordt, voor de hele opname. Ze zetten hieronder vanzelf de goede vinkjes aan. Wijkt een verdieping of een ruimte af, dan zet je dat daar.</p>
        <div class="fr-vast" id="im-vast"></div>

        <p class="fr-calc-pt">3. Wat moet er gebeuren <span class="fr-hint" id="im-checkmeter"></span></p>
        <div class="fr-checklist" id="im-checklist"></div>

        <p class="fr-calc-pt">Eigen werk</p>
        <p class="fr-hint">Wat de checklist niet dekt: tik het erbij, dan staat het straks als werkregel op de offerte.</p>
        <div id="im-eigenwerk"></div>
        <div class="fr-knoppenrij"><button class="fr-knop tweede klein" type="button" id="im-eigen-erbij">Eigen regel erbij</button></div>
      </div>

      <p class="fr-calc-pt">4. De klant</p>
      <p class="fr-hint">Je zit bij hem aan tafel, dus vul het hier meteen goed in. Wat hier staat komt
        vanzelf op je offerte en je factuur, en de klant komt in je klantenlijst.</p>
      <div class="fr-veldrij">
        <label>Een klant uit je lijst<select name="klant_id"><option value="">nieuwe of losse klant</option>${klantOpties}</select></label>
      </div>
      <div class="fr-veldrij" id="im-klantvelden">
        ${KLANTVELDEN.map((v) => `<label>${v.label}<input name="kl-${v.id}" value="" ${v.hint ? `placeholder="${v.hint}"` : ''}></label>`).join('')}
      </div>

      <p class="fr-calc-pt">5. Afspraken <span class="fr-hint" id="im-afsprakenmeter"></span></p>
      <div class="fr-veldrij" id="im-afspraken">
        ${AFSPRAKEN.map((a) => `<label>${a.label}<input name="af-${a.id}" value="" ${a.hint ? `placeholder="${a.hint}"` : ''}></label>`).join('')}
      </div>
      <label style="margin-top:14px">Notitie<textarea name="notitie" rows="2" placeholder="Wat je ter plekke opvalt: drempels, deuren, vloerverwarming, ondergrond">${schoon(inmeting?.notitie ?? '')}</textarea></label>
      <div class="fr-knoppenrij">
        <button class="fr-knop" type="submit">Bewaren</button>
        <span id="im-terugplek"></span>
      </div>
      <p class="fr-formfout" id="im-fout"></p>
    </form>`;
  }

  function tekenEigenWerk() {
    $('im-eigenwerk').innerHTML = eigenWerk.map((w, i) => `
      <div class="fr-veldrij fr-werkregel" data-i="${i}">
        <label>Omschrijving<input data-w="omschrijving" value="${schoon(w.omschrijving)}"></label>
        <label style="max-width:90px">Aantal<input data-w="aantal" inputmode="decimal" value="${w.aantal}"></label>
        <label style="max-width:110px">Eenheid<input data-w="eenheid" value="${schoon(w.eenheid)}"></label>
        <button class="fr-knop klein tweede" data-w-weg="${i}" type="button">Weg</button>
      </div>`).join('');
  }

  /* ---------- de klant en de afspraken ---------- */

  function vulKlantvelden(klantId) {
    const kaart = klanten.find((k) => k.id === klantId) ?? {};
    KLANTVELDEN.forEach((v) => {
      const veld = document.querySelector(`#im-form [name="kl-${v.id}"]`);
      if (veld) veld.value = kaart[v.id] ?? '';
    });
  }

  function vulAfspraken(afspraken) {
    AFSPRAKEN.forEach((a) => {
      const veld = document.querySelector(`#im-form [name="af-${a.id}"]`);
      if (veld) veld.value = afspraken[a.id] ?? '';
    });
    telAfspraken();
  }

  function telAfspraken() {
    const ingevuld = AFSPRAKEN.filter((a) => {
      const veld = document.querySelector(`#im-form [name="af-${a.id}"]`);
      return veld && veld.value.trim();
    }).length;
    $('im-afsprakenmeter').textContent = ingevuld ? `${ingevuld} van ${AFSPRAKEN.length} ingevuld` : 'nog leeg';
  }

  /* ---------- sommen ---------- */

  /* Voor het oog, langs dezelfde regels als de motor: handmatig wint, dan de vlakken, dan de
     rechthoek; de plint uit de wanden als die er zijn, anders uit de rechthoek. Wat de motor
     bewaart is leidend. */
  function vloerSom(form) {
    let m2 = 0; let omtrek = 0;
    form.querySelectorAll('#im-ruimtes .fr-ruimte').forEach((blok) => {
      const rk = blok.dataset.key;
      const m = maten(blok);
      const netto = nettoVan(rk, m);
      const plint = plintVan(rk, m);
      m2 += netto.m2; omtrek += plint.m;
      const tel = (n, een, meer) => `${n} ${n === 1 ? een : meer}`;
      const bronM2 = netto.bron === 'vlakken' ? ` uit ${tel((vlakkenVan.get(rk) ?? []).length, 'vlak', 'vlakken')}` : netto.bron === 'handmatig' ? ' zelf opgegeven' : '';
      const bronPlint = plint.bron === 'wanden' ? ` uit ${tel((wandenVan.get(rk) ?? []).length, 'wand', 'wanden')}` : '';
      blok.querySelector('.fr-ruimtesom').textContent = (m.l && m.b) || netto.bron !== 'rechthoek'
        ? `${komma(netto.m2)} m2 vloer${bronM2}, ${komma(plint.m)} m plint${bronPlint}` : '';
      const somVlak = blok.querySelector('[data-geosom="vlakken"]');
      if (somVlak) somVlak.textContent = `Netto ${komma(netto.m2)} m2${bronM2}.`;
      const somWand = blok.querySelector('[data-geosom="wanden"]');
      if (somWand) somWand.textContent = `${komma(plint.m)} m plint van ${komma(plint.wand)} m wand.`;
    });
    $('im-vloersom').textContent = `${komma(m2)} m2 vloer, ${komma(omtrek)} m plint`;
    return { m2, omtrek };
  }

  function kozijnSom(form) {
    let stuks = 0; let oppervlak = 0;
    form.querySelectorAll('#im-kozijnen .fr-kozijn').forEach((blok) => {
      const b = num(blok.querySelector('[name=k-breedte]').value);
      const h = num(blok.querySelector('[name=k-hoogte]').value);
      const n = Math.max(1, Math.round(num(blok.querySelector('[name=k-aantal]').value)) || 1);
      const m2 = (b / 1000) * (h / 1000) * n;
      stuks += b && h ? n : 0;
      oppervlak += m2;
      blok.querySelector('.fr-kozijnsom').textContent = b && h
        ? `${b} x ${h} mm, ${n} stuks, ${m2.toFixed(2).replace('.', ',')} m2` : '';
    });
    $('im-kozijnsom').textContent = `${stuks} kozijn${stuks === 1 ? '' : 'en'}, ${oppervlak.toFixed(2).replace('.', ',')} m2`;
  }

  function zetMeet(keuze) {
    meet = { vloer: keuze !== 'kozijnen', kozijnen: keuze !== 'vloer' };
    document.querySelectorAll('#im-meet button').forEach((b) => b.classList.toggle('aan', b.dataset.m === keuze));
    $('im-vloerdeel').hidden = !meet.vloer;
    /* De vaststel-vragen en de checklist horen bij vloerwerk; bij alleen kozijnen staan ze in de weg. */
    $('im-vastdeel').hidden = !meet.vloer;
    $('im-kozijndeel').hidden = !meet.kozijnen;
  }

  /* ---------- bewaren ---------- */

  const rijenUit = (bak) => ({
    instellingen: Object.entries(bak.inst).map(([sleutel, waarde]) => ({ sleutel, waarde })),
    taken: Object.entries(bak.taken).map(([taak, staat]) => ({ taak, staat })),
  });

  /* De klantkaart van de inmeetkaart.

     Drie gevallen. Koos hij niemand en tikte hij een naam, dan wordt dat een nieuwe kaart. Koos hij
     een bestaande klant en vulde hij iets aan, dan gaat die aanvulling naar de kaart. Liet hij alles
     leeg, dan blijft het een losse inmeting zonder klant, want dat mag hier gewoon.

     Bijwerken vult alleen aan en maakt nooit leeg: een leeg veld op deze kaart betekent dat hij het
     hier niet invulde, niet dat het telefoonnummer dat er al stond weg moet. */
  async function regelKlant(form) {
    const gekozen = form.klant_id.value || null;
    const kaart = {};
    KLANTVELDEN.forEach((v) => { kaart[v.id] = form[`kl-${v.id}`].value.trim(); });

    if (!gekozen) {
      if (!kaart.naam) return { id: null, naam: null };
      const nieuw = {};
      Object.entries(kaart).forEach(([veld, waarde]) => { nieuw[veld] = waarde || null; });
      const { klant } = await motor('/klanten', { methode: 'POST', body: nieuw });
      klanten.push(klant);
      return { id: klant.id, naam: klant.naam };
    }

    const staat = klanten.find((k) => k.id === gekozen) ?? {};
    const aanvulling = {};
    Object.entries(kaart).forEach(([veld, waarde]) => {
      if (waarde && waarde !== (staat[veld] ?? '')) aanvulling[veld] = waarde;
    });
    if (Object.keys(aanvulling).length) {
      const { klant } = await motor(`/klanten/${gekozen}`, { methode: 'PATCH', body: aanvulling });
      const plek = klanten.findIndex((k) => k.id === gekozen);
      if (plek >= 0) klanten[plek] = klant;
      return { id: klant.id, naam: klant.naam };
    }
    return { id: gekozen, naam: (klanten.find((k) => k.id === gekozen) ?? {}).naam ?? null };
  }

  /* Wat er bij het bewaren de deur uit gaat: de nieuwe vorm. De opname met zijn rijen, de
     verdiepingen met de hunne (met id als ze bestaan, anders met hun sleutel op het scherm), elke
     ruimte met zijn id (zodat hij zijn vlakken, wanden en zone houdt), zijn verdieping en zijn
     eigen rijen, en het eigen werk. De oude vorm leidt de motor hieruit af. */
  async function bewaar(form) {
    if (meet.vloer) vloerSom(form);
    const zones = meet.vloer
      ? zonesLokaal.map((z, i) => ({
          ...(z.id ? { id: z.id } : { key: z.key }),
          naam: form.querySelector(`[data-zonenaam="${z.key}"]`)?.value.trim() || z.naam || '',
          volgorde: i,
          ...rijenUit(bakVan('zone', z.key)),
        }))
      : [];
    const ruimtes = meet.vloer
      ? [...form.querySelectorAll('#im-ruimtes .fr-ruimte')].map((blok) => {
          const rk = blok.dataset.key;
          const eigen = perRuimte.get(rk) ?? { inst: {}, taken: {} };
          const zk = ruimteZone.get(rk) || '';
          const zone = zonesLokaal.find((z) => z.key === zk);
          return {
            ...(blok.dataset.id ? { id: blok.dataset.id } : {}),
            naam: blok.querySelector('[name=r-naam]').value || null,
            lengte: blok.querySelector('[name=r-lengte]').value,
            breedte: blok.querySelector('[name=r-breedte]').value,
            aftrek: blok.querySelector('[name=r-aftrek]').value,
            plint_eraf: blok.querySelector('[name=r-plint]').value,
            vloer_handle: blok.dataset.handle || (blok.dataset.id ? null : (meegenomen?.handle ?? null)),
            ...(zone ? (zone.id ? { zone_id: zone.id } : { zone_key: zone.key }) : { zone_id: null }),
            ...rijenUit(eigen),
            /* Vlakken en wanden alleen als hij eraan gezeten heeft of als een nieuwe ruimte ze
               heeft; anders blijft staan wat er staat. */
            ...(vlakkenGeraakt.has(rk) || (!blok.dataset.id && (vlakkenVan.get(rk) ?? []).length)
              ? { vlakken: vlakkenVan.get(rk) ?? [], oppervlak_handmatig: handmatigVan.get(rk) || null } : {}),
            ...(wandenGeraakt.has(rk) || (!blok.dataset.id && (wandenVan.get(rk) ?? []).length)
              ? { wanden: wandenVan.get(rk) ?? [] } : {}),
          };
        })
      : [];
    const kozijnen = meet.kozijnen
      ? [...form.querySelectorAll('#im-kozijnen .fr-kozijn')].map((blok) => ({
          plaats: blok.querySelector('[name=k-plaats]').value || null,
          breedte_mm: blok.querySelector('[name=k-breedte]').value,
          hoogte_mm: blok.querySelector('[name=k-hoogte]').value,
          aantal: blok.querySelector('[name=k-aantal]').value,
          type: blok.querySelector('[name=k-type]').value,
          notitie: blok.querySelector('[name=k-notitie]').value || null,
        })).filter((k) => num(k.breedte_mm) > 0 && num(k.hoogte_mm) > 0)
      : [];
    const klant = await regelKlant(form);
    const afspraken = {};
    AFSPRAKEN.forEach((a) => {
      const waarde = form[`af-${a.id}`].value.trim();
      if (waarde) afspraken[a.id] = waarde;
    });
    const body = {
      naam: form.naam.value || null,
      project_id: form.project_id.value || null,
      klant_id: klant.id,
      klant: klant.naam,
      zones,
      ruimtes,
      kozijnen,
      afspraken,
      notitie: form.notitie.value || null,
      ...(meet.vloer ? rijenUit(opname) : { instellingen: [], taken: [] }),
      eigen_werk: meet.vloer
        ? eigenWerk.filter((w) => String(w.omschrijving || '').trim())
          .map((w) => ({ omschrijving: w.omschrijving, aantal: num(w.aantal) || 1, eenheid: w.eenheid || 'vast' }))
        : [],
    };
    const id = form.dataset.id;
    if (id) await motor(`/inmetingen/${id}`, { methode: 'PATCH', body });
    else await motor('/inmetingen', { methode: 'POST', body });
  }

  /* ---------- opzetten ---------- */

  /* De rijen van een bestaande inmeting in de bakken zetten, per niveau. Wat bewaard is, is van
     hem: daar komt geen voorstel meer overheen. */
  function laadRijen(d) {
    zonesLokaal = (d.zones ?? []).slice().sort((a, b) => (a.volgorde ?? 0) - (b.volgorde ?? 0))
      .map((z) => ({ key: z.id, id: z.id, naam: z.naam }));
    (d.rijen ?? []).forEach((r) => {
      if (r.niveau === 'inmeting') opname.inst[r.sleutel] = r.waarde;
      else if (r.niveau === 'ruimte') bakVan('ruimte', r.niveau_id).inst[r.sleutel] = r.waarde;
      else if (r.niveau === 'zone') bakVan('zone', r.niveau_id).inst[r.sleutel] = r.waarde;
    });
    (d.taken ?? []).forEach((t) => {
      if (t.niveau === 'inmeting') opname.taken[t.taak] = t.staat;
      else if (t.niveau === 'ruimte') bakVan('ruimte', t.niveau_id).taken[t.taak] = t.staat;
      else if (t.niveau === 'zone') bakVan('zone', t.niveau_id).taken[t.taak] = t.staat;
    });
    zelfGezet = new Set(Object.keys(opname.taken));
  }

  /* Wat er van buiten wordt meegegeven aan een nieuwe kaart: de klus waar hij vandaan komt, de klant
     die al bekend is, en een vloer die hij uit de catalogus meenam. */
  async function toon(bak, id, terugHtml, mee = {}) {
    const bestaand = id && id !== 'nieuw';
    const [{ klanten: k }, { projecten: p }, reg, im, rijen] = await Promise.all([
      motor('/klanten'), motor('/projecten'), motor('/registry'),
      bestaand ? motor(`/inmetingen/${id}`) : Promise.resolve(null),
      bestaand ? motor(`/inmetingen/${id}/instellingen`) : Promise.resolve(null),
    ]);
    klanten = k ?? [];
    projecten = p ?? [];
    registry = { instellingen: reg.instellingen ?? [], werkzaamheden: reg.werkzaamheden ?? [], voorstellen: reg.voorstellen ?? {} };
    meegenomen = (mee.vloer_naam || mee.vloer_handle)
      ? { naam: mee.vloer_naam || mee.vloer_handle, handle: mee.vloer_handle || null }
      : null;
    if (bestaand) {
      inmeting = im.inmeting;
      laadRijen(rijen);
      eigenWerk = (inmeting.werkregels ?? []).filter((w) => w.eigen)
        .map((w) => ({ omschrijving: w.omschrijving, aantal: w.aantal, eenheid: w.eenheid }));
    } else if (meegenomen) {
      opname.inst['vloer.product'] = meegenomen.naam;
    }

    bak.innerHTML = schil();
    const form = $('im-form');
    tekenRuimtes((inmeting?.portal_measurement_rooms?.slice() ?? [{}])
      .sort((a, b) => (a.volgorde ?? 0) - (b.volgorde ?? 0)));
    if (!inmeting && mee.project_id) form.project_id.value = mee.project_id;
    if (!inmeting && mee.klant_id) form.klant_id.value = mee.klant_id;
    vulKlantvelden(inmeting?.customer_id ?? (inmeting ? null : mee.klant_id ?? null));
    koppelAdresvelden(form, { adres: 'kl-adres', postcode: 'kl-postcode', plaats: 'kl-plaats' });
    vulAfspraken(inmeting?.afspraken ?? {});
    if (terugHtml) $('im-terugplek').innerHTML = terugHtml;
    tekenVast();
    tekenChecklist();
    tekenEigenWerk();

    const start = inmeting && (inmeting.kozijnen ?? []).length
      ? ((inmeting.portal_measurement_rooms ?? []).length ? 'beide' : 'kozijnen')
      : 'vloer';
    zetMeet(start);
    vloerSom(form);
    kozijnSom(form);

    document.querySelectorAll('#im-meet button').forEach((b) => b.addEventListener('click', () => zetMeet(b.dataset.m)));
    $('im-ruimte-erbij').addEventListener('click', () => {
      const doel = document.querySelector('#im-ruimtes .fr-zone[data-zone=""] [data-ruimtes]');
      doel.insertAdjacentHTML('beforeend', ruimteBlok({}, 0));
      hernummer();
    });
    $('im-zone-erbij').addEventListener('click', () => {
      const key = voegZoneToe('');
      /* Zonder verdiepingen hingen alle ruimtes los; de eerste verdieping neemt ze mee, want dat
         is bijna altijd wat hij bedoelt (de begane grond). Een tweede verdieping begint leeg. */
      if (zonesLokaal.length === 1) {
        [...document.querySelectorAll('#im-ruimtes .fr-zone[data-zone=""] .fr-ruimte')]
          .forEach((blok) => verplaatsBlok(blok.dataset.key, key));
      }
      document.querySelector(`[data-zonenaam="${key}"]`)?.focus();
    });

    /* Alles wat met keuzes te maken heeft, op de opname en in de panelen van verdiepingen en
       ruimtes. */
    form.addEventListener('click', (e) => {
      const kies = e.target.closest('[data-kies]');
      if (kies) {
        const { niv, k, s } = kies.dataset;
        const d = def(s);
        let waarde = kies.dataset.kies;
        if (d?.soort === 'ja-nee') waarde = waarde === 'true';
        const nu = resolveer(s, niv, k);
        const eigen = nu.vanaf === NIVEAU[niv];
        /* Nog een keer op de eigen keuze drukken is hem loslaten. */
        zetInst(niv, k, s, eigen && nu.waarde === waarde ? undefined : waarde);
        naKeuze(niv, k);
        return;
      }
      const erf = e.target.closest('[data-erf]');
      if (erf) { zetInst(erf.dataset.niv, erf.dataset.k, erf.dataset.s, undefined); naKeuze(erf.dataset.niv, erf.dataset.k); return; }
      const erfTaak = e.target.closest('[data-erf-taak]');
      if (erfTaak) { zetTaak(erfTaak.dataset.niv, erfTaak.dataset.k, erfTaak.dataset.t, undefined); naKeuze(erfTaak.dataset.niv, erfTaak.dataset.k); return; }
      const afwijk = e.target.closest('[data-afwijk]');
      if (afwijk) {
        const sleutel = paneelSleutel(afwijk.dataset.niv, afwijk.dataset.afwijk);
        if (open.has(sleutel)) open.delete(sleutel); else open.add(sleutel);
        tekenAfwijk(afwijk.dataset.niv, afwijk.dataset.afwijk);
        return;
      }
      const zoneRuimte = e.target.closest('[data-zone-ruimte]');
      if (zoneRuimte) {
        const zk = zoneRuimte.dataset.zoneRuimte;
        const doel = document.querySelector(`#im-ruimtes .fr-zone[data-zone="${zk}"] [data-ruimtes]`);
        const blok = ruimteBlok({}, 0, `n${++teller}`);
        doel.insertAdjacentHTML('beforeend', blok);
        const nieuw = doel.lastElementChild;
        ruimteZone.set(nieuw.dataset.key, zk);
        hernummer();
        return;
      }
      const zoneWeg = e.target.closest('[data-zone-weg]');
      if (zoneWeg) { haalZoneWeg(zoneWeg.dataset.zoneWeg); vloerSom(form); return; }

      /* De vlakken en de wanden van een ruimte. */
      const geo = e.target.closest('[data-geo]');
      if (geo) { openGeo(geo.dataset.geo, geo.dataset.k); return; }
      const vlakRij = e.target.closest('.fr-vlak');
      if (vlakRij) {
        const rk = vlakRij.dataset.k;
        const i = Number(vlakRij.dataset.vlak);
        const lijst = vlakkenVan.get(rk) ?? [];
        const teken = e.target.closest('[data-vteken]');
        if (teken) { lijst[i].teken = teken.dataset.vteken; vlakkenGeraakt.add(rk); tekenGeo('vlakken', rk); return; }
        if (e.target.closest('[data-vlak-weg]')) { lijst.splice(i, 1); vlakkenGeraakt.add(rk); tekenGeo('vlakken', rk); return; }
      }
      const vlakErbij = e.target.closest('[data-vlak-erbij]');
      if (vlakErbij) {
        const rk = vlakErbij.dataset.k;
        const lijst = vlakkenVan.get(rk) ?? [];
        lijst.push({ naam: '', teken: vlakErbij.dataset.vlakErbij, lengte: '', breedte: '' });
        vlakkenVan.set(rk, lijst);
        vlakkenGeraakt.add(rk);
        tekenGeo('vlakken', rk);
        return;
      }
      const rechthoek = e.target.closest('[data-rechthoek]');
      if (rechthoek) {
        const rk = rechthoek.dataset.k;
        vlakkenVan.set(rk, []);
        handmatigVan.delete(rk);
        vlakkenGeraakt.add(rk);
        open.delete(paneelSleutel('vlakken', rk));
        tekenGeo('vlakken', rk);
        return;
      }
      const wandRij = e.target.closest('.fr-wand');
      if (wandRij) {
        const rk = wandRij.dataset.k;
        const i = Number(wandRij.dataset.wand);
        const lijst = wandenVan.get(rk) ?? [];
        const plint = e.target.closest('[data-wplint]');
        if (plint) { lijst[i].plint = plint.dataset.wplint || null; wandenGeraakt.add(rk); tekenGeo('wanden', rk); return; }
        const openingWeg = e.target.closest('[data-opening-weg]');
        if (openingWeg) { lijst[i].openingen.splice(Number(openingWeg.dataset.openingWeg), 1); wandenGeraakt.add(rk); tekenGeo('wanden', rk); return; }
        const openingErbij = e.target.closest('[data-opening-erbij]');
        if (openingErbij) { lijst[i].openingen.push({ lengte: '', reden: '' }); wandenGeraakt.add(rk); tekenGeo('wanden', rk); return; }
        if (e.target.closest('[data-wand-weg]')) { lijst.splice(i, 1); wandenGeraakt.add(rk); tekenGeo('wanden', rk); return; }
      }
      const wandErbij = e.target.closest('[data-wand-erbij]');
      if (wandErbij) {
        const rk = wandErbij.dataset.k;
        const lijst = wandenVan.get(rk) ?? [];
        lijst.push({ label: String.fromCharCode(65 + lijst.length), lengte: '', plint: null, openingen: [] });
        wandenVan.set(rk, lijst);
        wandenGeraakt.add(rk);
        tekenGeo('wanden', rk);
        return;
      }
      const rondom = e.target.closest('[data-rondom]');
      if (rondom) {
        const rk = rondom.dataset.k;
        wandenVan.set(rk, []);
        wandenGeraakt.add(rk);
        open.delete(paneelSleutel('wanden', rk));
        tekenGeo('wanden', rk);
        return;
      }

      const weg = e.target.closest('[data-ruimte-weg]');
      if (weg) {
        if (document.querySelectorAll('#im-ruimtes .fr-ruimte').length <= 1) { meldRegel('Een inmeting heeft minstens een ruimte.'); return; }
        weg.closest('.fr-ruimte').remove();
        perRuimte.delete(weg.dataset.ruimteWeg);
        ruimteZone.delete(weg.dataset.ruimteWeg);
        vlakkenVan.delete(weg.dataset.ruimteWeg);
        wandenVan.delete(weg.dataset.ruimteWeg);
        handmatigVan.delete(weg.dataset.ruimteWeg);
        hernummer();
        vloerSom(form);
      }
    });

    form.addEventListener('change', (e) => {
      const vak = e.target.closest('[data-taak]');
      if (vak) {
        const { niv, k, t } = vak.dataset;
        if (niv === 'opname') { zelfGezet.add(t); viaVoorstel.delete(t); }
        zetTaak(niv, k, t, vak.checked);
        naKeuze(niv, k);
        return;
      }
      const keuze = e.target.closest('[data-zonekeuze]');
      if (keuze) verplaatsBlok(keuze.dataset.zonekeuze, keuze.value);
    });

    form.addEventListener('input', (e) => {
      const getal = e.target.closest('[data-getal]');
      if (getal) {
        const { niv, k, s } = getal.dataset;
        const ruw = getal.value.trim();
        zetInst(niv, k, s, ruw === '' ? undefined : num(ruw));
        return;
      }
      const tekst = e.target.closest('[data-tekst]');
      if (tekst) {
        const { niv, k, s } = tekst.dataset;
        const ruw = tekst.value.trim();
        zetInst(niv, k, s, ruw === '' ? undefined : ruw);
        return;
      }
      /* De velden in de panelen voor vlakken en wanden: de staat volgt de toets, het paneel
         hertekent pas bij het verlaten van het veld. */
      const vlakVeld = e.target.closest('.fr-vlak [data-v]');
      if (vlakVeld) {
        const rij = vlakVeld.closest('.fr-vlak');
        const lijst = vlakkenVan.get(rij.dataset.k) ?? [];
        const vlak = lijst[Number(rij.dataset.vlak)];
        if (vlak) {
          vlak[vlakVeld.dataset.v] = vlakVeld.value;
          /* De maat van dit vlak meteen bijwerken, in de rij zelf; het paneel hertekent hier niet,
             want dat zou het veld waar hij net in klikte weer loslaten. */
          const maat = rij.querySelector('.maatje');
          if (maat) maat.textContent = `${vlak.teken === 'min' ? '-' : ''}${komma(num(vlak.lengte) * num(vlak.breedte))} m2`;
        }
        vlakkenGeraakt.add(rij.dataset.k);
        vloerSom(form);
        return;
      }
      const handmatig = e.target.closest('[data-handmatig]');
      if (handmatig) {
        const rk = handmatig.dataset.k;
        if (handmatig.value.trim()) handmatigVan.set(rk, handmatig.value.trim()); else handmatigVan.delete(rk);
        vlakkenGeraakt.add(rk);
        vloerSom(form);
        return;
      }
      const wandVeld = e.target.closest('.fr-wand [data-w]');
      if (wandVeld) {
        const rij = wandVeld.closest('.fr-wand');
        const lijst = wandenVan.get(rij.dataset.k) ?? [];
        if (lijst[Number(rij.dataset.wand)]) lijst[Number(rij.dataset.wand)][wandVeld.dataset.w] = wandVeld.value;
        wandenGeraakt.add(rij.dataset.k);
        vloerSom(form);
        return;
      }
      const openingVeld = e.target.closest('.fr-opening [data-o]');
      if (openingVeld) {
        const rij = openingVeld.closest('.fr-opening');
        const wand = rij.closest('.fr-wand');
        const lijst = wandenVan.get(wand.dataset.k) ?? [];
        const o = lijst[Number(wand.dataset.wand)]?.openingen?.[Number(rij.dataset.opening)];
        if (o) o[openingVeld.dataset.o] = openingVeld.value;
        wandenGeraakt.add(wand.dataset.k);
        vloerSom(form);
        return;
      }
      const zonenaam = e.target.closest('[data-zonenaam]');
      if (zonenaam) {
        const z = zonesLokaal.find((x) => x.key === zonenaam.dataset.zonenaam);
        if (z) z.naam = zonenaam.value.trim();
        document.querySelectorAll('#im-ruimtes [data-zonekeuzeplek]').forEach((plek) => {
          plek.innerHTML = zoneKeuze(plek.closest('.fr-ruimte').dataset.key);
        });
        return;
      }
      vloerSom(form);
      kozijnSom(form);
    });

    /* Na een keuze het niveau opnieuw tekenen: op de opname ook de checklist, want de voorstellen
       volgen de antwoorden; in een paneel alleen dat paneel, plus de panelen eronder die erven. */
    function naKeuze(niv, k) {
      if (niv === 'opname') {
        pasVoorstellenToe();
        tekenVast();
        tekenChecklist();
        open.forEach((p) => { const [n, key] = p.split(':'); tekenAfwijk(n, key); });
      } else if (niv === 'zone') {
        tekenAfwijk('zone', k);
        open.forEach((p) => { const [n, key] = p.split(':'); if (n === 'ruimte' && (ruimteZone.get(key) || '') === k) tekenAfwijk('ruimte', key); });
      } else {
        tekenAfwijk('ruimte', k);
      }
    }

    /* Een getal wijzigen hertekent niet bij elke aanslag (dan springt de cursor weg), maar wel
       zodra het veld verlaten wordt: dan staat de herkomst weer goed. */
    /* Een getal wijzigen hertekent niet bij elke aanslag (dan springt de cursor weg), maar wel
       zodra de aandacht het blok verlaat: dan staat de herkomst weer goed. Gaat de aandacht naar
       een ander veld in hetzelfde blok, dan blijft alles staan, anders raakt hij het veld waar hij
       net in klikte kwijt (gevonden 04-09-2026 in de schermcontrole van de vlakken). De vlakken
       en wanden hertekenen hier helemaal niet: hun sommen worden bij het typen al bijgewerkt. */
    form.addEventListener('focusout', (e) => {
      const veld = e.target.closest('[data-getal], [data-tekst]');
      if (!veld) return;
      const blok = veld.closest('.fr-afwijk, #im-vast, #im-checklist');
      if (e.relatedTarget && blok && blok.contains(e.relatedTarget)) return;
      naKeuze(veld.dataset.niv, veld.dataset.k);
    });

    form.klant_id.addEventListener('change', () => vulKlantvelden(form.klant_id.value || null));
    $('im-afspraken').addEventListener('input', telAfspraken);
    $('im-kozijn-erbij').addEventListener('click', () => {
      const doos = $('im-kozijnen');
      doos.insertAdjacentHTML('beforeend', kozijnBlok({}, doos.children.length + 1));
    });
    $('im-eigen-erbij').addEventListener('click', () => { eigenWerk.push({ omschrijving: '', aantal: 1, eenheid: 'vast' }); tekenEigenWerk(); });
    $('im-eigenwerk').addEventListener('input', (e) => {
      const rij = e.target.closest('.fr-werkregel');
      if (rij && e.target.dataset.w) eigenWerk[Number(rij.dataset.i)][e.target.dataset.w] = e.target.value;
    });
    $('im-eigenwerk').addEventListener('click', (e) => {
      if (e.target.dataset.wWeg === undefined) return;
      eigenWerk.splice(Number(e.target.dataset.wWeg), 1);
      tekenEigenWerk();
    });

    /* Bewaren mag maar een keer tegelijk. Zonder dit slot leverden drie snelle klikken drie
       inmetingen op; het scherm wachtte op de motor en liet de knop ondertussen klikbaar. */
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const knop = form.querySelector('button[type=submit]');
      if (knop && knop.disabled) return;
      if (knop) knop.disabled = true;
      $('im-fout').textContent = '';
      try {
        await bewaar(form);
        meldRegel('Inmeting bewaard.');
        naBewaren();
      } catch (err) {
        $('im-fout').textContent = err.message;
      } finally {
        if (knop && knop.isConnected) knop.disabled = false;
      }
    });
  }

  return { toon };
}
