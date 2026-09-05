/* De offerte-stap van het Framr.one Portaal.

   Uit een berekening (vers uit de calculator of bewaard onder Calculaties) wordt een
   offerte op naam van de partner gemaakt: de materiaalregels met de kortingschuif
   op de adviesprijs, zijn eigen werkregels (voorgevuld uit zijn vaste sjablonen),
   en de totalen met btw. Bewaren geeft de offerte een nummer uit zijn eigen reeks;
   de motor is daarin de waarheid. */

/* De eenheid uit een aantal-als-tekst halen: "11 pakken" wordt "pakken", "1 verpakking" wordt
   "verpakking". Staat er alleen een getal, dan is er geen eenheid. */
function eenheidUit(aantal) {
  const m = String(aantal ?? '').trim().match(/^[\d.,]+\s+(.+)$/);
  return m ? m[1].trim() : null;
}

import { koppelAdresvelden } from './adres.js?v=4e0bba9';

export function maakOfferte({ motor, euro, schoon, meldRegel, naBewaren }) {
  let regels = [];
  let vrijMat = [];
  let werk = [];
  let korting = 20;
  let btwTarief = 21;
  let klanten = [];
  let projecten = [];
  let partner = null;
  let bron = null;
  let bewerktId = null;

  const $ = (id) => document.getElementById(id);
  const num = (v) => { const n = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };

  function totalen() {
    const berekAdv = regels.reduce((s, r) => s + (r.adv || 0), 0);
    const vrijTot = vrijMat.reduce((s, r) => s + num(r.aantal) * num(r.prijs), 0);
    const matAdv = berekAdv + vrijTot;
    const matVerk = berekAdv * (1 - korting / 100) + vrijTot;
    /* De inkoop van een vrije regel telt mee. Bij het bewerken van een bewaarde offerte worden
       alle materiaalregels vrije regels, en zonder dit zou zijn marge daarna nul lijken. */
    const matInk = regels.reduce((s, r) => s + (r.ink || 0), 0)
      + vrijMat.reduce((s, r) => s + num(r.ink), 0);
    const werkTot = werk.reduce((s, w) => s + num(w.aantal) * num(w.tarief), 0);
    const sub = matVerk + werkTot;
    const btw = sub * (btwTarief / 100);
    return { matAdv, matVerk, matInk, werkTot, sub, btw, totaal: sub + btw };
  }

  function tekenTotalen() {
    const t = totalen();
    $('of-mat-adv').textContent = euro(t.matAdv);
    $('of-mat-verk').textContent = euro(t.matVerk);
    const kortingLabel = $('of-korting-label');
    if (kortingLabel) kortingLabel.textContent = korting + '%';
    $('of-werk').textContent = euro(t.werkTot);
    $('of-sub').textContent = euro(t.sub);
    $('of-btw').textContent = euro(t.btw);
    const btwLabel = $('of-btw-label');
    if (btwLabel) btwLabel.textContent = btwTarief === 0 ? 'Btw verlegd' : `Btw ${btwTarief}%`;
    $('of-totaal').textContent = euro(t.totaal);
    /* Zonder partnerniveau is de inkoop gelijk aan de adviesprijs; een marge tonen zou dan
       een negatief getal zijn dat niets betekent. Zelfde gedrag als de calculator. */
    const geenNiveau = regels.length > 0 && regels.every((r) => (r.ink || 0) >= (r.adv || 0));
    const margeRegel = $('of-marge-regel');
    if (margeRegel) margeRegel.hidden = geenNiveau;
    const marge = $('of-marge');
    if (marge) marge.textContent = euro(t.matVerk - t.matInk);
  }

  function tekenVrijMat() {
    $('of-vrijmat').innerHTML = vrijMat.map((r, i) => `
      <div class="fr-veldrij fr-werkregel" data-i="${i}">
        <label>Materiaal<input data-vm="omschrijving" value="${schoon(r.omschrijving)}" placeholder="Bijvoorbeeld: kozijn 1200 x 1400, draaikiep"></label>
        <label style="max-width:90px">Aantal<input data-vm="aantal" inputmode="decimal" value="${r.aantal}"></label>
        <label style="max-width:110px">Eenheid<input data-vm="eenheid" value="${schoon(r.eenheid)}"></label>
        <label style="max-width:120px">Prijs p/st<input data-vm="prijs" inputmode="decimal" value="${r.prijs}"></label>
        <button class="fr-knop klein tweede" data-vm-weg="${i}" type="button">Weg</button>
      </div>`).join('');
    tekenTotalen();
  }

  function tekenWerk() {
    $('of-werkregels').innerHTML = werk.map((w, i) => `
      <div class="fr-veldrij fr-werkregel" data-i="${i}">
        <label>Omschrijving<input data-w="omschrijving" value="${schoon(w.omschrijving)}"></label>
        <label style="max-width:90px">Aantal<input data-w="aantal" inputmode="decimal" value="${w.aantal}"></label>
        <label style="max-width:110px">Eenheid<input data-w="eenheid" value="${schoon(w.eenheid)}"></label>
        <label style="max-width:110px">Tarief<input data-w="tarief" inputmode="decimal" value="${w.tarief}"></label>
        <button class="fr-knop klein tweede" data-w-weg="${i}" type="button" title="Regel weghalen">Weg</button>
      </div>`).join('');
    tekenTotalen();
  }

  function schil() {
    const klantOpties = klanten.map((k) => `<option value="${k.id}">${schoon(k.naam)}</option>`).join('');
    const projectOpties = projecten.map((p) =>
      `<option value="${p.id}" ${p.id === bron.project_id ? 'selected' : ''}>${schoon(p.naam)}</option>`).join('');
    return `
    <div class="fr-form fr-form-breed">
      <p class="fr-calc-pt">De klant</p>
      <div class="fr-veldrij">
        <label>Bestaande klant<select id="of-klant"><option value="">nieuwe of losse klant</option>${klantOpties}</select></label>
        <label>Naam<input id="of-klant-naam"></label>
      </div>
      <div class="fr-veldrij">
        <label>Adres<input id="of-klant-adres"></label>
        <label style="max-width:130px">Postcode<input id="of-klant-postcode"></label>
        <label>Plaats<input id="of-klant-plaats"></label>
      </div>
      <p class="fr-calc-pt">Het materiaal</p>
      <div id="of-materiaal">${regels.map((r) => `
        <div class="fr-calc-row"><span class="k"><b>${schoon(r.naam)}</b> <span class="qty">${schoon(r.aantal)}</span><small>${schoon(r.uitleg || '')}</small></span>
        <span class="v">${euro(r.adv || 0)}</span></div>`).join('')}</div>
      <div id="of-vrijmat"></div>
      <div class="fr-knoppenrij"><button class="fr-knop klein tweede" id="of-mat-erbij" type="button">Materiaalregel erbij</button></div>
      ${regels.length ? `<label>Korting voor je klant op de adviesprijs: <b id="of-korting-label">${korting}%</b>
        <input type="range" id="of-korting" min="0" max="40" step="1" value="${korting}"></label>` : ''}
      <p class="fr-calc-pt">Jouw werk</p>
      <div id="of-werkregels"></div>
      <div class="fr-knoppenrij"><button class="fr-knop klein tweede" id="of-werk-erbij" type="button">Werkregel erbij</button></div>
      <p class="fr-calc-pt">De som</p>
      <div class="fr-calc-tot">
        <div class="regel stil">Materiaal adviesprijs <s id="of-mat-adv"></s></div>
        <div class="som"><span>Materiaal voor je klant</span><b id="of-mat-verk"></b></div>
        <div class="som"><span>Jouw werk</span><b id="of-werk"></b></div>
        <div class="som"><span>Subtotaal ex btw</span><b id="of-sub"></b></div>
        <div class="som"><span id="of-btw-label">Btw 21%</span><b id="of-btw"></b></div>
        <div class="som marge"><span>Totaal incl btw</span><b id="of-totaal"></b></div>
        <div class="regel groen" id="of-marge-regel">Jouw materiaalmarge: <span id="of-marge"></span></div>
      </div>
      <div class="fr-veldrij" style="margin-top:10px">
        <label>Hoort bij klus<select id="of-project"><option value="">geen klus</option>${projectOpties}</select></label>
        <label style="max-width:200px">Btw<select id="of-btw-keus">
          <option value="21" selected>21% standaard</option>
          <option value="9">9% verlaagd</option>
          <option value="0">0% btw verlegd</option>
        </select></label>
        <label style="max-width:160px">Geldig (dagen)<input id="of-geldig" inputmode="numeric" value="30"></label>
      </div>
      <p class="fr-hint">9% geldt alleen voor bepaalde arbeid aan woningen ouder dan twee jaar; btw verlegd is voor onderaanneming, zet dan het btw-nummer van je opdrachtgever op het document.</p>
      <div class="fr-knoppenrij">
        <button class="fr-knop" id="of-bewaar" type="button">Offerte bewaren</button>
      </div>
      <p class="fr-hint">De offerte krijgt een nummer uit jouw eigen reeks en verschijnt onder Offertes; daar zet je hem op verstuurd, gewonnen of verloren.</p>
      <p class="fr-formfout" id="of-fout"></p>
    </div>`;
  }

  async function toon(bak, invoer) {
    bron = invoer;
    /* Bewerkt hij een bestaande offerte, dan staat hier zijn id. Bewaren doet dan een PATCH op
       diezelfde offerte in plaats van een nieuwe aan te maken, zodat het nummer en de reeks niet
       opschuiven. De motor laat dat alleen toe zolang de offerte concept is. */
    bewerktId = invoer.bewerktId ?? null;
    regels = (invoer.regels || []).map((r) => ({
      naam: r.naam, aantal: r.aantal, stuks: r.stuks, uitleg: r.uitleg,
      ink: r.ink || 0, verk: r.verk || 0, adv: r.adv || 0, code: r.code || null,
    }));
    vrijMat = (invoer.vrijMat || []).map((r) => ({
      omschrijving: r.omschrijving ?? '', aantal: r.aantal ?? 0,
      eenheid: r.eenheid ?? 'stuks', prijs: r.prijs ?? 0, ink: r.ink ?? 0,
    }));
    const [{ klanten: k }, { projecten: p }, mij] = await Promise.all([
      motor('/klanten'), motor('/projecten'), motor('/mij'),
    ]);
    klanten = k ?? [];
    projecten = p ?? [];
    partner = mij.partner;
    korting = invoer.korting !== undefined && invoer.korting !== null
      ? Number(invoer.korting) : (Number(partner.standaard_korting ?? 20) || 20);
    btwTarief = invoer.btwTarief !== undefined && invoer.btwTarief !== null ? Number(invoer.btwTarief) : 21;
    if (bron.werk && bron.werk.length) {
      /* De werkregels reizen mee uit de inmeting. Het tarief komt uit zijn vaste sjablonen
         als de omschrijving daarop past; anders vult hij het hier in. */
      werk = bron.werk.map((w) => {
        const sjabloon = (mij.werkregels ?? []).find((s) =>
          String(s.naam || '').toLowerCase() === String(w.omschrijving || '').toLowerCase());
        return {
          omschrijving: w.omschrijving || '',
          aantal: num(w.aantal) || 0,
          eenheid: w.eenheid || 'm²',
          tarief: num(w.tarief) || Number(sjabloon?.tarief ?? 0),
        };
      });
    } else {
      werk = (mij.werkregels ?? []).map((w) => ({
        omschrijving: w.naam || '', aantal: 0, eenheid: w.eenheid || 'm²', tarief: Number(w.tarief ?? 0),
      }));
      if (!werk.length) werk = [{ omschrijving: 'Leggen', aantal: bron.opp || 0, eenheid: 'm²', tarief: 0 }];
    }

    bak.innerHTML = schil();
    tekenVrijMat();
    tekenWerk();
    koppelAdresvelden(bak, { adres: 'of-klant-adres', postcode: 'of-klant-postcode', plaats: 'of-klant-plaats' });

    $('of-klant').addEventListener('change', () => {
      const gekozen = klanten.find((x) => x.id === $('of-klant').value);
      if (!gekozen) return;
      $('of-klant-naam').value = gekozen.naam || '';
      $('of-klant-adres').value = gekozen.adres || '';
      $('of-klant-postcode').value = gekozen.postcode || '';
      $('of-klant-plaats').value = gekozen.plaats || '';
    });
    /* Als de klant al aan de bron hangt (de inmeting), staat hij hier voorgekozen. */
    if (bron.klant_id && klanten.some((x) => x.id === bron.klant_id)) {
      $('of-klant').value = bron.klant_id;
      $('of-klant').dispatchEvent(new Event('change'));
    } else if (bron.klant_naam) {
      /* Een offerte op een losse klant zonder kaart: de ingetikte gegevens komen terug. */
      $('of-klant-naam').value = bron.klant_naam;
      if ($('of-klant-adres')) $('of-klant-adres').value = bron.klant_adres ?? '';
      if ($('of-klant-postcode')) $('of-klant-postcode').value = bron.klant_postcode ?? '';
      if ($('of-klant-plaats')) $('of-klant-plaats').value = bron.klant_plaats ?? '';
    }
    if (bron.project_id && projecten.some((x) => x.id === bron.project_id)) {
      $('of-project').value = bron.project_id;
    }
    if ($('of-btw-keus')) $('of-btw-keus').value = String(btwTarief);
    const schuif = $('of-korting');
    if (schuif) schuif.value = String(korting);
    const kortingSchuif = $('of-korting');
    if (kortingSchuif) kortingSchuif.addEventListener('input', () => {
      korting = Number(kortingSchuif.value);
      tekenTotalen();
    });
    $('of-btw-keus').addEventListener('change', () => {
      btwTarief = Number($('of-btw-keus').value);
      tekenTotalen();
    });
    $('of-mat-erbij').addEventListener('click', () => {
      vrijMat.push({ omschrijving: '', aantal: 1, eenheid: 'stuks', prijs: 0, ink: 0 });
      tekenVrijMat();
    });
    $('of-vrijmat').addEventListener('input', (e) => {
      const rij = e.target.closest('.fr-werkregel');
      if (rij && e.target.dataset.vm) { vrijMat[Number(rij.dataset.i)][e.target.dataset.vm] = e.target.value; tekenTotalen(); }
    });
    $('of-vrijmat').addEventListener('click', (e) => {
      if (e.target.dataset.vmWeg === undefined) return;
      vrijMat.splice(Number(e.target.dataset.vmWeg), 1);
      tekenVrijMat();
    });
    $('of-werk-erbij').addEventListener('click', () => {
      werk.push({ omschrijving: '', aantal: 0, eenheid: 'm²', tarief: 0 });
      tekenWerk();
    });
    $('of-werkregels').addEventListener('input', (e) => {
      const rij = e.target.closest('.fr-werkregel');
      if (!rij) return;
      const veld = e.target.dataset.w;
      if (veld) { werk[Number(rij.dataset.i)][veld] = e.target.value; tekenTotalen(); }
    });
    $('of-werkregels').addEventListener('click', (e) => {
      const weg = e.target.dataset.wWeg;
      if (weg === undefined) return;
      werk.splice(Number(weg), 1);
      tekenWerk();
    });

    $('of-bewaar').addEventListener('click', async () => {
      const foutvak = $('of-fout');
      foutvak.textContent = '';
      const t = totalen();
      if (t.sub <= 0) { foutvak.textContent = 'Zet eerst een materiaal- of werkregel op de offerte.'; return; }
      const berekAdv = regels.reduce((s, r) => s + (r.adv || 0), 0);
      const factor = berekAdv > 0 ? (berekAdv * (1 - korting / 100)) / berekAdv : 1;
      const knop = $('of-bewaar');
      knop.disabled = true;
      try {
        const geldigDagen = Math.max(1, Math.round(num($('of-geldig').value)) || 30);
        const geldigTot = new Date(Date.now() + geldigDagen * 24 * 3600 * 1000).toISOString().slice(0, 10);
        const body = {
          klant_id: $('of-klant').value || null,
          klant_naam: $('of-klant-naam').value || null,
          klant_adres: $('of-klant-adres').value || null,
          klant_postcode: $('of-klant-postcode').value || null,
          klant_plaats: $('of-klant-plaats').value || null,
          project_id: $('of-project').value || null,
          project: (projecten.find((x) => x.id === $('of-project').value) || {}).naam || null,
          materiaal_advies: t.matAdv,
          materiaal_verkoop: t.matVerk,
          materiaal_inkoop: t.matInk,
          werk_totaal: t.werkTot,
          subtotaal: t.sub,
          btw_bedrag: t.btw,
          totaal: t.totaal,
          geldig_tot: geldigTot,
          berekening: { vloer: bron.vloer, soort: bron.soort, opp: bron.opp, verliesPct: bron.verliesPct, brutoM2: bron.brutoM2, korting, btw_tarief: btwTarief },
          regels: [
            ...vrijMat.filter((r) => String(r.omschrijving || '').trim() && num(r.aantal) > 0).map((r) => ({
              soort: 'materiaal',
              omschrijving: r.omschrijving,
              aantal: num(r.aantal),
              eenheid: r.eenheid || null,
              prijs_verkoop: num(r.prijs),
              bedrag_advies: num(r.aantal) * num(r.prijs),
              bedrag_verkoop: num(r.aantal) * num(r.prijs),
              bedrag_inkoop: num(r.ink),
            })),
            ...regels.map((r) => ({
              soort: 'materiaal',
              omschrijving: r.naam,
              aantal: r.stuks ?? null,
              /* De calculator levert het aantal als tekst ("11 pakken"); het getal en de eenheid
                 gaan hier uit elkaar. Zonder dit stond er op de factuur Vloer 11 zonder erbij dat
                 het pakken zijn, want de eenheid werd op leeg gezet en zat alleen in de uitleg. */
              eenheid: eenheidUit(r.aantal),
              uitleg: `${r.aantal} · ${r.uitleg || ''}`.trim(),
              bedrag_advies: r.adv || 0,
              bedrag_verkoop: (r.adv || 0) * factor,
              bedrag_inkoop: r.ink || 0,
            })),
            ...werk.filter((w) => w.omschrijving && num(w.aantal) > 0).map((w) => ({
              soort: 'werk',
              omschrijving: w.omschrijving,
              aantal: num(w.aantal),
              eenheid: w.eenheid || null,
              prijs_verkoop: num(w.tarief),
              bedrag_verkoop: num(w.aantal) * num(w.tarief),
            })),
          ],
        };
        const { offerte } = bewerktId
          ? await motor(`/offertes/${bewerktId}`, { methode: 'PATCH', body })
          : await motor('/offertes', { methode: 'POST', body });
        meldRegel(`Offerte ${offerte.nummer} bewaard.`);
        naBewaren(offerte);
      } catch (e) {
        foutvak.textContent = e.message;
        knop.disabled = false;
      }
    });
  }

  return { toon };
}
