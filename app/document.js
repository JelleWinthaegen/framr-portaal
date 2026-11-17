/* Wat er op een offerte of factuur staat, als beschrijving.

   Hier wordt geen streep getekend. Deze module zegt alleen WAT er op het vel hoort: de kop met de
   afzender, de titel met het nummer, de drie kolommen, de regels, het voordeelkader, de totalen en
   de voet. Wie dat vervolgens tekent staat los:

     pdf.js   maakt er bytes van, voor de knop Opslaan als PDF
     vel.js   maakt er HTML van, voor het vel dat op het scherm meekijkt

   Dat het hier op een plek staat is geen netheid maar noodzaak. Zodra het scherm een eigen idee
   heeft van hoe de offerte eruitziet, kan het vel iets anders tonen dan wat de klant krijgt, en
   dan is het vel erger dan geen vel. Een bron, twee tekenaars.

   De bedragen komen binnen als getal en gaan als tekst het document in; de opmaak (euro) komt van
   de aanroeper, zodat deze module niets hoeft te weten van taal of munt. */

/* De regels van een offerte of factuur, gegroepeerd zoals ze op papier horen. Materiaal eerst,
   dan het werk, met een groepskop zodra er allebei zijn. */
function regelsMetGroepen({ materiaal, werk, euro, adviesKolom, bedragVan, adviesVan, subVan }) {
  const rijen = [];
  if (materiaal.length) {
    rijen.push({ groep: 'Materiaal, geleverd op het werk' });
    materiaal.forEach((r) => rijen.push({
      cellen: [r.omschrijving, adviesKolom ? euro(adviesVan(r)) : '', euro(bedragVan(r))],
      sub: subVan(r),
    }));
  }
  if (werk.length) {
    rijen.push({ groep: 'Werkzaamheden' });
    werk.forEach((r) => rijen.push({
      cellen: [r.omschrijving, '', euro(bedragVan(r))],
      sub: subVan(r),
    }));
  }
  return rijen;
}

/* De regel onder een omschrijving: de eigen uitleg, en anders het aantal met zijn eenheid. */
function subregel(r) {
  if (r.uitleg) return r.uitleg;
  if (r.aantal) return `${r.aantal} ${r.eenheid || ''}`.trim();
  return '';
}

