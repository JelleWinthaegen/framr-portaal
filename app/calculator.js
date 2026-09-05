/* De projectcalculator van het Framr.one Portaal.

   Een op een dezelfde rekenregels als de Oaklyn-calculator (shopify-themes/oaklyn/
   sections/oaklyn-calculator.liquid): pakken naar boven afronden, de partnerprijs
   volgens de kassa-afronding (winkelprijs incl btw, korting naar beneden op hele
   centen), snijverlies 10 of 15 procent uit het legpatroon, en de toebehoren met
   hun verbruik uit de prijslaag. De prijzen komen van de motor; wie geen niveau
   heeft krijgt geen partnerprijzen mee en ziet ze dus ook niet. */

export function maakCalculator({ motor, euro, schoon, meldRegel, naBewaren, naOfferte }) {
  let PRODUCTS = [];
  let PARTNER = false;
  let PLINTLENGTE = 2.4;
  let LIJM = null;
  const PRIMERS = {};
  let ONDER = null;
  let PLINT = null;
  const EG = {};
  const KORT = {};
  const INCL = {};
  let HUIDIG = null;

  /* Meerdere vloeren in een klus.

     De inmeetkaart laat per ruimte invullen welke vloer daar komt; twee ruimtes met een andere
     vloer zijn een klus met twee opbouwen. De calculator rekent er daarom een tegelijk door en
     onthoudt de rest: VLOEREN is de lijst, actief is de vloer die op het scherm staat, en perVloer
     bewaart per vloer wat er ingevuld staat en wat eruit kwam. De bestelling rechts toont ze alle
     twee onder elkaar en telt ze op.

     Bij een vloer verandert er niets: dan is er een groep, geen balk, en werkt het scherm precies
     zoals het altijd deed. */
  let VLOEREN = [];
  let actief = null;
  const perVloer = {};

  /* bron is waar de vloer vandaan komt (stap 5 van de schermbouw): via Framr.one uit de
     prijslijst, van een eigen leverancier met zelf ingevulde prijzen, van de klant (geen
     materiaal via jou) of nog niet gekozen (alleen het werk en de voorbereiding). De toebehoren
     hebben per regel hun eigen keuze of de klant ze levert. Zo staat de materiaalbron per regel
     en niet alleen per vloer, want een normale klus mengt. */
  const staat = { cat: 'pvc-dry', bron: 'framr', verl: 0.10, verlMode: '10', verlTouched: false, btwIncl: false };

  const BRONINFO = {
    framr: 'De vloer komt uit de prijslijst van Framr.one, met jouw partnerprijs.',
    extern: 'Je koopt de vloer ergens anders. Vul in wat hij kost; de calculator rekent de pakken en het snijverlies.',
    klant: 'De klant levert de vloer zelf. Je rekent alleen het werk en wat je zelf meebrengt.',
    onbekend: 'De vloer is nog niet gekozen. Het werk en de voorbereiding worden wel gerekend; het materiaal komt later.',
  };
  const BRONLABEL = { framr: 'via Framr.one', extern: 'eigen leverancier', klant: 'levert de klant', onbekend: 'nog te kiezen' };

  /* De eenheid uit een aantal-als-tekst halen: "11 pakken" wordt "pakken". */
  const eenheidUit = (aantal) => {
    const m = String(aantal ?? '').trim().match(/^[\d.,]+\s+(.+)$/);
    return m ? m[1].trim() : null;
  };

  const ceilP = (n) => (n > 0 ? Math.ceil(n - 1e-9) : 0);
  const $ = (id) => document.getElementById(id);

  /* Partnerprijs zoals de kassa hem rekent: winkelprijs per verpakking incl btw, het
     kortingsbedrag naar beneden afgerond op hele centen, terug naar ex btw. */
  function consP(code, adv, aantal) {
    const advies = adv * aantal;
    const pct = KORT[code];
    if (pct === undefined || pct === null) return { p: advies, c: advies * 0.8, a: advies };
    const inclCent = Math.round((INCL[code] || adv * 1.21) * 100);
    const kortCent = Math.floor(inclCent * Math.round(pct * 10) / 1000);
    return { p: ((inclCent - kortCent) / 121) * aantal, c: advies * 0.8, a: advies };
  }

  const catOf = (p) => p.t || 'pvc-dry';
  const CATTXT = {
    'pvc-dry': 'Lijmvloer: lijm, primer en egaline beschikbaar.',
    'pvc-click': 'Klikvloer: ondervloer en egaline beschikbaar.',
    laminaat: 'Laminaat: ondervloer en plinten. Lijm, primer en egaline zijn alleen voor PVC.',
  };
  const colLabel = (c) => c.replace(/^Laminaat\s*/i, '').replace(/\s+(dryback|klik)$/i, '');
  const btwF = (n) => (staat.btwIncl ? n * 1.21 : n);

  /* Wat er per soort toebehoren in de prijslijst staat, op volgorde. De keuzelijsten worden
     hieruit gevuld.

     Dit stond tot 02-09-2026 als vaste codes in het scherm (JK26, JK01, JK10 tot JK17, JK139,
     PLINT). Bij de prijsronde van die dag kregen de producten andere codes en gingen de oude op
     niet-actief, en toen viel de egaline stilzwijgend uit elke berekening: het scherm zocht JK10
     op, de prijslijst kende alleen nog JK10-25KG. Een materiaallijst waar de egaline zomaar niet
     op staat is erger dan een foutmelding, dus de lijsten komen nu uit de prijslijst zelf en een
     soort die er niet in staat zegt dat met zoveel woorden. */
  const PER_SOORT = { lijm: [], primer: [], egaline: [], ondervloer: [], plint: [] };

  function vulPrijzen(d) {
    PRODUCTS = d.vloeren || [];
    PARTNER = !!d.niveau;
    Object.keys(PER_SOORT).forEach((k) => { PER_SOORT[k] = []; });
    (d.toebehoren || []).forEach((t) => {
      if (t.k !== undefined && t.k !== null) KORT[t.code] = t.k;
      if (t.incl !== undefined && t.incl !== null) INCL[t.code] = t.incl;
      if (PER_SOORT[t.soort]) PER_SOORT[t.soort].push(t);
      if (t.soort === 'primer') PRIMERS[t.code] = [null, t.adv, t.inhoud, t.verbruik];
      if (t.soort === 'egaline') EG[t.code] = [null, t.adv, t.inhoud, t.verbruik];
    });
    /* Lijm en ondervloer hebben geen keuzelijst op het scherm; daarvan geldt de eerste uit de
       lijst. Bij de plint bepaalt de lengte uit de verpakking hoeveel er nodig zijn. */
    const lijm = PER_SOORT.lijm[0];
    LIJM = lijm ? [lijm.code, lijm.adv, lijm.inhoud, lijm.verbruik] : null;
    const onder = PER_SOORT.ondervloer[0];
    ONDER = onder ? [onder.code, onder.adv, onder.inhoud] : null;
    const plint = PER_SOORT.plint[0];
    PLINT = plint ? [plint.code, plint.adv] : null;
    if (plint && plint.inhoud) PLINTLENGTE = plint.inhoud;
  }

  /* Een keuzelijst vullen met wat er in de prijslijst staat. Staat er niets, dan gaat het hele
     blok dicht met de reden erbij, in plaats van een vinkje dat niets doet. */
  function vulToebehoren(soort, selId, blokId) {
    const lijst = PER_SOORT[soort] ?? [];
    const sel = $(selId);
    const blok = $(blokId);
    if (sel) {
      const vorige = sel.value;
      sel.innerHTML = lijst.map((t) => `<option value="${t.code}">${schoon(t.naam || t.code)}</option>`).join('');
      if (lijst.some((t) => t.code === vorige)) sel.value = vorige;
    }
    if (blok) {
      const leeg = !lijst.length;
      blok.classList.toggle('fr-acc-leeg', leeg);
      const vink = blok.querySelector('input[type=checkbox]');
      if (vink) { vink.disabled = leeg; if (leeg) vink.checked = false; }
      let uitleg = blok.querySelector('.fr-acc-geen');
      if (leeg && !uitleg) {
        uitleg = document.createElement('span');
        uitleg.className = 'fr-hint fr-acc-geen';
        uitleg.textContent = `Staat niet in je prijslijst, dus hier niet te kiezen.`;
        blok.appendChild(uitleg);
      }
      if (!leeg && uitleg) uitleg.remove();
    }
  }

  function schil(projecten, voorkeur) {
    const projectOpties = projecten.map((p) =>
      `<option value="${p.id}" ${p.id === voorkeur.project_id ? 'selected' : ''}>${schoon(p.naam)}</option>`).join('');
    return `
    <div class="fr-calc">
      <div class="fr-calc-in">
        <div id="ca-vloerbalk"></div>
        <p class="fr-calc-pt">Stap 1: de vloer</p>
        <div class="fr-form">
          <label>Waar komt de vloer vandaan
            <div class="fr-seg" id="ca-bron">
              <button type="button" data-bron="framr" class="aan">Via Framr.one</button>
              <button type="button" data-bron="extern">Eigen leverancier</button>
              <button type="button" data-bron="klant">Klant levert</button>
              <button type="button" data-bron="onbekend">Nog niet gekozen</button>
            </div>
            <span class="fr-hint" id="ca-broninfo"></span></label>
          <label>Soort vloer
            <div class="fr-seg" id="ca-cat">
              <button type="button" data-cat="pvc-dry" class="aan">PVC lijmvloer</button>
              <button type="button" data-cat="pvc-click">PVC klikvloer</button>
              <button type="button" data-cat="laminaat">Laminaat</button>
            </div>
            <span class="fr-hint" id="ca-catinfo"></span></label>
          <div class="fr-form" id="ca-catalogus" style="margin-top:0">
            <label>Collectie<select id="ca-col"></select></label>
            <label>Decor<select id="ca-dec"></select><span class="fr-hint" id="ca-floorinfo"></span></label>
          </div>
          <div class="fr-veldrij" id="ca-extern" hidden>
            <label>Welke vloer<input id="ca-ext-naam" placeholder="merk, collectie en decor"></label>
            <label style="max-width:120px">m² per pak<input id="ca-ext-pak" inputmode="decimal" value="2"></label>
            <label style="max-width:150px">Inkoop per pak<input id="ca-ext-ink" inputmode="decimal" placeholder="0,00"></label>
            <label style="max-width:150px">Verkoop per pak<input id="ca-ext-verk" inputmode="decimal" placeholder="0,00"></label>
          </div>
        </div>
        <p class="fr-calc-pt">Stap 2: het project</p>
        <div class="fr-form">
          <div class="fr-veldrij">
            <label>Oppervlakte (m²)<input id="ca-m2" inputmode="decimal" value="${voorkeur.m2 ?? 50}"></label>
          </div>
          <label>Snijverlies
            <div class="fr-seg" id="ca-verl">
              <button type="button" data-v="0">Geen</button>
              <button type="button" data-v="10" class="aan">Stroken 10%</button>
              <button type="button" data-v="15">Visgraat 15%</button>
              <button type="button" data-v="eigen">Zelf</button>
            </div>
            <span id="ca-verl-eigen-wrap" style="display:none"><input id="ca-verl-eigen" inputmode="numeric" value="12" style="max-width:110px"></span>
            <span class="fr-hint" id="ca-verliesinfo"></span></label>
        </div>
        <p class="fr-calc-pt">Stap 3: de toebehoren</p>
        <p class="fr-hint">Per regel kun je zeggen dat de klant het zelf levert; dan staat het wel op de lijst, maar zonder prijs.</p>
        <div class="fr-form" id="ca-accs">
          <div class="fr-acc" id="acc-lijm"><label class="kop"><input type="checkbox" id="ca-lijm-on" checked> Lijm <span class="advies">advies</span>
              <label class="fr-acc-klant"><input type="checkbox" id="ca-klant-lijm"> klant levert</label></label>
            <span class="fr-hint" id="ca-lijm-naam"></span></div>
          <div class="fr-acc" id="acc-primer"><label class="kop"><input type="checkbox" id="ca-primer-on"> Primer
              <label class="fr-acc-klant"><input type="checkbox" id="ca-klant-primer"> klant levert</label></label>
            <select id="ca-primer-sel"></select></div>
          <div class="fr-acc" id="acc-onder"><label class="kop"><input type="checkbox" id="ca-onder-on" checked> Ondervloer <span class="advies">bij klik</span>
              <label class="fr-acc-klant"><input type="checkbox" id="ca-klant-onder"> klant levert</label></label>
            <span class="fr-hint" id="ca-onder-naam"></span></div>
          <div class="fr-acc" id="acc-egaline"><label class="kop"><input type="checkbox" id="ca-eg-on" checked> Egaline
              <label class="fr-acc-klant"><input type="checkbox" id="ca-klant-eg"> klant levert</label></label>
            <div class="fr-veldrij">
              <select id="ca-eg-sel"></select>
              <label style="max-width:110px">Laagdikte (mm)<input id="ca-eg-mm" inputmode="numeric" value="3"></label>
            </div></div>
          <div class="fr-acc" id="acc-plint"><label class="kop"><input type="checkbox" id="ca-plint-on" ${voorkeur.omtrek ? 'checked' : ''}> Plinten <span class="advies">advies</span>
              <label class="fr-acc-klant"><input type="checkbox" id="ca-klant-plint"> klant levert</label></label>
            <div class="fr-veldrij">
              <select id="ca-plint-sel"></select>
              <label style="max-width:130px">Strekkende meter<input id="ca-plint-m" inputmode="decimal" value="${voorkeur.omtrek ?? 0}"></label>
            </div></div>
        </div>
      </div>
      <div class="fr-calc-uit">
        <p class="fr-calc-pt">Jouw bestelling</p>
        <div class="fr-seg klein" id="ca-btw"><button type="button" data-b="ex" class="aan">ex btw</button><button type="button" data-b="incl">incl btw</button></div>
        <div class="fr-calc-verlies" id="ca-verlies-line"></div>
        <div id="ca-rows"></div>
        <div class="fr-calc-tot">
          <div class="regel stil">Adviesprijs <s id="ca-adv">€ 0,00</s></div>
          <div class="regel groen" data-partner>Jouw korting <span id="ca-korting">0%</span> (bespaart <span id="ca-besparing">€ 0,00</span>)</div>
          <div class="regel groen" data-partner>Je klant bespaart <span id="ca-klant-bespaart">€ 0,00</span> t.o.v. de adviesprijs</div>
          <div class="som" data-partner><span>Jij betaalt</span><b id="ca-tot-ink">€ 0,00</b></div>
          <div class="som" data-partner><span>Verkoop aan je klant</span><b id="ca-verk">€ 0,00</b></div>
          <div class="som marge" data-partner><span>Jouw marge</span><b id="ca-marge">€ 0,00</b></div>
          <div class="som" data-bezoeker hidden><span>Totaal adviesprijs</span><b id="ca-adv2">€ 0,00</b></div>
        </div>
        <div class="fr-form" style="margin-top:18px">
          <label>Naam van deze berekening<input id="ca-naam" placeholder="Klusnaam met de vloer"></label>
          <label>Hoort bij<select id="ca-project"><option value="">geen klus</option>${projectOpties}</select></label>
          <div class="fr-knoppenrij">
            <button class="fr-knop" id="ca-offerte" type="button">Maak offerte</button>
            <button class="fr-knop tweede" id="ca-bewaar" type="button">Berekening bewaren</button>
          </div>
          <p class="fr-hint">Bestellen volgt straks rechtstreeks uit de offerte; die knop komt met de besteladapter.</p>
          <p class="fr-formfout" id="ca-fout"></p>
        </div>
      </div>
    </div>`;
  }

  function fillCols() {
    const col = $('ca-col');
    const keep = col.value;
    const seen = [];
    col.innerHTML = '';
    PRODUCTS.forEach((p) => { if (catOf(p) === staat.cat && !seen.includes(p.c)) seen.push(p.c); });
    seen.forEach((c) => {
      const o = document.createElement('option');
      o.value = c; o.textContent = colLabel(c);
      col.appendChild(o);
    });
    if (seen.includes(keep)) col.value = keep;
    $('ca-catinfo').textContent = CATTXT[staat.cat] || '';
  }

  function fillDecors() {
    const dec = $('ca-dec');
    dec.innerHTML = '';
    PRODUCTS.forEach((p, i) => {
      if (p.c === $('ca-col').value && catOf(p) === staat.cat) {
        const o = document.createElement('option');
        o.value = String(i); o.textContent = `${p.d} (${p.art})`;
        dec.appendChild(o);
      }
    });
  }

  const cur = () => PRODUCTS[parseInt($('ca-dec').value, 10)];

  /* De plintenlijst komt uit de prijslijst, want daar staat wat je kunt bestellen en wat het kost.
     Tot 02-09-2026 kwam hij uit het veld plintcode van de vloeren (L107, L141, L151). Dat is geen
     bestelbaar artikel maar een verwijzing naar een profiel, en sinds de prijsronde staan er twaalf
     echte plinten in de prijslijst met elk hun eigen prijs. Het scherm toonde toen een code die
     nergens op sloeg met de prijs van een willekeurige andere plint erbij. */
  function vulPlinten() {
    const sel = $('ca-plint-sel');
    if (!sel) return;
    const vorige = sel.value;
    sel.innerHTML = PER_SOORT.plint
      .map((t) => `<option value="${t.code}">${schoon(t.naam || t.code)}</option>`).join('');
    if (PER_SOORT.plint.some((t) => t.code === vorige)) sel.value = vorige;
    const blok = $('acc-plint');
    if (blok) {
      const leeg = !PER_SOORT.plint.length;
      const vink = $('ca-plint-on');
      if (vink) { vink.disabled = leeg; if (leeg) vink.checked = false; }
    }
  }

  function setVerl(mode, touched) {
    staat.verlMode = mode;
    if (touched) staat.verlTouched = true;
    $('ca-verl-eigen-wrap').style.display = mode === 'eigen' ? 'inline-block' : 'none';
    staat.verl = mode === 'eigen' ? (parseFloat($('ca-verl-eigen').value) || 0) / 100 : parseFloat(mode) / 100;
    document.querySelectorAll('#ca-verl button').forEach((b) => b.classList.toggle('aan', b.dataset.v === mode));
  }

  function accToon(id, zichtbaar) {
    const el = $(id);
    if (el) el.style.display = zichtbaar ? '' : 'none';
  }

  /* ---------- wisselen tussen de vloeren van een klus ---------- */

  /* De invoervelden die bij een vloer horen. De naam van de berekening en de klus staan hier
     bewust niet bij: die gelden voor de hele klus en niet voor een vloer. */
  const VELDEN = ['ca-col', 'ca-dec', 'ca-m2', 'ca-verl-eigen', 'ca-primer-sel', 'ca-eg-sel', 'ca-eg-mm', 'ca-plint-sel', 'ca-plint-m',
    'ca-ext-naam', 'ca-ext-pak', 'ca-ext-ink', 'ca-ext-verk'];
  const VINKJES = ['ca-lijm-on', 'ca-primer-on', 'ca-onder-on', 'ca-eg-on', 'ca-plint-on',
    'ca-klant-lijm', 'ca-klant-primer', 'ca-klant-onder', 'ca-klant-eg', 'ca-klant-plint'];

  function leesVelden() {
    const v = { cat: staat.cat, bron: staat.bron, verlMode: staat.verlMode, verlTouched: staat.verlTouched };
    VELDEN.forEach((id) => { const el = $(id); if (el) v[id] = el.value; });
    VINKJES.forEach((id) => { const el = $(id); if (el) v[id] = el.checked; });
    return v;
  }

  function zetBron(bron) {
    staat.bron = bron;
    document.querySelectorAll('#ca-bron button').forEach((b) => b.classList.toggle('aan', b.dataset.bron === bron));
    const catalogus = $('ca-catalogus');
    if (catalogus) catalogus.hidden = bron !== 'framr';
    const extern = $('ca-extern');
    if (extern) extern.hidden = bron !== 'extern';
    const info = $('ca-broninfo');
    if (info) info.textContent = BRONINFO[bron] ?? '';
  }

  /* Een keuzelijst terugzetten op wat er bewaard staat, maar alleen als die keuze er nog in zit.
     Een collectie hoort bij een soort vloer: de klikcollectie bestaat niet onder laminaat, en die
     dan toch proberen te zetten laat de lijst leeg achter en dan rekent er niets meer. */
  function zetKeuze(id, waarde) {
    const el = $(id);
    if (!el) return;
    if (waarde !== undefined && [...el.options].some((o) => o.value === waarde)) el.value = waarde;
    else if (el.options.length) el.value = el.options[0].value;
  }

  function zetVelden(v) {
    staat.cat = v.cat;
    document.querySelectorAll('#ca-cat button').forEach((b) => b.classList.toggle('aan', b.dataset.cat === v.cat));
    zetBron(v.bron ?? 'framr');
    fillCols();
    zetKeuze('ca-col', v['ca-col']);
    fillDecors();
    zetKeuze('ca-dec', v['ca-dec']);
    VELDEN.filter((id) => id !== 'ca-col' && id !== 'ca-dec').forEach((id) => {
      const el = $(id);
      if (el && v[id] !== undefined) el.value = v[id];
    });
    VINKJES.forEach((id) => { const el = $(id); if (el && v[id] !== undefined) el.checked = v[id]; });
    staat.verlTouched = !!v.verlTouched;
    setVerl(v.verlMode ?? '10', false);
    staat.verlTouched = !!v.verlTouched;
  }

  /* De beginstand van een vloer: zijn eigen maten, zijn eigen soort en zijn eigen snijverlies uit
     de inmeting. Wat daar niet vaststaat blijft staan zoals het scherm het nu heeft, want dat is
     meestal wat hij ook voor de volgende vloer wil. */
  function verseVloer(vloer) {
    const v = leesVelden();
    if (vloer.cat && vloer.cat !== v.cat) {
      /* Andere soort vloer, dus de collectie en het decor van de vorige vloer gelden hier niet;
         die worden vers gekozen uit wat er onder deze soort staat. */
      v.cat = vloer.cat;
      delete v['ca-col'];
      delete v['ca-dec'];
    }
    /* De bron uit de inmeting. Een vloer die daar nog niet gekozen is, begint hier bij de
       prijslijst: dit is de plek om hem te kiezen. Wie hem bewust open wil laten kiest dat. */
    v.bron = vloer.bron && vloer.bron !== 'onbekend' ? vloer.bron : 'framr';
    if (v.bron === 'extern' && vloer.product) v['ca-ext-naam'] = vloer.product;
    v['ca-m2'] = vloer.m2 ?? '';
    v['ca-plint-m'] = vloer.omtrek ?? 0;
    v['ca-plint-on'] = !!vloer.omtrek;
    if (vloer.legpatroon) {
      v.verlMode = /visgraat|chevron/i.test(vloer.legpatroon) ? '15' : '10';
      v.verlTouched = true;
    } else {
      v.verlTouched = false;
    }
    return v;
  }

  function tekenVloerbalk() {
    const balk = $('ca-vloerbalk');
    if (!balk) return;
    if (VLOEREN.length < 2) { balk.innerHTML = ''; return; }
    balk.innerHTML = `<p class="fr-calc-pt">De vloeren in deze klus</p>
      <div class="fr-chips" id="ca-vloerkeuze">${VLOEREN.map((v) => {
    const vak = perVloer[v.sleutel];
    const stand = vak?.uitkomst ? euro(btwF(vak.totaal.verk)) : 'nog niet gerekend';
    return `<button type="button" class="fr-keuze${v.sleutel === actief ? ' aan' : ''}" data-vloer="${schoon(v.sleutel)}">${schoon(v.naam)} <span class="qty">${v.m2.toLocaleString('nl-NL')} m² · ${schoon(stand)}</span></button>`;
  }).join('')}</div>
      <p class="fr-hint">Je rekent er een tegelijk door. De bestelling rechts telt alle vloeren bij elkaar op.</p>`;
  }

  function wisselVloer(sleutel) {
    if (sleutel === actief) return;
    perVloer[actief] = { ...(perVloer[actief] ?? {}), invoer: leesVelden() };
    actief = sleutel;
    const vloer = VLOEREN.find((v) => v.sleutel === sleutel);
    zetVelden(perVloer[sleutel]?.invoer ?? verseVloer(vloer));
    calc();
  }

  /* Bij het opstarten wordt elke vloer een keer doorgerekend, met de soort en het legpatroon die
     bij die vloer staan. Anders zou de bestelling alleen de eerste vloer bevatten en zet iemand
     die meteen op Maak offerte drukt de helft van zijn klus niet op de offerte. */
  function rekenAlleVloeren() {
    const beginnen = actief;
    VLOEREN.forEach((v) => {
      if (v.sleutel === beginnen) return;
      perVloer[actief] = { ...(perVloer[actief] ?? {}), invoer: leesVelden() };
      actief = v.sleutel;
      zetVelden(verseVloer(v));
      calc();
    });
    perVloer[actief] = { ...(perVloer[actief] ?? {}), invoer: leesVelden() };
    actief = beginnen;
    zetVelden(perVloer[beginnen].invoer);
    calc();
  }

  function calc() {
    const p = cur();
    const bron = staat.bron;
    /* Staat er onder deze soort vloer niets in de prijslijst, dan valt er niets te rekenen. Dat
       hoort te blijven staan in plaats van stil de vorige uitkomst te laten zien. Bij een andere
       bron is de prijslijst niet nodig voor de vloer zelf. */
    if (bron === 'framr' && !p) {
      perVloer[actief] = { invoer: perVloer[actief]?.invoer };
      tekenUit();
      return;
    }
    const klantLevert = (id) => !!$(id)?.checked;
    /* Wat er aanstond maar niet te rekenen viel. Dit hoort op het scherm en niet stil weggelaten:
       een materiaallijst zonder de egaline erop is een bestelling die tekortkomt. */
    const ontbreekt = [];
    const cat = staat.cat;
    const isDry = cat === 'pvc-dry';
    const isClick = cat !== 'pvc-dry';
    const isPVC = cat !== 'laminaat';
    accToon('acc-lijm', isDry); accToon('acc-primer', isDry);
    accToon('acc-onder', isClick); accToon('acc-egaline', isPVC);
    const soort = cat === 'laminaat' ? 'laminaat (klik)' : (isDry ? 'dryback (lijmvloer)' : 'klikvloer');
    if (p) $('ca-floorinfo').textContent = `${colLabel(p.c)} · ${soort} · pak ${p.pak} m²` + (isDry ? ` · lijm ${p.lijm || 'n.v.t.'}` : '') + ` · plint ${p.pl || 'geen'}`;

    /* Wat er in het oppervlakveld staat. Een komma mag, want zo tikt een legger het. Staat er iets
       dat geen getal is of een getal onder nul, dan rekent hij met nul en zegt hij dat ook: stil
       nul rekenen op een veld waar 40 in lijkt te staan levert een offerte die te laag uitvalt. */
    const oppRuw = String($('ca-m2').value).trim();
    const oppGetal = parseFloat(oppRuw.replace(',', '.'));
    const oppFout = oppRuw !== '' && (!Number.isFinite(oppGetal) || oppGetal < 0);
    const opp = Number.isFinite(oppGetal) && oppGetal > 0 ? oppGetal : 0;
    if (oppFout) ontbreekt.push('het oppervlak is geen bruikbaar getal, dus er is met nul gerekend');
    if (staat.verlMode === 'eigen') staat.verl = (parseFloat($('ca-verl-eigen').value) || 0) / 100;
    const verl = staat.verl;
    const verlPct = (verl * 100).toFixed(verl * 100 % 1 ? 1 : 0).replace('.', ',');
    const vis = /visgraat|chevron|herringbone/i.test(p?.pat || '');
    $('ca-verliesinfo').textContent = staat.verlMode === '0' ? 'Geen snijverlies gerekend.'
      : `Je rekent ${verlPct}% snijverlies.` + (staat.verlTouched ? '' : ` Voorgesteld op basis van ${vis ? 'visgraat/chevron' : 'recht leggen'}.`);
    const bruto = opp * (1 + verl);
    const verliesRegel = `Oppervlak: ${opp} m² netto + ${verlPct}% snijverlies = ${bruto.toFixed(2)} m² te bestellen`;

    let rows = '';
    let totInk = 0; let totVerk = 0; let totAdv = 0;
    const OFFER = [];
    /* Alle regels, ook die zonder prijs (de klant levert, nog te kiezen). OFFER is wat naar de
       offerte gaat en dus alleen wat een prijs draagt; LIJNEN is wat de calculatie bewaart, met per
       regel zijn bron en de prijs waarmee gerekend is. */
    const LIJNEN = [];
    const nu = new Date().toISOString();
    function addRow(name, qty, uitleg, val, aantal, verk, adv, extra) {
      const bronVan = (extra && extra.bron) || 'framr';
      const label = bronVan === 'framr' ? '' : ` <span class="qty">${BRONLABEL[bronVan]}</span>`;
      rows += `<div class="fr-calc-row"><span class="k"><b>${schoon(name)}</b> <span class="qty">${schoon(qty)}</span>${label}<small>${schoon(uitleg)}</small></span><span class="v">${bronVan === 'klant' || bronVan === 'onbekend' ? '' : euro(btwF(val))}</span></div>`;
      const regel = { naam: name, aantal: qty, stuks: aantal, uitleg, ink: val, verk: verk || 0, adv: adv || 0, ...(extra || {}), bron: bronVan };
      LIJNEN.push(regel);
      if (aantal > 0 && bronVan !== 'klant' && bronVan !== 'onbekend') OFFER.push(regel);
    }
    /* De prijsbasis van een regel uit de prijslijst: met welke prijs er gerekend is en wanneer. */
    const basisUitLijst = (code, omschrijving, inkoopPerStuk, verkoopPerStuk, adviesPerStuk) =>
      ({ bron: 'framr', code, omschrijving, inkoop: inkoopPerStuk, verkoop: verkoopPerStuk, advies: adviesPerStuk, op: nu });

    /* De vloer zelf, langs zijn bron. */
    let vloerLabel = '';
    if (bron === 'framr') {
      const pak = ceilP(bruto / p.pak);
      const pakInclCent = Math.round(p.adv * p.pak * 1.21 * 100);
      const vAdv = pak * (p.adv * p.pak);
      const vVerk = vAdv * 0.8;
      let vInk = vAdv;
      if (p.k !== undefined && p.k !== null) {
        const kortCent = Math.floor(pakInclCent * Math.round(p.k * 10) / 1000);
        vInk = pak * ((pakInclCent - kortCent) / 121);
      }
      vloerLabel = `${colLabel(p.c)} ${p.d}`;
      addRow('Vloer', `${pak} pakken`, `${bruto.toFixed(2)} m² ÷ ${p.pak} m²/pak → ${pak} pak (${(pak * p.pak).toFixed(2)} m²)`, vInk, pak, vVerk, vAdv,
        { code: `vloer:${p.art}`, bron: 'framr', prijsbasis: basisUitLijst(p.art, vloerLabel, pak ? vInk / pak : null, pak ? vVerk / pak : null, p.adv * p.pak) });
      totInk += vInk; totVerk += vVerk; totAdv += vAdv;
    } else if (bron === 'extern') {
      const naam = String($('ca-ext-naam').value || '').trim();
      const pakInhoud = parseFloat(String($('ca-ext-pak').value).replace(',', '.')) || 0;
      const inkPerPak = parseFloat(String($('ca-ext-ink').value).replace(',', '.')) || 0;
      const verkPerPak = parseFloat(String($('ca-ext-verk').value).replace(',', '.')) || inkPerPak;
      vloerLabel = naam || 'vloer van eigen leverancier';
      if (pakInhoud > 0) {
        const pak = ceilP(bruto / pakInhoud);
        const vInk = pak * inkPerPak;
        const vVerk = pak * verkPerPak;
        addRow(`Vloer, ${vloerLabel}`, `${pak} pakken`, `${bruto.toFixed(2)} m² ÷ ${pakInhoud} m²/pak → ${pak} pak, eigen leverancier`, vInk, pak, vVerk, vVerk,
          { bron: 'extern', prijsbasis: { bron: 'extern', code: null, omschrijving: vloerLabel, inkoop: inkPerPak, verkoop: verkPerPak, advies: null, op: nu } });
        totInk += vInk; totVerk += vVerk; totAdv += vVerk;
        if (!inkPerPak) ontbreekt.push('de inkoopprijs per pak van je eigen vloer staat nog op nul');
      } else {
        ontbreekt.push('bij je eigen vloer ontbreekt het aantal m² per pak, dus de pakken zijn niet te rekenen');
      }
    } else if (bron === 'klant') {
      vloerLabel = 'vloer van de klant';
      addRow('Vloer, levert de klant', `${bruto.toFixed(2)} m² bruto`, `${opp} m² netto plus ${verlPct}% snijverlies; geen materiaal via jou`, 0, 0, 0, 0, { bron: 'klant' });
    } else {
      vloerLabel = 'vloer nog te kiezen';
      addRow('Vloer, nog te kiezen', `${bruto.toFixed(2)} m² bruto`, 'het werk en de voorbereiding zijn wel gerekend; de vloer komt er later bij', 0, Number(bruto.toFixed(2)), 0, 0, { bron: 'onbekend' });
    }

    if (isDry && $('ca-lijm-on').checked && LIJM) {
      const lijm = PER_SOORT.lijm[0];
      const lkg = opp * LIJM[3];
      const em = ceilP(lkg / LIJM[2]);
      const c = consP(LIJM[0], LIJM[1], em);
      if (klantLevert('ca-klant-lijm')) {
        addRow(lijm.naam || `Lijm ${LIJM[0]}`, `${em} ${lijm.eenheid || 'stuk'}`, `${lkg.toFixed(1)} kg nodig`, 0, em, 0, 0, { code: `lijm:${LIJM[0]}`, bron: 'klant' });
      } else {
        addRow(lijm.naam || `Lijm ${LIJM[0]}`, `${em} ${lijm.eenheid || 'stuk'}`,
          `${opp} m² × ${LIJM[3]} kg = ${lkg.toFixed(1)} kg ÷ ${LIJM[2]} kg/${lijm.eenheid || 'stuk'} → ${em}`,
          c.p, em, c.c, c.a, { code: `lijm:${LIJM[0]}`, ruw: lkg / LIJM[2], bron: 'framr', prijsbasis: basisUitLijst(LIJM[0], lijm.naam, em ? c.p / em : null, em ? c.c / em : null, LIJM[1]) });
        totInk += c.p; totVerk += c.c; totAdv += c.a;
      }
    }
    if (isDry && $('ca-primer-on').checked) {
      const codePr = $('ca-primer-sel').value;
      const PR = PRIMERS[codePr];
      const rij = PER_SOORT.primer.find((t) => t.code === codePr);
      if (PR && PR[2] && PR[3]) {
        const pkg = opp * PR[3];
        const pp = ceilP(pkg / PR[2]);
        const cpr = consP(codePr, PR[1], pp);
        if (klantLevert('ca-klant-primer')) {
          addRow(rij?.naam || `Primer ${codePr}`, `${pp} ${rij?.eenheid || 'stuk'}`, `${pkg.toFixed(1)} kg nodig`, 0, pp, 0, 0, { code: `primer:${codePr}`, bron: 'klant' });
        } else {
          addRow(rij?.naam || `Primer ${codePr}`, `${pp} ${rij?.eenheid || 'stuk'}`,
            `${opp} m² × ${PR[3]} kg = ${pkg.toFixed(1)} kg ÷ ${PR[2]} kg → ${pp}`,
            cpr.p, pp, cpr.c, cpr.a, { code: `primer:${codePr}`, ruw: pkg / PR[2], bron: 'framr', prijsbasis: basisUitLijst(codePr, rij?.naam, pp ? cpr.p / pp : null, pp ? cpr.c / pp : null, PR[1]) });
          totInk += cpr.p; totVerk += cpr.c; totAdv += cpr.a;
        }
      }
    }
    /* Een ondervloer zonder inhoud per verpakking is niet om te rekenen naar een aantal pakken;
       dan is delen door niets een getal dat nergens op slaat. Liever geen regel dan een verzonnen
       aantal, met de reden erbij. */
    if (isClick && $('ca-onder-on').checked && ONDER) {
      const onder = PER_SOORT.ondervloer[0];
      if (ONDER[2]) {
        const opak = ceilP(bruto / ONDER[2]);
        const co = consP(ONDER[0], ONDER[1], opak);
        if (klantLevert('ca-klant-onder')) {
          addRow(onder.naam || `Ondervloer ${ONDER[0]}`, `${opak} ${onder.eenheid || 'pak'}`, `${bruto.toFixed(2)} m² nodig`, 0, opak, 0, 0, { code: `onder:${ONDER[0]}`, bron: 'klant' });
        } else {
          addRow(onder.naam || `Ondervloer ${ONDER[0]}`, `${opak} ${onder.eenheid || 'pak'}`,
            `${bruto.toFixed(2)} m² ÷ ${ONDER[2]} m²/${onder.eenheid || 'pak'} → ${opak}`,
            co.p, opak, co.c, co.a, { code: `onder:${ONDER[0]}`, ruw: bruto / ONDER[2], bron: 'framr', prijsbasis: basisUitLijst(ONDER[0], onder.naam, opak ? co.p / opak : null, opak ? co.c / opak : null, ONDER[1]) });
          totInk += co.p; totVerk += co.c; totAdv += co.a;
        }
      } else {
        ontbreekt.push(`${onder.naam || 'de ondervloer'} staat in je prijslijst zonder inhoud per verpakking, dus het aantal is niet te rekenen`);
      }
    }
    if (isPVC && $('ca-eg-on').checked) {
      const codeEg = $('ca-eg-sel').value;
      const e = EG[codeEg];
      const rij = PER_SOORT.egaline.find((t) => t.code === codeEg);
      if (e && e[2] && e[3]) {
        const mm = parseFloat($('ca-eg-mm').value) || 0;
        const egkg = opp * e[3] * mm;
        const zak = ceilP(egkg / e[2]);
        const ce = consP(codeEg, e[1], zak);
        if (klantLevert('ca-klant-eg')) {
          addRow(rij?.naam || `Egaline ${codeEg}`, `${zak} ${rij?.eenheid || 'zak'}`, `${egkg.toFixed(0)} kg bij ${mm} mm nodig`, 0, zak, 0, 0, { code: `eg:${codeEg}`, bron: 'klant' });
        } else {
          addRow(rij?.naam || `Egaline ${codeEg}`, `${zak} ${rij?.eenheid || 'zak'}`,
            `${opp} m² × ${mm} mm × ${e[3]} kg = ${egkg.toFixed(0)} kg ÷ ${e[2]} kg/${rij?.eenheid || 'zak'} → ${zak}`,
            ce.p, zak, ce.c, ce.a, { code: `eg:${codeEg}`, ruw: egkg / e[2], bron: 'framr', prijsbasis: basisUitLijst(codeEg, rij?.naam, zak ? ce.p / zak : null, zak ? ce.c / zak : null, e[1]) });
          totInk += ce.p; totVerk += ce.c; totAdv += ce.a;
        }
      } else if (!e) {
        ontbreekt.push('de egaline die aanstaat komt niet voor in je prijslijst');
      }
    }
    if ($('ca-plint-on').checked) {
      const codePl = $('ca-plint-sel').value;
      const rij = PER_SOORT.plint.find((t) => t.code === codePl);
      const pm = parseFloat(String($('ca-plint-m').value).replace(',', '.')) || 0;
      if (klantLevert('ca-klant-plint')) {
        addRow('Plinten', `${pm} m`, `${pm} m plint nodig`, 0, pm, 0, 0, { bron: 'klant' });
      } else if (rij) {
        const lengte = rij.inhoud || PLINTLENGTE;
        const pbruto = pm * 1.1;
        const pcnt = ceilP(pbruto / lengte);
        const cpl = consP(codePl, rij.adv, pcnt);
        addRow(rij.naam || `Plinten ${codePl}`, `${pcnt} stuks`,
          `${pm} m + 10% = ${pbruto.toFixed(1)} m ÷ ${lengte} m/stuk → ${pcnt}`,
          cpl.p, pcnt, cpl.c, cpl.a, { code: `plint:${codePl}`, ruw: pbruto / lengte, bron: 'framr', prijsbasis: basisUitLijst(codePl, rij.naam, pcnt ? cpl.p / pcnt : null, pcnt ? cpl.c / pcnt : null, rij.adv) });
        totInk += cpl.p; totVerk += cpl.c; totAdv += cpl.a;
      } else {
        ontbreekt.push('de plint die aanstaat komt niet voor in je prijslijst');
      }
    }

    /* Wat er voor deze vloer uitkwam gaat in zijn eigen vakje; het scherm tekent daarna alle
       vloeren die er zijn. Zo blijft de vloer die niet op het scherm staat gewoon meetellen. */
    if (ontbreekt.length) {
      rows += `<div class="fr-calc-mist">Niet meegerekend: ${schoon(ontbreekt.join('; '))}.
        Vul je prijslijst aan of zet het vinkje uit.</div>`;
    }
    perVloer[actief] = {
      ...(perVloer[actief] ?? {}),
      rows,
      verliesRegel,
      totaal: { ink: totInk, verk: totVerk, adv: totAdv },
      uitkomst: {
        vloer: vloerLabel,
        soort,
        cat,
        bron,
        product: bron === 'framr' ? `${colLabel(p.c)} ${p.d}` : (bron === 'extern' ? vloerLabel : null),
        artikelnummer: bron === 'framr' ? p.art : null,
        pakInhoud: bron === 'framr' ? p.pak : (bron === 'extern' ? (parseFloat(String($('ca-ext-pak').value).replace(',', '.')) || null) : null),
        opp,
        verliesPct: verlPct,
        verlies: verl,
        brutoM2: Number(bruto.toFixed(2)),
        plintM: parseFloat(String($('ca-plint-m').value).replace(',', '.')) || 0,
        regels: OFFER,
        lijnen: LIJNEN,
        totaal: { ink: totInk, verk: totVerk, adv: totAdv },
      },
    };
    tekenUit();
  }

  /* De bestelling rechts: alle vloeren onder elkaar, met de sommen bij elkaar opgeteld. HUIDIG is
     wat er naar de offerte en naar het bewaren gaat, en dat is dus altijd de hele klus. */
  function tekenUit() {
    const gedaan = VLOEREN.filter((v) => perVloer[v.sleutel]?.uitkomst);
    const meer = VLOEREN.length > 1;
    $('ca-rows').innerHTML = gedaan.map((v) => {
      const vak = perVloer[v.sleutel];
      return (meer ? `<p class="fr-calc-vloerkop">${schoon(v.naam)} <span class="qty">${vak.uitkomst.vloer}</span></p>` : '')
        + `<div class="fr-calc-verlies">${schoon(vak.verliesRegel)}</div>${vak.rows}`;
    }).join('');
    $('ca-verlies-line').textContent = '';

    const som = gedaan.reduce((s, v) => {
      const t = perVloer[v.sleutel].totaal;
      return { ink: s.ink + t.ink, verk: s.verk + t.verk, adv: s.adv + t.adv };
    }, { ink: 0, verk: 0, adv: 0 });

    $('ca-tot-ink').textContent = euro(btwF(som.ink));
    $('ca-verk').textContent = euro(btwF(som.verk));
    $('ca-marge').textContent = euro(btwF(som.verk - som.ink));
    $('ca-adv').textContent = euro(btwF(som.adv));
    $('ca-adv2').textContent = euro(btwF(som.adv));
    const kort = som.adv > 0 ? (1 - som.ink / som.adv) * 100 : 0;
    $('ca-korting').textContent = kort.toFixed(0) + '%';
    $('ca-besparing').textContent = euro(btwF(som.adv - som.ink));
    $('ca-klant-bespaart').textContent = euro(btwF(som.adv - som.verk));

    /* Bij meer vloeren draagt elke regel de naam van zijn vloer, want op de offerte moet te zien
       zijn welke pakken bij welke vloer horen. */
    const regels = gedaan.flatMap((v) => perVloer[v.sleutel].uitkomst.regels.map((r) => (meer
      ? { ...r, naam: `${r.naam} (${v.naam})`, vloer: v.naam }
      : r)));

    HUIDIG = gedaan.length ? {
      vloer: gedaan.map((v) => perVloer[v.sleutel].uitkomst.vloer).join(' en '),
      soort: perVloer[gedaan[0].sleutel].uitkomst.soort,
      opp: Math.round(gedaan.reduce((s, v) => s + perVloer[v.sleutel].uitkomst.opp, 0) * 100) / 100,
      verliesPct: perVloer[gedaan[0].sleutel].uitkomst.verliesPct,
      brutoM2: Math.round(gedaan.reduce((s, v) => s + perVloer[v.sleutel].uitkomst.brutoM2, 0) * 100) / 100,
      vloeren: gedaan.map((v) => ({ naam: v.naam, ...perVloer[v.sleutel].uitkomst })),
      regels,
      totaal: som,
      gemaakt: new Date().toISOString(),
    } : null;
    tekenVloerbalk();
    stelNaamVoor();
  }

  function naamVoorstel(klusNaam) {
    if (!HUIDIG) return '';
    return klusNaam ? `${klusNaam} · ${HUIDIG.vloer}` : HUIDIG.vloer;
  }

  let projectenBij = [];
  function stelNaamVoor() {
    const veld = $('ca-naam');
    if (!veld) return;
    if (veld.value && veld.dataset.auto !== '1') return;
    const gekozen = projectenBij.find((pr) => pr.id === $('ca-project').value);
    veld.value = naamVoorstel(gekozen ? gekozen.naam : '');
    veld.dataset.auto = '1';
  }

  /* Het scherm opzetten. voorkeur draagt wat er uit een inmeting meekomt: m2, omtrek,
     legpatroon (stuurt het snijverlies, besluit 2026-08-19) en de klus. */
  async function toon(bak, voorkeur) {
    const [prijzen, p] = await Promise.all([motor('/prijzen'), motor('/projecten')]);
    if (!prijzen.vloeren || !prijzen.vloeren.length) {
      bak.innerHTML = '<div class="fr-leeg">De prijslijst is even niet op te halen. Probeer het zo nog eens.</div>';
      return;
    }
    vulPrijzen(prijzen);
    projectenBij = p.projecten ?? [];
    bak.innerHTML = schil(projectenBij, voorkeur);
    if (!PARTNER) {
      document.querySelectorAll('[data-partner]').forEach((el) => { el.hidden = true; });
      document.querySelector('[data-bezoeker]').hidden = false;
    }
    fillCols();
    if ([...$('ca-col').options].some((o) => o.value === 'Design 555')) $('ca-col').value = 'Design 555';
    fillDecors();
    vulToebehoren('primer', 'ca-primer-sel', 'acc-primer');
    vulToebehoren('egaline', 'ca-eg-sel', 'acc-egaline');
    vulToebehoren('lijm', null, 'acc-lijm');
    vulToebehoren('ondervloer', null, 'acc-onder');
    vulPlinten();
    if ($('ca-lijm-naam')) $('ca-lijm-naam').textContent = PER_SOORT.lijm[0]?.naam ?? '';
    if ($('ca-onder-naam')) $('ca-onder-naam').textContent = PER_SOORT.ondervloer[0]?.naam ?? '';

    /* De vloeren van deze klus. Zonder inmeting is het er een, en dan gedraagt alles zich zoals
       het altijd deed. Kwam hij uit een inmeting met meer vloeren, dan staan ze hier allemaal en
       begint hij bij de eerste. */
    VLOEREN = (voorkeur.vloeren && voorkeur.vloeren.length ? voorkeur.vloeren : [{
      sleutel: '__een', naam: 'De vloer', m2: voorkeur.m2, omtrek: voorkeur.omtrek, legpatroon: voorkeur.legpatroon, cat: null,
    }]);
    actief = VLOEREN[0].sleutel;
    if (VLOEREN[0].cat) {
      staat.cat = VLOEREN[0].cat;
      document.querySelectorAll('#ca-cat button').forEach((b) => b.classList.toggle('aan', b.dataset.cat === staat.cat));
      fillCols(); fillDecors();
    }
    /* De bron van de eerste vloer uit de inmeting; nog niet gekozen begint bij de prijslijst, want
       dit is de plek om te kiezen. */
    zetBron(VLOEREN[0].bron && VLOEREN[0].bron !== 'onbekend' ? VLOEREN[0].bron : 'framr');
    if (staat.bron === 'extern' && VLOEREN[0].product) $('ca-ext-naam').value = VLOEREN[0].product;
    if (VLOEREN.length > 1) {
      $('ca-m2').value = VLOEREN[0].m2 ?? '';
      $('ca-plint-m').value = VLOEREN[0].omtrek ?? 0;
      $('ca-plint-on').checked = !!VLOEREN[0].omtrek;
    }

    const patroonNu = VLOEREN[0].legpatroon ?? voorkeur.legpatroon;
    if (patroonNu) {
      setVerl(/visgraat|chevron/i.test(patroonNu) ? '15' : '10', true);
    }

    $('ca-vloerbalk').addEventListener('click', (e) => {
      const knop = e.target.closest('[data-vloer]');
      if (knop) wisselVloer(knop.dataset.vloer);
    });

    $('ca-col').addEventListener('change', () => { fillDecors(); naVloerkeuze(); });
    $('ca-dec').addEventListener('change', naVloerkeuze);
    document.querySelectorAll('#ca-cat button').forEach((b) => b.addEventListener('click', () => {
      staat.cat = b.dataset.cat;
      document.querySelectorAll('#ca-cat button').forEach((x) => x.classList.toggle('aan', x === b));
      fillCols(); fillDecors(); naVloerkeuze();
    }));
    document.querySelectorAll('#ca-bron button').forEach((b) => b.addEventListener('click', () => { zetBron(b.dataset.bron); calc(); }));
    ['ca-ext-naam', 'ca-ext-pak', 'ca-ext-ink', 'ca-ext-verk', 'ca-klant-lijm', 'ca-klant-primer', 'ca-klant-onder', 'ca-klant-eg', 'ca-klant-plint'].forEach((id) => {
      const el = $(id);
      if (el) { el.addEventListener('input', calc); el.addEventListener('change', calc); }
    });
    document.querySelectorAll('#ca-verl button').forEach((b) => b.addEventListener('click', () => { setVerl(b.dataset.v, true); calc(); }));
    document.querySelectorAll('#ca-btw button').forEach((b) => b.addEventListener('click', () => {
      staat.btwIncl = b.dataset.b === 'incl';
      document.querySelectorAll('#ca-btw button').forEach((x) => x.classList.toggle('aan', x === b));
      calc();
    }));
    ['ca-m2', 'ca-verl-eigen', 'ca-lijm-on', 'ca-primer-on', 'ca-primer-sel', 'ca-onder-on', 'ca-eg-on', 'ca-eg-sel', 'ca-eg-mm', 'ca-plint-on', 'ca-plint-sel', 'ca-plint-m'].forEach((id) => {
      const el = $(id);
      if (el) { el.addEventListener('input', calc); el.addEventListener('change', calc); }
    });
    $('ca-naam').addEventListener('input', () => { delete $('ca-naam').dataset.auto; });
    $('ca-project').addEventListener('change', stelNaamVoor);

    function naVloerkeuze() {
      const pr = cur();
      if (!pr) { calc(); return; }
      /* Het veld plintcode van een vloer (L107, L141, L151) is een verwijzing naar een profiel en
         geen bestelbaar artikel; de prijslijst kent die codes niet. Alleen als hij toevallig wel
         als artikel bestaat, wordt hij voorgekozen. Anders blijft de plint staan die er staat. */
      if (pr.pl && [...$('ca-plint-sel').options].some((o) => o.value === pr.pl)) $('ca-plint-sel').value = pr.pl;
      if (!staat.verlTouched) setVerl(/visgraat|chevron|herringbone/i.test(pr.pat || '') ? '15' : '10', false);
      calc();
    }

    $('ca-offerte').addEventListener('click', () => {
      const foutvak = $('ca-fout');
      foutvak.textContent = '';
      if (!HUIDIG || !HUIDIG.regels.length) { foutvak.textContent = 'Er staat nog niets in je berekening.'; return; }
      try {
        sessionStorage.setItem('framr-offerte-invoer', JSON.stringify({
          ...HUIDIG,
          project_id: $('ca-project').value || voorkeur.project_id || null,
          inmeting_id: voorkeur.inmeting_id || null,
          /* De klant en de werkregels reizen door de calculator heen mee naar de offerte. De
             calculator doet er zelf niets mee; hij is hier alleen de doorgeefluik. */
          klant_id: voorkeur.klant_id || null,
          werk: voorkeur.werk ?? [],
        }));
      } catch {
        foutvak.textContent = 'Je browser laat niet toe om de berekening mee te nemen.';
        return;
      }
      naOfferte();
    });

    $('ca-bewaar').addEventListener('click', async () => {
      const foutvak = $('ca-fout');
      foutvak.textContent = '';
      if (!HUIDIG || !HUIDIG.regels.length) { foutvak.textContent = 'Er staat nog niets in je berekening.'; return; }
      const knop = $('ca-bewaar');
      knop.disabled = true;
      try {
        /* De calculatielaag van fase C (stap 5): per vloer een groep als rekencontext, met de
           regels en hun bron, oorsprong, herkomst en prijsbasis; het werk los onder de
           calculatie. De oude jsonb-velden blijven meegaan voor de schermen die ze nog lezen. */
        const gedaan = VLOEREN.filter((v) => perVloer[v.sleutel]?.uitkomst);
        const groepen = gedaan.map((v) => {
          const u = perVloer[v.sleutel].uitkomst;
          return {
            naam: v.product && v.naam !== 'De vloer' ? v.naam : (u.vloer || v.naam || 'De vloer'),
            bron: u.bron,
            product: u.product,
            artikelnummer: u.artikelnummer,
            pak_inhoud: u.pakInhoud,
            vloersoort: u.cat,
            legpatroon: v.legpatroon ?? null,
            band_bies: v.band_bies === true,
            snijverlies_pct: Math.round((u.verlies ?? 0) * 1000) / 10,
            oppervlak: u.opp,
            plint_meters: u.plintM,
            herkomst: v.herkomst ?? null,
            regels: (u.lijnen ?? []).map((r) => ({
              soort: 'materiaal',
              omschrijving: r.naam,
              aantal: r.stuks ?? 0,
              eenheid: eenheidUit(r.aantal),
              prijs_inkoop: r.stuks ? r.ink / r.stuks : null,
              prijs_verkoop: r.stuks ? r.verk / r.stuks : null,
              bedrag_inkoop: r.ink || 0,
              bedrag_verkoop: r.verk || 0,
              bedrag_advies: r.adv || 0,
              bron: r.bron,
              oorsprong: 'automatisch',
              herkomst: v.herkomst ?? null,
              prijsbasis: r.prijsbasis ?? null,
            })),
          };
        });
        const werkregels = (voorkeur.werk ?? []).map((w) => ({
          soort: 'werk',
          omschrijving: w.omschrijving,
          aantal: w.aantal,
          eenheid: w.eenheid,
          prijs_verkoop: w.tarief || 0,
          bedrag_verkoop: (Number(w.aantal) || 0) * (Number(w.tarief) || 0),
          oorsprong: 'automatisch',
          herkomst: w.herkomst ?? null,
        }));
        await motor('/berekeningen', {
          methode: 'POST',
          body: {
            naam: $('ca-naam').value.trim() || HUIDIG.vloer,
            project_id: $('ca-project').value || voorkeur.project_id || null,
            inmeting_id: voorkeur.inmeting_id || null,
            gebaseerd_op: voorkeur.inhoud_versie ?? null,
            oppervlak_m2: HUIDIG.opp || null,
            totaal_advies: HUIDIG.totaal.adv || 0,
            totaal_verkoop: HUIDIG.totaal.verk || 0,
            totaal_inkoop: HUIDIG.totaal.ink || 0,
            invoer: {
              vloer: HUIDIG.vloer, soort: HUIDIG.soort, opp: HUIDIG.opp,
              verliesPct: HUIDIG.verliesPct, brutoM2: HUIDIG.brutoM2,
              /* Bij meer vloeren staat per vloer wat er gekozen is; zonder dat is later niet meer
                 te zien welke pakken bij welke vloer horen. */
              vloeren: HUIDIG.vloeren,
            },
            uitkomst: { regels: HUIDIG.regels, totaal: HUIDIG.totaal, gemaakt: HUIDIG.gemaakt },
            groepen,
            regels: werkregels,
          },
        });
        meldRegel('Berekening bewaard.');
        naBewaren();
      } catch (e) {
        foutvak.textContent = e.message;
        knop.disabled = false;
      }
    });

    naVloerkeuze();
    if (VLOEREN.length > 1) rekenAlleVloeren();
  }

  return { toon };
}
