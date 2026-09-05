/* Framr.one Portaal: inlog, gegevenslaag en schermen.

   Elke route is een echte URL, dus de terugknop van de browser werkt gewoon. De app praat
   rechtstreeks met de portaalmotor (Edge Function portaal) via de Framr.one-deur: een Supabase
   Auth-token in plaats van de Shopify-handtekening. De motor rekent alles zelf na; wat het
   scherm uitrekent is alleen voor het oog. */

import { maakCalculator } from './calculator.js?v=4e0bba9';
import { maakOfferte } from './offerte.js?v=4e0bba9';
import { maakInmeetkaart } from './inmeten.js?v=4e0bba9';
import { koppelAdresvelden } from './adres.js?v=4e0bba9';
import * as PDF from './pdf.js?v=4e0bba9';

const CONF = window.FRAMR_CONFIG;
const MOTOR = `${CONF.SUPABASE_URL}/functions/v1/portaal`;
const AUTH = `${CONF.SUPABASE_URL}/auth/v1`;

/* De app kan op een submap leven (zoals GitHub Pages) of op een eigen domein; de basis
   wordt afgeleid uit het adres van dit script zelf, dus verhuizen kost geen codewijziging. */
const BASIS = new URL(import.meta.url).pathname.replace(/\/app\/framr\.js$/, '');

/* De tabbladen. Wie een onderdeel niet gebruikt zet het uit onder Mijn bedrijf; `mod` zegt welke
   schakel daarbij hoort. Zonder mod staat het tabblad er altijd: het overzicht, wat er bij Oaklyn
   loopt en zijn eigen gegevens horen niet weg te kunnen. */
const TABS = [
  { pad: '/', naam: 'Overzicht' },
  { pad: '/projecten', naam: 'Projecten', mod: 'projecten' },
  { pad: '/inmeten', naam: 'Inmeten', mod: 'inmeten' },
  { pad: '/calculaties', naam: 'Calculaties', mod: 'calculaties' },
  { pad: '/offertes', naam: 'Offertes', mod: 'offertes' },
  { pad: '/facturen', naam: 'Facturen', mod: 'facturen' },
  { pad: '/klanten', naam: 'Klanten', mod: 'klanten' },
  { pad: '/bestellingen', naam: 'Bestellingen' },
  { pad: '/bedrijf', naam: 'Mijn bedrijf' },
];

/* De zes schakels onder Mijn bedrijf, met de uitleg die op het scherm komt.

   Een lege instelling betekent AAN en niet uit. Alleen wat hij bewust uitzet komt als false in
   portal_partners.modules te staan. Een nieuwe partner heeft daar een leeg object en krijgt dus
   alles; een onderdeel dat er later bij komt staat vanzelf aan, want anders zou niemand het ooit
   vinden. Uitzetten verbergt en gooit niets weg: het tabblad verdwijnt en verder niets.

   Dezelfde regel en dezelfde kolom als het Oaklyn-portaal, want het is dezelfde partnerrij. */
const MODULES = [
  { id: 'inmeten', titel: 'Inmeten', uitleg: 'Meet bij de klant per ruimte in, met de checklist die meedenkt. Levert je vierkante meters en je werkregels.' },
  { id: 'calculaties', titel: 'Calculaties', uitleg: 'Alle berekeningen die je bewaart, bij elkaar. Handig als je twee vloeren naast elkaar wilt leggen.' },
  { id: 'offertes', titel: 'Offertes', uitleg: 'Een offerte op jouw naam, met jouw eigen werk erbij. Terugvinden, status bijzetten en factureren zit erin.' },
  { id: 'facturen', titel: 'Facturen', uitleg: 'Twee facturen uit dezelfde offerte: het materiaal vooraf, je werk na oplevering. Betalen gaat naar jouw eigen rekening.' },
  { id: 'klanten', titel: 'Klanten', uitleg: 'Een klantenkaart, zodat je bij een tweede klus niet alles opnieuw tikt. Hoeft niet: los invullen kan altijd.' },
  { id: 'projecten', titel: 'Projecten', uitleg: 'De doos om een klus heen: inmeting, offertes en facturen bij elkaar. Een project is nooit verplicht.' },
];

/* Wat er aan staat. null zolang de motor het niet verteld heeft; dan staat alles aan, want een
   onbekende stand hoort nooit een tabblad te laten verdwijnen. Wat er de vorige keer stond wordt op
   dit apparaat onthouden, alleen om de balk meteen goed te kunnen zetten: de waarheid komt van de
   server en overschrijft dit zodra hij binnen is. */
let modules = null;
try { modules = JSON.parse(localStorage.getItem('framr-modules') || 'null'); } catch { modules = null; }

function moduleAan(id) {
  return !modules || modules[id] !== false;
}

function zetModules(nieuw) {
  modules = nieuw && typeof nieuw === 'object' ? nieuw : {};
  try { localStorage.setItem('framr-modules', JSON.stringify(modules)); } catch { /* dan niet */ }
}

const scherm = document.getElementById('fr-scherm');
const tabbalk = document.getElementById('fr-tabs');
const navBalk = document.querySelector('.fr-nav');

/* ---------- sessie ---------- */

function sessie() {
  try { return JSON.parse(localStorage.getItem('framr-sessie') || 'null'); } catch { return null; }
}

function zetSessie(s) {
  if (s) localStorage.setItem('framr-sessie', JSON.stringify(s));
  else localStorage.removeItem('framr-sessie');
}