function centen(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function getal(v) {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

/* De bedragen van een offerte, in centen.

   Per regel wordt eerst op centen afgerond en pas daarna opgeteld, dezelfde regel als in het
   rekenwerk van de factuur (supabase/functions/portaal/factuur.ts). Tot 01-10-2026 rekende de
   offerte andersom: de korting over de som van de adviesprijzen, en de regels elk apart. Dan
   stond er 171,11 onder twee regels van 78,54 en 92,58, en de factuur die uit diezelfde regels
   kwam zei 171,12. Een cent, maar een offerte en een factuur die niet uit dezelfde afronding
   komen vallen in een boekhouding altijd op (Myron, 30-09-2026).

   Dit is de ene bron voor de som op het scherm, het vel dat meekijkt, en wat er bewaard wordt.

     regels    de materiaalregels uit de calculator, met adv (adviesprijs) en ink (inkoop) per regel
     vrijMat   de regels die hij er zelf bij tikt, met aantal en prijs
     werk      zijn werkregels, met aantal en tarief
     korting   zijn korting voor de klant op de adviesprijs, in procenten */
export function offerteBedragen({ regels = [], vrijMat = [], werk = [], korting = 0, btwTarief = 21 }) {
  const factor = 1 - getal(korting) / 100;
  const materiaal = regels.map((r) => ({
    bedrag_advies: centen(r.adv || 0),
    bedrag_verkoop: centen((r.adv || 0) * factor),
    bedrag_inkoop: centen(r.ink || 0),
  }));
  const vrij = vrijMat.map((r) => {
    const bedrag = centen(getal(r.aantal) * getal(r.prijs));
    return { bedrag_advies: bedrag, bedrag_verkoop: bedrag, bedrag_inkoop: centen(getal(r.ink)) };
  });
  const werkregels = werk.map((w) => ({ bedrag_verkoop: centen(getal(w.aantal) * getal(w.tarief)) }));

  const som = (lijst, veld) => lijst.reduce((s, x) => centen(s + x[veld]), 0);
  const matAdv = centen(som(materiaal, 'bedrag_advies') + som(vrij, 'bedrag_advies'));
  const matVerk = centen(som(materiaal, 'bedrag_verkoop') + som(vrij, 'bedrag_verkoop'));
  const matInk = centen(som(materiaal, 'bedrag_inkoop') + som(vrij, 'bedrag_inkoop'));
  const werkTot = som(werkregels, 'bedrag_verkoop');
  const sub = centen(matVerk + werkTot);
  const btw = centen(sub * getal(btwTarief) / 100);
  return { materiaal, vrij, werkregels, matAdv, matVerk, matInk, werkTot, sub, btw, totaal: centen(sub + btw) };
}

/* Het voordeel op het materiaal: wat de adviesprijs was, wat hij ervoor rekent en het verschil.
   Alleen als er echt verschil is; een kader dat nul euro voordeel meldt is een kader te veel. */
export function voordeelUit(matAdvies, matVerkoop) {
  const advies = Number(matAdvies || 0);
  const prijs = Number(matVerkoop || 0);
  if (!(advies > prijs + 0.005)) return null;
  return {
    advies,
    prijs,
    bespaard: advies - prijs,
    pct: Math.round((1 - prijs / advies) * 100),
  };
}

/* De offerte als document.

   Alles komt binnen als gewoon getal of gewone tekst, niet als rij uit de database. Zo kan zowel
   een bewaarde offerte als het formulier waar op dat moment in getypt wordt hetzelfde document
   opleveren, en toont het vel tijdens het invullen precies wat er straks uit de PDF komt. */
export function offerteDocument({
  partner, logo, logoUrl, kopregels, klant, nummer, datum, geldigTot, levertijd, project,
  materiaal = [], werk = [], matAdvies = 0, matVerkoop = 0, werkTotaal = 0,
  subtotaal = 0, btwBedrag = 0, totaal = 0, btwPct = 21, euro,
}) {
  const voordeel = voordeelUit(matAdvies, matVerkoop);

  const totalen = [];
  if (werk.length) {
    totalen.push({ label: 'Materiaal', waarde: euro(matVerkoop) });
    totalen.push({ label: 'Werkzaamheden', waarde: euro(werkTotaal) });
  }
  totalen.push({ label: 'Subtotaal exclusief btw', waarde: euro(subtotaal) });
  totalen.push({ label: btwPct === 0 ? 'Btw verlegd' : `Btw ${btwPct} procent`, waarde: euro(btwBedrag) });
  totalen.push({ label: 'Totaal inclusief btw', waarde: euro(totaal), dik: true, groot: true });

  const bedrijfsnaam = partner.bedrijfsnaam || 'Jouw bedrijfsnaam';
  const werkadres = [klant.adres, klant.plaats].filter(Boolean).join(', ');

  return {
    titel: 'Offerte ' + (nummer || ''),
    elementen: [
      { soort: 'kop', bedrijfsnaam, logo, logoUrl, rechts: kopregels },
      { soort: 'titel', tekst: 'Offerte', rechts: nummer },
      { soort: 'kolommen', kolommen: [
        { kop: 'Voor', regels: [klant.naam || '', klant.adres || '', `${klant.postcode || ''} ${klant.plaats || ''}`.trim()] },
        { kop: 'Het werk', regels: [project || '-', werkadres] },
        { kop: 'Gegevens', regels: ['Datum ' + datum, geldigTot ? 'Geldig tot ' + geldigTot : '']
          .concat(levertijd ? ['Levertijd ' + levertijd] : []) },
      ] },
      { soort: 'tabel', kolommen: [
        { titel: 'Omschrijving', deel: 3 },
        { titel: voordeel ? 'Adviesprijs' : '', deel: 1, rechts: true },
        { titel: 'Bedrag ex btw', deel: 1, rechts: true },
      ], rijen: regelsMetGroepen({
        materiaal, werk, euro,
        adviesKolom: !!voordeel,
        bedragVan: (r) => r.bedrag_verkoop ?? 0,
        adviesVan: (r) => r.bedrag_advies ?? 0,
        subVan: subregel,
      }) },
      voordeel ? { soort: 'kader', kop: 'Uw voordeel op het materiaal', vakken: [
        { label: 'Normale adviesprijs', waarde: euro(voordeel.advies) },
        { label: 'Uw prijs via ons', waarde: euro(voordeel.prijs) },
        { label: `U bespaart (${voordeel.pct} procent)`, waarde: euro(voordeel.bespaard), groot: true },
      ] } : null,
      { soort: 'totalen', regels: totalen },
      /* De voet. Tot 01-10-2026 begon hij met "Alle bedragen zijn exclusief btw tenzij anders
         vermeld", pal onder een totaal dat juist inclusief btw is. Formeel dekte het "tenzij" dat,
         maar het las als een tegenspraak (Myron, 30-09-2026). De kolomkop zegt al "Bedrag ex btw"
         en elke totaalregel zegt zelf wat hij is, dus de zin is weg. */
      { soort: 'bijeen', elementen: [
        { soort: 'tekst', klein: true, tekst: [
          btwPct === 0 ? 'De btw is verlegd naar de afnemer.' : '',
          geldigTot ? 'Deze offerte is geldig tot ' + geldigTot + '.' : '',
          'Levering in overleg. Op deze offerte zijn de algemene voorwaarden van ' + bedrijfsnaam + ' van toepassing.',
        ].filter(Boolean).join(' ') },
        { soort: 'ondertekening', links: 'Voor akkoord, opdrachtgever', rechts: 'Datum' },
      ] },
    ].filter(Boolean),
  };
}
