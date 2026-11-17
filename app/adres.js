/* Adresvoorstellen uit de Locatieserver van PDOK (het Kadaster, de BAG-adressen).

   Wens van Jelle, 05-09-2026: bij de adresvelden voorstellen doen. Gekozen voor PDOK omdat het
   gratis is, zonder sleutel en zonder account, en rechtstreeks vanuit de browser werkt. Dat
   laatste telt: de schermlaag staat openbaar op GitHub Pages, dus een dienst met een geheime
   sleutel kan daar niet zonder een extra laag in de motor. PDOK dekt alleen Nederland.

   Hoe het zich gedraagt: wie in het adresveld "Dudenrode 35" of "6439BL 35" tikt krijgt onder
   het veld maximaal vijf voorstellen; een keuze (klik, of pijltjes en Enter) vult adres,
   postcode en plaats in een keer. Wie de voorstellen negeert merkt er niets van: typen blijft
   gewoon werken, en een adres dat PDOK niet kent (nieuwbouw, buitenland) tik je gewoon in. Een
   voorstel is een hulp, geen controle.

   Wat er naar PDOK gaat is alleen wat er in het adresveld staat; nooit een naam of iets anders
   van de kaart. */

const PDOK = 'https://api.pdok.nl/bzk/locatieserver/search/v3_1/free';
const VELDEN = 'id,weergavenaam,straatnaam,huisnummer,huisletter,huisnummertoevoeging,postcode,woonplaatsnaam';
const MINIMUM = 3;
const WACHT_MS = 250;
const AANTAL = 5;

/* De zoekopdracht zoals hij naar PDOK gaat: alleen adressen, een handvol, met precies de velden
   die de kaart nodig heeft. */
export function zoekUrl(term, rows = AANTAL) {
  const u = new URL(PDOK);
  u.searchParams.set('q', term);
  u.searchParams.set('fq', 'type:adres');
  u.searchParams.set('rows', String(rows));
  u.searchParams.set('fl', VELDEN);
  return u.toString();
}

/* Een PDOK-adres naar de drie velden van de kaart. De BAG splitst het huisnummer in nummer,
   letter en toevoeging; op een offerte staat dat als "35A" en "35-2", zoals PostNL het schrijft.
   De postcode krijgt zijn spatie terug, want zo staat hij op elk Nederlands document. */
export function veldenUitDoc(doc) {
  const d = doc ?? {};
  const nummer = [
    d.huisnummer ?? '',
    d.huisletter ?? '',
    d.huisnummertoevoeging ? `-${d.huisnummertoevoeging}` : '',
  ].join('');
  const pc = String(d.postcode ?? '').replace(/\s+/g, '').toUpperCase();
  return {
    adres: [d.straatnaam ?? '', nummer].filter(Boolean).join(' ').trim(),
    postcode: pc.length === 6 ? `${pc.slice(0, 4)} ${pc.slice(4)}` : pc,
    plaats: d.woonplaatsnaam ?? '',
    label: d.weergavenaam ?? '',
  };
}

/* Voorstellen ophalen. Een lege of te korte term geeft niets terug zonder te vragen. Een storing
   bij PDOK geeft ook niets terug: de kaart mag nooit stuklopen op een hulpdienst. */
export async function zoekAdressen(term, fetcher = globalThis.fetch, signal = undefined) {
  const schoon = String(term ?? '').trim();
  if (schoon.length < MINIMUM) return [];
  try {
    const r = await fetcher(zoekUrl(schoon), { signal });
    if (!r.ok) return [];
    const j = await r.json();
    return (j?.response?.docs ?? []).map(veldenUitDoc).filter((v) => v.adres);
  } catch {
    return [];
  }
}

/* De voorstellen aan een adresveld hangen, met een postcode- en plaatsveld dat meegevuld wordt.

   De lijst staat vast gepositioneerd onder het adresveld, zodat hij boven alles uit komt zonder
   dat de rij eromheen zijn hoogte verandert. Na een keuze vuurt elk veld zijn input- en
   change-gebeurtenis af, zodat wat er al aan het formulier hangt (het spiegelen naar de klant,
   de tellers) gewoon meedoet. */
