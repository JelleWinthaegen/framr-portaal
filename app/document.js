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
      { soort: 'bijeen', elementen: [
        { soort: 'tekst', klein: true, tekst: 'Alle bedragen zijn exclusief btw tenzij anders vermeld.'
          + (btwPct === 0 ? ' De btw is verlegd naar de afnemer.' : '')
          + (geldigTot ? ' Deze offerte is geldig tot ' + geldigTot + '.' : '')
          + ' Levering in overleg. Op deze offerte zijn de algemene voorwaarden van '
          + bedrijfsnaam + ' van toepassing.' },
        { soort: 'ondertekening', links: 'Voor akkoord, opdrachtgever', rechts: 'Datum' },
      ] },
    ].filter(Boolean),
  };
}