async function authVraag(pad, body) {
  const r = await fetch(`${AUTH}${pad}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: CONF.ANON_KEY },
    body: JSON.stringify(body),
  });
  const inhoud = await r.json().catch(() => ({}));
  if (!r.ok) {
    const ruw = inhoud.error_description || inhoud.msg || inhoud.message || '';
    const NL = {
      'Email not confirmed': 'Je account is nog niet vrijgegeven. Je krijgt bericht zodra je erin kunt.',
      'Invalid login credentials': 'Dit e-mailadres en wachtwoord horen niet bij elkaar.',
      'User already registered': 'Er bestaat al een account met dit e-mailadres.',
      'Password should be at least 6 characters': 'Kies een wachtwoord van minstens 8 tekens.',
    };
    throw new Error(NL[ruw] || ruw || 'Inloggen lukte niet.');
  }
  return inhoud;
}

async function inloggen(email, wachtwoord) {
  const t = await authVraag('/token?grant_type=password', { email, password: wachtwoord });
  zetSessie({
    access_token: t.access_token,
    refresh_token: t.refresh_token,
    verloopt_op: Date.now() + (t.expires_in ?? 3600) * 1000,
    email: t.user?.email ?? email,
  });
}

async function aanmelden(email, wachtwoord) {
  await authVraag('/signup', { email, password: wachtwoord });
}

async function versToken() {
  const s = sessie();
  if (!s) return null;
  if (s.verloopt_op - 60_000 > Date.now()) return s.access_token;
  try {
    const t = await authVraag('/token?grant_type=refresh_token', { refresh_token: s.refresh_token });
    zetSessie({
      access_token: t.access_token,
      refresh_token: t.refresh_token,
      verloopt_op: Date.now() + (t.expires_in ?? 3600) * 1000,
      email: s.email,
    });
    return t.access_token;
  } catch {
    zetSessie(null);
    return null;
  }
}

function uitloggen() {
  zetSessie(null);
  toon('/', false);
}

/* ---------- gegevenslaag ---------- */

async function motor(pad, opties = {}) {
  const token = await versToken();
  if (!token) { toonLogin(); throw new Error('niet ingelogd'); }
  const r = await fetch(`${MOTOR}${pad}`, {
    method: opties.methode || 'GET',
    headers: {
      authorization: `Bearer ${token}`,
      ...(opties.body ? { 'content-type': 'application/json' } : {}),
    },
    body: opties.body ? JSON.stringify(opties.body) : undefined,
  });
  if (r.status === 401) { zetSessie(null); toonLogin(); throw new Error('sessie verlopen'); }
  const inhoud = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(inhoud.fout || `Er ging iets mis (${r.status}).`);
  return inhoud;
}

/* ---------- hulpjes ---------- */

const euro = (n) => '€ ' + Number(n || 0).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const m2 = (n) => Number(n || 0).toLocaleString('nl-NL', { maximumFractionDigits: 2 }) + ' m²';
const datum = (d) => (d ? new Date(d).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const schoon = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function kop(eyebrow, titel, onder) {
  return `<p class="fr-eyebrow">${schoon(eyebrow)}</p>
    <h1 class="fr-kop">${schoon(titel)}</h1>
    ${onder ? `<p class="fr-onderkop">${schoon(onder)}</p>` : ''}`;
}

function standklasse(stand) {
  if (['betaald', 'geleverd', 'gewonnen', 'afgerond', 'besteld'].includes(stand)) return 'klaar';
  if (['concept', 'verloren', 'verlopen', 'archief'].includes(stand)) return 'stil';
  return 'open';
}

/* De stand zoals hij in de database staat is een sleutel; op het scherm hoort er een woord te staan.
   Wie een lijst met teksten meegeeft krijgt die, de rest krijgt de sleutel zonder streepje. */
function stand(s, teksten = null) {
  const sleutel = s || 'open';
  const woord = (teksten && teksten[sleutel]) || String(sleutel).replace(/_/g, ' ');
  return `<span class="fr-stand ${standklasse(s)}">${schoon(woord)}</span>`;
}

function foutkaart(e) {
  return `<div class="fr-leeg"><div class="naam">Er ging iets mis</div>${schoon(e.message)}</div>`;
}

function meldRegel(tekst) {
  const el = document.createElement('div');
  el.className = 'fr-melding';
  el.textContent = tekst;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

/* ---------- inlogscherm ---------- */

function toonLogin(melding) {
  navBalk.style.display = 'none';
  scherm.innerHTML = `
    <div class="fr-login">
      <p class="fr-eyebrow">Voor vloerprofessionals</p>
      <h1 class="fr-kop">Jouw werk, van maat tot factuur.</h1>
      <p class="fr-onderkop">Log in op je Framr.one-account. Nog geen account? Aanmelden kan hieronder;
      je account wordt daarna vrijgegeven.</p>
      ${melding ? `<div class="fr-leeg" style="margin-bottom:16px">${schoon(melding)}</div>` : ''}
      <form id="fr-loginform" class="fr-form">
        <label>E-mailadres<input type="email" name="email" required autocomplete="email"></label>
        <label>Wachtwoord<input type="password" name="wachtwoord" required minlength="8" autocomplete="current-password"></label>
        <div class="fr-knoppenrij">
          <button class="fr-knop" type="submit">Inloggen</button>
          <button class="fr-knop tweede" type="button" id="fr-aanmeld">Account aanmaken</button>
        </div>
        <p class="fr-formfout" id="fr-loginfout"></p>
      </form>
    </div>`;
  const form = document.getElementById('fr-loginform');
  const foutvak = document.getElementById('fr-loginfout');
  form.addEventListener('submit', eenmalig(form.querySelector('button[type=submit]'), async (e) => {
    e.preventDefault();
    foutvak.textContent = '';
    try {
      await inloggen(form.email.value.trim(), form.wachtwoord.value);
      navBalk.style.display = '';
      toon('/', false);
    } catch (err) { foutvak.textContent = err.message; }
  }));
  document.getElementById('fr-aanmeld').addEventListener('click', async () => {
    foutvak.textContent = '';
    if (!form.email.value || !form.wachtwoord.value) {
      foutvak.textContent = 'Vul eerst je e-mailadres en een wachtwoord in.';
      return;
    }
    try {
      await aanmelden(form.email.value.trim(), form.wachtwoord.value);
      foutvak.textContent = 'Account aangemaakt. Zodra hij is vrijgegeven kun je inloggen.';
    } catch (err) { foutvak.textContent = err.message; }
  });
}

/* ---------- overzicht ---------- */

async function schermOverzicht() {
  const [o, p, i, f, k] = await Promise.all([
    motor('/offertes'), motor('/projecten'), motor('/inmetingen'), motor('/facturen'), motor('/klanten'),
  ]);
  const offertes = o.offertes ?? [];
  const projecten = p.projecten ?? [];
  const inmetingen = i.inmetingen ?? [];
  const facturen = f.facturen ?? [];
  const klantnaam = maakKlantnamen(k.klanten ?? []);
  const open = offertes.filter((x) => ['concept', 'verstuurd'].includes(x.status));
  const teBestellen = offertes.filter((x) => x.status === 'gewonnen');
  const openFacturen = facturen.filter((x) => ['concept', 'verstuurd', 'vervallen'].includes(x.status));
  const openBedrag = openFacturen.reduce((s, x) => s + Number(x.totaal ?? 0), 0);
  return kop('Voor vloerprofessionals', 'Jouw werk, van maat tot factuur.',
      'Alles wat loopt staat hier bij elkaar: de klussen, de inmetingen en wat er nog open staat.')
    /* Ook de tegels volgen de schakels: een teller over offertes hoort er niet te staan bij iemand
       die offertes heeft uitgezet. */
    + `<div class="fr-tegels">
        ${moduleAan('offertes') ? `<div class="fr-tegel"><div class="naam">Open offertes</div><div class="waarde">${open.length}</div></div>
        <div class="fr-tegel"><div class="naam">Te bestellen</div><div class="waarde">${teBestellen.length}</div></div>` : ''}
        ${moduleAan('facturen') ? `<div class="fr-tegel"><div class="naam">Open facturen</div><div class="waarde">${openFacturen.length} <small>${euro(openBedrag)}</small></div></div>` : ''}
        ${moduleAan('inmeten') ? `<div class="fr-tegel"><div class="naam">Ingemeten</div><div class="waarde">${inmetingen.length} <small>${m2(inmetingen.reduce((s, x) => s + Number(x.totaal_m2 ?? 0), 0))}</small></div></div>` : ''}
      </div>
      ${MODULES.every((mo) => !moduleAan(mo.id)) ? `<div class="fr-leeg">
        <div class="naam">Je hebt alles uitgezet</div>
        <p>In Mijn bedrijf zet je weer aan wat je nodig hebt. Er is niets weg: wat je gemaakt hebt
          staat er nog en komt terug zodra je het onderdeel weer aanzet.</p>
        <div class="fr-knoppenrij"><a class="fr-knop" href="${BASIS}/bedrijf" data-route>Naar Mijn bedrijf</a></div>
      </div>` : ''}

      <div class="fr-snel">
        ${moduleAan('inmeten') ? `<a class="fr-kaart" href="${BASIS}/inmeten/nieuw" data-route>
          <span class="k">Inmeten</span>
          <span class="o">Sta je bij de klant? Meet de ruimtes in en reken het ter plekke door.</span>
        </a>` : ''}
        ${moduleAan('calculaties') ? `<a class="fr-kaart" href="${BASIS}/calculaties/nieuw" data-route>
          <span class="k">Project berekenen</span>
          <span class="o">Vloer kiezen, snijverlies erbij, materiaal en marge in beeld.</span>
        </a>` : ''}
        ${moduleAan('offertes') ? `<a class="fr-kaart" href="${BASIS}/offertes" data-route>
          <span class="k">Offertes</span>
          <span class="o">Terugvinden, status bijzetten en er een factuur uit maken.</span>
        </a>` : ''}
      </div>

      ${moduleAan('projecten') ? `<div class="fr-blokkop"><h2>Lopende klussen</h2><span class="maatje">${projecten.length} totaal</span>
        <span class="rechts"><a class="fr-knop klein" href="${BASIS}/inmeten/nieuw" data-route>Nieuwe inmeting</a></span></div>
      <div class="fr-rijen">${projecten.slice(0, 5).map((x) => rijProject(x, klantnaam(x.customer_id))).join('') || legeRij('Nog geen klussen. Begin met een inmeting; de klus komt er vanzelf omheen.')}</div>` : ''}

      <div class="fr-twee">
        ${moduleAan('offertes') ? `<div>
          <div class="fr-blokkop"><h2>Laatste offertes</h2>
            <span class="rechts"><a class="fr-knop klein tweede" href="${BASIS}/offertes" data-route>Alle</a></span></div>
          <div class="fr-rijen">${offertes.slice(0, 5).map((x) => rijOfferte(x)).join('') || legeRij('Nog geen offertes.')}</div>
        </div>` : ''}
        ${moduleAan('inmeten') ? `<div>
          <div class="fr-blokkop"><h2>Laatste inmetingen</h2>
            <span class="rechts"><a class="fr-knop klein tweede" href="${BASIS}/inmeten" data-route>Alle</a></span></div>
          <div class="fr-rijen">${inmetingen.slice(0, 5).map((x) => rijInmeting(x, true)).join('') || legeRij('Nog geen inmetingen.')}</div>
        </div>` : ''}
      </div>`;
}

/* Van customer_id naar de naam op de kaart. De motor geeft bij klussen alleen het nummer terug,
   dus elk scherm dat klussen toont haalt de klantenlijst erbij en zoekt hem hier op. */
function maakKlantnamen(klanten) {
  const op = new Map((klanten ?? []).map((k) => [k.id, k.naam]));
  return (id) => (id ? op.get(id) ?? null : null);
}

function legeRij(tekst) {
  return `<div class="fr-leeg">${schoon(tekst)}</div>`;
}

/* ---------- projecten ---------- */

/* De zeven standen die een klus kan hebben, in de volgorde waarin een klus ze doorloopt, met de
   tekst die op het scherm hoort. Een sleutel als wacht_vloer is een kolomwaarde, geen woord. */
const PROJECTSTANDEN = {
  open: 'open',
  wacht_vloer: 'wacht op de vloerkeuze',
  geoffreerd: 'geoffreerd',
  gewonnen: 'gewonnen',
  besteld: 'besteld',
  afgerond: 'afgerond',
  verloren: 'verloren',
};

/* De klantnaam staat niet op de klus zelf: de motor geeft alleen customer_id terug. Hij komt uit de
   klantenlijst die het scherm toch al ophaalt, net als in het Oaklyn-portaal.

   Alleen tellers die er zijn komen in de regel: nul inmetingen en nul offertes op elke rij is ruis
   die niets zegt. */
function rijProject(p, klantnaam = null) {
  const metingen = (p.portal_measurements ?? []).length;
  const offertes = (p.portal_quotes ?? []).length;
  const tellers = [];
  if (metingen) tellers.push(`${metingen} inmeting${metingen === 1 ? '' : 'en'}`);
  if (offertes) tellers.push(`${offertes} offerte${offertes === 1 ? '' : 's'}`);
  const sub = [klantnaam, [p.werkadres, p.plaats].filter(Boolean).join(', ')].filter(Boolean).join(' · ');
  return `<div class="fr-rij">
      <span class="hoofd">${schoon(p.naam)}</span>
      <span class="sub">${schoon(sub)}</span>
      <span class="maatje">${schoon(tellers.join(' · '))}</span>
      <span class="rechts">${stand(p.status, PROJECTSTANDEN)}
        <a class="fr-knop klein tweede" href="${BASIS}/projecten/${p.id}" data-route>Openen</a>
        <button class="fr-knop klein tweede" data-actie="project-weg" data-id="${p.id}">Weghalen</button></span>
    </div>`;
}

async function schermProjecten() {
  const [{ projecten }, { klanten }] = await Promise.all([motor('/projecten'), motor('/klanten')]);
  let kaarten = klanten ?? [];
  let klantnaam = maakKlantnamen(kaarten);
  let pagina = 0;

  /* Tien per pagina: genoeg om te overzien, weinig genoeg om niet te hoeven scrollen. */
  const PER_PAGINA = 10;

  /* Zoeken, filteren en sorteren gebeuren hier op de lijst die er al is en niet met een nieuwe vraag
     aan de motor. Een legger heeft klussen in de tientallen, niet in de tienduizenden, en zo blijft
     het typen direct zonder dat er per aanslag een verzoek de deur uit gaat. */
  const gefilterd = () => {
    const zoek = document.getElementById('pr-zoek').value.trim().toLowerCase();
    const sorteer = document.getElementById('pr-sorteer').value;
    const aan = new Set([...document.querySelectorAll('#pr-standen .fr-keuze.aan')].map((k) => k.dataset.stand));
    const lijst = projecten.filter((p) => {
      if (aan.size && !aan.has(p.status)) return false;
      if (!zoek) return true;
      return [p.naam, klantnaam(p.customer_id), p.werkadres, p.plaats].some((v) => String(v ?? '').toLowerCase().includes(zoek));
    });
    const tijd = (p) => new Date(p.updated_at ?? p.created_at ?? 0).getTime();
    return lijst.slice().sort((a, b) => (sorteer === 'oud' ? tijd(a) - tijd(b) : tijd(b) - tijd(a)));
  };

  const teken = () => {
    const lijst = gefilterd();
    const paginas = Math.max(1, Math.ceil(lijst.length / PER_PAGINA));
    if (pagina >= paginas) pagina = paginas - 1;
    const blad = lijst.slice(pagina * PER_PAGINA, (pagina + 1) * PER_PAGINA);
    document.getElementById('pr-lijst').innerHTML = blad.map((x) => rijProject(x, klantnaam(x.customer_id))).join('')
      || legeRij(projecten.length ? 'Geen klus die hierop past.' : 'Nog geen klussen. Maak er een aan zodra een klus meer is dan een berekening; hoeft niet, want rekenen en bestellen kan zonder.');
    document.getElementById('pr-telling').textContent = lijst.length === projecten.length
      ? `${projecten.length}` : `${lijst.length} van ${projecten.length}`;
    document.getElementById('pr-blader').innerHTML = paginas > 1
      ? `<button class="fr-knop klein tweede" id="pr-vorige" ${pagina === 0 ? 'disabled' : ''}>Vorige</button>
         <span class="maatje">${pagina + 1} van ${paginas}</span>
         <button class="fr-knop klein tweede" id="pr-volgende" ${pagina === paginas - 1 ? 'disabled' : ''}>Volgende</button>`
      : '';
  };

  /* De keuzelijst met klanten, met de keuze om er ter plekke een aan te maken. */
  const klantOpties = (gekozen = '') => `<option value="">zonder klant</option>
      <option value="__nieuw">+ nieuwe klant</option>
      ${kaarten.map((k) => `<option value="${k.id}" ${k.id === gekozen ? 'selected' : ''}>${schoon(k.naam)}</option>`).join('')}`;

  /* Het werkadres van de klus is meestal ook het adres van de klant. Wat hij boven intikt zakt dus
     door naar het klantblok, tot hij daar zelf iets neerzet; dan laat de spiegel dat veld los. */
  const SPIEGEL = [['pr-adres', 'pr-klant-adres'], ['pr-postcode', 'pr-klant-pc'], ['pr-plaats', 'pr-klant-plaats']];
  const spiegel = () => {
    if (document.getElementById('pr-nieuwe-klant').hidden) return;
    SPIEGEL.forEach(([van, naar]) => {
      const doel = document.getElementById(naar);
      if (doel.value && doel.dataset.auto !== '1') return;
      doel.value = document.getElementById(van).value.trim();
      doel.dataset.auto = doel.value ? '1' : '';
    });
  };

  return {
    html: kop('Projecten', 'De klus als doos.',
        'Klant, inmeting, berekening en offerte reizen samen. Weghalen laat de inhoud staan.')
      + `<div class="fr-blokkop"><h2>Nieuwe klus</h2></div>
        <div class="fr-veldrij">
          <input class="fr-in" id="pr-naam" placeholder="Naam van de klus" aria-label="Naam van de klus">
          <input class="fr-in" id="pr-adres" placeholder="Werkadres" aria-label="Werkadres">
          <input class="fr-in" id="pr-postcode" placeholder="Postcode" aria-label="Postcode" style="max-width:130px">
          <input class="fr-in" id="pr-plaats" placeholder="Plaats" aria-label="Plaats">
          <select class="fr-in" id="pr-klant" aria-label="Klant koppelen" style="max-width:200px">${klantOpties()}</select>
          <button type="button" class="fr-knop" id="pr-toevoegen">Nieuwe klus</button>
        </div>
        <div class="fr-veldrij" id="pr-nieuwe-klant" hidden>
          <input class="fr-in" id="pr-klant-naam" placeholder="Naam of bedrijf van de klant" aria-label="Naam van de nieuwe klant">
          <input class="fr-in" id="pr-klant-contact" placeholder="Contactpersoon" aria-label="Contactpersoon">
          <input class="fr-in" id="pr-klant-tel" placeholder="Telefoon" aria-label="Telefoon">
          <input class="fr-in" id="pr-klant-mail" placeholder="E-mail" aria-label="E-mail">
          <input class="fr-in" id="pr-klant-adres" placeholder="Adres van de klant" aria-label="Adres van de klant">
          <input class="fr-in" id="pr-klant-pc" placeholder="Postcode" aria-label="Postcode van de klant" style="max-width:130px">
          <input class="fr-in" id="pr-klant-plaats" placeholder="Plaats" aria-label="Plaats van de klant">
        </div>
        <p class="fr-formfout" id="pr-fout"></p>

        <div class="fr-blokkop"><h2>Alle klussen</h2><span class="maatje" id="pr-telling">${projecten.length}</span></div>
        <div class="fr-zoekbalk">
          <input id="pr-zoek" type="search" placeholder="Zoek op klus, klant of adres" aria-label="Zoeken in je klussen">
          <button type="button" class="fr-knop tweede klein" id="pr-filterknop" aria-expanded="false">Filter</button>
          <select id="pr-sorteer" aria-label="Sorteren">
            <option value="nieuw">nieuwste eerst</option>
            <option value="oud">oudste eerst</option>
          </select>
          <div class="fr-filterrij" id="pr-standen" hidden>
            ${Object.entries(PROJECTSTANDEN).map(([s, woord]) => `<button type="button" class="fr-keuze" data-stand="${s}">${woord}</button>`).join('')}
            <button type="button" class="fr-knop tweede klein" id="pr-filterweg">Alles</button>
          </div>
        </div>
        <div class="fr-rijen" id="pr-lijst"></div>
        <div class="fr-blader" id="pr-blader"></div>
        <p class="fr-note"><b>Een klus is een doos, geen trechter.</b> Je hoeft er niets mee: wie alleen
          wil rekenen en bestellen merkt er niets van. Maar hoort er meer bij een klus, dan hangen de
          inmeting, de offertes en de facturen hier bij elkaar.</p>`,
    na: () => {
      document.getElementById('pr-zoek').addEventListener('input', () => { pagina = 0; teken(); });
      /* Adresvoorstellen van PDOK op het werkadres en op het adres van de nieuwe klant. */
      koppelAdresvelden(document, { adres: 'pr-adres', postcode: 'pr-postcode', plaats: 'pr-plaats' });
      koppelAdresvelden(document, { adres: 'pr-klant-adres', postcode: 'pr-klant-pc', plaats: 'pr-klant-plaats' });
      document.getElementById('pr-sorteer').addEventListener('change', () => { pagina = 0; teken(); });
      document.getElementById('pr-filterknop').addEventListener('click', (e) => {
        const la = document.getElementById('pr-standen');
        la.hidden = !la.hidden;
        e.currentTarget.setAttribute('aria-expanded', String(!la.hidden));
      });
      document.getElementById('pr-standen').addEventListener('click', (e) => {
        const knop = e.target.closest('.fr-keuze');
        if (knop) knop.classList.toggle('aan');
        if (e.target.id === 'pr-filterweg') {
          document.querySelectorAll('#pr-standen .fr-keuze').forEach((k) => k.classList.remove('aan'));
        }
        pagina = 0;
        teken();
      });
      document.getElementById('pr-blader').addEventListener('click', (e) => {
        if (e.target.id === 'pr-vorige') pagina -= 1;
        else if (e.target.id === 'pr-volgende') pagina += 1;
        else return;
        teken();
      });

      /* De keuze "+ nieuwe klant" klapt het invulblok eronder open. */
      document.getElementById('pr-klant').addEventListener('change', (e) => {
        const nieuw = e.target.value === '__nieuw';
        document.getElementById('pr-nieuwe-klant').hidden = !nieuw;
        if (!nieuw) return;
        spiegel();
        document.getElementById('pr-klant-naam').focus();
      });
      SPIEGEL.forEach(([van, naar]) => {
        document.getElementById(van).addEventListener('input', spiegel);
        document.getElementById(naar).addEventListener('input', (e) => { delete e.target.dataset.auto; });
      });

      document.getElementById('pr-toevoegen').addEventListener('click', async () => {
        const fout = document.getElementById('pr-fout');
        fout.textContent = '';
        const naam = document.getElementById('pr-naam').value.trim();
        if (!naam) { document.getElementById('pr-naam').focus(); return; }
        const knop = document.getElementById('pr-toevoegen');
        knop.disabled = true;
        try {
          let klantId = document.getElementById('pr-klant').value;
          /* Eerst de klant, dan de klus: anders staat er een klus zonder de kaart die hij net intikte. */
          if (klantId === '__nieuw') {
            const verseNaam = document.getElementById('pr-klant-naam').value.trim();
            if (!verseNaam) { document.getElementById('pr-klant-naam').focus(); knop.disabled = false; return; }
            const { klant } = await motor('/klanten', { methode: 'POST', body: {
              naam: verseNaam,
              contact: document.getElementById('pr-klant-contact').value.trim() || null,
              telefoon: document.getElementById('pr-klant-tel').value.trim() || null,
              email: document.getElementById('pr-klant-mail').value.trim() || null,
              adres: document.getElementById('pr-klant-adres').value.trim() || null,
              postcode: document.getElementById('pr-klant-pc').value.trim() || null,
              plaats: document.getElementById('pr-klant-plaats').value.trim() || null,
            } });
            kaarten = kaarten.concat([klant]);
            klantnaam = maakKlantnamen(kaarten);
            klantId = klant.id;
          }
          const { project } = await motor('/projecten', { methode: 'POST', body: {
            naam,
            klant_id: klantId || null,
            werkadres: document.getElementById('pr-adres').value.trim() || null,
            postcode: document.getElementById('pr-postcode').value.trim() || null,
            plaats: document.getElementById('pr-plaats').value.trim() || null,
          } });
          projecten.unshift(project);
          ['pr-naam', 'pr-adres', 'pr-postcode', 'pr-plaats', 'pr-klant-naam', 'pr-klant-contact',
            'pr-klant-tel', 'pr-klant-mail', 'pr-klant-adres', 'pr-klant-pc', 'pr-klant-plaats']
            .forEach((v) => { const veld = document.getElementById(v); veld.value = ''; delete veld.dataset.auto; });
          document.getElementById('pr-nieuwe-klant').hidden = true;
          document.getElementById('pr-klant').innerHTML = klantOpties(klantId || '');
          meldRegel('Klus aangemaakt.');
          pagina = 0;
          teken();
        } catch (err) { fout.textContent = err.message; }
        knop.disabled = false;
      });

      teken();
    },
  };
}

/* De stappen die een klus kan doorlopen. Wat er in Mijn bedrijf aanstaat geldt overal; hier kan hij
   het per klus alsnog uitzetten, want de ene klus is de andere niet. Een lege waarde betekent aan:
   wie het onderdeel gebruikt wil het bij een nieuwe klus meestal ook, en een klus die leeg begint
   zou hem dwingen om elke keer dezelfde vinkjes te zetten.

   Bestelling is geen module maar wel een stap, want het materiaal bestellen hoort bij het werk. */
const PROJECTSTAPPEN = ['inmeten', 'calculaties', 'offertes', 'facturen', 'bestelling'];

function stapAan(project, stap) {
  const s = (project && typeof project.stappen === 'object' && project.stappen) || {};
  return s[stap] !== false;
}

async function schermProject(id) {
  const { project } = await motor(`/projecten/${id}`);
  const [{ inmetingen }, { offertes }, { klanten }, { berekeningen }, { facturen }] = await Promise.all([
    motor('/inmetingen'), motor('/offertes'), motor('/klanten'), motor('/berekeningen'), motor('/facturen'),
  ]);
  const eigen = (lijst) => (lijst ?? []).filter((x) => x.project_id === id);
  const eigenMetingen = eigen(inmetingen);
  const eigenOffertes = eigen(offertes);
  const eigenBerekeningen = eigen(berekeningen);
  const eigenFacturen = eigen(facturen);

  /* Hangt er een klant aan de klus, dan reist die mee naar alles wat je hieronder begint. Wie een
     klus opent heeft zijn klant al gekozen; die naam hoort hij geen tweede keer op te zoeken. */
  const klantMee = project.customer_id ? `&klant=${project.customer_id}` : '';

  /* De bestellingtekst hangt af van waar de klus staat, want dat is precies wat hij wil weten. */
  const gewonnenHier = eigenOffertes.filter((o) => o.status === 'gewonnen');
  const bestelTekst = (project.status === 'besteld' || project.status === 'afgerond')
    ? 'Het materiaal voor deze klus is besteld. Je bestellingen staan onder Bestellingen.'
    : gewonnenHier.length
      ? 'Er staat een gewonnen offerte klaar. Stuur eerst de aanbetalingsfactuur en bestel zodra die betaald is: open de offerte hierboven en zet daarna de stand van de klus op besteld.'
      : 'Nog niets te bestellen. Bestellen gaat vanuit een gewonnen offerte, dan reist de materiaallijst vanzelf mee.';

  const blok = (stap, titel, aantal, knop, inhoud, leeg) => {
    if (!stapAan(project, stap)) return '';
    if (stap !== 'bestelling' && !moduleAan(stap)) return '';
    return `<div class="fr-blokkop"><h2>${titel}</h2>${aantal === null ? '' : `<span class="maatje">${aantal}</span>`}
        ${knop ? `<span class="rechts">${knop}</span>` : ''}</div>
      <div class="fr-rijen">${inhoud || legeRij(leeg)}</div>`;
  };

  return {
    html: `<p class="fr-eyebrow">Klus</p>
    <h1 class="fr-kop">${schoon(project.naam)}</h1>
    <p class="fr-onderkop">${schoon([klanten.find((k) => k.id === project.customer_id)?.naam,
      [project.werkadres, project.postcode, project.plaats].filter(Boolean).join(', ')].filter(Boolean).join(' · ') || 'nog geen klant of adres')}</p>

    <div class="fr-blokkop"><h2>Wat hoort er bij deze klus</h2></div>
    <p class="fr-hint">Wat je hier uitzet verdwijnt alleen bij deze klus. Wat je nooit gebruikt zet je
      uit onder Mijn bedrijf.</p>
    <div class="fr-chips" id="pr-stappen">
      ${PROJECTSTAPPEN.filter((s) => s === 'bestelling' || moduleAan(s))
        .map((s) => `<button type="button" class="fr-keuze${stapAan(project, s) ? ' aan' : ''}" data-stap="${s}">${s}</button>`).join('')
        || '<span class="fr-hint">Je hebt alles uitgezet onder Mijn bedrijf.</span>'}
    </div>

    <form id="fr-projectform" class="fr-form fr-form-breed" data-id="${project.id}">
      <div class="fr-veldrij">
        <label>Naam<input name="naam" value="${schoon(project.naam)}"></label>
        <label>Stand<select name="status">${Object.entries(PROJECTSTANDEN).map(([s, woord]) => `<option value="${s}" ${s === project.status ? 'selected' : ''}>${woord}</option>`).join('')}</select></label>
        <label>Klant<select name="klant_id"><option value="">nog geen klant</option>
          ${(klanten ?? []).map((k) => `<option value="${k.id}" ${k.id === project.customer_id ? 'selected' : ''}>${schoon(k.naam)}</option>`).join('')}
        </select></label>
      </div>
      <div class="fr-veldrij">
        <label>Werkadres<input name="werkadres" value="${schoon(project.werkadres ?? '')}"></label>
        <label>Postcode<input name="postcode" value="${schoon(project.postcode ?? '')}"></label>
        <label>Plaats<input name="plaats" value="${schoon(project.plaats ?? '')}"></label>
      </div>
      <label>Notitie<textarea name="notitie" rows="3">${schoon(project.notitie ?? '')}</textarea></label>
      <div class="fr-knoppenrij">
        <button class="fr-knop" type="submit">Bewaren</button>
        ${project.customer_id ? `<a class="fr-knop tweede" href="${BASIS}/klanten/${project.customer_id}" data-route>Naar de klantenkaart</a>` : ''}
        <button class="fr-knop tweede" type="button" data-actie="project-weg" data-id="${project.id}">Klus weghalen</button>
      </div>
    </form>

    ${blok('inmeten', 'Inmetingen', eigenMetingen.length,
      `<a class="fr-knop klein" href="${BASIS}/inmeten/nieuw?project=${project.id}${klantMee}" data-route>Nieuwe inmeting voor deze klus</a>`,
      eigenMetingen.map((x) => rijInmeting(x, false, project.id)).join(''),
      'Nog niets ingemeten voor deze klus. Sta je bij de klant, dan meet je hier per ruimte in en staat je offerte daarna al bijna klaar.')}

    ${blok('calculaties', 'Calculaties', eigenBerekeningen.length,
      `<a class="fr-knop klein" href="${BASIS}/calculaties/nieuw?project=${project.id}${klantMee}" data-route>Nieuwe berekening</a>`,
      eigenBerekeningen.map((b) => rijBerekening(b)).join(''),
      'Nog geen berekening voor deze klus. Reken hem door in de calculator en kies deze klus bij het bewaren.')}

    ${blok('offertes', 'Offertes', eigenOffertes.length,
      `<a class="fr-knop klein" href="${BASIS}/offertes/nieuw?vrij=1&project=${project.id}${klantMee}" data-route>Nieuwe offerte</a>`,
      eigenOffertes.map((o) => rijOfferte(o)).join(''),
      'Nog geen offerte voor deze klus. Reken hem door in de calculator en kies deze klus bij het bewaren.')}

    ${blok('facturen', 'Facturen', eigenFacturen.length,
      `<a class="fr-knop klein" href="${BASIS}/facturen/nieuw?project=${project.id}${klantMee}" data-route>Nieuwe factuur voor deze klus</a>`,
      eigenFacturen.map((f) => rijFactuur(f)).join(''),
      'Nog niets gefactureerd. De aanbetaling voor het materiaal gaat na het akkoord de deur uit, je werk na oplevering.')}

    ${blok('bestelling', 'Bestelling', null, '', '', bestelTekst)}`,
    na: () => {
      const chips = document.getElementById('pr-stappen');
      if (!chips) return;
      /* Een stap aan of uit zetten gaat meteen naar het account: een schakel met een bewaarknop
         ernaast is een schakel die half aan blijft staan. */
      chips.addEventListener('click', async (e) => {
        const knop = e.target.closest('.fr-keuze');
        if (!knop) return;
        const stap = knop.dataset.stap;
        const stappen = { ...(project.stappen && typeof project.stappen === 'object' ? project.stappen : {}) };
        stappen[stap] = !stapAan(project, stap);
        /* Aan is de lege stand, dus wat aanstaat hoort er niet in. */
        if (stappen[stap]) delete stappen[stap];
        try {
          await motor(`/projecten/${project.id}`, { methode: 'PATCH', body: { stappen } });
          project.stappen = stappen;
          toon(`/projecten/${project.id}`, false);
        } catch (err) { meldRegel(err.message); }
      });
    },
  };
}

/* Een nieuwe klus: een echt scherm, met de klant er meteen bij. */
async function schermProjectNieuw(zoek) {
  const { klanten } = await motor('/klanten');
  /* Komt hij van een klantenkaart, dan staat die klant hier al goed; daar drukte hij op de knop.
     Ook het adres van die klant wordt voorgesteld als werkadres, want bij een woning is dat
     meestal hetzelfde en anders tikt hij het over. */
  const uitKlant = new URLSearchParams(zoek).get('klant');
  const kaart = (klanten ?? []).find((k) => k.id === uitKlant);
  return {
    html: kop('Projecten', 'Nieuwe klus', 'De klus is de doos waar de inmeting, de berekening en de offerte samen in reizen.')
      + `<form id="pr-form" class="fr-form fr-form-breed">
        <div class="fr-veldrij">
          <label>Naam van de klus<input name="naam" required placeholder="Woonkamer Peeters"></label>
          <label>Klant<select name="klant_id"><option value="">nog geen klant</option>
            ${(klanten ?? []).map((k) => `<option value="${k.id}" ${k.id === uitKlant ? 'selected' : ''}>${schoon(k.naam)}</option>`).join('')}
          </select></label>
        </div>
        <div class="fr-veldrij">
          <label>Werkadres<input name="werkadres" value="${schoon(kaart?.adres ?? '')}"></label>
          <label style="max-width:130px">Postcode<input name="postcode" value="${schoon(kaart?.postcode ?? '')}"></label>
          <label>Plaats<input name="plaats" value="${schoon(kaart?.plaats ?? '')}"></label>
        </div>
        <label>Omschrijving<textarea name="omschrijving" rows="2"></textarea></label>
        <div class="fr-knoppenrij">
          <button class="fr-knop" type="submit">Klus aanmaken</button>
          <a class="fr-knop tweede" href="${BASIS}/projecten" data-route>Terug</a>
        </div>
        <p class="fr-formfout" id="pr-fout"></p>
      </form>`,
    na: () => {
      const form = document.getElementById('pr-form');
      koppelAdresvelden(form, { adres: 'werkadres', postcode: 'postcode', plaats: 'plaats' });
      form.addEventListener('submit', eenmalig(form.querySelector('button[type=submit]'), async (e) => {
        e.preventDefault();
        try {
          const { project } = await motor('/projecten', {
            methode: 'POST',
            body: {
              naam: form.naam.value,
              klant_id: form.klant_id.value || null,
              werkadres: form.werkadres.value || null,
              postcode: form.postcode.value || null,
              plaats: form.plaats.value || null,
              omschrijving: form.omschrijving.value || null,
            },
          });
          meldRegel('Klus aangemaakt.');
          toon(`/projecten/${project.id}`, true);
        } catch (err) { document.getElementById('pr-fout').textContent = err.message; }
      }));
    },
  };
}

/* ---------- inmeten ---------- */

/* De inmetingrij. Op de eigen lijst dragen de vier knoppen de hele vervolgweg; in de smalle kolom
   op het overzicht is dat te veel voor wat daar de bedoeling is (zien wat je laatst deed), dus daar
   blijft alleen Openen staan.

   Twee plekken, twee laatste knoppen. In een klus haal je hem er alleen uit; zijn meetwerk hoort niet
   weg te kunnen door een misklik in een doos. Weghalen doet hij onder Inmeten, waar de inmeting zelf
   woont. Dezelfde regel als bij de klant van een klus, die daar ook alleen los te halen is. */
function rijInmeting(x, kort = false, inKlus = null) {
  const ruimtes = (x.portal_measurement_rooms ?? []).length;
  return `<div class="fr-rij">
      <span class="hoofd">${schoon(x.naam || 'Inmeting')}</span>
      <span class="sub">${datum(x.gemeten_op)}</span>
      <span class="maatje">${[
        ruimtes ? `${ruimtes} ruimte${ruimtes === 1 ? '' : 's'} · ${m2(x.totaal_m2)}` : '',
        (x.kozijnen ?? []).length ? (() => {
          const stuks = x.kozijnen.reduce((s, kz) => s + (Number(kz.aantal) || 1), 0);
          return `${stuks} kozijn${stuks === 1 ? '' : 'en'}`;
        })() : '',
      ].filter(Boolean).join(' · ') || 'leeg'}</span>
      <span class="rechts">
        ${kort ? '' : `<a class="fr-knop klein" href="${BASIS}/calculaties/nieuw?van=${x.id}" data-route>Doorrekenen</a>
        <a class="fr-knop klein tweede" href="${BASIS}/offertes/nieuw?inmeting=${x.id}" data-route>Offerte</a>`}
        <a class="fr-knop klein tweede" href="${BASIS}/inmeten/${x.id}" data-route>Openen</a>
        ${kort ? '' : (inKlus
          ? `<button class="fr-knop klein tweede" data-actie="inmeting-los" data-id="${x.id}">Uit deze klus</button>`
          : `<button class="fr-knop klein tweede" data-actie="inmeting-weg" data-id="${x.id}">Weghalen</button>`)}
      </span>
    </div>`;
}

/* De berekeningrij en de factuurrij staan hier los, want ze worden op twee plekken getekend: op hun
   eigen tabblad en in de klus waar ze bij horen. */
function rijBerekening(b, projecten = null) {
  /* In de lijst staat de klus als keuzelijst erbij, zodat een berekening die los begon er alsnog
     bij kan. In een klus zelf staat hij niet: daar weet je al waar hij hangt. */
  const klusKeuze = projecten
    ? `<select class="fr-in klein" data-berekening-klus="${b.id}">
        <option value="">geen klus</option>
        ${projecten.map((p) => `<option value="${p.id}" ${p.id === b.project_id ? 'selected' : ''}>${schoon(p.naam)}</option>`).join('')}
      </select>`
    : '';
  return `<div class="fr-rij">
      <span class="hoofd">${schoon(b.naam || 'Berekening')}</span>
      <span class="sub">${datum(b.created_at)}</span>
      <span class="maatje">${m2(b.oppervlak_m2)} · ${euro(b.totaal_verkoop)}</span>
      <span class="rechts">${klusKeuze}
        <a class="fr-knop klein" href="${BASIS}/offertes/nieuw?berekening=${b.id}" data-route>Naar offerte</a>
        <a class="fr-knop klein tweede" href="${BASIS}/calculaties/${b.id}" data-route>Openen</a>
      </span>
    </div>`;
}

function rijFactuur(f) {
  return `<div class="fr-rij">
      <span class="hoofd">${schoon(f.nummer)}</span>
      <span class="sub">${schoon(f.klant_naam || '')}</span>
      <span class="maatje">${euro(f.totaal)} · vervalt ${datum(f.vervaldatum)}</span>
      <span class="rechts">${stand(f.status)}
        ${f.status === 'verstuurd' ? `<button class="fr-knop klein tweede" data-actie="factuur-status" data-id="${f.id}" data-status="betaald">Betaald</button>` : ''}
        ${f.status === 'concept' ? `<button class="fr-knop klein tweede" data-actie="factuur-status" data-id="${f.id}" data-status="verstuurd">Verstuurd</button>` : ''}
        <a class="fr-knop klein tweede" href="${BASIS}/facturen/${f.id}" data-route>Openen</a>
      </span>
    </div>`;
}

async function schermInmeten() {
  const { inmetingen } = await motor('/inmetingen');
  return kop('Inmeten', 'Per ruimte, op je telefoon, op locatie.',
      'De maten gaan naar je account en zijn overal terug te vinden. De motor rekent het oppervlak en de plintlengte zelf na.')
    + `<div class="fr-blokkop"><h2>Inmetingen</h2><span class="maatje">${inmetingen.length}</span>
        <span class="rechts"><a class="fr-knop klein" href="${BASIS}/inmeten/nieuw" data-route>Nieuwe inmeting</a></span></div>
      <div class="fr-rijen">${inmetingen.map((x) => rijInmeting(x)).join('') || legeRij('Nog geen inmetingen. Druk op Nieuwe inmeting om te beginnen.')}</div>`;
}

/* De volledige inmeetkaart staat in inmeten.js: vloer, kozijnen of allebei, de zes
   vaststel-vragen en de werkzaamheden-checklist die werkregels voor de offerte worden. */
function schermInmetingForm(id, zoek) {
  const uit = new URLSearchParams(zoek);
  return {
    html: kop('Inmeten', id === 'nieuw' ? 'Nieuwe inmeting' : 'Inmeting',
      'Meet per ruimte of per kozijn, beantwoord de vaststel-vragen en vink aan wat er moet gebeuren; dat worden vanzelf de werkregels op je offerte.')
      + '<div id="fr-inmeetbak"><p class="fr-onderkop">Laden...</p></div>',
    na: () => maakInmeetkaart({
      motor, schoon, meldRegel,
      naBewaren: () => toon('/inmeten', true),
    }).toon(document.getElementById('fr-inmeetbak'), id,
      `<a class="fr-knop tweede" href="${BASIS}/inmeten" data-route>Terug</a>`,
      { project_id: uit.get('project'), klant_id: uit.get('klant'), vloer_naam: uit.get('vloernaam'), vloer_handle: uit.get('vloer') }),
  };
}

/* ---------- calculaties ---------- */

async function schermCalculaties() {
  const [{ berekeningen }, { projecten }] = await Promise.all([motor('/berekeningen'), motor('/projecten')]);
  return {
    html: kop('Calculaties', 'Van maat naar materiaallijst.',
        'De calculator rekent de hele bestelling door: pakken, snijverlies, lijm, egaline, plinten en jouw marge. Een berekening bewaren kan per klus.')
      + `<div class="fr-blokkop"><h2>Berekeningen</h2><span class="maatje">${berekeningen.length}</span>
          <span class="rechts"><a class="fr-knop klein" href="${BASIS}/calculaties/nieuw" data-route>Nieuwe berekening</a></span></div>
        <div class="fr-rijen" id="ca-lijst">${berekeningen.map((b) => rijBerekening(b, projecten ?? [])).join('') || legeRij('Nog geen bewaarde berekeningen.')}</div>`,
    na: () => {
      document.getElementById('ca-lijst').addEventListener('change', async (e) => {
        const keuze = e.target.closest('[data-berekening-klus]');
        if (!keuze) return;
        try {
          await motor(`/berekeningen/${keuze.dataset.berekeningKlus}`, {
            methode: 'PATCH', body: { project_id: keuze.value || null },
          });
          meldRegel(keuze.value ? 'Berekening aan de klus gehangen.' : 'Berekening uit de klus gehaald.');
        } catch (err) { meldRegel(err.message); }
      });
    },
  };
}

/* De vloersoort uit de inmeting naar de soort in de prijslijst. */
const VLOERSOORT_NAAR_CAT = { 'pvc-lijm': 'pvc-dry', 'pvc-klik': 'pvc-click', laminaat: 'laminaat' };
const EENHEID_TEKST = { m2: 'm²', m: 'm', vast: 'vast', stuks: 'stuks' };

/* Het voorstel van de motor voor een inmeting (fase C5): de rekengroepen en de werkregels, elk
   met hun herkomst. Sinds stap 5 en 6 van de schermbouw (03-09-2026) lezen de calculator en de
   offerte-stap hieruit en niet meer uit de oude jsonb-velden van de inmeting; de motor is de
   enige die resolvet. Het eigen werk van de vakman heeft nog geen rij en komt uit werkregels met
   eigen: true; dat is de ene rest van de oude vorm die hier nog gelezen wordt. */
async function voorstelVan(inmetingId) {
  const [{ inmeting }, voorstel] = await Promise.all([
    motor(`/inmetingen/${inmetingId}`),
    motor(`/berekeningen/voorstel?inmeting=${inmetingId}`),
  ]);
  const werk = (voorstel.werk ?? []).map((w) => ({
    omschrijving: w.omschrijving, aantal: w.aantal, eenheid: EENHEID_TEKST[w.eenheid] ?? w.eenheid, tarief: 0, herkomst: w.herkomst ?? null,
  })).concat((inmeting.werkregels ?? []).filter((w) => w.eigen).map((w) => ({
    omschrijving: w.omschrijving, aantal: w.aantal, eenheid: w.eenheid, tarief: w.prijs || 0, herkomst: null,
  })));
  const vloeren = (voorstel.groepen ?? []).map((g) => ({
    sleutel: g.sleutel, naam: g.naam, m2: Number(g.oppervlak) || 0, omtrek: Number(g.plint_meters) || 0,
    legpatroon: g.legpatroon ?? null, cat: VLOERSOORT_NAAR_CAT[g.vloersoort] ?? null,
    bron: g.bron, product: g.product ?? null, band_bies: g.band_bies === true, herkomst: g.herkomst ?? null, room_ids: g.room_ids ?? [],
  }));
  return { inmeting, werk, vloeren, inhoud_versie: voorstel.inmeting?.inhoud_versie ?? inmeting.inhoud_versie ?? null };
}

/* De calculator zelf staat in calculator.js; hier alleen het inpakken in de route,
   met de maten die uit een inmeting meereizen (het legpatroon stuurt het snijverlies). */
async function schermCalculatorNieuw(zoek) {
  const params = new URLSearchParams(zoek);
  const van = params.get('van');
  /* Komt hij rechtstreeks uit een klus, dan staan die klus en zijn klant hier al goed: daar drukte
     hij op de knop. Zonder dit viel de klus op de grond, want de knop stuurde hem wel mee. */
  const voorkeur = { project_id: params.get('project') || undefined, klant_id: params.get('klant') || undefined };
  let onder = 'Kies de vloer en de toebehoren; de calculator rekent de hele bestelling door.';
  if (van) {
    const { inmeting, werk, vloeren, inhoud_versie } = await voorstelVan(van);
    voorkeur.m2 = Number(inmeting.totaal_m2) || undefined;
    voorkeur.omtrek = Number(inmeting.totaal_omtrek) || undefined;
    voorkeur.project_id = inmeting.project_id || voorkeur.project_id;
    voorkeur.klant_id = inmeting.customer_id || voorkeur.klant_id;
    voorkeur.inmeting_id = inmeting.id;
    voorkeur.inhoud_versie = inhoud_versie;
    /* De werkregels uit het voorstel reizen mee naar de offerte. Zonder dit gold de belofte van de
       inmeetkaart (dit worden vanzelf je werkregels) alleen als je de calculator oversloeg. */
    voorkeur.werk = werk;
    /* Elke rekengroep uit het voorstel wordt een eigen vloer in de calculator, met zijn eigen
       maten, zijn eigen soort, zijn eigen bron en zijn eigen snijverlies. Alles op een hoop
       rekenen gaf een verkeerde prijs: laminaat op de zolder werd dan als de PVC uit de woonkamer
       geprijsd. */
    voorkeur.vloeren = vloeren;
    const eerste = voorkeur.vloeren[0] ?? {};
    voorkeur.legpatroon = eerste.legpatroon ?? null;
    onder = voorkeur.vloeren.length > 1
      ? `${voorkeur.vloeren.length} vloeren uit ${inmeting.naam || 'je inmeting'}: `
        + voorkeur.vloeren.map((v) => `${v.naam} ${v.m2.toLocaleString('nl-NL')} m²`).join(', ')
        + '. Elke vloer reken je apart door; de bestelling telt ze bij elkaar op.'
      : `Maten overgenomen uit ${inmeting.naam || 'je inmeting'}: ${Number(inmeting.totaal_m2).toLocaleString('nl-NL')} m² vloer en ${Number(inmeting.totaal_omtrek).toLocaleString('nl-NL')} m plint.`
        + (voorkeur.legpatroon ? ` Het legpatroon (${voorkeur.legpatroon}) bepaalt het snijverlies.` : '');
    onder += voorkeur.werk.length ? ` Je ${voorkeur.werk.length} werkregel${voorkeur.werk.length === 1 ? '' : 's'} uit de inmeting reizen mee naar de offerte.` : '';
  }
  return {
    html: kop('Calculatie', 'Reken het project door.', onder)
      + '<div id="fr-calcbak"><p class="fr-onderkop">De prijslijst wordt geladen...</p></div>',
    na: () => maakCalculator({
      motor, euro, schoon, meldRegel,
      naBewaren: () => toon('/calculaties', true),
      naOfferte: () => toon('/offertes/nieuw', true),
    }).toon(document.getElementById('fr-calcbak'), voorkeur),
  };
}

/* De klant en de werkregels terugvinden bij iets dat ze zelf niet draagt.

   Een bewaarde berekening kent alleen zijn inmeting en zijn klus. De klant hangt daaronder: eerst
   bij de inmeting kijken, want die is het dichtst bij de klus zelf, en anders bij de klus. De
   werkregels komen altijd uit de inmeting; een klus heeft ze niet. Lukt het ophalen niet, dan
   levert dit gewoon niets op: een offerte zonder voorgevulde klant is vervelend, een offerte die
   niet opent is erger. */
async function klantEnWerkBij(inmetingId, projectId) {
  const uit = { klant_id: null, werk: [] };
  if (inmetingId) {
    try {
      const { inmeting, werk } = await voorstelVan(inmetingId);
      uit.klant_id = inmeting.customer_id || null;
      uit.werk = werk;
    } catch { /* dan zonder */ }
  }
  if (!uit.klant_id && projectId) {
    try {
      const { project } = await motor(`/projecten/${projectId}`);
      uit.klant_id = project.customer_id || null;
    } catch { /* dan zonder */ }
  }
  return uit;
}

/* De offerte-stap: uit de verse berekening (sessionStorage), uit een bewaarde
   berekening (?berekening=<id>), rechtstreeks uit een inmeting (?inmeting=<id>,
   zonder calculatie) of helemaal vrij (?vrij=1). */
async function schermOfferteNieuw(zoek) {
  const params = new URLSearchParams(zoek);
  const vanBerekening = params.get('berekening');
  const vanInmeting = params.get('inmeting');
  const vrij = params.get('vrij') === '1';
  let invoer = null;
  if (vanInmeting) {
    /* Rechtstreeks van maat naar offerte: de klant, de klus en de werkregels uit de
       checklist reizen mee; materiaal zet hij er zelf op of laat hij weg. */
    const { inmeting, werk } = await voorstelVan(vanInmeting);
    invoer = {
      vloer: null,
      soort: null,
      opp: Number(inmeting.totaal_m2) || null,
      regels: [],
      project_id: inmeting.project_id || null,
      klant_id: inmeting.customer_id || null,
      werk,
    };
    return {
      html: kop('Offerte', 'Van maat naar offerte, zonder rekenwerk.',
        `Op basis van ${inmeting.naam || 'je inmeting'}${invoer.opp ? `: ${Number(invoer.opp).toLocaleString('nl-NL')} m² netto` : ''}. De werkregels uit je inmeting staan er al onder; materiaal zet je erbij als dat nodig is.`)
        + '<div id="fr-offertebak"><p class="fr-onderkop">Laden...</p></div>',
      na: () => maakOfferte({
        motor, euro, schoon, meldRegel,
        naBewaren: (offerte) => toon(`/offertes/${offerte.id}`, true),
      }).toon(document.getElementById('fr-offertebak'), invoer),
    };
  }
  if (vanBerekening) {
    const { berekeningen } = await motor('/berekeningen');
    const b = (berekeningen ?? []).find((x) => x.id === vanBerekening);
    if (b) {
      invoer = {
        ...(b.invoer || {}),
        regels: (b.uitkomst && b.uitkomst.regels) || [],
        project_id: b.project_id || null,
        inmeting_id: b.measurement_id || null,
      };
      /* Een bewaarde berekening draagt zelf geen klant en geen werkregels: portal_calculations kent
         die kolommen niet. Ze zijn wel af te leiden uit waar de berekening aan hangt, dus dat doen
         we hier. Anders staat een offerte uit een bewaarde berekening weer op nul. */
      const erbij = await klantEnWerkBij(b.measurement_id, b.project_id);
      invoer.klant_id = erbij.klant_id;
      invoer.werk = erbij.werk;
    }
  } else {
    try { invoer = JSON.parse(sessionStorage.getItem('framr-offerte-invoer') || 'null'); } catch { invoer = null; }
  }
  if (vrij) {
    invoer = {
      vloer: null, soort: null, opp: null, regels: [],
      project_id: params.get('project') || null,
      klant_id: params.get('klant') || null,
    };
  }
  if (!invoer) {
    return kop('Offerte', 'Eerst rekenen, dan offreren.', null)
      + `<div class="fr-leeg"><div class="naam">Geen berekening gevonden</div>
        Maak eerst een berekening in de calculator en druk daar op Maak offerte, of kies er een onder Calculaties.</div>
        <div class="fr-knoppenrij" style="margin-top:16px"><a class="fr-knop" href="${BASIS}/calculaties/nieuw" data-route>Naar de calculator</a></div>`;
  }
  return {
    html: kop('Offerte', 'Op jouw naam, met jouw marge.',
      invoer.regels.length
        ? `${invoer.vloer || 'Berekening'} · ${invoer.opp ?? '?'} m² netto. Zet de klant erbij, je werkregels eronder, en bewaar.`
        : 'Een vrije offerte: zet zelf de materiaal- en werkregels erop, zonder meting of berekening vooraf.')
      + '<div id="fr-offertebak"><p class="fr-onderkop">Laden...</p></div>',
    na: () => maakOfferte({
      motor, euro, schoon, meldRegel,
      naBewaren: (offerte) => toon(`/offertes/${offerte.id}`, true),
    }).toon(document.getElementById('fr-offertebak'), invoer),
  };
}

/* Een bewaarde berekening terugzien.

   Zonder dit scherm was een berekening alleen een rij in een lijst: je kon hem niet openen, de
   regels niet nalezen, niet hernoemen en alleen vanaf de lijst aan een klus hangen. Wat er
   gerekend is verandert hier niet; dat is een momentopname van de prijzen van dat moment en die
   hoort te blijven staan. Wat je wel bijstelt is de naam en de klus, en van hieruit loop je door
   naar de klus, de inmeting of een offerte.

   Sinds stap 5 van de schermbouw komt hij van zijn eigen route, met zijn groepen (de rekencontext
   per vloer) en zijn regels met hun bron, en met de melding dat de inmeting sindsdien gewijzigd is
   als dat zo is. Die melding is een knop, geen stille herberekening. */
async function schermBerekening(id) {
  let uit = null;
  try { uit = await motor(`/berekeningen/${id}`); } catch { uit = null; }
  const { projecten } = await motor('/projecten');
  const b = uit?.berekening ?? null;
  if (!b) {
    return kop('Calculatie', 'Deze berekening bestaat niet meer.', null)
      + `<div class="fr-leeg"><div class="naam">Niet gevonden</div>
        Hij is weggehaald, of hij hoort bij een ander account.</div>
        <div class="fr-knoppenrij" style="margin-top:16px"><a class="fr-knop" href="${BASIS}/calculaties" data-route>Terug naar de calculaties</a></div>`;
  }
  const invoer = b.invoer ?? {};
  const regels = (b.uitkomst ?? {}).regels ?? [];
  const klus = (projecten ?? []).find((p) => p.id === b.project_id);
  const inmeting = uit.inmeting ?? null;
  const vloeren = invoer.vloeren ?? null;
  const groepen = b.portal_calculation_groups ?? [];
  const losseRegels = b.portal_calculation_lines ?? [];
  const BRONLABEL = { framr: 'via Framr.one', extern: 'eigen leverancier', klant: 'levert de klant', onbekend: 'nog te kiezen' };
  const regelRij = (r) => `<div class="fr-rij">
      <span class="hoofd">${schoon(r.omschrijving ?? 'Regel')}</span>
      <span class="maatje">${schoon([r.aantal, r.eenheid].filter((x) => x !== null && x !== undefined && x !== '').join(' '))}</span>
      ${r.soort === 'materiaal' && r.bron ? `<span class="fr-stand ${r.bron === 'framr' ? 'klaar' : 'stil'}">${BRONLABEL[r.bron] ?? r.bron}</span>` : ''}
      ${r.oorsprong && r.oorsprong !== 'automatisch' ? `<span class="fr-stand open">${schoon(r.oorsprong)}</span>` : ''}
      <span class="rechts"><span class="maatje">${r.bron === 'klant' || r.bron === 'onbekend' ? '' : euro(r.bedrag_verkoop ?? 0)}</span></span>
    </div>`;
  /* Zonder partnerniveau is de inkoop gelijk aan de adviesprijs; een marge tonen zou dan een
     negatief getal zijn dat niets betekent. Zelfde regel als in de calculator en op de offerte. */
  const geenNiveau = Number(b.totaal_inkoop ?? 0) >= Number(b.totaal_verkoop ?? 0);

  return {
    html: `<p class="fr-eyebrow">Calculatie</p>
    <h1 class="fr-kop">${schoon(b.naam || 'Berekening')}</h1>
    <p class="fr-onderkop">${schoon([invoer.vloer, invoer.soort].filter(Boolean).join(' · ') || 'vrije berekening')} · gemaakt ${datum(b.created_at)}</p>

    <div class="fr-form fr-form-breed">
      <div class="fr-veldrij">
        <label>Naam<input id="be-naam" value="${schoon(b.naam ?? '')}"></label>
        <label>Hoort bij klus<select class="fr-in" id="be-klus">
          <option value="">geen klus</option>
          ${(projecten ?? []).map((p) => `<option value="${p.id}" ${p.id === b.project_id ? 'selected' : ''}>${schoon(p.naam)}</option>`).join('')}
        </select></label>
      </div>
      <div class="fr-knoppenrij">
        <button class="fr-knop" id="be-bewaar" type="button">Bewaren</button>
      </div>
      <p class="fr-formfout" id="be-fout"></p>
    </div>

    <div class="fr-tegels">
      <div class="fr-tegel"><div class="naam">Oppervlak</div><div class="waarde">${m2(b.oppervlak_m2)}</div></div>
      ${invoer.verliesPct ? `<div class="fr-tegel"><div class="naam">Snijverlies</div><div class="waarde">${schoon(invoer.verliesPct)}%<small>${invoer.brutoM2 ? `${invoer.brutoM2} m² te bestellen` : ''}</small></div></div>` : ''}
      <div class="fr-tegel"><div class="naam">Verkoop</div><div class="waarde">${euro(b.totaal_verkoop)}</div></div>
      ${geenNiveau ? '' : `<div class="fr-tegel"><div class="naam">Jouw marge</div><div class="waarde">${euro(Number(b.totaal_verkoop ?? 0) - Number(b.totaal_inkoop ?? 0))}</div></div>`}
    </div>
    ${geenNiveau ? '<p class="fr-hint">Zonder partnerniveau rekent het portaal met adviesprijzen, dus er is hier geen inkoop en geen marge te tonen.</p>' : ''}

    ${uit.verouderd ? `<p class="fr-note"><b>De inmeting is gewijzigd sinds deze berekening</b> (stand ${schoon(String(b.gebaseerd_op))} toen, nu ${schoon(String(inmeting?.inhoud_versie ?? '?'))}).
      De bedragen hieronder zijn niet stilletjes herrekend; reken opnieuw door als je de nieuwe maten wilt.
      <a class="fr-knop klein" href="${BASIS}/calculaties/nieuw?van=${b.measurement_id}" data-route style="margin-left:10px">Opnieuw doorrekenen</a></p>` : ''}

    ${vloeren && vloeren.length > 1 ? `<p class="fr-hint">Deze berekening gaat over ${vloeren.length} vloeren: ${schoon(vloeren.map((v) => v.naam).join(', '))}.</p>` : ''}

    ${groepen.length ? groepen.map((g) => `
      <div class="fr-blokkop"><h2>${schoon(g.naam)}</h2>
        <span class="maatje">${m2(g.oppervlak)}${Number(g.plint_meters) ? ` · ${Number(g.plint_meters).toLocaleString('nl-NL')} m plint` : ''}${g.snijverlies_pct !== null && g.snijverlies_pct !== undefined ? ` · ${Number(g.snijverlies_pct).toLocaleString('nl-NL')}% snijverlies` : ''}</span>
        <span class="rechts"><span class="fr-stand ${g.bron === 'framr' ? 'klaar' : 'stil'}">${BRONLABEL[g.bron] ?? g.bron}</span></span></div>
      ${g.product ? `<p class="fr-hint">${schoon(g.product)}${g.leverancier ? ` · ${schoon(g.leverancier)}` : ''}</p>` : ''}
      <div class="fr-rijen">${(g.portal_calculation_lines ?? []).map(regelRij).join('') || legeRij('Geen materiaalregels in deze groep.')}</div>`).join('')
      + (losseRegels.length ? `<div class="fr-blokkop"><h2>Het werk</h2><span class="maatje">${losseRegels.length}</span></div>
        <div class="fr-rijen">${losseRegels.map(regelRij).join('')}</div>` : '')
      : `<div class="fr-blokkop"><h2>De materiaallijst</h2><span class="maatje">${regels.length}</span></div>
    <div class="fr-rijen">${regels.map((r) => `<div class="fr-rij">
        <span class="hoofd">${schoon(r.naam ?? 'Regel')}</span>
        <span class="sub">${schoon(r.uitleg ?? '')}</span>
        <span class="maatje">${schoon(r.aantal ?? '')}</span>
        <span class="rechts"><span class="maatje">${euro(r.verk ?? 0)}</span></span>
      </div>`).join('') || legeRij('Deze berekening draagt geen regels meer; hij is bewaard voordat de regels werden meegeschreven.')}</div>`}

    <div class="fr-knoppenrij">
      <a class="fr-knop" href="${BASIS}/offertes/nieuw?berekening=${b.id}" data-route>Offerte maken</a>
      ${klus ? `<a class="fr-knop tweede" href="${BASIS}/projecten/${klus.id}" data-route>Naar de klus</a>` : ''}
      ${inmeting ? `<a class="fr-knop tweede" href="${BASIS}/inmeten/${inmeting.id}" data-route>Naar de inmeting</a>` : ''}
      <button class="fr-knop tweede" data-actie="berekening-weg" data-id="${b.id}">Weghalen</button>
      <a class="fr-knop tweede" href="${BASIS}/calculaties" data-route>Terug</a>
    </div>
    <p class="fr-hint">De bedragen van een bewaarde berekening blijven staan zoals ze gerekend zijn, met de prijzen van dat moment. Wil je met verse prijzen rekenen, maak dan een nieuwe berekening vanuit de inmeting.</p>`,
    na: () => {
      const knopbebewaar = document.getElementById('be-bewaar');
      knopbebewaar.addEventListener('click', eenmalig(knopbebewaar, async () => {
        const fout = document.getElementById('be-fout');
        fout.textContent = '';
        try {
          await motor(`/berekeningen/${b.id}`, {
            methode: 'PATCH',
            body: {
              naam: document.getElementById('be-naam').value || null,
              project_id: document.getElementById('be-klus').value || null,
            },
          });
          meldRegel('Berekening bewaard.');
          toon(`/calculaties/${b.id}`, false);
        } catch (err) { fout.textContent = err.message; }
      }));
    },
  };
}

/* ---------- offertes ---------- */

function rijOfferte(o) {
  return `<div class="fr-rij">
      <span class="hoofd">${schoon(o.nummer)}</span>
      <span class="sub">${schoon(o.klant_naam || '')}</span>
      <span class="maatje">${euro(o.totaal)} · ${datum(o.created_at)}</span>
      <span class="rechts">${stand(o.status)}
        <a class="fr-knop klein tweede" href="${BASIS}/offertes/${o.id}" data-route>Openen</a></span>
    </div>`;
}

/* Wat er van een offerte aan hem blijft hangen: het verschil op het materiaal plus zijn eigen werk.
   Dezelfde som als het Oaklyn-portaal maakt, zodat dezelfde offerte in beide hetzelfde bedrag geeft. */
function marge(o) {
  const mat = offerteMateriaal(o);
  return mat.verkoop - mat.inkoop + (Number(o.werk_totaal) || 0);
}

async function schermOffertes() {
  const { offertes } = await motor('/offertes');
  const verstuurd = offertes.filter((o) => o.status === 'verstuurd');
  const gewonnen = offertes.filter((o) => o.status === 'gewonnen');
  const verdiend = gewonnen.reduce((s, o) => s + marge(o), 0);
  return kop('Offertes', 'Op jouw naam, met jouw marge.',
      'Offertes maken loopt via de calculator; hier staat alles wat er ligt, met de stand erbij.')
    + `<div class="fr-tegels">
        <div class="fr-tegel"><div class="naam">Bewaard</div><div class="waarde">${offertes.length}</div></div>
        <div class="fr-tegel"><div class="naam">Verstuurd</div><div class="waarde">${verstuurd.length} <small>wacht op antwoord</small></div></div>
        <div class="fr-tegel"><div class="naam">Gewonnen</div><div class="waarde">${gewonnen.length} <small>klussen binnen</small></div></div>
        <div class="fr-tegel"><div class="naam">Verdiend</div><div class="waarde">${euro(verdiend)}</div></div>
      </div>
      <div class="fr-blokkop"><h2>Alle offertes</h2><span class="maatje">${offertes.length}</span>
        <span class="rechts"><a class="fr-knop klein" href="${BASIS}/offertes/nieuw?vrij=1" data-route>Nieuwe offerte</a></span></div>
      <div class="fr-rijen">${offertes.map((o) => rijOfferte(o)).join('') || legeRij('Nog geen offertes.')}</div>`;
}

/* De regels van een offerte, ook als ze niet in portal_quote_lines staan.

   Op live zijn negen van de elf offertes gemaakt voordat de regels als eigen rijen werden
   weggeschreven; hun regels zitten in de kolom berekening, in de vorm die de calculator maakt
   ({naam, aantal, uitleg, adv, verk, ink}). Zonder deze terugval opent zo'n offerte leeg, komt er
   een leeg vel uit de PDF, valt er niets aan te vinken op de factuurstap en kopieert Kopieren een
   offerte zonder inhoud.

   Dit leest alleen; er wordt niets herschreven. Een offerte die wel eigen regels heeft verandert
   niet, want die zijn de waarheid: de blob is een momentopname van de berekening, de regels zijn
   wat er op het vel stond. */
function offerteRegels(offerte) {
  const eigen = (offerte.portal_quote_lines ?? []).slice().sort((a, b) => (a.volgorde ?? 0) - (b.volgorde ?? 0));
  if (eigen.length) return eigen;
  const oud = (offerte.berekening ?? {}).regels;
  if (!Array.isArray(oud) || !oud.length) return [];
  return oud.map((r, i) => {
    /* aantal staat er als tekst ("12 pakken"); getal en eenheid weer uit elkaar. */
    const stuk = String(r.aantal ?? '').trim().match(/^([\d.,]+)\s*(.*)$/);
    return {
      id: null,
      volgorde: i,
      soort: 'materiaal',
      omschrijving: r.naam ?? 'Regel',
      aantal: r.stuks ?? (stuk ? Number(stuk[1].replace(',', '.')) : null),
      eenheid: stuk ? stuk[2] : null,
      uitleg: r.uitleg ?? null,
      bedrag_advies: Number(r.adv ?? 0),
      bedrag_verkoop: Number(r.verk ?? 0),
      bedrag_inkoop: Number(r.ink ?? 0),
      prijs_verkoop: r.stuks ? Number(r.verk ?? 0) / Number(r.stuks) : null,
      uitBerekening: true,
    };
  });
}

/* Wat het materiaal op een offerte kostte. De oude offertes hebben materiaal_verkoop op nul staan
   terwijl het subtotaal er wel is; dan komt het uit de berekening, en anders uit de kolommen. */
function offerteMateriaal(offerte) {
  const kolom = {
    advies: Number(offerte.materiaal_advies ?? 0),
    verkoop: Number(offerte.materiaal_verkoop ?? 0),
    inkoop: Number(offerte.materiaal_inkoop ?? 0),
  };
  if (kolom.verkoop > 0) return kolom;
  const totaal = (offerte.berekening ?? {}).totaal;
  if (totaal && Number(totaal.verk) > 0) {
    return { advies: Number(totaal.adv ?? 0), verkoop: Number(totaal.verk ?? 0), inkoop: Number(totaal.ink ?? 0) };
  }
  return kolom;
}

/* De statussen van een offerte, in de volgorde waarin hij ze doorloopt. Vrij kiezen in plaats van
   alleen de volgende stap: een offerte gaat in het echt ook wel eens terug (Jelle zette hem per
   ongeluk op verstuurd), en dan moet je dat kunnen rechtzetten zonder hem opnieuw te maken. */
const OFFERTESTANDEN = ['concept', 'verstuurd', 'gewonnen', 'verloren', 'besteld'];

async function schermOfferte(id) {
  const [{ offerte }, { projecten }, { documenten }, { klanten }] = await Promise.all([
    motor(`/offertes/${id}`), motor('/projecten'), motor('/documenten'), motor('/klanten'),
  ]);
  const vellen = bewaardeVellen(documenten, 'quote_id', id);
  const klant = klantOpDocument(offerte, klanten);
  const regels = offerteRegels(offerte);
  const uitBlob = regels.length > 0 && regels[0].uitBerekening;
  const waar = [klant.naam || 'zonder klant', offerte.project].filter(Boolean).join(' · ');

  return {
    html: `<p class="fr-eyebrow">Offerte</p>
    <h1 class="fr-kop">${schoon(offerte.nummer)}</h1>
    <p class="fr-onderkop">${schoon(waar)} · gemaakt ${datum(offerte.created_at)}${offerte.geldig_tot ? ` · geldig tot ${datum(offerte.geldig_tot)}` : ''}</p>

    ${herkomstRegel(offerte, klant)}

    <div class="fr-veldrij" style="max-width:620px">
      <label class="fr-veldlabel">Stand
        <select class="fr-in" id="of-stand">
          ${OFFERTESTANDEN.map((s) => `<option value="${s}" ${s === offerte.status ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
      </label>
      <label class="fr-veldlabel">Hoort bij klus
        <select class="fr-in" id="of-klus">
          <option value="">geen klus</option>
          ${(projecten ?? []).map((p) => `<option value="${p.id}" ${p.id === offerte.project_id ? 'selected' : ''}>${schoon(p.naam)}</option>`).join('')}
        </select>
      </label>
    </div>

    <div class="fr-blokkop"><h2>De regels</h2><span class="maatje">${regels.length}</span></div>
    <div class="fr-rijen">${regels.map((r) => `<div class="fr-rij">
        <span class="hoofd">${schoon(r.omschrijving ?? 'Regel')}</span>
        <span class="sub">${schoon(r.uitleg ?? '')}</span>
        <span class="maatje">${r.aantal ?? ''} ${schoon(r.eenheid ?? '')}</span>
        <span class="rechts"><span class="maatje">${euro(r.bedrag_verkoop ?? 0)}</span></span>
      </div>`).join('') || legeRij('Deze offerte draagt geen regels. Hij is gemaakt zonder calculatie, of de regels zijn nooit bewaard.')}</div>
    ${uitBlob ? '<p class="fr-hint">Deze offerte komt uit de tijd dat de regels alleen als berekening bewaard werden. Ze worden hier uit die berekening gelezen, dus je kunt hem gewoon openen en afdrukken; op de factuurstap kunnen ze alleen niet per regel afgevinkt worden.</p>' : ''}

    <div class="fr-tegels">
      <div class="fr-tegel"><div class="naam">Totaal</div><div class="waarde">${euro(offerte.totaal)}</div></div>
      <div class="fr-tegel"><div class="naam">Jouw marge</div><div class="waarde">${euro(marge(offerte))}</div></div>
      <div class="fr-tegel"><div class="naam">Marge</div><div class="waarde">${Number(offerte.totaal) ? Math.round((marge(offerte) / Number(offerte.totaal)) * 100) : 0}%</div></div>
    </div>

    ${vellenBlok(vellen)}

    <div class="fr-knoppenrij">
      ${offerte.status === 'gewonnen' ? `<button class="fr-knop" data-actie="offerte-bestel" data-id="${offerte.id}">Bestellen bij Oaklyn</button>` : ''}
      <a class="fr-knop${offerte.status === 'gewonnen' ? ' tweede' : ''}" href="${BASIS}/offertes/${offerte.id}/factuur" data-route>Factuur maken</a>
      ${offerte.status === 'concept' ? `<a class="fr-knop tweede" href="${BASIS}/offertes/${offerte.id}/bewerken" data-route>Bewerken</a>` : ''}
      <button class="fr-knop tweede" data-actie="offerte-kopie" data-id="${offerte.id}">Kopieren</button>
      <button class="fr-knop tweede" data-actie="offerte-pdf" data-id="${offerte.id}">PDF opslaan</button>
      <button class="fr-knop tweede" data-actie="offerte-weg" data-id="${offerte.id}">Weghalen</button>
      <a class="fr-knop tweede" href="${BASIS}/offertes" data-route>Terug</a>
    </div>`,
    na: () => {
      document.getElementById('of-stand').addEventListener('change', async (e) => {
        try {
          await motor(`/offertes/${offerte.id}`, { methode: 'PATCH', body: { status: e.target.value } });
          meldRegel(`Offerte op ${e.target.value} gezet.`);
          toon(`/offertes/${offerte.id}`, false);
        } catch (err) { meldRegel(err.message); }
      });
      /* Een offerte die los begon mag er alsnog bij. De motor wil bij deze route altijd een
         geldige stand zien, dus die gaat mee zoals hij nu staat. */
      document.getElementById('of-klus').addEventListener('change', async (e) => {
        try {
          await motor(`/offertes/${offerte.id}`, {
            methode: 'PATCH',
            body: { status: document.getElementById('of-stand').value, project_id: e.target.value || null },
          });
          meldRegel(e.target.value ? 'Offerte aan de klus gehangen.' : 'Offerte uit de klus gehaald.');
        } catch (err) { meldRegel(err.message); }
      });
    },
  };
}

/* De factuur uit een offerte: aanvinken wat erop komt; wat overblijft komt later op de
   restfactuur. De motor kent per regel bij welke offerteregel hij hoort, dus dubbel
   factureren kan niet stilletjes gebeuren. */
async function schermFactuurUitOfferte(id) {
  const [{ offerte }, { regels: uitMotor }] = await Promise.all([
    motor(`/offertes/${id}`),
    motor(`/offertes/${id}/te-factureren`),
  ]);
  /* Heeft de offerte geen eigen regels, dan komen ze uit de berekening. Ze dragen dan geen
     verwijzing naar een offerteregel, dus de bewaking op dubbel factureren kan er niet op letten;
     dat staat er onder de lijst ook zo. */
  const regels = (uitMotor ?? []).length ? uitMotor : offerteRegels(offerte).map((r) => ({ ...r, gefactureerd: false }));
  /* De klantgegevens die op de nieuwe factuur komen. Is de offerte nog concept, dan komen ze van
     de kaart; staat de offerte al vast, dan neemt de factuur over wat daar vastligt. */
  const { klanten: alleKlanten } = await motor('/klanten');
  const klantBron = klantOpDocument(offerte, alleKlanten);
  const zonderBewaking = !(uitMotor ?? []).length && regels.length > 0;
  /* Staat er niets meer open, dan is de hele offerte gefactureerd. Dan hoort hier geen knop te
     staan die pas na het klikken zegt dat er niets aan te vinken is. */
  const allesGefactureerd = regels.length > 0 && regels.every((r) => r.gefactureerd);
  const rijen = (regels ?? []).map((r, i) => {
    const bedrag = Number(r.bedrag_verkoop ?? 0);
    return `<label class="fr-rij fr-vinkrij${r.gefactureerd ? ' stil' : ''}">
      <input type="checkbox" data-vink="${i}" ${r.gefactureerd ? 'disabled' : (r.soort === 'materiaal' ? 'checked' : '')}>
      <span class="hoofd">${schoon(r.omschrijving)}</span>
      <span class="sub">${r.gefactureerd ? 'al gefactureerd' : (r.soort === 'werk' ? 'werk' : 'materiaal')}</span>
      <span class="rechts">${r.gefactureerd ? '' : `<select data-btw="${i}" class="fr-vinkbtw">
          <option value="21" selected>21%</option>
          <option value="9">9%</option>
          <option value="0">verlegd</option>
        </select>`}
        <span class="maatje">${euro(bedrag)}</span></span>
    </label>`;
  }).join('');
  return {
    html: kop('Factuur', `Factuur uit ${offerte.nummer}`,
      'Vink aan wat op deze factuur komt. Wat je niet aanvinkt blijft staan voor de restfactuur; wat al gefactureerd is kan niet opnieuw.')
      + `<div class="fr-rijen" id="fa-regels">${rijen || '<div class="fr-leeg">Deze offerte heeft geen regels om te factureren. Maak een vrije factuur als je hem toch wilt versturen.</div>'}</div>
      ${zonderBewaking ? '<p class="fr-hint">De regels komen uit de bewaarde berekening van deze offerte, want er staan geen losse offerteregels bij. Je kunt er gewoon mee factureren; alleen kan het portaal niet bijhouden welke regel al op een eerdere factuur stond.</p>' : ''}
      ${allesGefactureerd ? `<div class="fr-leeg"><div class="naam">Deze offerte is helemaal gefactureerd</div>
        Elke regel staat al op een factuur. Is er toch nog iets te factureren, bijvoorbeeld meerwerk,
        maak daar dan een vrije factuur voor.</div>` : ''}
      <div class="fr-form" style="margin-top:18px">
        <div class="fr-veldrij">
          <label>Soort factuur<select id="fa-soort">
            <option value="aanbetaling">Aanbetaling (materiaal vooraf)</option>
            <option value="materiaal">Materiaal</option>
            <option value="werk">Werk na oplevering</option>
            <option value="rest">Restfactuur</option>
          </select></label>
          <label>Omschrijving<input id="fa-omschrijving" value="${schoon(offerte.project || offerte.klant_naam || '')}"></label>
        </div>
        <div class="fr-blokkop"><h2>Op deze factuur</h2><span class="maatje" id="fa-som"></span></div>
        <div class="fr-knoppenrij"${allesGefactureerd ? ' hidden' : ''}>
          <button class="fr-knop" id="fa-bewaar" type="button">Factuur maken</button>
          <a class="fr-knop tweede" href="${BASIS}/offertes/${id}" data-route>Terug</a>
        </div>
        <p class="fr-hint">De factuur begint als concept met een nummer uit jouw factuurreeks; versturen en betaald melden doe je onder Facturen.</p>
        <p class="fr-formfout" id="fa-fout"></p>
      </div>`,
    na: () => {
      const lijst = regels ?? [];
      const som = () => {
        const gekozen = [...document.querySelectorAll('[data-vink]')].filter((el) => el.checked && !el.disabled);
        const bedrag = gekozen.reduce((s, el) => s + Number(lijst[Number(el.dataset.vink)].bedrag_verkoop ?? 0), 0);
        document.getElementById('fa-som').textContent = `${gekozen.length} regels · ${euro(bedrag)} ex btw`;
      };
      document.getElementById('fa-regels').addEventListener('change', som);
      som();
      const knopfabewaar = document.getElementById('fa-bewaar');
      knopfabewaar.addEventListener('click', eenmalig(knopfabewaar, async () => {
        const foutvak = document.getElementById('fa-fout');
        foutvak.textContent = '';
        const gekozen = [...document.querySelectorAll('[data-vink]')].filter((el) => el.checked && !el.disabled)
          .map((el) => {
            const i = Number(el.dataset.vink);
            const keus = document.querySelector(`[data-btw="${i}"]`);
            return { ...lijst[i], btw_tarief: keus ? Number(keus.value) : 21 };
          });
        if (!gekozen.length) { foutvak.textContent = 'Vink eerst aan wat op de factuur komt.'; return; }
        try {
          await motor('/facturen', {
            methode: 'POST',
            body: {
              quote_id: offerte.id,
              project_id: offerte.project_id || null,
              klant_id: offerte.customer_id || null,
              klant_naam: klantBron.naam,
              klant_adres: klantBron.adres,
              klant_postcode: klantBron.postcode,
              klant_plaats: klantBron.plaats,
              soort: document.getElementById('fa-soort').value,
              omschrijving: document.getElementById('fa-omschrijving').value || null,
              regels: gekozen.map((r) => ({
                soort: r.soort === 'werk' ? 'werk' : 'materiaal',
                omschrijving: r.omschrijving,
                aantal: r.aantal,
                eenheid: r.eenheid,
                bedrag: Number(r.bedrag_verkoop ?? 0),
                btw_tarief: r.btw_tarief,
                quote_line_id: r.id,
              })),
            },
          });
          meldRegel('Factuur gemaakt.');
          toon('/facturen', true);
        } catch (e) { foutvak.textContent = e.message; }
      }));
    },
  };
}

/* ---------- facturen ---------- */

/* Het archief hoort onder de facturen, want daar doet het ertoe: een verstuurde factuur mag niet
   opnieuw uit de database getekend worden maar moet het vel zijn dat de deur uit ging. De lijst komt
   zonder inhoud binnen; het bestand zelf wordt pas opgehaald als hij erop drukt. */
function rijDocument(d) {
  return `<div class="fr-rij">
      <span class="hoofd">${schoon(d.nummer || d.bestandsnaam)}</span>
      <span class="sub">${schoon(d.soort)} · ${datum(d.created_at)}</span>
      <span class="maatje">${Math.max(1, Math.round((d.bytes ?? 0) / 1024))} kB</span>
      <span class="rechts">
        <button class="fr-knop klein tweede" data-actie="document-halen" data-id="${d.id}">Ophalen</button>
        <button class="fr-knop klein tweede" data-actie="document-weg" data-id="${d.id}">Weghalen</button>
      </span>
    </div>`;
}

/* De factuur als CSV, voor wie hem in zijn boekhouding overtypt. Puntkomma's en komma's als
   decimaalteken, want dat is wat een Nederlandse Excel verwacht, en met de byte-order-mark ervoor
   zodat de accenten niet omvallen. De totalen staan eronder, zodat wat hij overneemt klopt met wat
   er op het vel staat. */
function csvVeld(waarde) {
  const t = String(waarde ?? '');
  return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

function csvBedrag(n) {
  return Number(n ?? 0).toFixed(2).replace('.', ',');
}

async function factuurCsv(id) {
  const { factuur: f } = await motor(`/facturen/${id}`);
  const regels = (f.portal_invoice_lines ?? []).slice().sort((a, b) => (a.volgorde ?? 0) - (b.volgorde ?? 0));
  const rijen = [['Factuurnummer', 'Factuurdatum', 'Vervaldatum', 'Klant', 'Omschrijving',
    'Aantal', 'Eenheid', 'Prijs', 'Btw tarief', 'Bedrag'].map(csvVeld).join(';')];
  regels.forEach((r) => {
    rijen.push([
      csvVeld(f.nummer),
      csvVeld(String(f.factuurdatum ?? '').slice(0, 10)),
      csvVeld(String(f.vervaldatum ?? '').slice(0, 10)),
      csvVeld(f.klant_naam ?? ''),
      csvVeld(r.omschrijving ?? ''),
      csvVeld(String(r.aantal ?? '').replace('.', ',')),
      csvVeld(r.eenheid ?? ''),
      csvVeld(csvBedrag(r.prijs)),
      csvVeld(r.btw_tarief ?? ''),
      csvVeld(csvBedrag(r.bedrag)),
    ].join(';'));
  });
  rijen.push('');
  rijen.push([csvVeld('Subtotaal'), csvVeld(csvBedrag(f.subtotaal))].join(';'));
  rijen.push([csvVeld('Totaal'), csvVeld(csvBedrag(f.totaal))].join(';'));

  const blob = new Blob(['﻿' + rijen.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const adres = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = adres;
  link.download = PDF.bestandsnaam(['factuur', f.nummer, f.klant_naam]).replace(/\.pdf$/, '') + '.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(adres), 4000);
  meldRegel('CSV gedownload.');
}

async function schermFacturen() {
  const [{ facturen }, { documenten }] = await Promise.all([motor('/facturen'), motor('/documenten')]);
  return kop('Facturen', 'Uit de offerte of helemaal los, in jouw reeks.',
      'Het nummer komt uit je eigen factuurreeks. Een verstuurde factuur blijft altijd staan.')
    + `<div class="fr-blokkop"><h2>Alle facturen</h2><span class="maatje">${facturen.length}</span>
        <span class="rechts"><a class="fr-knop klein" href="${BASIS}/facturen/nieuw" data-route>Nieuwe factuur</a></span></div>
      <div class="fr-rijen">${facturen.map((f) => rijFactuur(f)).join('') || legeRij('Nog geen facturen.')}</div>

      <div class="fr-blokkop"><h2>Archief</h2><span class="maatje">${documenten.length}</span></div>
      <div class="fr-rijen">${documenten.map((d) => rijDocument(d)).join('')
        || legeRij('Nog niets in het archief. Elke offerte en factuur die je als PDF opslaat komt hier terecht, precies zoals hij de deur uit ging.')}</div>`;
}

/* Een bewaarde conceptofferte terug in de editor zetten.

   De regel van Jelle (02-09-2026): een conceptofferte is volledig te bewerken, een verstuurde
   niet. Wat verstuurd is hoort te blijven staan; wil je die wijzigen, dan maak je er een kopie
   van en dat wordt een nieuwe versie. De motor bewaakt dat ook en weigert een inhoudswijziging
   op een offerte die geen concept meer is.

   Bij het bewerken worden alle materiaalregels gewone regels met hun eigen prijs, met de inkoop
   die eraan hing, zodat de marge blijft kloppen. De kortingschuif hoort bij een verse berekening
   en heeft op een bewaarde offerte niets meer te sturen. */
async function schermOfferteBewerken(id) {
  const { offerte } = await motor(`/offertes/${id}`);
  if (offerte.status !== 'concept') {
    return kop('Offerte', `${offerte.nummer} is al verstuurd`, null)
      + `<div class="fr-leeg"><div class="naam">Deze offerte staat vast</div>
        Hij heeft de stand ${schoon(offerte.status)}. Wat de deur uit is hoort te blijven staan, dus
        wijzigen kan hier niet meer. Maak er een kopie van; die begint als concept en die kun je wel
        aanpassen.</div>
        <div class="fr-knoppenrij" style="margin-top:16px">
          <button class="fr-knop" data-actie="offerte-kopie" data-id="${offerte.id}">Kopieren als nieuwe offerte</button>
          <a class="fr-knop tweede" href="${BASIS}/offertes/${offerte.id}" data-route>Terug naar de offerte</a>
        </div>`;
  }

  const alle = offerteRegels(offerte);
  const bereken = offerte.berekening ?? {};
  const invoer = {
    bewerktId: offerte.id,
    klant_id: offerte.customer_id ?? null,
    project_id: offerte.project_id ?? null,
    klant_naam: offerte.klant_naam ?? null,
    klant_adres: offerte.klant_adres ?? null,
    klant_postcode: offerte.klant_postcode ?? null,
    klant_plaats: offerte.klant_plaats ?? null,
    korting: bereken.korting ?? 0,
    btwTarief: bereken.btw_tarief ?? 21,
    vloer: bereken.vloer ?? null,
    soort: bereken.soort ?? null,
    opp: bereken.opp ?? null,
    verliesPct: bereken.verliesPct ?? null,
    brutoM2: bereken.brutoM2 ?? null,
    regels: [],
    vrijMat: alle.filter((r) => r.soort !== 'werk').map((r) => {
      const aantal = Number(r.aantal ?? 0) || 0;
      const bedrag = Number(r.bedrag_verkoop ?? 0);
      return {
        omschrijving: r.omschrijving ?? '',
        aantal: aantal || 1,
        eenheid: r.eenheid ?? 'stuks',
        prijs: aantal > 0 ? Math.round((bedrag / aantal) * 100) / 100 : bedrag,
        ink: Number(r.bedrag_inkoop ?? 0),
      };
    }),
    werk: alle.filter((r) => r.soort === 'werk').map((r) => ({
      omschrijving: r.omschrijving ?? '',
      aantal: Number(r.aantal ?? 0) || 0,
      eenheid: r.eenheid ?? 'm²',
      tarief: Number(r.prijs_verkoop ?? 0)
        || (Number(r.aantal ?? 0) > 0 ? Number(r.bedrag_verkoop ?? 0) / Number(r.aantal) : 0),
    })),
  };
  return {
    html: kop('Offerte', `${offerte.nummer} bewerken`,
      'Dit is nog een concept, dus je kunt alles aanpassen: regels, aantallen, prijzen, btw, de klant en de klus. Bewaren houdt hetzelfde offertenummer.')
      + '<div id="fr-offertebak"><p class="fr-onderkop">Laden...</p></div>',
    na: () => maakOfferte({
      motor, euro, schoon, meldRegel,
      naBewaren: (bewaard) => toon(`/offertes/${bewaard.id}`, true),
    }).toon(document.getElementById('fr-offertebak'), invoer),
  };
}

/* Een bewaarknop mag maar een keer afgaan.

   Gevonden op 02-09-2026: drie snelle klikken op Klant aanmaken leverden drie klanten op. Het
   scherm wachtte op de motor en tot dat antwoord er was bleef de knop gewoon klikbaar. Dat gold
   voor elk formulier dat bewaart; alleen de offerte had zijn eigen slot. Dit is dus geen los
   foutje maar een gat in het patroon, en daarom staat het slot hier een keer voor iedereen.

   Bij een fout gaat de knop weer open, want dan moet hij het opnieuw kunnen proberen. Lukt het
   wel, dan volgt er een scherm-wissel en is de knop toch weg. */
function eenmalig(knop, werk) {
  return async (...argumenten) => {
    if (!knop || knop.disabled) return undefined;
    knop.disabled = true;
    try {
      return await werk(...argumenten);
    } finally {
      /* Staat de knop er nog (geen scherm-wissel, of het ging mis), dan mag hij weer. */
      if (knop.isConnected) knop.disabled = false;
    }
  };
}

/* Welke klantgegevens er op een document horen te staan.

   De regel van Jelle (02-09-2026): een klant is een levende kaart, een verstuurd document is een
   gebeurtenis in het verleden.

   Zolang een offerte of factuur CONCEPT is, volgt hij de klantenkaart. Corrigeer je daar een
   adres, dan klopt het concept meteen mee en hoef je het niet op vijf plekken over te tikken.
   Zodra hij VERSTUURD of anderszins officieel is, staat er wat de motor bij die overgang heeft
   vastgelegd, en dat verandert niet meer.

   Draagt het document geen klant_id, dan is de ingetikte naam de enige waarheid. */
function klantOpDocument(doc, klanten) {
  const bevroren = {
    naam: doc.klant_naam ?? null, adres: doc.klant_adres ?? null,
    postcode: doc.klant_postcode ?? null, plaats: doc.klant_plaats ?? null,
  };
  if (doc.status !== 'concept' || !doc.customer_id) return { ...bevroren, live: false };
  const kaart = (klanten ?? []).find((k) => k.id === doc.customer_id);
  if (!kaart) return { ...bevroren, live: false };
  return { naam: kaart.naam, adres: kaart.adres, postcode: kaart.postcode, plaats: kaart.plaats, live: true };
}

/* Het regeltje onder de kop dat vertelt waar de gegevens vandaan komen. Zonder dat is het voor de
   gebruiker niet te zien of hij naar levende of naar vastgelegde gegevens kijkt, en juist dat
   verschil bepaalt of hij een adres nog kan corrigeren of een creditnota nodig heeft. */
function herkomstRegel(doc, klant) {
  if (klant.live) {
    return '<p class="fr-hint">Dit is nog een concept en volgt de klantenkaart. Corrigeer je daar het adres, dan staat het hier meteen goed. Zodra je hem verstuurt worden de klantgegevens vastgelegd zoals ze op dat moment zijn.</p>';
  }
  if (doc.status === 'concept') return '';
  const wanneer = doc.bevroren_op ? ` op ${datum(doc.bevroren_op)}` : (doc.verstuurd_op ? ` op ${datum(doc.verstuurd_op)}` : '');
  const briefhoofd = doc.afzender
    ? ' Ook je eigen bedrijfsgegevens en logo liggen vast zoals ze toen waren, dus een herdruk blijft hetzelfde vel.'
    : ' Let op: dit document is van voor de invoering van het vastleggen van je eigen bedrijfsgegevens, dus een herdruk krijgt je huidige briefhoofd. Het bewaarde vel in het archief is wat er destijds uitging.';
  return `<p class="fr-hint">De klantgegevens hieronder liggen vast${wanneer} en veranderen niet meer mee met de klantenkaart.${briefhoofd} Klopt er iets niet, herstel dat dan met een nieuw document en niet door dit stuk te wijzigen.</p>`;
}

/* De bewaarde vellen die bij een offerte of factuur horen.

   Belangrijk onderscheid, en het staat op het scherm ook zo. Wat je nu op PDF opslaat wordt vers
   getekend uit wat er nu in het portaal staat, met de bedrijfsgegevens en het logo zoals ze nu
   onder Mijn bedrijf staan. Wat er destijds de deur uit ging staat in het archief, en dat vel
   verandert nooit meer. Verhuis je of verander je je bedrijfsnaam, dan is het archief dus de
   plek waar de oude factuur nog met je oude briefhoofd staat.

   De klantgegevens liggen wel vast op het document zelf: die worden bij het aanmaken bevroren en
   veranderen niet mee als de klantenkaart later wijzigt. */
function bewaardeVellen(documenten, sleutel, waarde) {
  return (documenten ?? []).filter((d) => d[sleutel] === waarde);
}

function vellenBlok(vellen) {
  if (!vellen.length) {
    return `<div class="fr-blokkop"><h2>Bewaarde vellen</h2><span class="maatje">0</span></div>
      <div class="fr-rijen">${legeRij('Nog niets bewaard. Elke keer dat je hier een PDF opslaat komt dat vel in je archief te staan, precies zoals het eruitzag.')}</div>`;
  }
  return `<div class="fr-blokkop"><h2>Bewaarde vellen</h2><span class="maatje">${vellen.length}</span></div>
    <div class="fr-rijen">${vellen.map((d) => `<div class="fr-rij">
      <span class="hoofd">${schoon(d.bestandsnaam ?? d.nummer)}</span>
      <span class="sub">bewaard ${datum(d.created_at)}</span>
      <span class="maatje">${Math.round((d.bytes ?? 0) / 1024)} kB</span>
      <span class="rechts">
        <button class="fr-knop klein tweede" data-actie="document-halen" data-id="${d.id}">Ophalen</button>
        <button class="fr-knop klein tweede" data-actie="document-weg" data-id="${d.id}">Weghalen</button>
      </span></div>`).join('')}</div>
    <p class="fr-hint">Dit zijn de vellen zoals ze bewaard zijn. Een verse PDF wordt opnieuw getekend met je huidige bedrijfsgegevens en logo; het vel hierboven verandert niet meer.</p>`;
}

/* De standen van een factuur, in de volgorde waarin hij ze doorloopt. Vrij te kiezen, om dezelfde
   reden als bij de offerte: een stand die per ongeluk verkeerd staat moet je kunnen rechtzetten. */
const FACTUURSTANDEN = ['concept', 'verstuurd', 'betaald', 'vervallen'];

/* De factuur zelf, met haar regels en de btw-uitsplitsing.

   Zonder dit scherm was een factuur alleen een rij in een lijst: je kon hem nergens openen, de
   regels niet nalezen en hem niet alsnog aan een klus hangen, terwijl de motor dat allemaal wel
   kan. Wat er op een factuur staat verandert niet meer, want dat is het punt van een factuur; wat
   je hier wel bijstelt is de stand, de klus en de notitie. */
async function schermFactuur(id) {
  const [{ factuur }, { projecten }, { documenten }, { klanten }] = await Promise.all([
    motor(`/facturen/${id}`), motor('/projecten'), motor('/documenten'), motor('/klanten'),
  ]);
  const vellen = bewaardeVellen(documenten, 'invoice_id', id);
  const klant = klantOpDocument(factuur, klanten);
  const regels = (factuur.portal_invoice_lines ?? []).slice().sort((a, b) => (a.volgorde ?? 0) - (b.volgorde ?? 0));
  const spec = factuur.btw_specificatie ?? [];
  const tariefWoord = (t) => (Number(t) === 0 ? 'verlegd' : `${t}%`);
  const waar = [klant.naam || 'zonder klant', factuur.omschrijving].filter(Boolean).join(' · ');
  const teLaat = factuur.status === 'verstuurd' && factuur.vervaldatum
    && new Date(factuur.vervaldatum) < new Date(new Date().toDateString());

  return {
    html: `<p class="fr-eyebrow">Factuur</p>
    <h1 class="fr-kop">${schoon(factuur.nummer)}</h1>
    <p class="fr-onderkop">${schoon(waar)} · ${datum(factuur.factuurdatum)}${factuur.vervaldatum ? ` · vervalt ${datum(factuur.vervaldatum)}` : ''}${teLaat ? ' · over de vervaldatum' : ''}</p>
    ${[klant.adres, [klant.postcode, klant.plaats].filter(Boolean).join(' ')].filter(Boolean).length
      ? `<p class="fr-onderkop">${schoon([klant.adres, [klant.postcode, klant.plaats].filter(Boolean).join(' ')].filter(Boolean).join(', '))}</p>` : ''}
    ${herkomstRegel(factuur, klant)}

    <div class="fr-veldrij" style="max-width:620px">
      <label class="fr-veldlabel">Stand
        <select class="fr-in" id="fa-stand">
          ${FACTUURSTANDEN.map((s) => `<option value="${s}" ${s === factuur.status ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
      </label>
      <label class="fr-veldlabel">Hoort bij klus
        <select class="fr-in" id="fa-klus">
          <option value="">geen klus</option>
          ${(projecten ?? []).map((p) => `<option value="${p.id}" ${p.id === factuur.project_id ? 'selected' : ''}>${schoon(p.naam)}</option>`).join('')}
        </select>
      </label>
    </div>

    <div class="fr-blokkop"><h2>De regels</h2><span class="maatje">${regels.length}</span></div>
    <div class="fr-rijen">${regels.map((r) => `<div class="fr-rij">
        <span class="hoofd">${schoon(r.omschrijving ?? 'Regel')}</span>
        <span class="sub">${schoon(r.soort ?? '')}</span>
        <span class="maatje">${r.aantal ?? ''} ${schoon(r.eenheid ?? '')} · btw ${tariefWoord(r.btw_tarief)}</span>
        <span class="rechts"><span class="maatje">${euro(r.bedrag ?? 0)}</span></span>
      </div>`).join('') || legeRij('Deze factuur draagt geen regels.')}</div>

    <div class="fr-blokkop"><h2>De som</h2></div>
    <div class="fr-calc-tot">
      <div class="regel tweekant"><span>Subtotaal ex btw</span><span>${euro(factuur.subtotaal)}</span></div>
      ${spec.map((r) => `<div class="regel tweekant"><span>${Number(r.tarief) === 0 ? 'Btw verlegd' : `Btw ${r.tarief}%`} over ${euro(r.grondslag)}</span><span>${euro(r.btw)}</span></div>`).join('')}
      <div class="som marge"><span>Totaal te betalen</span><b>${euro(factuur.totaal)}</b></div>
    </div>

    ${vellenBlok(vellen)}

    ${factuur.betaald_op ? `<p class="fr-hint">Betaald gemeld op ${datum(factuur.betaald_op)}.</p>` : ''}
    ${factuur.iban ? `<p class="fr-hint">Betalen naar ${schoon(factuur.iban)}, op naam van jouw bedrijf.</p>` : ''}

    <div class="fr-knoppenrij">
      <button class="fr-knop" data-actie="factuur-pdf" data-id="${factuur.id}">PDF opslaan</button>
      <button class="fr-knop tweede" data-actie="factuur-csv" data-id="${factuur.id}">CSV</button>
      ${factuur.quote_id ? `<a class="fr-knop tweede" href="${BASIS}/offertes/${factuur.quote_id}" data-route>Naar de offerte</a>` : ''}
      ${factuur.customer_id ? `<a class="fr-knop tweede" href="${BASIS}/klanten/${factuur.customer_id}" data-route>Naar de klant</a>` : ''}
      ${factuur.status === 'concept' ? `<button class="fr-knop tweede" data-actie="factuur-weg" data-id="${factuur.id}">Weghalen</button>` : ''}
      <a class="fr-knop tweede" href="${BASIS}/facturen" data-route>Terug</a>
    </div>
    <p class="fr-hint">Een verstuurde factuur blijft altijd staan; alleen een concept kan nog weg.</p>`,
    na: () => {
      document.getElementById('fa-stand').addEventListener('change', async (e) => {
        try {
          await motor(`/facturen/${factuur.id}`, { methode: 'PATCH', body: { status: e.target.value } });
          meldRegel(`Factuur op ${e.target.value} gezet.`);
          toon(`/facturen/${factuur.id}`, false);
        } catch (err) { meldRegel(err.message); }
      });
      document.getElementById('fa-klus').addEventListener('change', async (e) => {
        try {
          await motor(`/facturen/${factuur.id}`, { methode: 'PATCH', body: { project_id: e.target.value || null } });
          meldRegel(e.target.value ? 'Factuur aan de klus gehangen.' : 'Factuur uit de klus gehaald.');
        } catch (err) { meldRegel(err.message); }
      });
    },
  };
}

/* De vrije factuur: los van een offerte, met eigen regels en een btw-tarief per regel.
   Voor werk dat nooit in een offerte stond, meerwerk, of een klus met de eigen vloer van
   de klant. De motor rekent na en is de waarheid; de som hier volgt dezelfde regels
   (per regel op centen afronden, de btw per tarief). */
async function schermFactuurNieuw(zoek) {
  const [{ klanten }, { projecten }] = await Promise.all([motor('/klanten'), motor('/projecten')]);
  /* Komt hij vanuit een klus, dan staan die klus en zijn klant al goed: daar drukte hij op de knop. */
  const uitParams = new URLSearchParams(zoek);
  const uitKlus = uitParams.get('project');
  const uitKlant = uitParams.get('klant');
  const num = (v) => { const n = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };
  const centen = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
  const regels = [{ soort: 'werk', omschrijving: '', aantal: 1, eenheid: 'stuks', prijs: '', btw: '21' }];

  const html = kop('Factuur', 'Een vrije factuur.',
      'Los van een offerte: zet zelf de regels erop, met een btw-tarief per regel. De factuur krijgt gewoon een nummer uit jouw reeks.')
    + `<div class="fr-form fr-form-breed">
      <p class="fr-calc-pt">De klant</p>
      <div class="fr-veldrij">
        <label>Bestaande klant<select id="vf-klant"><option value="">nieuwe of losse klant</option>
          ${klanten.map((k) => `<option value="${k.id}">${schoon(k.naam)}</option>`).join('')}</select></label>
        <label>Naam<input id="vf-klant-naam"></label>
      </div>
      <div class="fr-veldrij">
        <label>Adres<input id="vf-klant-adres"></label>
        <label style="max-width:130px">Postcode<input id="vf-klant-postcode"></label>
        <label>Plaats<input id="vf-klant-plaats"></label>
      </div>
      <p class="fr-calc-pt">De factuur</p>
      <div class="fr-veldrij">
        <label>Soort<select id="vf-soort">
          <option value="werk" selected>Werk</option>
          <option value="materiaal">Materiaal</option>
          <option value="aanbetaling">Aanbetaling</option>
          <option value="rest">Restfactuur</option>
        </select></label>
        <label>Omschrijving<input id="vf-omschrijving" placeholder="Bijvoorbeeld: leggen eigen vloer woonkamer"></label>
        <label>Hoort bij klus<select id="vf-project"><option value="">geen klus</option>
          ${projecten.map((p) => `<option value="${p.id}" ${p.id === uitKlus ? 'selected' : ''}>${schoon(p.naam)}</option>`).join('')}</select></label>
      </div>
      <p class="fr-calc-pt">De regels</p>
      <div id="vf-regels"></div>
      <div class="fr-knoppenrij"><button class="fr-knop klein tweede" id="vf-erbij" type="button">Regel erbij</button></div>
      <p class="fr-calc-pt">De som</p>
      <div class="fr-calc-tot" id="vf-som"></div>
      <div class="fr-knoppenrij">
        <button class="fr-knop" id="vf-bewaar" type="button">Factuur maken</button>
        <a class="fr-knop tweede" href="${BASIS}/facturen" data-route>Terug</a>
      </div>
      <p class="fr-hint">De factuur begint als concept; versturen en betaald melden doe je onder Facturen. De vervaldatum volgt uit je betaaltermijn onder Mijn bedrijf.
        9% geldt alleen voor bepaalde arbeid aan woningen ouder dan twee jaar; btw verlegd is voor onderaanneming, zet dan het btw-nummer van je opdrachtgever in de omschrijving.</p>
      <p class="fr-formfout" id="vf-fout"></p>
    </div>`;

  return {
    html,
    na: () => {
      const $ = (id) => document.getElementById(id);
      koppelAdresvelden(document, { adres: 'vf-klant-adres', postcode: 'vf-klant-postcode', plaats: 'vf-klant-plaats' });
      const som = () => {
        const perTarief = new Map();
        let sub = 0;
        regels.forEach((r) => {
          const bedrag = centen(num(r.aantal) * num(r.prijs));
          const tarief = String(r.btw).trim() === '' ? 21 : num(r.btw);
          sub += bedrag;
          perTarief.set(tarief, (perTarief.get(tarief) || 0) + bedrag);
        });
        sub = centen(sub);
        let btwTotaal = 0;
        const uitsplitsing = [...perTarief.entries()].sort((a, b) => a[0] - b[0]).map(([tarief, grondslag]) => {
          const btw = centen(grondslag * tarief / 100);
          btwTotaal += btw;
          const label = tarief === 0 ? `Btw verlegd over ${euro(grondslag)}` : `Btw ${tarief}% over ${euro(grondslag)}`;
          return `<div class="regel stil">${label}<span style="float:right">${euro(btw)}</span></div>`;
        }).join('');
        btwTotaal = centen(btwTotaal);
        $('vf-som').innerHTML = `<div class="som"><span>Subtotaal ex btw</span><b>${euro(sub)}</b></div>`
          + uitsplitsing
          + `<div class="som marge"><span>Totaal te betalen</span><b>${euro(centen(sub + btwTotaal))}</b></div>`;
      };
      const teken = () => {
        $('vf-regels').innerHTML = regels.map((r, i) => `
          <div class="fr-veldrij fr-werkregel" data-i="${i}">
            <label style="max-width:130px">Soort<select data-r="soort">
              <option value="werk" ${r.soort === 'werk' ? 'selected' : ''}>werk</option>
              <option value="materiaal" ${r.soort === 'materiaal' ? 'selected' : ''}>materiaal</option>
              <option value="meerwerk" ${r.soort === 'meerwerk' ? 'selected' : ''}>meerwerk</option>
            </select></label>
            <label>Omschrijving<input data-r="omschrijving" value="${schoon(r.omschrijving)}"></label>
            <label style="max-width:90px">Aantal<input data-r="aantal" inputmode="decimal" value="${schoon(r.aantal)}"></label>
            <label style="max-width:110px">Eenheid<input data-r="eenheid" value="${schoon(r.eenheid)}"></label>
            <label style="max-width:120px">Prijs p/st<input data-r="prijs" inputmode="decimal" value="${schoon(r.prijs)}"></label>
            <label style="max-width:150px">Btw<select data-r="btw">
              <option value="21" ${String(r.btw) === '21' ? 'selected' : ''}>21% standaard</option>
              <option value="9" ${String(r.btw) === '9' ? 'selected' : ''}>9% verlaagd</option>
              <option value="0" ${String(r.btw) === '0' ? 'selected' : ''}>0% verlegd</option>
            </select></label>
            <button class="fr-knop klein tweede" data-r-weg="${i}" type="button">Weg</button>
          </div>`).join('');
        som();
      };
      teken();
      $('vf-klant').addEventListener('change', () => {
        const gekozen = klanten.find((x) => x.id === $('vf-klant').value);
        if (!gekozen) return;
        $('vf-klant-naam').value = gekozen.naam || '';
        $('vf-klant-adres').value = gekozen.adres || '';
        $('vf-klant-postcode').value = gekozen.postcode || '';
        $('vf-klant-plaats').value = gekozen.plaats || '';
      });
      /* Kwam hij uit een klus met een klant, dan staat die er meteen ingevuld. */
      if (uitKlant && klanten.some((k) => k.id === uitKlant)) {
        $('vf-klant').value = uitKlant;
        $('vf-klant').dispatchEvent(new Event('change'));
      }
      $('vf-erbij').addEventListener('click', () => {
        regels.push({ soort: 'werk', omschrijving: '', aantal: 1, eenheid: 'stuks', prijs: '', btw: '21' });
        teken();
      });
      $('vf-regels').addEventListener('input', (e) => {
        const rij = e.target.closest('.fr-werkregel');
        if (rij && e.target.dataset.r) { regels[Number(rij.dataset.i)][e.target.dataset.r] = e.target.value; som(); }
      });
      $('vf-regels').addEventListener('change', (e) => {
        const rij = e.target.closest('.fr-werkregel');
        if (rij && e.target.dataset.r) { regels[Number(rij.dataset.i)][e.target.dataset.r] = e.target.value; som(); }
      });
      $('vf-regels').addEventListener('click', (e) => {
        if (e.target.dataset.rWeg === undefined) return;
        regels.splice(Number(e.target.dataset.rWeg), 1);
        teken();
      });
      $('vf-bewaar').addEventListener('click', async () => {
        const foutvak = $('vf-fout');
        foutvak.textContent = '';
        const bruikbaar = regels.filter((r) => String(r.omschrijving || '').trim() && num(r.aantal) * num(r.prijs) !== 0);
        if (!bruikbaar.length) { foutvak.textContent = 'Zet eerst een regel met omschrijving en bedrag op de factuur.'; return; }
        const knop = $('vf-bewaar');
        knop.disabled = true;
        try {
          await motor('/facturen', {
            methode: 'POST',
            body: {
              klant_id: $('vf-klant').value || null,
              klant_naam: $('vf-klant-naam').value || null,
              klant_adres: $('vf-klant-adres').value || null,
              klant_postcode: $('vf-klant-postcode').value || null,
              klant_plaats: $('vf-klant-plaats').value || null,
              project_id: $('vf-project').value || null,
              soort: $('vf-soort').value,
              omschrijving: $('vf-omschrijving').value || null,
              regels: bruikbaar.map((r) => ({
                soort: r.soort,
                omschrijving: r.omschrijving,
                aantal: num(r.aantal),
                eenheid: r.eenheid || null,
                prijs: num(r.prijs),
                ...(String(r.btw).trim() === '' ? {} : { btw_tarief: num(r.btw) }),
              })),
            },
          });
          meldRegel('Factuur gemaakt.');
          toon('/facturen', true);
        } catch (e) {
          foutvak.textContent = e.message;
          knop.disabled = false;
        }
      });
    },
  };
}

/* ---------- klanten ---------- */

async function schermKlanten() {
  const [{ klanten }, { projecten }, { offertes }] = await Promise.all([
    motor('/klanten'), motor('/projecten'), motor('/offertes'),
  ]);
  return kop('Klanten', 'Jouw klanten, aan jouw klussen geknoopt.',
      'Een klant hangt op nummer aan zijn klussen en offertes, dus hernoemen kan altijd.')
    + `<div class="fr-blokkop"><h2>Alle klanten</h2><span class="maatje">${klanten.length}</span>
        <span class="rechts"><a class="fr-knop klein" href="${BASIS}/klanten/nieuw" data-route>Nieuwe klant</a></span></div>
      <div class="fr-rijen">${klanten.map((k) => {
        /* Zijn klussen staan als knoppen in de rij: van de klant naar zijn klus is dezelfde doos,
           andere ingang, en dat is de weg die een legger in het echt neemt. */
        const klussen = (projecten ?? []).filter((p) => p.customer_id === k.id);
        const eigenOffertes = (offertes ?? []).filter((o) => o.customer_id === k.id);
        const contact = [k.telefoon, k.email].filter(Boolean).join(' · ');
        return `<div class="fr-rij">
          <span class="hoofd">${schoon(k.naam)}</span>
          <span class="sub">${schoon([k.contact, [k.postcode, k.plaats].filter(Boolean).join(' ')].filter(Boolean).join(' · '))}</span>
          <span class="maatje">${schoon(contact)}</span>
          <span class="sub">${klussen.length
            ? klussen.map((p) => `<a href="${BASIS}/projecten/${p.id}" data-route>${schoon(p.naam)}</a>`).join(', ')
            : 'geen klus'}${eigenOffertes.length ? ` · ${eigenOffertes.length} offerte${eigenOffertes.length === 1 ? '' : 's'}` : ''}</span>
          <span class="rechts"><a class="fr-knop klein tweede" href="${BASIS}/klanten/${k.id}" data-route>Openen</a></span>
        </div>`;
      }).join('') || legeRij('Nog geen klanten. Bewaren hoeft niet: je kunt klantgegevens ook los op een offerte invullen. Maar bij een tweede klus voor dezelfde klant kies je hem uit de lijst in plaats van alles opnieuw te typen.')}</div>`;
}

/* Een nieuwe klant: een echt formulier, want de kaart is de kapstok voor alles daarna. */
function schermKlantNieuw() {
  return {
    html: kop('Klanten', 'Nieuwe klant',
      'Alleen de naam is verplicht; de rest vul je aan wanneer je het weet, bijvoorbeeld bij het inmeten.')
      + `<form id="kl-form" class="fr-form fr-form-breed">
        <div class="fr-veldrij">
          <label>Naam<input name="naam" required placeholder="M. Peeters"></label>
          <label>Contactpersoon<input name="contact"></label>
        </div>
        <div class="fr-veldrij">
          <label>E-mail<input name="email" type="email"></label>
          <label>Telefoon<input name="telefoon"></label>
        </div>
        <div class="fr-veldrij">
          <label>Adres<input name="adres"></label>
          <label style="max-width:130px">Postcode<input name="postcode"></label>
          <label>Plaats<input name="plaats"></label>
        </div>
        <label>Notitie<textarea name="notitie" rows="2"></textarea></label>
        <div class="fr-knoppenrij">
          <button class="fr-knop" type="submit">Klant aanmaken</button>
          <a class="fr-knop tweede" href="${BASIS}/klanten" data-route>Terug</a>
        </div>
        <p class="fr-formfout" id="kl-fout"></p>
      </form>`,
    na: () => {
      const form = document.getElementById('kl-form');
      koppelAdresvelden(form, { adres: 'adres', postcode: 'postcode', plaats: 'plaats' });
      form.addEventListener('submit', eenmalig(form.querySelector('button[type=submit]'), async (e) => {
        e.preventDefault();
        try {
          const { klant } = await motor('/klanten', {
            methode: 'POST',
            body: {
              naam: form.naam.value,
              contact: form.contact.value || null,
              email: form.email.value || null,
              telefoon: form.telefoon.value || null,
              adres: form.adres.value || null,
              postcode: form.postcode.value || null,
              plaats: form.plaats.value || null,
              notitie: form.notitie.value || null,
            },
          });
          meldRegel('Klant aangemaakt.');
          toon(`/klanten/${klant.id}`, true);
        } catch (err) { document.getElementById('kl-fout').textContent = err.message; }
      }));
    },
  };
}

/* Het klantendetail: zijn kaart om bij te werken, met daaronder het koppelweb, alles wat
   op nummer aan deze klant hangt. Weghalen laat dat allemaal staan; alleen de kaart verdwijnt. */
async function schermKlant(id) {
  const { klant, projecten, inmetingen, offertes, facturen } = await motor(`/klanten/${id}`);
  const veld = (naam, label, type = 'text') =>
    `<label>${label}<input name="${naam}" type="${type}" value="${schoon(klant[naam] ?? '')}"></label>`;
  return {
    html: `<p class="fr-eyebrow">Klant</p>
      <h1 class="fr-kop">${schoon(klant.naam)}</h1>
      <form id="kl-form" class="fr-form fr-form-breed">
        <div class="fr-veldrij">${veld('naam', 'Naam')}${veld('contact', 'Contactpersoon')}</div>
        <div class="fr-veldrij">${veld('email', 'E-mail', 'email')}${veld('telefoon', 'Telefoon')}</div>
        <div class="fr-veldrij">${veld('adres', 'Adres')}
          <label style="max-width:130px">Postcode<input name="postcode" value="${schoon(klant.postcode ?? '')}"></label>
          ${veld('plaats', 'Plaats')}</div>
        <label>Notitie<textarea name="notitie" rows="2">${schoon(klant.notitie ?? '')}</textarea></label>
        <div class="fr-knoppenrij">
          <button class="fr-knop" type="submit">Bewaren</button>
          <button class="fr-knop tweede" type="button" data-actie="klant-weg" data-id="${klant.id}">Klant weghalen</button>
          <a class="fr-knop tweede" href="${BASIS}/klanten" data-route>Terug</a>
        </div>
        <p class="fr-formfout" id="kl-fout"></p>
      </form>
      <div class="fr-blokkop"><h2>Klussen van deze klant</h2><span class="maatje">${projecten.length}</span>
        <span class="rechts"><a class="fr-knop klein" href="${BASIS}/projecten/nieuw?klant=${klant.id}" data-route>Nieuwe klus</a></span></div>
      <div class="fr-rijen">${projecten.map((x) => rijProject(x, klant.naam)).join('') || legeRij('Nog geen klus aan deze klant gekoppeld.')}</div>
      <div class="fr-blokkop"><h2>Inmetingen</h2><span class="maatje">${inmetingen.length}</span></div>
      <div class="fr-rijen">${inmetingen.map((x) => rijInmeting(x)).join('') || legeRij('Nog geen inmeting bij deze klant.')}</div>
      <div class="fr-blokkop"><h2>Offertes</h2><span class="maatje">${offertes.length}</span></div>
      <div class="fr-rijen">${offertes.map(rijOfferte).join('') || legeRij('Nog geen offerte voor deze klant.')}</div>
      <div class="fr-blokkop"><h2>Facturen</h2><span class="maatje">${facturen.length}</span></div>
      <div class="fr-rijen">${facturen.map((f) => `<div class="fr-rij">
          <span class="hoofd">${schoon(f.nummer)}</span>
          <span class="sub">${schoon(f.omschrijving || '')}</span>
          <span class="maatje">${euro(f.totaal)}${f.vervaldatum ? ' · vervalt ' + datum(f.vervaldatum) : ''}</span>
          <span class="rechts">${stand(f.status)}
            <button class="fr-knop klein tweede" data-actie="factuur-pdf" data-id="${f.id}">PDF</button></span>
        </div>`).join('') || legeRij('Nog geen factuur voor deze klant.')}</div>`,
    na: () => {
      const form = document.getElementById('kl-form');
      koppelAdresvelden(form, { adres: 'adres', postcode: 'postcode', plaats: 'plaats' });
      form.addEventListener('submit', eenmalig(form.querySelector('button[type=submit]'), async (e) => {
        e.preventDefault();
        try {
          await motor(`/klanten/${id}`, {
            methode: 'PATCH',
            body: {
              naam: form.naam.value,
              contact: form.contact.value || null,
              email: form.email.value || null,
              telefoon: form.telefoon.value || null,
              adres: form.adres.value || null,
              postcode: form.postcode.value || null,
              plaats: form.plaats.value || null,
              notitie: form.notitie.value || null,
            },
          });
          meldRegel('Klant bewaard.');
        } catch (err) { document.getElementById('kl-fout').textContent = err.message; }
      }));
    },
  };
}

/* ---------- bestellingen ---------- */

/* Bestellingen. De adapter naar Oaklyn bestaat nog niet, en dit scherm doet niet alsof.

   Wat er wel hoort te staan is waar je aan toe bent: welke offertes erop wachten, wat er straks
   meegaat, en waarom het nog niet kan. Een lege pagina met alleen "nog geen bestellingen" laat je
   raden of je iets fout doet. */
async function schermBestellingen() {
  const [{ bestellingen }, { offertes }, mij] = await Promise.all([
    motor('/bestellingen'), motor('/offertes'), motor('/mij'),
  ]);
  const wachtend = (offertes ?? []).filter((o) => o.status === 'gewonnen');
  const gekoppeld = !!mij.partner.shopify_customer_id;

  return kop('Bestellingen', 'Bestellen wordt een knop.',
      'De materiaallijst van een gewonnen offerte gaat straks als bestelling naar de groothandel; voor vloeren loopt dat via Oaklyn.')
    + `<div class="fr-blokkop"><h2>Alle bestellingen</h2><span class="maatje">${bestellingen.length}</span></div>
      <div class="fr-rijen">${bestellingen.map((b) => `<div class="fr-rij">
          <span class="hoofd">${schoon(b.nummer || b.shopify_order_name || 'Bestelling')}</span>
          <span class="sub">${datum(b.created_at)}</span>
          <span class="rechts">${stand(b.status)}</span>
        </div>`).join('') || legeRij('Nog geen bestellingen. Dat klopt: bestellen kan nog niet, zie hieronder.')}</div>

      <div class="fr-blokkop"><h2>Klaar om te bestellen</h2><span class="maatje">${wachtend.length}</span></div>
      <div class="fr-rijen">${wachtend.map((o) => rijOfferte(o)).join('')
        || legeRij('Geen gewonnen offertes. Zet een offerte op gewonnen zodra de klant akkoord is; hij komt dan hier te staan.')}</div>

      <div class="fr-blokkop"><h2>Wat er nog moet gebeuren</h2></div>
      <div class="fr-rijen">
        <div class="fr-rij"><span class="hoofd">Je account aan de groothandel koppelen</span>
          <span class="sub">Zonder die koppeling weet de winkel niet wie er bestelt en welke prijs voor jou geldt.</span>
          <span class="rechts">${stand(gekoppeld ? 'gewonnen' : 'concept')}</span></div>
        <div class="fr-rij"><span class="hoofd">Het prijsmodel vaststellen</span>
          <span class="sub">Wat jij betaalt moet gelijk zijn aan wat de kassa rekent, anders offreer je op een bedrag dat je niet betaalt.</span>
          <span class="rechts">${stand('concept')}</span></div>
        <div class="fr-rij"><span class="hoofd">De besteladapter bouwen</span>
          <span class="sub">De stap die de materiaallijst als order wegzet en de status terugmeldt.</span>
          <span class="rechts">${stand('concept')}</span></div>
      </div>

      <div class="fr-blokkop"><h2>Wat er straks meegaat</h2></div>
      <p class="fr-hint">Uit een gewonnen offerte: de materiaalregels met hun aantallen, jouw partnerprijs, de klant
        en de klus waar het bij hoort, en het afleveradres. Je eigen werkregels gaan niet mee, want die bestel je
        nergens. Wat je zelf ergens anders koopt gaat ook niet mee.</p>
      <p class="fr-hint">Tot die tijd bestel je zoals je nu bestelt. Je offerte, je calculatie en je facturen werken
        gewoon; alleen de laatste stap naar de groothandel doe je nog buiten Framr.one om.</p>`;
}

/* ---------- mijn bedrijf ---------- */

async function schermBedrijf() {
  const { partner, werkregels } = await motor('/mij');
  zetModules(partner.modules);
  tekenTabs('/bedrijf');
  const veld = (naam, label, type = 'text') =>
    `<label>${label}<input name="${naam}" type="${type}" value="${schoon(partner[naam] ?? '')}"></label>`;
  return kop('Mijn bedrijf', 'Wat er op je offerte en factuur staat.',
      'Deze gegevens komen op elk document dat je maakt. De IBAN staat op de factuur.')
    + `<div class="fr-blokkop"><h2>Wat gebruik je</h2></div>
      <p class="fr-hint">Alles staat aan; zet uit wat je niet gebruikt. Uitzetten verbergt en gooit
        niets weg: het tabblad verdwijnt en verder niets, en wat je gemaakt hebt komt terug zodra je
        het weer aanzet.</p>
      <div class="fr-schakels" id="fr-modules">
        ${MODULES.map((m) => `<button type="button" class="fr-schakel${moduleAan(m.id) ? ' aan' : ''}" data-module="${m.id}">
            <span class="k">${m.titel}<span class="stand">${moduleAan(m.id) ? 'aan' : 'uit'}</span></span>
            <span class="o">${m.uitleg}</span>
          </button>`).join('')}
      </div>

      <form id="fr-bedrijfform" class="fr-form fr-form-breed">
      <div class="fr-veldrij">${veld('bedrijfsnaam', 'Bedrijfsnaam')}${veld('kvk', 'KvK')}${veld('btw_nummer', 'Btw-nummer')}</div>
      <div class="fr-veldrij">${veld('adres', 'Adres')}${veld('postcode', 'Postcode')}${veld('plaats', 'Plaats')}</div>
      <div class="fr-veldrij">${veld('email', 'E-mail', 'email')}${veld('telefoon', 'Telefoon')}${veld('iban', 'IBAN')}</div>
      <div class="fr-veldrij">${veld('quote_prefix', 'Offertevoorvoegsel')}${veld('factuur_prefix', 'Factuurvoorvoegsel')}${veld('betaaltermijn', 'Betaaltermijn (dagen)')}</div>
      <div class="fr-veldrij">${veld('quote_counter', 'Volgend offertenummer')}${veld('factuur_counter', 'Volgend factuurnummer')}</div>
      <p class="fr-hint">Zo sluit je reeks aan op wat je al had. Het nummer wordt bijvoorbeeld ${schoon(partner.quote_prefix || 'OFF')}-${new Date().getFullYear()}-${String(partner.quote_counter ?? 1).padStart(3, '0')}.</p>
      <div class="fr-logoveld">
        <div class="fr-logovak" id="fr-logovak">${partner.logo_data ? `<img src="${schoon(partner.logo_data)}" alt="">` : '<span>nog geen logo</span>'}</div>
        <div>
          <label class="fr-logoknop">Logo (PNG of JPG)<input type="file" id="fr-logo" accept="image/*"></label>
          <button class="fr-knop klein tweede" type="button" id="fr-logo-weg" ${partner.logo_data ? '' : 'hidden'}>Logo weghalen</button>
          <p class="fr-hint">Het logo wordt verkleind bij je account bewaard en staat bovenaan elke offerte en factuur, ook als je die op je telefoon maakt.</p>
        </div>
      </div>
      <div class="fr-knoppenrij"><button class="fr-knop" type="submit">Bewaren</button></div>
      <p class="fr-formfout" id="fr-bedrijffout"></p>
    </form>
    <div class="fr-blokkop"><h2>Vaste werkregels</h2><span class="maatje">${werkregels.length}</span></div>
    <div class="fr-rijen">${werkregels.map((w) => `<div class="fr-rij">
        <span class="hoofd">${schoon(w.naam)}</span>
        <span class="maatje">${euro(w.tarief)} per ${schoon(w.eenheid || 'stuk')}</span>
      </div>`).join('') || legeRij('Nog geen vaste werkregels. Die komen mee met de offerte-stap.')}</div>
    <div class="fr-knoppenrij" style="margin-top:26px">
      <button class="fr-knop tweede klein" data-actie="uitloggen">Uitloggen (${schoon(sessie()?.email ?? '')})</button>
    </div>`;
}


/* Zijn logo hoort bij zijn account en niet bij dit apparaat: het gaat verkleind naar boven,
   want een foto uit een telefoon is zo een paar megabyte en dat past niet in een tabelrij.
   480 pixels breed is ruim genoeg voor bovenaan een offerte. */
function verkleinLogo(bestand) {
  return new Promise((klaar, mis) => {
    const lezer = new FileReader();
    lezer.onload = () => {
      const beeld = new Image();
      beeld.onload = () => {
        const breedte = Math.min(480, beeld.width);
        const hoogte = Math.round(beeld.height * (breedte / beeld.width));
        const doek = document.createElement('canvas');
        doek.width = breedte;
        doek.height = hoogte;
        doek.getContext('2d').drawImage(beeld, 0, 0, breedte, hoogte);
        klaar(doek.toDataURL('image/png'));
      };
      beeld.onerror = () => mis(new Error('Dit bestand is geen bruikbare afbeelding.'));
      beeld.src = lezer.result;
    };
    lezer.onerror = () => mis(new Error('Dit bestand is niet te lezen.'));
    lezer.readAsDataURL(bestand);
  });
}

/* ---------- de PDF's ----------

   Het klantvel van een offerte en de factuur als echt bestand, met de bouwer uit pdf.js.
   In het bestand staat nooit inkoop of marge: de opbouw hieronder geeft de bouwer alleen
   het klantvel door. Het bestand gaat na het downloaden ook het archief in, zodat over
   een jaar terug te vinden is wat er precies de deur uit ging. */

async function archiveerPdf(gegevens, bytes, naam) {
  try {
    await motor('/documenten', {
      methode: 'POST',
      body: { ...gegevens, bestandsnaam: naam, mediatype: 'application/pdf', inhoud: PDF.naarBase64(bytes) },
    });
  } catch { /* het archief is nazorg; de download zelf is al gelukt */ }
}

/* De afzender die op een document hoort.

   Zelfde regel als bij de klant (besluit Jelle 02-09-2026): zolang het een concept is volgt het
   briefhoofd Mijn bedrijf, zodat een correctie daar meteen goed staat. Zodra het document
   officieel is geworden staat er wat de motor bij die overgang heeft vastgelegd in de kolom
   afzender (migration 0089), inclusief het logo. Zo kan de database de historische staat zelf
   reconstrueren en hoeft dat niet uit het bewaarde bestand te komen.

   Documenten van voor die migration hebben geen afzender; die vallen terug op de levende
   gegevens, want een betere bron is er voor hen niet. */
function afzenderVan(doc, partner) {
  const vast = doc.afzender;
  if (!vast) return { ...partner, live: true };
  return { ...vast, live: false };
}

function partnerKopregels(partner) {
  return [
    [partner.adres, [partner.postcode, partner.plaats].filter(Boolean).join(' ')].filter(Boolean).join(', '),
    [partner.kvk ? 'KvK ' + partner.kvk : '', partner.btw_nummer || ''].filter(Boolean).join('   '),
    [partner.email, partner.telefoon].filter(Boolean).join('   '),
  ].filter(Boolean);
}

async function offertePdf(id) {
  const [{ offerte }, mij, { klanten }] = await Promise.all([
    motor(`/offertes/${id}`), motor('/mij'), motor('/klanten'),
  ]);
  /* Een concept volgt de levende kaarten, een verstuurde offerte staat vast. Zie klantOpDocument
     en afzenderVan. */
  const partner = afzenderVan(offerte, mij.partner);
  const klantVel = klantOpDocument(offerte, klanten);
  const regels = offerteRegels(offerte);
  const materiaal = regels.filter((r) => r.soort !== 'werk');
  const werk = regels.filter((r) => r.soort === 'werk');
  const beeld = await PDF.logo(partner.logo_data);
  const mat = offerteMateriaal(offerte);
  const matAdv = mat.advies;
  const matVerk = mat.verkoop;
  const voordeel = matAdv > matVerk + 0.005
    ? { advies: matAdv, prijs: matVerk, bespaard: matAdv - matVerk, pct: Math.round((1 - matVerk / matAdv) * 100) }
    : null;

  const rijen = [{ groep: 'Materiaal, geleverd op het werk' }];
  materiaal.forEach((r) => rijen.push({
    cellen: [r.omschrijving, voordeel ? euro(r.bedrag_advies ?? 0) : '', euro(r.bedrag_verkoop ?? 0)],
    sub: r.uitleg || (r.aantal ? `${r.aantal} ${r.eenheid || ''}`.trim() : ''),
  }));
  if (werk.length) {
    rijen.push({ groep: 'Werkzaamheden' });
    werk.forEach((r) => rijen.push({
      cellen: [r.omschrijving, '', euro(r.bedrag_verkoop ?? 0)],
      sub: r.aantal ? `${r.aantal} ${r.eenheid || ''} x ${euro(r.prijs_verkoop ?? 0)}` : '',
    }));
  }

  const totalen = [];
  if (werk.length) {
    totalen.push({ label: 'Materiaal', waarde: euro(matVerk) });
    totalen.push({ label: 'Werkzaamheden', waarde: euro(offerte.werk_totaal ?? 0) });
  }
  /* Het tarief staat sinds de btw-keuze in de bevroren berekening; oudere offertes
     hebben dat veld niet en daar wordt het uit de bedragen afgeleid. */
  const btwPct = (() => {
    const bewaard = offerte.berekening ? offerte.berekening.btw_tarief : undefined;
    if (bewaard !== undefined && bewaard !== null) return Number(bewaard);
    const sub = Number(offerte.subtotaal ?? 0);
    return sub > 0 ? Math.round((Number(offerte.btw_bedrag ?? 0) / sub) * 100) : 21;
  })();
  totalen.push({ label: 'Subtotaal exclusief btw', waarde: euro(offerte.subtotaal ?? 0) });
  totalen.push({ label: btwPct === 0 ? 'Btw verlegd' : `Btw ${btwPct} procent`, waarde: euro(offerte.btw_bedrag ?? 0) });
  totalen.push({ label: 'Totaal inclusief btw', waarde: euro(offerte.totaal ?? 0), dik: true, groot: true });

  const bytes = PDF.maak({
    titel: 'Offerte ' + offerte.nummer,
    elementen: [
      { soort: 'kop', bedrijfsnaam: partner.bedrijfsnaam || 'Jouw bedrijfsnaam', logo: beeld, rechts: partnerKopregels(partner) },
      { soort: 'titel', tekst: 'Offerte', rechts: offerte.nummer },
      { soort: 'kolommen', kolommen: [
        { kop: 'Voor', regels: [klantVel.naam || '', klantVel.adres || '', `${klantVel.postcode || ''} ${klantVel.plaats || ''}`.trim()] },
        { kop: 'Het werk', regels: [offerte.project || (offerte.berekening && offerte.berekening.vloer) || '-', [klantVel.adres, klantVel.plaats].filter(Boolean).join(', ')] },
        { kop: 'Gegevens', regels: ['Datum ' + datum(offerte.created_at), offerte.geldig_tot ? 'Geldig tot ' + datum(offerte.geldig_tot) : ''].concat(offerte.levertijd ? ['Levertijd ' + offerte.levertijd] : []) },
      ] },
      { soort: 'tabel', kolommen: [
        { titel: 'Omschrijving', deel: 3 },
        { titel: voordeel ? 'Adviesprijs' : '', deel: 1, rechts: true },
        { titel: 'Bedrag ex btw', deel: 1, rechts: true },
      ], rijen },
      voordeel ? { soort: 'kader', kop: 'Uw voordeel op het materiaal', vakken: [
        { label: 'Normale adviesprijs', waarde: euro(voordeel.advies) },
        { label: 'Uw prijs via ons', waarde: euro(voordeel.prijs) },
        { label: `U bespaart (${voordeel.pct} procent)`, waarde: euro(voordeel.bespaard), groot: true },
      ] } : null,
      { soort: 'totalen', regels: totalen },
      { soort: 'bijeen', elementen: [
        { soort: 'tekst', klein: true, tekst: 'Alle bedragen zijn exclusief btw tenzij anders vermeld.'
          + (btwPct === 0 ? ' De btw is verlegd naar de afnemer.' : '')
          + (offerte.geldig_tot ? ' Deze offerte is geldig tot ' + datum(offerte.geldig_tot) + '.' : '')
          + ' Levering in overleg. Op deze offerte zijn de algemene voorwaarden van '
          + (partner.bedrijfsnaam || 'de opdrachtnemer') + ' van toepassing.' },
        { soort: 'ondertekening', links: 'Voor akkoord, opdrachtgever', rechts: 'Datum' },
      ] },
    ].filter(Boolean),
  });
  const naam = PDF.bestandsnaam(['offerte', offerte.nummer, klantVel.naam]);
  PDF.download(bytes, naam);
  await archiveerPdf({
    soort: 'offerte', nummer: offerte.nummer, quote_id: offerte.id, project_id: offerte.project_id || null,
    gemaakt_uit: { totaal: offerte.totaal, status: offerte.status },
  }, bytes, naam);
  meldRegel('PDF opgeslagen en in het archief gezet.');
}

async function factuurPdf(id) {
  const [{ facturen }, mij, { klanten }] = await Promise.all([
    motor('/facturen'), motor('/mij'), motor('/klanten'),
  ]);
  const f = (facturen ?? []).find((x) => x.id === id);
  if (!f) throw new Error('Deze factuur is niet gevonden.');
  /* Zolang de factuur concept is volgt hij de levende kaarten; daarna staat vast wat er vaststaat. */
  const partner = afzenderVan(f, mij.partner);
  const klantVel = klantOpDocument(f, klanten);
  const regels = (f.portal_invoice_lines ?? []).slice().sort((a, b) => (a.volgorde ?? 0) - (b.volgorde ?? 0));
  const spec = Array.isArray(f.btw_specificatie) ? f.btw_specificatie : [];
  const beeld = await PDF.logo(partner.logo_data);
  const totalen = [{ label: 'Subtotaal exclusief btw', waarde: euro(f.subtotaal ?? 0) }];
  spec.forEach((s) => totalen.push({
    label: Number(s.tarief) === 0
      ? `Btw verlegd over ${euro(s.grondslag ?? 0)}`
      : `Btw ${Number(s.tarief)} procent over ${euro(s.grondslag ?? 0)}`,
    waarde: euro(s.btw ?? 0),
  }));
  totalen.push({ label: 'Totaal te betalen', waarde: euro(f.totaal ?? 0), dik: true, groot: true });
  const verlegd = spec.some((s) => Number(s.tarief) === 0);

  const bytes = PDF.maak({
    titel: 'Factuur ' + f.nummer,
    elementen: [
      { soort: 'kop', bedrijfsnaam: partner.bedrijfsnaam || 'Jouw bedrijfsnaam', logo: beeld, rechts: partnerKopregels(partner) },
      { soort: 'titel', tekst: 'Factuur', rechts: f.nummer },
      { soort: 'kolommen', kolommen: [
        { kop: 'Aan', regels: [klantVel.naam || '', klantVel.adres || '', `${klantVel.postcode || ''} ${klantVel.plaats || ''}`.trim()] },
        { kop: 'Het werk', regels: [f.omschrijving || '-', f.soort === 'werk' ? 'Werkzaamheden' : 'Materiaal'] },
        { kop: 'Gegevens', regels: ['Datum ' + datum(f.factuurdatum), 'Vervalt ' + datum(f.vervaldatum)] },
      ] },
      { soort: 'tabel', kolommen: [
        { titel: 'Omschrijving', deel: 3 },
        { titel: 'Btw', deel: 1, rechts: true },
        { titel: 'Bedrag ex btw', deel: 1, rechts: true },
      ], rijen: regels.map((r) => ({
        cellen: [r.omschrijving, Number(r.btw_tarief ?? 21) === 0 ? 'verlegd' : `${Number(r.btw_tarief ?? 21)}%`, euro(r.bedrag ?? 0)],
        sub: (r.aantal !== null && r.aantal !== undefined && r.eenheid && r.eenheid !== 'vast')
          ? `${Number(r.aantal)} ${r.eenheid} x ${euro(r.prijs ?? 0)}` : '',
      })) },
      { soort: 'totalen', regels: totalen },
      { soort: 'bijeen', elementen: [
        { soort: 'tekst', tekst: `Wij verzoeken u het bedrag van ${euro(f.totaal ?? 0)} voor ${datum(f.vervaldatum)} over te maken op ${f.iban || partner.iban || 'ons rekeningnummer'} onder vermelding van ${f.betaalkenmerk || f.nummer}.` },
        { soort: 'tekst', klein: true, tekst: 'Alle bedragen zijn exclusief btw tenzij anders vermeld.'
          + (verlegd ? ' Btw verlegd: de btw over de regels met verlegd is verlegd naar de afnemer.' : '') },
      ] },
    ],
  });
  const naam = PDF.bestandsnaam(['factuur', f.nummer, klantVel.naam]);
  PDF.download(bytes, naam);
  await archiveerPdf({
    soort: 'factuur', nummer: f.nummer, invoice_id: f.id, project_id: f.project_id || null,
    gemaakt_uit: { totaal: f.totaal, status: f.status, factuurdatum: f.factuurdatum },
  }, bytes, naam);
  meldRegel('PDF opgeslagen en in het archief gezet.');
}

/* ---------- acties ---------- */

async function actie(knop) {
  const wat = knop.dataset.actie;
  const id = knop.dataset.id;
  try {
    if (wat === 'uitloggen') { uitloggen(); return; }
    if (wat === 'project-weg') {
      if (!confirm('Deze klus weghalen? De inmetingen en offertes blijven bestaan.')) return;
      await motor(`/projecten/${id}`, { methode: 'DELETE' });
      meldRegel('Klus weggehaald.');
      toon('/projecten', true);
      return;
    }
    /* Uit de klus halen, niet weggooien: de inmeting blijft bestaan en staat daarna los onder
       Inmeten. Weghalen kan alleen daar, waar de inmeting zelf woont. */
    if (wat === 'inmeting-los') {
      await motor(`/inmetingen/${id}`, { methode: 'PATCH', body: { project_id: null } });
      meldRegel('Inmeting uit deze klus gehaald; hij staat nu los onder Inmeten.');
      toon(huidigeRoute(), false);
      return;
    }
    if (wat === 'inmeting-weg') {
      if (!confirm('Deze inmeting definitief weghalen, met haar ruimtes?')) return;
      await motor(`/inmetingen/${id}`, { methode: 'DELETE' });
      meldRegel('Inmeting weggehaald.');
      toon(huidigeRoute(), false);
      return;
    }
    if (wat === 'berekening-weg') {
      if (!confirm('Deze berekening weghalen?')) return;
      await motor(`/berekeningen/${id}`, { methode: 'DELETE' });
      toon('/calculaties', true);
      return;
    }
    if (wat === 'offerte-status') {
      await motor(`/offertes/${id}`, { methode: 'PATCH', body: { status: knop.dataset.status } });
      meldRegel(`Offerte op ${knop.dataset.status} gezet.`);
      toon(`/offertes/${id}`, false);
      return;
    }
    /* Kopieren maakt een echte nieuwe offerte met dezelfde regels: hetzelfde werk voor een andere
       klant of een tweede variant naast de eerste. Hij krijgt een vers nummer uit de eigen reeks en
       niet het oude met -kopie erachter, want twee vellen met bijna hetzelfde nummer is precies wat
       je bij de klant niet wilt uitleggen. */
    if (wat === 'offerte-kopie') {
      const { offerte } = await motor(`/offertes/${id}`);
      const regels = offerteRegels(offerte);
      const kopie = { ...offerte, status: 'concept' };
      ['id', 'nummer', 'created_at', 'updated_at', 'verstuurd_op', 'beslist_op', 'portal_quote_lines', 'partner_id', 'company_id']
        .forEach((veld) => delete kopie[veld]);
      kopie.klant_id = offerte.customer_id ?? null;
      kopie.regels = regels.map((r) => { const k = { ...r }; delete k.id; delete k.quote_id; delete k.uitBerekening; return k; });
      /* Een kopie van een oude offerte krijgt de bedragen die uit de berekening komen, zodat de
         nieuwe wel gewone regels heeft en verder overal normaal meedoet. */
      const matKopie = offerteMateriaal(offerte);
      kopie.materiaal_advies = matKopie.advies;
      kopie.materiaal_verkoop = matKopie.verkoop;
      kopie.materiaal_inkoop = matKopie.inkoop;
      const nieuw = await motor('/offertes', { methode: 'POST', body: kopie });
      meldRegel(`Gekopieerd naar ${nieuw.offerte.nummer}.`);
      toon(`/offertes/${nieuw.offerte.id}`, true);
      return;
    }
    /* Bestellen bestaat nog niet: de besteladapter naar Oaklyn is nog niet gebouwd. Dat hoort hier
       eerlijk te staan in plaats van een knop die niets doet. */
    if (wat === 'offerte-bestel') {
      meldRegel('Bestellen bij Oaklyn kan nog niet: de besteladapter is nog niet gebouwd.');
      return;
    }
    if (wat === 'offerte-weg') {
      if (!confirm('Deze offerte weghalen? Facturen blijven staan.')) return;
      await motor(`/offertes/${id}`, { methode: 'DELETE' });
      toon('/offertes', true);
      return;
    }
    if (wat === 'offerte-pdf') { await offertePdf(id); return; }
    if (wat === 'factuur-pdf') { await factuurPdf(id); return; }
    if (wat === 'factuur-csv') { await factuurCsv(id); return; }
    if (wat === 'document-weg') {
      if (!confirm('Dit bestand uit het archief weghalen? Het vel zoals het de deur uit ging is dan weg.')) return;
      await motor(`/documenten/${id}`, { methode: 'DELETE' });
      meldRegel('Uit het archief gehaald.');
      toon(huidigeRoute(), false);
      return;
    }
    /* Het bewaarde vel terughalen. Niet opnieuw tekenen uit de database maar het bestand zelf, want
       daar is het archief voor: dit is wat de klant gekregen heeft. */
    if (wat === 'document-halen') {
      const { document: doc } = await motor(`/documenten/${id}`);
      const ruw = atob(doc.inhoud);
      const bytes = new Uint8Array(ruw.length);
      for (let i = 0; i < ruw.length; i += 1) bytes[i] = ruw.charCodeAt(i);
      PDF.download(bytes, doc.bestandsnaam);
      return;
    }
    if (wat === 'factuur-weg') {
      if (!confirm('Dit concept weghalen? Een verstuurde factuur kan nooit weg.')) return;
      await motor(`/facturen/${id}`, { methode: 'DELETE' });
      meldRegel('Concept weggehaald.');
      /* Met duw, anders blijft het adres op de weggehaalde factuur staan en loop je bij verversen
         of met de terugknop tegen een factuur aan die er niet meer is. */
      toon('/facturen', true);
      return;
    }
    if (wat === 'factuur-status') {
      await motor(`/facturen/${id}`, { methode: 'PATCH', body: { status: knop.dataset.status } });
      meldRegel('Factuur bijgewerkt.');
      toon('/facturen', false);
      return;
    }
    if (wat === 'klant-weg') {
      if (!confirm('Deze klant weghalen? De klussen, offertes en facturen blijven staan; alleen de kaart verdwijnt.')) return;
      await motor(`/klanten/${id}`, { methode: 'DELETE' });
      meldRegel('Klant weggehaald.');
      toon('/klanten', true);
      return;
    }
  } catch (e) {
    meldRegel(e.message);
  }
}

/* ---------- router ---------- */

const SCHERMEN = [
  { pad: /^\/$/, maak: schermOverzicht, tab: '/' },
  { pad: /^\/projecten$/, maak: schermProjecten, tab: '/projecten' },
  { pad: /^\/projecten\/nieuw$/, maak: (m, zoek) => schermProjectNieuw(zoek), tab: '/projecten' },
  { pad: /^\/projecten\/([\w-]+)$/, maak: (m) => schermProject(m[1]), tab: '/projecten' },
  { pad: /^\/inmeten$/, maak: schermInmeten, tab: '/inmeten' },
  { pad: /^\/inmeten\/(nieuw|[\w-]+)$/, maak: (m, zoek) => schermInmetingForm(m[1], zoek), tab: '/inmeten' },
  { pad: /^\/calculaties$/, maak: schermCalculaties, tab: '/calculaties' },
  { pad: /^\/calculaties\/nieuw$/, maak: (m, zoek) => schermCalculatorNieuw(zoek), tab: '/calculaties' },
  { pad: /^\/calculaties\/([\w-]+)$/, maak: (m) => schermBerekening(m[1]), tab: '/calculaties' },
  { pad: /^\/offertes$/, maak: schermOffertes, tab: '/offertes' },
  { pad: /^\/offertes\/nieuw$/, maak: (m, zoek) => schermOfferteNieuw(zoek), tab: '/offertes' },
  { pad: /^\/offertes\/([\w-]+)$/, maak: (m) => schermOfferte(m[1]), tab: '/offertes' },
  { pad: /^\/offertes\/([\w-]+)\/factuur$/, maak: (m) => schermFactuurUitOfferte(m[1]), tab: '/facturen' },
  { pad: /^\/offertes\/([\w-]+)\/bewerken$/, maak: (m) => schermOfferteBewerken(m[1]), tab: '/offertes' },
  { pad: /^\/facturen$/, maak: schermFacturen, tab: '/facturen' },
  { pad: /^\/facturen\/nieuw$/, maak: (m, zoek) => schermFactuurNieuw(zoek), tab: '/facturen' },
  { pad: /^\/facturen\/([\w-]+)$/, maak: (m) => schermFactuur(m[1]), tab: '/facturen' },
  { pad: /^\/klanten$/, maak: schermKlanten, tab: '/klanten' },
  { pad: /^\/klanten\/nieuw$/, maak: schermKlantNieuw, tab: '/klanten' },
  { pad: /^\/klanten\/([\w-]+)$/, maak: (m) => schermKlant(m[1]), tab: '/klanten' },
  { pad: /^\/bestellingen$/, maak: schermBestellingen, tab: '/bestellingen' },
  { pad: /^\/bedrijf$/, maak: schermBedrijf, tab: '/bedrijf' },
];

function huidigeRoute() {
  let pad = location.pathname;
  if (BASIS && pad.startsWith(BASIS)) pad = pad.slice(BASIS.length);
  return (pad || '/') + location.search;
}

/* Een uitgezet tabblad verdwijnt uit de balk, maar het adres blijft werken: wie er via een oude link
   of de terugknop komt hoort niet tegen een foutmelding aan te lopen om iets wat hij zelf gemaakt
   heeft. Daarom staat het tabblad er wel zolang hij er staat. */
function tekenTabs(actief) {
  tabbalk.innerHTML = TABS
    .filter((t) => !t.mod || moduleAan(t.mod) || t.pad === actief)
    .map((t) => `<a class="fr-tab${t.pad === actief ? ' actief' : ''}" href="${BASIS}${t.pad}" data-route>${t.naam}</a>`)
    .join('');
}

async function toon(pad, duw) {
  if (!sessie()) { toonLogin(); return; }
  navBalk.style.display = '';
  const [zuiver, zoek] = pad.split('?');
  const route = SCHERMEN.find((s) => s.pad.test(zuiver)) ?? SCHERMEN[0];
  const m = zuiver.match(route.pad) ?? ['/'];
  if (duw) history.pushState({}, '', BASIS + pad);
  tekenTabs(route.tab);
  scherm.innerHTML = '<p class="fr-onderkop">Laden...</p>';
  try {
    const uitkomst = await route.maak(m, zoek ? '?' + zoek : '');
    if (uitkomst && typeof uitkomst === 'object' && 'html' in uitkomst) {
      scherm.innerHTML = uitkomst.html;
      await uitkomst.na();
    } else {
      scherm.innerHTML = uitkomst;
    }
  } catch (e) {
    if (e.message !== 'niet ingelogd' && e.message !== 'sessie verlopen') scherm.innerHTML = foutkaart(e);
    return;
  }
  window.scrollTo({ top: 0 });
  tekenVoortgang();
  const projectform = document.getElementById('fr-projectform');
  if (projectform) {
    koppelAdresvelden(projectform, { adres: 'werkadres', postcode: 'postcode', plaats: 'plaats' });
    projectform.addEventListener('submit', eenmalig(projectform.querySelector('button[type=submit]'), async (e) => {
      e.preventDefault();
      try {
        await motor(`/projecten/${projectform.dataset.id}`, {
          methode: 'PATCH',
          body: {
            naam: projectform.naam.value,
            status: projectform.status.value,
            customer_id: projectform.klant_id.value || null,
            werkadres: projectform.werkadres.value || null,
            postcode: projectform.postcode.value || null,
            plaats: projectform.plaats.value || null,
            notitie: projectform.notitie.value || null,
          },
        });
        meldRegel('Klus bewaard.');
      } catch (err) { meldRegel(err.message); }
    }));
  }
  /* De schakels onder Mijn bedrijf. Elke klik gaat meteen naar zijn account, want een schakel met
     een aparte bewaarknop ernaast is een schakel die half aan blijft staan. */
  const schakels = document.getElementById('fr-modules');
  if (schakels) {
    schakels.addEventListener('click', async (e) => {
      const knop = e.target.closest('.fr-schakel');
      if (!knop) return;
      const id = knop.dataset.module;
      const nu = { ...(modules ?? {}) };
      nu[id] = !moduleAan(id);
      /* Wat aan staat hoeft er niet in: een lege instelling betekent aan. */
      if (nu[id]) delete nu[id];
      const vorige = modules;
      zetModules(nu);
      knop.classList.toggle('aan', moduleAan(id));
      knop.querySelector('.stand').textContent = moduleAan(id) ? 'aan' : 'uit';
      tekenTabs('/bedrijf');
      try {
        await motor('/mij', { methode: 'PUT', body: { modules: nu } });
      } catch (err) {
        /* Lukte het niet, dan hoort het scherm niet iets anders te tonen dan wat er op zijn account
           staat: terugdraaien en het zeggen. */
        zetModules(vorige);
        knop.classList.toggle('aan', moduleAan(id));
        knop.querySelector('.stand').textContent = moduleAan(id) ? 'aan' : 'uit';
        tekenTabs('/bedrijf');
        meldRegel(err.message);
      }
    });
  }
  const bedrijfform = document.getElementById('fr-bedrijfform');
  if (bedrijfform) {
    koppelAdresvelden(bedrijfform, { adres: 'adres', postcode: 'postcode', plaats: 'plaats' });
    bedrijfform.addEventListener('submit', eenmalig(bedrijfform.querySelector('button[type=submit]'), async (e) => {
      e.preventDefault();
      const body = {};
      ['bedrijfsnaam', 'kvk', 'btw_nummer', 'adres', 'postcode', 'plaats', 'email', 'telefoon', 'iban', 'quote_prefix', 'factuur_prefix', 'betaaltermijn'].forEach((n) => {
        body[n] = bedrijfform[n].value || null;
      });
      ['quote_counter', 'factuur_counter'].forEach((n) => {
        if (bedrijfform[n].value.trim() !== '') body[n] = bedrijfform[n].value;
      });
      try {
        await motor('/mij', { methode: 'PUT', body });
        meldRegel('Bedrijfsgegevens bewaard.');
      } catch (err) { document.getElementById('fr-bedrijffout').textContent = err.message; }
    }));
  }
  const logoInvoer = document.getElementById('fr-logo');
  if (logoInvoer) {
    const vak = document.getElementById('fr-logovak');
    const wegknop = document.getElementById('fr-logo-weg');
    logoInvoer.addEventListener('change', async () => {
      const bestand = logoInvoer.files && logoInvoer.files[0];
      if (!bestand) return;
      try {
        const dataUrl = await verkleinLogo(bestand);
        await motor('/mij', { methode: 'PUT', body: { logo_data: dataUrl } });
        vak.innerHTML = `<img src="${schoon(dataUrl)}" alt="">`;
        wegknop.hidden = false;
        meldRegel('Logo bewaard.');
      } catch (err) { meldRegel(err.message); }
    });
    wegknop.addEventListener('click', async () => {
      try {
        await motor('/mij', { methode: 'PUT', body: { logo_data: null } });
        vak.innerHTML = '<span>nog geen logo</span>';
        wegknop.hidden = true;
        logoInvoer.value = '';
        meldRegel('Logo weggehaald.');
      } catch (err) { meldRegel(err.message); }
    });
  }
}

document.addEventListener('click', (e) => {
  const knop = e.target.closest('[data-actie]');
  if (knop) { e.preventDefault(); actie(knop); return; }
  const a = e.target.closest('a[data-route]');
  if (!a) return;
  e.preventDefault();
  const doel = new URL(a.href);
  let pad = doel.pathname;
  if (BASIS && pad.startsWith(BASIS)) pad = pad.slice(BASIS.length);
  toon((pad || '/') + doel.search, true);
});

window.addEventListener('popstate', () => toon(huidigeRoute(), false));

/* ---------- de maatlijn ---------- */

const voortgang = document.getElementById('fr-voortgang');
const rail = document.querySelector('.fr-rail');

function bouwRail() {
  rail.querySelectorAll('.tick, .maat').forEach((el) => el.remove());
  const hoogte = window.innerHeight;
  for (let y = 90, n = 1; y < hoogte - 30; y += 90, n += 1) {
    const groot = n % 3 === 0;
    const t = document.createElement('div');
    t.className = 'tick' + (groot ? ' groot' : '');
    t.style.top = y + 'px';
    rail.appendChild(t);
    if (groot) {
      const m = document.createElement('div');
      m.className = 'maat';
      m.style.top = y + 'px';
      m.textContent = (n / 3) + ' m';
      rail.appendChild(m);
    }
  }
}

function tekenVoortgang() {
  const totaal = document.documentElement.scrollHeight - window.innerHeight;
  const deel = totaal > 0 ? Math.min(1, window.scrollY / totaal) : 0;
  voortgang.style.height = (deel * 100) + 'vh';
}

window.addEventListener('scroll', tekenVoortgang, { passive: true });
window.addEventListener('resize', () => { bouwRail(); tekenVoortgang(); });

bouwRail();

/* De schakels horen bij zijn account en niet bij dit apparaat, dus ze worden bij het opstarten
   opgehaald. Wat er op dit apparaat onthouden is, is alleen de eerste indruk: zo staat de balk
   meteen goed in plaats van te wachten op een rit naar de motor, en de server overschrijft het
   zodra hij antwoordt. Gaat dat mis, dan blijft alles gewoon staan zoals het stond: een onbekende
   stand hoort nooit een tabblad te laten verdwijnen. */
async function haalModules() {
  if (!sessie()) return;
  try {
    const { partner } = await motor('/mij');
    zetModules(partner.modules);
    tekenTabs(SCHERMEN.find((s) => s.pad.test(huidigeRoute().split('?')[0]))?.tab ?? '/');
  } catch { /* dan blijft staan wat er stond */ }
}

toon(huidigeRoute(), false);
haalModules();