export function koppelAdresvoorstel({ adres, postcode = null, plaats = null, fetcher = globalThis.fetch, naKeuze = null }) {
  if (!adres || adres.dataset.adresvoorstel === '1') return () => {};
  adres.dataset.adresvoorstel = '1';
  adres.setAttribute('autocomplete', 'off');

  let lijst = null;
  let voorstellen = [];
  let actief = -1;
  let timer = null;
  let lopend = null;
  /* Tijdens het invullen na een keuze vuurt het adresveld zijn eigen input-gebeurtenis af; die
     mag geen nieuwe zoektocht starten, anders staat de lijst meteen weer open. */
  let stil = false;

  const zetWaarde = (veld, waarde) => {
    if (!veld) return;
    veld.value = waarde;
    veld.dispatchEvent(new Event('input', { bubbles: true }));
    veld.dispatchEvent(new Event('change', { bubbles: true }));
  };

  function sluit() {
    if (lijst) { lijst.remove(); lijst = null; }
    voorstellen = [];
    actief = -1;
    window.removeEventListener('scroll', plaats_, true);
    window.removeEventListener('resize', plaats_);
  }

  function plaats_() {
    if (!lijst) return;
    const r = adres.getBoundingClientRect();
    lijst.style.left = `${r.left}px`;
    lijst.style.top = `${r.bottom + 4}px`;
    lijst.style.width = `${Math.max(r.width, 260)}px`;
  }

  function kies(i) {
    const v = voorstellen[i];
    if (!v) return;
    clearTimeout(timer);
    if (lopend) lopend.abort();
    stil = true;
    try {
      zetWaarde(adres, v.adres);
      zetWaarde(postcode, v.postcode);
      zetWaarde(plaats, v.plaats);
    } finally {
      stil = false;
    }
    sluit();
    if (naKeuze) naKeuze(v);
  }

  function teken() {
    if (!voorstellen.length) { sluit(); return; }
    if (!lijst) {
      lijst = document.createElement('div');
      lijst.className = 'fr-adreslijst';
      lijst.setAttribute('role', 'listbox');
      lijst.addEventListener('mousedown', (e) => {
        /* mousedown en niet click: bij click is het veld al zijn focus kwijt en de lijst weg. */
        const rij = e.target.closest('[data-i]');
        if (!rij) return;
        e.preventDefault();
        kies(Number(rij.dataset.i));
      });
      document.body.appendChild(lijst);
      window.addEventListener('scroll', plaats_, true);
      window.addEventListener('resize', plaats_);
    }
    lijst.innerHTML = voorstellen.map((v, i) =>
      `<div class="rij${i === actief ? ' actief' : ''}" role="option" data-i="${i}" aria-selected="${i === actief}">
        <b>${ontsmet(v.adres)}</b><span>${ontsmet(v.postcode)} ${ontsmet(v.plaats)}</span>
      </div>`).join('') + '<div class="bron">adressen van het Kadaster via PDOK</div>';
    plaats_();
  }

  async function zoek() {
    if (lopend) lopend.abort();
    lopend = new AbortController();
    const mijn = lopend;
    const uit = await zoekAdressen(adres.value, fetcher, mijn.signal);
    if (mijn !== lopend || document.activeElement !== adres) return;
    voorstellen = uit;
    actief = -1;
    teken();
  }

  const opInvoer = () => {
    if (stil) return;
    clearTimeout(timer);
    if (adres.value.trim().length < MINIMUM) { sluit(); return; }
    timer = setTimeout(zoek, WACHT_MS);
  };
  const opToets = (e) => {
    if (!lijst) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); actief = (actief + 1) % voorstellen.length; teken(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); actief = (actief - 1 + voorstellen.length) % voorstellen.length; teken(); }
    else if (e.key === 'Enter' && actief >= 0) { e.preventDefault(); kies(actief); }
    else if (e.key === 'Escape') { sluit(); }
  };
  const opVerlaten = () => { setTimeout(sluit, 150); };

  adres.addEventListener('input', opInvoer);
  adres.addEventListener('keydown', opToets);
  adres.addEventListener('blur', opVerlaten);

  return () => {
    sluit();
    adres.removeEventListener('input', opInvoer);
    adres.removeEventListener('keydown', opToets);
    adres.removeEventListener('blur', opVerlaten);
    delete adres.dataset.adresvoorstel;
  };
}

/* Alle adresvelden in een formulier in een keer aansluiten, op naam of op id. */
export function koppelAdresvelden(wortel, { adres, postcode, plaats }) {
  const zoek = (naam) => wortel?.querySelector(`[name="${naam}"], #${naam}`) ?? null;
  return koppelAdresvoorstel({ adres: zoek(adres), postcode: zoek(postcode), plaats: zoek(plaats) });
}

const ontsmet = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
