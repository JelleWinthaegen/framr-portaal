/* De proefmotor: het portaal zonder motor en zonder account.

   Dit is de nagebouwde portaalmotor met verzonnen gegevens. Hij draait op twee plekken:
   1. in de dev-server (server.mjs --nep), die hem achter /nep-motor over HTTP aanbiedt, zodat elk
      scherm te bekijken is zonder in te loggen en zonder de live database aan te raken;
   2. in de browser zelf, als proefstand van het gepubliceerde portaal (Jelle, 12-10-2026: een
      optie om het portaal te proberen zonder in te loggen, waarbij niets bewaard wordt). framr.js
      laadt dit bestand dan pas, roept aanroep() rechtstreeks aan en houdt de stand alleen in het
      geheugen van het tabblad.

   Een motor, twee gastheren: zo kan de proefstand niet achterlopen op wat de dev-server laat zien.
   Dit bestand gebruikt bewust niets van node of van de browser; de registry van de echte motor
   (instellingen.ts) en sinds 16-10-2026 ook zijn rekenregels (reken: groepeer en werkregels uit
   calculatie.ts, nettoOppervlak en vlakkenUitInvoer uit inmeting.ts) komen van buiten, want die
   horen maar op een plek te bestaan. Tot die dag rekende deze motor een inmeting als een vloer zonder
   vlakken en zonder eigen werk; de demofilm liet zo een andere vloer boven, een trapgat en een eigen
   regel niet terugkomen, terwijl de echte motor dat wel doet.

   Verder alleen lezen: schrijven bevestigt en onthoudt in het geheugen van deze instantie, want
   dit is er om schermen te bekijken en niet om een tweede database te worden.

   Geen echte data, geen prijzen: alles hieronder is verzonnen en als zodanig herkenbaar. */

export function maakProefmotor({ registry = null, reken = null, vers = false, leeg = false } = {}) {
  /* ---------- de verzonnen inhoud ---------- */

  /* Vaste id's in plaats van willekeurige, zodat een adres als /projecten/p1 na een
     herstart nog steeds hetzelfde scherm geeft. */
  const KLANTEN = [
    { id: 'k1', naam: 'M. Peeters', contact: 'Mark Peeters', telefoon: '06 12345678', email: 'm.peeters@voorbeeld.nl', adres: 'Slakkenstraat 12', postcode: '6431 AA', plaats: 'Hoensbroek', notitie: null },
    { id: 'k2', naam: 'Fam. Willems', contact: null, telefoon: '046 1234567', email: null, adres: 'Rijksweg Zuid 80', postcode: '6134 AB', plaats: 'Sittard', notitie: null },
    { id: 'k3', naam: 'Voorbeeld BV', contact: 'J. de Vries', telefoon: null, email: 'inkoop@voorbeeld.nl', adres: 'Markt 3', postcode: '6191 JJ', plaats: 'Beek', notitie: null },
  ];

  const PROJECTEN = [
    { id: 'p1', naam: 'Rijtjeshuis Hoensbroek', customer_id: 'k1', status: 'ingemeten', werkadres: 'Slakkenstraat 12', postcode: '6431 AA', plaats: 'Hoensbroek', notitie: null, stappen: {}, created_at: '2026-08-24T09:00:00Z' },
    { id: 'p2', naam: 'Appartement Sittard', customer_id: 'k2', status: 'open', werkadres: 'Rijksweg Zuid 80', postcode: '6134 AB', plaats: 'Sittard', notitie: null, stappen: {}, created_at: '2026-08-22T09:00:00Z' },
    { id: 'p3', naam: 'Kantoor Beek', customer_id: 'k3', status: 'gewonnen', werkadres: 'Markt 3', postcode: '6191 JJ', plaats: 'Beek', notitie: null, stappen: {}, created_at: '2026-08-18T09:00:00Z' },
    { id: 'p4', naam: 'Nieuwbouw Geleen', customer_id: null, status: 'wacht_vloer', werkadres: 'Ringovenstraat 7', postcode: '6161 AA', plaats: 'Geleen', notitie: null, stappen: { facturen: false }, created_at: '2026-08-12T09:00:00Z' },
  ];

  const INMETINGEN = [
    {
      id: 'i1', naam: 'Woonkamer en hal', project_id: 'p1', customer_id: 'k1', gemeten_op: '2026-08-24',
      totaal_m2: 41.3, totaal_omtrek: 28.4, notitie: 'Drempel naar de keuken zit los.',
      vaststelling: { vloersoort: 'pvc-lijm', legpatroon: 'recht', ondergrond: 'beton', vlakheid: 'licht', vw: 'nee', woning: 'na94' },
      afspraken: { start: 'over twee weken', dagen: '2', bezorging: 'op het werk', sleutel: 'klant is thuis, 8 tot 17 uur' },
      checklist: ['leggen', 'plinten', 'egaliseren', 'primer'],
      werkregels: [
        { omschrijving: 'Vloer leggen', aantal: 41.3, eenheid: 'm2', prijs: 0 },
        { omschrijving: 'Plinten plaatsen', aantal: 28.4, eenheid: 'm', prijs: 0 },
      ],
      kozijnen: [],
      portal_measurement_rooms: [
        { id: 'r1', volgorde: 0, naam: 'Woonkamer', lengte: 5.2, breedte: 4, aftrek: 0, plint_eraf: 0.9, oppervlak: 20.8, omtrek: 17.5, vloer_naam: null, legpatroon: 'recht' },
        { id: 'r2', volgorde: 1, naam: 'Hal', lengte: 5.1, breedte: 4.02, aftrek: 0, plint_eraf: 2.6, oppervlak: 20.5, omtrek: 10.9, vloer_naam: null, legpatroon: 'recht' },
      ],
    },
    {
      id: 'i2', naam: 'Hele verdieping', project_id: 'p2', customer_id: 'k2', gemeten_op: '2026-08-22',
      totaal_m2: 68.9, totaal_omtrek: 52.1, notitie: null,
      /* Twee vloeren in een klus, zoals de inmeetkaart het wegschrijft: een vaststelling per vloer,
         de checklist met de vloersleutel ervoor, en op elke werkregel bij welke vloer hij hoort. */
      vaststelling: {
        per_vloer: {
          'joka skyline eiken': { naam: 'Joka Skyline eiken', vast: { vloersoort: 'pvc-klik', legpatroon: 'visgraat', ondergrond: 'beton', vlakheid: 'goed' } },
          'grijs laminaat': { naam: 'Grijs laminaat', vast: { vloersoort: 'laminaat', legpatroon: 'recht', ondergrond: 'houten vloer', vlakheid: 'licht' } },
        },
      },
      afspraken: {}, checklist: ['joka skyline eiken::leggen', 'joka skyline eiken::plinten', 'joka skyline eiken::ondervloer', 'grijs laminaat::leggen', 'grijs laminaat::ondervloer'],
      werkregels: [
        { omschrijving: 'Vloer leggen', aantal: 45.9, eenheid: 'm2', prijs: 0, vloer: 'Joka Skyline eiken' },
        { omschrijving: 'Plinten plaatsen', aantal: 35.7, eenheid: 'm', prijs: 0, vloer: 'Joka Skyline eiken' },
        { omschrijving: 'Vloer leggen', aantal: 23, eenheid: 'm2', prijs: 0, vloer: 'Grijs laminaat' },
      ],
      kozijnen: [],
      portal_measurement_rooms: [
        { id: 'r3', volgorde: 0, naam: 'Woonkamer', lengte: 7, breedte: 4.4, aftrek: 0, plint_eraf: 1.8, oppervlak: 30.8, omtrek: 21, vloer_naam: 'Joka Skyline eiken', legpatroon: 'visgraat' },
        { id: 'r4', volgorde: 1, naam: 'Slaapkamer', lengte: 4.2, breedte: 3.6, aftrek: 0, plint_eraf: 0.9, oppervlak: 15.1, omtrek: 14.7, vloer_naam: 'Joka Skyline eiken', legpatroon: 'visgraat' },
        { id: 'r5', volgorde: 2, naam: 'Overloop', lengte: 4.7, breedte: 3.2, aftrek: 0.8, plint_eraf: 2.7, oppervlak: 14.2, omtrek: 13.1, vloer_naam: 'Grijs laminaat', legpatroon: 'recht' },
        { id: 'r6', volgorde: 3, naam: 'Badkamer', lengte: 2.6, breedte: 3.4, aftrek: 0, plint_eraf: 0.9, oppervlak: 8.8, omtrek: 11.1, vloer_naam: 'Grijs laminaat', legpatroon: 'recht' },
      ],
    },
    {
      id: 'i3', naam: 'Losse meting zolder', project_id: null, customer_id: null, gemeten_op: '2026-08-20',
      totaal_m2: 19.96, totaal_omtrek: 17.2, notitie: null,
      vaststelling: {}, afspraken: {}, checklist: ['leggen'], werkregels: [], kozijnen: [],
      portal_measurement_rooms: [
        { id: 'r7', volgorde: 0, naam: 'Zolder', lengte: 5.2, breedte: 3.84, aftrek: 0, plint_eraf: 1.2, oppervlak: 19.96, omtrek: 17.2, vloer_naam: null, legpatroon: null },
      ],
    },
  ];

  /* Een offerte uit de tijd dat de regels alleen als berekening bewaard werden. Op live zijn er
     negen van; ze staan hier na omdat het portaal ze moet kunnen openen, afdrukken en factureren
     zonder dat er ooit een rij in portal_quote_lines is geweest. Dezelfde vorm als daar. */
  const OUDE_BEREKENING = {
    opp: 36,
    soort: 'dryback (lijmvloer)',
    vloer: 'Voorbeeld Eiken',
    brutoM2: 39.6,
    verliesPct: '10',
    gemaakt: '2026-08-13T16:17:25.955Z',
    regels: [
      { naam: 'Vloer', aantal: '12 pakken', stuks: 12, uitleg: '39.60 m² ÷ 3.35 m²/pak → 12 pak (40.20 m²)', adv: 1393.73, verk: 1114.99, ink: 832.07 },
      { naam: 'Lijm JK26', aantal: '1 emmer', stuks: 1, uitleg: '36 m² × 0,32 kg (A2) = 11.5 kg ÷ 14 kg/emmer → 1', adv: 110.26, verk: 88.21, ink: 73.77 },
      { naam: 'Primer JK01', aantal: '1 x 10 kg', stuks: 1, uitleg: '36 m² × 0,15 kg = 5.4 kg ÷ 10 kg → 1', adv: 81.65, verk: 65.32, ink: 54.63 },
      { naam: 'Egaline JK10', aantal: '7 zak', stuks: 7, uitleg: '36 m² × 3 mm × 1.6 kg = 173 kg ÷ 25 kg/zak → 7', adv: 202.51, verk: 162.01, ink: 135.49 },
      { naam: 'Plinten L107', aantal: '13 plinten', stuks: 13, uitleg: '28 m + 10% = 30.8 m ÷ 2,4 m/plint → 13', adv: 127.92, verk: 102.34, ink: 85.63 },
    ],
    totaal: { adv: 1916.07, verk: 1532.86, ink: 1181.58 },
  };

  const OFFERTES = [
    { id: 'o1', nummer: 'OFF-2026-003', versie: 1, status: 'verstuurd', project: 'Woonkamer en hal', project_id: 'p1', customer_id: 'k1', klant_naam: 'M. Peeters', klant_adres: 'Slakkenstraat 12', klant_postcode: '6431 AA', klant_plaats: 'Hoensbroek', totaal: 4318.4, materiaal_verkoop: 2986.7, materiaal_inkoop: 2655.03, werk_totaal: 1331.7, subtotaal: 4318.4, btw_tarief: 21, verzendkosten: 0, levertijd: 'vijf tot zeven werkdagen na akkoord', geldig_tot: '2026-09-23', created_at: '2026-08-24T11:00:00Z' },
    { id: 'o2', nummer: 'OFF-2026-002', versie: 1, status: 'gewonnen', project: 'Kantoor Beek', project_id: 'p3', customer_id: 'k3', klant_naam: 'Voorbeeld BV', klant_adres: 'Markt 3', klant_postcode: '6191 JJ', klant_plaats: 'Beek', totaal: 6120.5, materiaal_verkoop: 4210.1, materiaal_inkoop: 3697.7, werk_totaal: 1910.4, subtotaal: 6120.5, btw_tarief: 21, verzendkosten: 0, levertijd: null, geldig_tot: '2026-09-17', created_at: '2026-08-18T11:00:00Z' },
    /* De oude vorm: geen offerteregels, materiaal_verkoop op nul, alles in berekening. */
    { id: 'o4', nummer: 'OFF-2026-000', versie: 1, status: 'concept', project: 'Oude klus', project_id: null, customer_id: null, klant_naam: 'Klant uit de oude doos', klant_adres: 'Vroegerlaan 3', klant_postcode: '6400 AA', klant_plaats: 'Heerlen', totaal: 2532.36, materiaal_verkoop: 0, materiaal_inkoop: 0, materiaal_advies: 0, werk_totaal: 560, subtotaal: 2092.86, verzendkosten: 0, geldig_tot: '2026-09-12', created_at: '2026-08-13T16:20:00Z', berekening: OUDE_BEREKENING },
    { id: 'o3', nummer: 'OFF-2026-001', versie: 2, status: 'concept', project: 'Appartement Sittard', project_id: 'p2', customer_id: 'k2', klant_naam: 'Fam. Willems', klant_adres: 'Rijksweg Zuid 80', klant_postcode: '6134 AB', klant_plaats: 'Sittard', totaal: 3268.2, materiaal_verkoop: 2100, materiaal_inkoop: 1831.8, werk_totaal: 1168.2, subtotaal: 3268.2, btw_tarief: 21, verzendkosten: 0, levertijd: null, geldig_tot: '2026-09-12', created_at: '2026-08-12T11:00:00Z' },
  ];

  const OFFERTEREGELS = {
    o1: [
      { id: 'ol1', volgorde: 0, soort: 'materiaal', omschrijving: 'PVC lijmvloer, 12 pakken', aantal: 12, eenheid: 'pak', prijs_verkoop: 178.4, bedrag_verkoop: 2140.8, bedrag_inkoop: 1902.2 },
      { id: 'ol2', volgorde: 1, soort: 'materiaal', omschrijving: 'Designvloerlijm, 3 emmers', aantal: 3, eenheid: 'emmer', prijs_verkoop: 92.5, bedrag_verkoop: 277.5, bedrag_inkoop: 240.9 },
      { id: 'ol3', volgorde: 2, soort: 'materiaal', omschrijving: 'Plint wit gegrond, 29 m', aantal: 29, eenheid: 'm', prijs_verkoop: 19.6, bedrag_verkoop: 568.4, bedrag_inkoop: 511.93 },
      { id: 'ol4', volgorde: 3, soort: 'werk', omschrijving: 'Vloer leggen', aantal: 41.3, eenheid: 'm2', prijs_verkoop: 22.5, bedrag_verkoop: 929.25, bedrag_inkoop: 0 },
      { id: 'ol5', volgorde: 4, soort: 'werk', omschrijving: 'Plinten plaatsen', aantal: 28.4, eenheid: 'm', prijs_verkoop: 8.5, bedrag_verkoop: 241.4, bedrag_inkoop: 0 },
      { id: 'ol6', volgorde: 5, soort: 'werk', omschrijving: 'Ondergrond egaliseren', aantal: 41.3, eenheid: 'm2', prijs_verkoop: 3.9, bedrag_verkoop: 161.07, bedrag_inkoop: 0 },
    ],
    o2: [{ id: 'ol7', volgorde: 0, soort: 'materiaal', omschrijving: 'PVC klikvloer, 22 pakken', aantal: 22, eenheid: 'pak', prijs_verkoop: 191.37, bedrag_verkoop: 4210.1, bedrag_inkoop: 3697.7 },
      { id: 'ol8', volgorde: 1, soort: 'werk', omschrijving: 'Vloer leggen', aantal: 84.9, eenheid: 'm2', prijs_verkoop: 22.5, bedrag_verkoop: 1910.4, bedrag_inkoop: 0 }],
    o3: [{ id: 'ol9', volgorde: 0, soort: 'materiaal', omschrijving: 'Laminaat, 18 pakken', aantal: 18, eenheid: 'pak', prijs_verkoop: 116.67, bedrag_verkoop: 2100, bedrag_inkoop: 1834.2 },
      { id: 'ol10', volgorde: 1, soort: 'werk', omschrijving: 'Vloer leggen', aantal: 68.9, eenheid: 'm2', prijs_verkoop: 16.95, bedrag_verkoop: 1168.2, bedrag_inkoop: 0 }],
  };

  const FACTUREN = [
    { id: 'f1', nummer: 'FAC-2026-002', soort: 'aanbetaling', status: 'verstuurd', quote_id: 'o2', project_id: 'p3', customer_id: 'k3', klant_naam: 'Voorbeeld BV', klant_adres: 'Markt 3', klant_postcode: '6191 JJ', klant_plaats: 'Beek', omschrijving: 'Materiaal Kantoor Beek', subtotaal: 4210.1, btw_bedrag: 884.12, btw_specificatie: [{ tarief: 21, grondslag: 4210.1, btw: 884.12 }], totaal: 5094.22, factuurdatum: '2026-08-19', vervaldatum: '2026-09-02', betaalkenmerk: 'FAC-2026-002', iban: 'NL00 BANK 0123 4567 89', created_at: '2026-08-19T09:00:00Z' },
    { id: 'f2', nummer: 'FAC-2026-001', soort: 'werk', status: 'betaald', quote_id: 'o2', project_id: 'p3', customer_id: 'k3', klant_naam: 'Voorbeeld BV', klant_adres: 'Markt 3', klant_postcode: '6191 JJ', klant_plaats: 'Beek', omschrijving: 'Werk Kantoor Beek', subtotaal: 1910.4, btw_bedrag: 401.18, btw_specificatie: [{ tarief: 21, grondslag: 1910.4, btw: 401.18 }], totaal: 2311.58, betaald_op: '2026-08-27', factuurdatum: '2026-08-15', vervaldatum: '2026-08-29', betaalkenmerk: 'FAC-2026-001', iban: 'NL00 BANK 0123 4567 89', created_at: '2026-08-15T09:00:00Z' },
  ];

  const FACTUURREGELS = {
    f1: [{ id: 'fl1', volgorde: 0, soort: 'materiaal', omschrijving: 'PVC klikvloer, 22 pakken', aantal: 22, eenheid: 'pak', prijs: 191.37, bedrag: 4210.1, btw_tarief: 21, quote_line_id: 'ol7' }],
    f2: [{ id: 'fl2', volgorde: 0, soort: 'werk', omschrijving: 'Vloer leggen', aantal: 84.9, eenheid: 'm2', prijs: 22.5, bedrag: 1910.4, btw_tarief: 21, quote_line_id: 'ol8' }],
  };

  const BEREKENINGEN = [
    { id: 'b1', naam: 'Woonkamer en hal, PVC lijm', project_id: 'p1', measurement_id: 'i1', oppervlak_m2: 41.3, totaal_advies: 3210.4, totaal_verkoop: 2986.7, totaal_inkoop: 2655.03, created_at: '2026-08-24T10:30:00Z', invoer: {}, uitkomst: {} },
    { id: 'b2', naam: 'Kantoor Beek, klik', project_id: 'p3', measurement_id: null, oppervlak_m2: 84.9, totaal_advies: 4520, totaal_verkoop: 4210.1, totaal_inkoop: 3697.7, created_at: '2026-08-18T10:30:00Z', invoer: {}, uitkomst: {} },
  ];

  const PARTNER = {
    id: 'partner-nep', bedrijfsnaam: 'Vloerbedrijf Voorbeeld', kvk: '12345678', btw_nummer: 'NL000000000B00',
    adres: 'Voorbeeldweg 1', postcode: '6400 AA', plaats: 'Heerlen', email: 'info@voorbeeld.nl', telefoon: '045 1234567',
    iban: 'NL00 BANK 0123 4567 89', quote_prefix: 'OFF', factuur_prefix: 'FAC', betaaltermijn: 14,
    quote_counter: 4, factuur_counter: 3, logo_data: null, niveau: 'goud', levertijd: 'vijf tot zeven werkdagen na akkoord',
  };
  /* --vers: het account zoals het sinds 12-10-2026 begint, alleen een e-mailadres en brons. */
  if (vers) {
    Object.assign(PARTNER, {
      bedrijfsnaam: '', kvk: '', btw_nummer: '', adres: '', postcode: '', plaats: '', telefoon: '',
      iban: '', quote_counter: 1, factuur_counter: 1, logo_data: null, niveau: 'brons',
    });
  }

  const WERKREGELS = [
    { id: 'w1', naam: 'Vloer leggen', eenheid: 'm2', prijs: 22.5 },
    { id: 'w2', naam: 'Plinten plaatsen', eenheid: 'm', prijs: 8.5 },
    { id: 'w3', naam: 'Ondergrond egaliseren', eenheid: 'm2', prijs: 3.9 },
  ];

  const DOCUMENTEN = [
    { id: 'd1', soort: 'offerte', nummer: 'OFF-2026-002', bestandsnaam: 'offerte-OFF-2026-002-voorbeeld-bv.pdf', bytes: 41230, created_at: '2026-08-18T11:05:00Z' },
    { id: 'd2', soort: 'factuur', nummer: 'FAC-2026-001', bestandsnaam: 'factuur-FAC-2026-001-voorbeeld-bv.pdf', bytes: 38940, created_at: '2026-08-15T09:05:00Z' },
  ];

  /* Een klein maar echt PDF-bestand, zodat Ophalen in het archief een bestand oplevert dat opent.
     Er staat een regel in die vertelt dat het uit de dev-server komt. */
  const VOORBEELD_PDF = 'JVBERi0xLjQKMSAwIG9iajw8L1R5cGUvQ2F0YWxvZy9QYWdlcyAyIDAgUj4+ZW5kb2JqCjIgMCBvYmo8PC9UeXBlL1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDE+PmVuZG9iagozIDAgb2JqPDwvVHlwZS9QYWdlL1BhcmVudCAyIDAgUi9NZWRpYUJveFswIDAgNTk1IDg0Ml0vUmVzb3VyY2VzPDwvRm9udDw8L0YxIDQgMCBSPj4+Pi9Db250ZW50cyA1IDAgUj4+ZW5kb2JqCjQgMCBvYmo8PC9UeXBlL0ZvbnQvU3VidHlwZS9UeXBlMS9CYXNlRm9udC9IZWx2ZXRpY2E+PmVuZG9iago1IDAgb2JqPDwvTGVuZ3RoIDYyPj5zdHJlYW0KQlQgL0YxIDE4IFRmIDYwIDc2MCBUZCAoVmVyem9ubmVuIHZlbCB1aXQgZGUgZGV2LXNlcnZlcikgVGogRVQKZW5kc3RyZWFtIGVuZG9iagp0cmFpbGVyPDwvUm9vdCAxIDAgUj4+CiUlRU9GCg==';

  /* De prijslijst in de vorm die prijzen.ts teruggeeft. Verzonnen bedragen, want prijzen horen
     niet in git; ze staan hier alleen zodat de calculator iets te rekenen heeft. */
  const PRIJZEN = {
    niveau: 'goud',
    vloeren: [
      { art: 'VB-001', c: 'voorbeeld-dryback', d: 'Eiken Natuur', t: 'pvc-dry', pak: 3.34, pat: 'recht', pl: 'PL-WIT', lijm: 'JK26', adv: 44.95, h: 'voorbeeld-eiken-natuur', k: 43.7 },
      { art: 'VB-002', c: 'voorbeeld-dryback', d: 'Eiken Rustiek', t: 'pvc-dry', pak: 3.34, pat: 'visgraat', pl: 'PL-WIT', lijm: 'JK26', adv: 49.95, h: 'voorbeeld-eiken-rustiek', k: 30.6 },
      { art: 'VB-101', c: 'voorbeeld-klik', d: 'Grijs Eiken', t: 'pvc-click', pak: 2.2, pat: 'recht', pl: 'PL-WIT', lijm: null, adv: 39.95, h: 'voorbeeld-grijs-eiken', k: 36 },
      { art: 'VB-201', c: 'voorbeeld-laminaat', d: 'Licht Eiken', t: 'laminaat', pak: 2.47, pat: 'recht', pl: 'PL-WIT', lijm: null, adv: 24.95, h: 'voorbeeld-licht-eiken', k: 34.5 },
    ],
    toebehoren: [
      { code: 'JK26', soort: 'lijm', naam: 'JK26 LVT Designvloerlijm (14 kg emmer)', eenheid: 'emmer', inhoud: 14, verbruik: 0.35, adv: 92.5, incl: 111.93, vid: null, k: 34.8 },
      { code: 'JK01', soort: 'primer', naam: 'JK01 Dispersieprimer (10 kg)', eenheid: 'bus', inhoud: 10, verbruik: 0.15, adv: 38.5, incl: 46.59, vid: null, k: 34.8 },
      { code: 'JK10', soort: 'egaline', naam: 'JK10 Objectegaline (25 kg zak)', eenheid: 'zak', inhoud: 25, verbruik: 1.5, adv: 22.9, incl: 27.71, vid: null, k: 34.8 },
      { code: 'JK11', soort: 'egaline', naam: 'JK11 Vezelegaline (25 kg zak)', eenheid: 'zak', inhoud: 25, verbruik: 1.6, adv: 26.4, incl: 31.94, vid: null, k: 34.8 },
      { code: 'JK16', soort: 'egaline', naam: 'JK16 Sneldrogend (25 kg zak)', eenheid: 'zak', inhoud: 25, verbruik: 1.5, adv: 29.9, incl: 36.18, vid: null, k: 34.8 },
      { code: 'JK17', soort: 'egaline', naam: 'JK17 Buitenegaline (25 kg zak)', eenheid: 'zak', inhoud: 25, verbruik: 1.7, adv: 31.5, incl: 38.12, vid: null, k: 34.8 },
      { code: 'JK139', soort: 'ondervloer', naam: 'Ondervloer JK139+ Silent', eenheid: 'pak', inhoud: 10, verbruik: 1, adv: 64.5, incl: 78.05, vid: null, k: 49.9 },
      /* De plint staat in de echte prijslaag onder de vaste code PLINT, en de calculator zoekt hem
         ook zo op; een andere code hier gaf een plint zonder partnerkorting. */
      { code: 'PLINT', soort: 'plint', naam: 'Plint wit gegrond 12 x 70 mm (240 cm)', eenheid: 'stuk', inhoud: 2.4, verbruik: 1, adv: 12.95, incl: 15.67, vid: null, k: 34.8 },
    ],
  };

  /* De partnerprijs als bedrag, zoals de echte motor hem sinds 12-09-2026 meegeeft: per pak of per
     stuk inclusief btw, hier afgeleid uit de adviesprijs en het percentage hierboven. */
  PRIJZEN.vloeren.forEach((v, i) => { v.pp = Math.round(v.adv * v.pak * 1.21 * (1 - v.k / 100) * 100) / 100; v.vid = `gid://shopify/ProductVariant/9000000000${i + 1}`; });
  PRIJZEN.toebehoren.forEach((t, i) => { t.pp = Math.round(t.adv * 1.21 * (1 - t.k / 100) * 100) / 100; t.vid = `gid://shopify/ProductVariant/9100000000${i + 1}`; });

  /* leeg (12-10-2026): een account zoals het echt begint, zonder voorbeeldklussen, -klanten of
     -documenten, en zonder vaste werkregels. Voor de demofilm, die een nieuw account volgt van de
     aanmelding tot de eerste factuur. Alleen samen met vers zinvol. */
  if (leeg) {
    for (const lijst of [KLANTEN, PROJECTEN, INMETINGEN, OFFERTES, FACTUREN, BEREKENINGEN, DOCUMENTEN, WERKREGELS]) lijst.length = 0;
    for (const bak of [OFFERTEREGELS, FACTUURREGELS]) for (const k of Object.keys(bak)) delete bak[k];
  }

  /* ---------- de nagebouwde motor ---------- */

  const klantNaam = (id) => (KLANTEN.find((k) => k.id === id) ?? {}).naam ?? null;

  /* Een vaste tijdstempel voor wat er in deze sessie bij komt: nieuw werk hoort bovenaan te staan bij
     nieuwste eerst, en een echte klok in een dev-server maakt elke schermafdruk anders. */
  const NU = '2026-08-31T12:00:00Z';

  const projectRij = (p) => ({
    ...p,
    portal_measurements: INMETINGEN.filter((i) => i.project_id === p.id).map((i) => ({ id: i.id })),
    portal_quotes: OFFERTES.filter((o) => o.project_id === p.id).map((o) => ({ id: o.id, nummer: o.nummer, status: o.status })),
  });

  const inmetingRij = (i) => ({ ...i, klant_naam: klantNaam(i.customer_id) });

  /* Wat de partner heeft uitgezet. Dit leeft in het geheugen van dit proces: zonder dat springt elke
     schakel bij de eerstvolgende /mij weer aan en is er niets te zien van wat de knop doet. Weg bij
     een herstart, en dat is de bedoeling. */
  let MODULES_UIT = {};

  /* Verse id's. Tellen op de lengte van de lijst gaf dubbele id's zodra er iets verwijderd was. */
  const TELLERS = { project: 0, klant: 0, inmeting: 0, berekening: 0, offerte: 0, factuur: 0, document: 0, regel: 0 };

  /* Een document bevriezen bij het officieel worden, gelijk aan de echte motor (migration 0089):
     de klantgegevens uit de kaart en de afzendergegevens uit de partner, met een stempel erbij. */
  function bevriesDocument(doc) {
    doc.bevroren_op = NU;
    doc.afzender = {
      bedrijfsnaam: PARTNER.bedrijfsnaam ?? null, adres: PARTNER.adres ?? null,
      postcode: PARTNER.postcode ?? null, plaats: PARTNER.plaats ?? null,
      kvk: PARTNER.kvk ?? null, btw_nummer: PARTNER.btw_nummer ?? null,
      iban: PARTNER.iban ?? null, email: PARTNER.email ?? null,
      telefoon: PARTNER.telefoon ?? null, logo_data: PARTNER.logo_data ?? null,
    };
    if (doc.customer_id) {
      const k = KLANTEN.find((x) => x.id === doc.customer_id);
      if (k) { doc.klant_naam = k.naam; doc.klant_adres = k.adres; doc.klant_postcode = k.postcode; doc.klant_plaats = k.plaats; }
    }
  }

  /* De nep-documenten die al officieel zijn (verstuurd, gewonnen, betaald) dragen de
     afzender-momentopname vanaf het begin, zoals een echt document dat na migration 0089 de deur
     uitging. Zonder dit stond op elke nep-offerte de waarschuwing dat het document van voor het
     vastleggen van de bedrijfsgegevens is, en dat is een eigenschap van de nepdata, niet van het
     portaal. De datum van het bevriezen is de verzenddatum van het document. */
  for (const doc of [...OFFERTES, ...FACTUREN]) {
    if (doc.status === 'concept' || doc.afzender) continue;
    const was = doc.bevroren_op || doc.verstuurd_op || null;
    bevriesDocument(doc);
    if (was) doc.bevroren_op = was;
  }

  /* ---------- de rekenregels van de motor, hier nagebouwd ---------- */

  /* Deze staan gelijk aan supabase/functions/portaal/factuur.ts en aan de nummering in index.ts. Een
     dev-server die anders rekent dan de motor is erger dan geen dev-server: dan zoek je een fout die
     alleen in de namaak zit. */

  const getal = (v) => { const n = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };
  const centen = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

  /* Het volgnummer uit de eigen reeks van de partner, met de teller die daarna een stap opschuift. */
  function volgnummer(soort) {
    const jaar = NU.slice(0, 4);
    const tellerVeld = soort === 'quote' ? 'quote_counter' : 'factuur_counter';
    const prefixVeld = soort === 'quote' ? 'quote_prefix' : 'factuur_prefix';
    const teller = Number(PARTNER[tellerVeld] ?? 1);
    PARTNER[tellerVeld] = teller + 1;
    return `${PARTNER[prefixVeld] ?? (soort === 'quote' ? 'OFF' : 'FAC')}-${jaar}-${String(teller).padStart(3, '0')}`;
  }

  /* Een factuurregel netjes maken. Een leeg tarief is niet hetzelfde als nul procent: nul moet
     expliciet meegegeven worden en blijft dan ook nul. */
  function stukprijsUit(aantal, bedrag, opgegeven = null) {
    if (aantal === null || !(aantal > 0)) return opgegeven;
    const prijs = opgegeven ?? centen(bedrag / aantal);
    return prijs > 0 && centen(aantal * prijs) === bedrag ? prijs : null;
  }

  function regelUitInvoer(invoer, volgorde) {
    const aantal = invoer.aantal === null || invoer.aantal === undefined ? null : getal(invoer.aantal);
    const opgegeven = invoer.prijs === null || invoer.prijs === undefined ? null : getal(invoer.prijs);
    const bedrag = invoer.bedrag === null || invoer.bedrag === undefined
      ? centen((aantal ?? 0) * (opgegeven ?? 0))
      : centen(getal(invoer.bedrag));
    /* De stukprijs staat er alleen op als hij terugvermenigvuldigt tot het bedrag, net als in de motor. */
    const prijs = stukprijsUit(aantal, bedrag, opgegeven === null ? null : centen(opgegeven));
    const tarief = invoer.btw_tarief === null || invoer.btw_tarief === undefined || invoer.btw_tarief === ''
      ? 21 : getal(invoer.btw_tarief);
    const soort = ['materiaal', 'werk', 'meerwerk'].includes(String(invoer.soort)) ? String(invoer.soort) : 'materiaal';
    return {
      volgorde, soort,
      omschrijving: String(invoer.omschrijving ?? '').trim() || 'Zonder omschrijving',
      aantal, eenheid: invoer.eenheid ?? null, prijs, bedrag, btw_tarief: tarief,
      quote_line_id: invoer.quote_line_id ?? null,
    };
  }

  /* Per regel op centen afronden en pas daarna optellen, en de btw per tarief in plaats van per
     regel. Anders klopt de uitsplitsing niet met wat er in de aangifte komt. */
  function totalenVan(regels) {
    const perTarief = new Map();
    let subtotaal = 0;
    regels.forEach((r) => {
      subtotaal = centen(subtotaal + r.bedrag);
      perTarief.set(r.btw_tarief, centen((perTarief.get(r.btw_tarief) ?? 0) + r.bedrag));
    });
    const specificatie = [...perTarief.entries()].sort((a, b) => a[0] - b[0])
      .map(([tarief, grondslag]) => ({ tarief, grondslag, btw: centen(grondslag * tarief / 100) }));
    const btwBedrag = specificatie.reduce((s, r) => centen(s + r.btw), 0);
    return { subtotaal, btw_bedrag: btwBedrag, totaal: centen(subtotaal + btwBedrag), btw_specificatie: specificatie };
  }

  function vervaldatumVan(factuurdatum, termijnDagen) {
    const d = new Date(factuurdatum + 'T00:00:00Z');
    if (Number.isNaN(d.getTime())) return factuurdatum;
    d.setUTCDate(d.getUTCDate() + (Number.isFinite(termijnDagen) ? termijnDagen : 14));
    return d.toISOString().slice(0, 10);
  }

  /* De instellingen en werkzaamheden per inmeting (fase C), zoals de kaart ze stuurt: per niveau
     een rij per sleutel of taak. Onthouden zolang de server draait, zodat een kaart na het bewaren
     met dezelfde keuzes opnieuw opent. De verdiepingen horen erbij. */
  const RIJEN = {};

  function bewaarRijen(body, inmeting) {
    const rijen = [];
    const taken = [];
    const zet = (niveau, niveauId, bron) => {
      (bron?.instellingen ?? []).forEach((r) => rijen.push({ niveau, niveau_id: niveauId, sleutel: r.sleutel, waarde: r.waarde }));
      (bron?.taken ?? []).forEach((t) => taken.push({ niveau, niveau_id: niveauId, taak: t.taak, staat: t.staat }));
    };
    zet('inmeting', inmeting.id, body);
    const zones = (body?.zones ?? []).map((z, i) => ({ id: z.id ?? `z${inmeting.id}-${i}`, key: z.key ?? null, naam: z.naam ?? '', volgorde: i }));
    zones.forEach((z, i) => zet('zone', z.id, body.zones[i]));
    (body?.ruimtes ?? []).forEach((r, i) => {
      const kamer = inmeting.portal_measurement_rooms[i];
      if (!kamer) return;
      const zone = r.zone_id ? zones.find((z) => z.id === r.zone_id) : r.zone_key ? zones.find((z) => z.key === r.zone_key) : null;
      kamer.zone_id = zone ? zone.id : null;
      zet('ruimte', kamer.id, r);
    });
    RIJEN[inmeting.id] = { rijen, taken, zones: zones.map(({ id, naam, volgorde }) => ({ id, naam, volgorde })) };
  }

  /* Het voorstel van de motor voor een inmeting (fase C5), in de vorm die de calculator leest: een
     rekengroep per inmeting met de vloersoort en het legpatroon uit de bewaarde rijen (of uit de oude
     vaststelling), en de werkregels leggen en plinten. De echte motor resolvet dit per ruimte en per
     vloer; hier is een groep genoeg om het scherm te tonen. Nodig voor Doorrekenen vanuit een
     inmeting, dus ook voor de rondleiding van de toonbank (14-09-2026). */
  function voorstelVanInmeting(inmetingId) {
    const inmeting = INMETINGEN.find((i) => i.id === inmetingId);
    if (!inmeting) return { fout: 'Deze inmeting bestaat niet.', status: 404 };
    /* Met de rekenregels van de echte motor en een inmeting die hier bewaard is: per vloer een groep
       en de werkregels uit de checklist, net als op live (index.ts, de route voorstel). De verzonnen
       inmetingen uit het begin hebben geen rijen; die houden het eenvoudige voorstel hieronder. */
    if (reken && RIJEN[inmeting.id]) {
      const bak = RIJEN[inmeting.id];
      const voorCalc = (inmeting.portal_measurement_rooms ?? []).map((k) => ({
        id: k.id, naam: k.naam ?? null, zone_id: k.zone_id ?? null, oppervlak: Number(k.oppervlak ?? 0), plint_meters: Number(k.omtrek ?? 0),
      }));
      const zoneNamen = Object.fromEntries((bak.zones ?? []).map((z) => [z.id, z.naam]));
      const groepen = reken.groepeer(voorCalc, bak.rijen, inmeting.id, zoneNamen);
      const werk = reken.werkregels(voorCalc, bak.rijen, bak.taken, inmeting.id, { plinten: 'm', plintenweg: 'm' });
      return {
        inmeting: { id: inmeting.id, inhoud_versie: 1 },
        groepen: groepen.map((g) => ({ ...g, herkomst: 'inmeting' })),
        werk: werk.map((w) => ({ ...w, herkomst: 'inmeting' })),
      };
    }
    const rijen = (RIJEN[inmeting.id]?.rijen ?? []);
    const rij = (sleutel) => rijen.find((r) => r.niveau === 'inmeting' && r.sleutel === sleutel)?.waarde;
    const kamers = inmeting.portal_measurement_rooms ?? [];
    const vast = inmeting.vaststelling ?? {};
    const vloersoort = rij('vloer.soort') ?? vast.vloersoort ?? null;
    const legpatroon = rij('vloer.legpatroon') ?? vast.legpatroon ?? kamers.find((k) => k.legpatroon)?.legpatroon ?? 'recht';
    const werk = [{ omschrijving: 'Vloer leggen', aantal: inmeting.totaal_m2, eenheid: 'm2', herkomst: 'inmeting' }];
    if (inmeting.totaal_omtrek > 0) werk.push({ omschrijving: 'Plinten plaatsen', aantal: inmeting.totaal_omtrek, eenheid: 'm', herkomst: 'inmeting' });
    return {
      inmeting: { id: inmeting.id, inhoud_versie: 1 },
      groepen: [{
        sleutel: '__een', naam: 'De vloer', oppervlak: inmeting.totaal_m2, plint_meters: inmeting.totaal_omtrek,
        legpatroon, vloersoort, bron: 'framr', product: null, band_bies: /visgraat|chevron/.test(String(legpatroon)),
        herkomst: 'inmeting', room_ids: kamers.map((k) => k.id),
      }],
      werk,
    };
  }

  function rijenVan(id) {
    const bak = RIJEN[id] ?? { rijen: [], taken: [], zones: [] };
    return { registry: registry, rijen: bak.rijen, taken: bak.taken, opname: { instellingen: {}, taken: {} }, per_ruimte: {}, per_zone: {}, zones: bak.zones };
  }

  /* Een inmeting bouwen uit wat het scherm stuurt. Gebruikt bij zowel aanmaken als bewaren, want de
     echte motor doet allebei met dezelfde opbouw: de ruimtes worden opnieuw weggeschreven en de
     totalen worden op de server nagerekend. */
  function bouwInmeting(body, id) {
    const vorige = INMETINGEN.find((x) => x.id === id);
    const ruimtes = (body?.ruimtes ?? []).map((r, i) => {
      const l = getal(r.lengte); const b = getal(r.breedte);
      /* De vlakken (een nis erbij, een trapgat eraf): meegestuurd als hij eraan zat, anders blijft
         staan wat er stond, zoals in de echte motor. */
      const vlakken = Array.isArray(r.vlakken) ? (reken ? reken.vlakkenUitInvoer(r.vlakken) : r.vlakken)
        : (vorige?.portal_measurement_rooms?.[i]?.vlakken ?? []);
      /* Met de hand gezette meters winnen van de maten, net als in de echte motor (nettoOppervlak en
         plintMeters in inmeting.ts, migration 0114). Leeg is niet gezet; nul is de keuze dat er geen
         plint komt, dus hier wordt op null gekeken en niet op waarheid. */
      const gezet = (w) => w !== null && w !== undefined && String(w).trim() !== '';
      const oppervlak = reken
        ? reken.nettoOppervlak({ lengte: l, breedte: b, aftrek: getal(r.aftrek), oppervlak_handmatig: gezet(r.oppervlak_handmatig) ? r.oppervlak_handmatig : null }, vlakken).oppervlak
        : gezet(r.oppervlak_handmatig)
          ? Math.max(0, getal(r.oppervlak_handmatig))
          : Math.max(0, l * b - getal(r.aftrek));
      const plint = gezet(r.plint_handmatig)
        ? Math.max(0, getal(r.plint_handmatig))
        : Math.max(0, 2 * (l + b) - getal(r.plint_eraf));
      return {
        id: `r${id}-${i}`, volgorde: i, naam: r.naam ?? null, lengte: l, breedte: b,
        aftrek: getal(r.aftrek), plint_eraf: getal(r.plint_eraf),
        oppervlak_handmatig: gezet(r.oppervlak_handmatig) ? getal(r.oppervlak_handmatig) : null,
        plint_handmatig: gezet(r.plint_handmatig) ? getal(r.plint_handmatig) : null,
        oppervlak: centen(oppervlak),
        omtrek: centen(plint),
        vloer_naam: r.vloer_naam ?? null, vloer_handle: r.vloer_handle ?? null, legpatroon: r.legpatroon ?? null,
        vlakken,
      };
    });
    return {
      id,
      naam: body?.naam ?? null,
      project_id: body?.project_id ?? null,
      customer_id: body?.klant_id ?? null,
      gemeten_op: NU.slice(0, 10),
      notitie: body?.notitie ?? null,
      vaststelling: body?.vast ?? {},
      afspraken: body?.afspraken ?? {},
      checklist: body?.checklist ?? [],
      /* Het eigen werk zoals de kaart het stuurt (eigen_werk), als werkregels met eigen: true, net als
         de echte motor (eigenWerkUitBody in index.ts); de calculator en de offerte lezen het daar. */
      werkregels: body && 'eigen_werk' in body
        ? (Array.isArray(body.eigen_werk) ? body.eigen_werk : []).filter((w) => String(w?.omschrijving ?? '').trim())
          .map((w) => ({ omschrijving: String(w.omschrijving).trim(), aantal: getal(w.aantal) || 1, eenheid: w.eenheid || 'vast', prijs: getal(w.prijs) || 0, eigen: true }))
        : (body?.werkregels ?? vorige?.werkregels ?? []),
      kozijnen: body?.kozijnen ?? [],
      totaal_m2: centen(ruimtes.reduce((s, r) => s + r.oppervlak, 0)),
      totaal_omtrek: centen(ruimtes.reduce((s, r) => s + r.omtrek, 0)),
      portal_measurement_rooms: ruimtes,
    };
  }

  /* Antwoord op een motorroute. Verder alleen lezen: schrijven bevestigt zonder iets te onthouden,
     want deze server is er om schermen te bekijken en niet om een tweede database te worden. */
  function nepMotor(pad, methode, body, zoek = {}) {
    const delen = pad.split('?')[0].split('/').filter(Boolean);
    const onderdeel = delen[0];
    const id = delen[1] ?? null;

    if (methode !== 'GET') {
      if (onderdeel === 'mij') {
        if (body && typeof body.modules === 'object' && body.modules !== null) MODULES_UIT = body.modules;
        ['bedrijfsnaam', 'kvk', 'btw_nummer', 'adres', 'postcode', 'plaats', 'email', 'telefoon',
          'iban', 'quote_prefix', 'factuur_prefix', 'logo_data'].forEach((v) => {
          if (body && v in body) PARTNER[v] = body[v];
        });
        ['betaaltermijn', 'quote_counter', 'factuur_counter'].forEach((v) => {
          if (body && v in body) {
            const n = Math.floor(Number(body[v]));
            if (Number.isFinite(n) && n >= 1) PARTNER[v] = n;
          }
        });
        return { partner: { ...PARTNER, modules: MODULES_UIT } };
      }

      if (onderdeel === 'projecten') {
        if (methode === 'POST') {
          const nieuw = {
            id: 'p' + (++TELLERS.project) + 'x', naam: body?.naam ?? 'Zonder naam',
            customer_id: body?.klant_id ?? null, status: 'open',
            werkadres: body?.werkadres ?? null, postcode: body?.postcode ?? null, plaats: body?.plaats ?? null,
            notitie: null, stappen: {}, created_at: NU,
          };
          PROJECTEN.unshift(nieuw);
          return { project: projectRij(nieuw) };
        }
        const staat = PROJECTEN.find((x) => x.id === id);
        if (!staat) return { fout: 'Deze klus bestaat niet.', status: 404 };
        /* Een klus verwijderen laat zijn inhoud staan; in het schema is dat set null. */
        if (methode === 'DELETE') {
          PROJECTEN.splice(PROJECTEN.indexOf(staat), 1);
          [...INMETINGEN, ...OFFERTES, ...FACTUREN, ...BEREKENINGEN].forEach((r) => {
            if (r.project_id === id) r.project_id = null;
          });
          return { weg: true };
        }
        if (methode === 'PATCH') {
          if (body?.naam !== undefined) staat.naam = body.naam;
          if (body?.status !== undefined) staat.status = body.status;
          if (body?.customer_id !== undefined) staat.customer_id = body.customer_id;
          if (body?.stappen !== undefined) staat.stappen = body.stappen;
          ['werkadres', 'postcode', 'plaats', 'notitie'].forEach((v) => { if (body?.[v] !== undefined) staat[v] = body[v]; });
          return { project: projectRij(staat) };
        }
      }

      if (onderdeel === 'klanten') {
        if (methode === 'POST') {
          const nieuw = { id: 'k' + (++TELLERS.klant) + 'x', naam: body?.naam ?? 'Zonder naam',
            contact: body?.contact ?? null, telefoon: body?.telefoon ?? null, email: body?.email ?? null,
            adres: body?.adres ?? null, postcode: body?.postcode ?? null, plaats: body?.plaats ?? null, notitie: null };
          KLANTEN.push(nieuw);
          return { klant: nieuw };
        }
        const staat = KLANTEN.find((x) => x.id === id);
        if (!staat) return { fout: 'Deze klant bestaat niet.', status: 404 };
        /* De kaart verdwijnt, de klussen en offertes blijven staan en raken hun verwijzing kwijt. */
        if (methode === 'DELETE') {
          KLANTEN.splice(KLANTEN.indexOf(staat), 1);
          [...PROJECTEN, ...INMETINGEN, ...OFFERTES, ...FACTUREN].forEach((r) => {
            if (r.customer_id === id) r.customer_id = null;
          });
          return { weg: true };
        }
        if (methode === 'PATCH') { Object.assign(staat, body ?? {}); return { klant: staat }; }
      }

      if (onderdeel === 'inmetingen') {
        if (methode === 'POST') {
          const nieuw = bouwInmeting(body, 'i' + (++TELLERS.inmeting) + 'x');
          INMETINGEN.unshift(nieuw);
          bewaarRijen(body, nieuw);
          return { inmeting: inmetingRij(nieuw) };
        }
        const staat = INMETINGEN.find((x) => x.id === id);
        if (!staat) return { fout: 'Deze inmeting bestaat niet.', status: 404 };
        if (methode === 'DELETE') { INMETINGEN.splice(INMETINGEN.indexOf(staat), 1); return { weg: true }; }
        if (methode === 'PATCH') {
          /* Een losse PATCH die alleen de klus of de klant verzet (uit deze klus halen), tegenover
             het bewaren van de hele kaart. De echte motor doet allebei op deze route. */
          const alleenKoppeling = body && !('ruimtes' in body) && !('vast' in body) && !('naam' in body);
          if (alleenKoppeling) {
            if ('project_id' in body) staat.project_id = body.project_id;
            if ('klant_id' in body) staat.customer_id = body.klant_id;
            return { inmeting: inmetingRij(staat) };
          }
          const bij = bouwInmeting(body, staat.id);
          INMETINGEN[INMETINGEN.indexOf(staat)] = bij;
          bewaarRijen(body, bij);
          return { inmeting: inmetingRij(bij) };
        }
      }

      if (onderdeel === 'berekeningen') {
        if (methode === 'POST') {
          const nieuw = {
            id: 'b' + (++TELLERS.berekening) + 'x',
            naam: body?.naam ?? 'Berekening',
            project_id: body?.project_id ?? null,
            measurement_id: body?.inmeting_id ?? null,
            oppervlak_m2: getal(body?.oppervlak_m2),
            totaal_advies: getal(body?.totaal_advies),
            totaal_verkoop: getal(body?.totaal_verkoop),
            totaal_inkoop: getal(body?.totaal_inkoop),
            invoer: body?.invoer ?? {}, uitkomst: body?.uitkomst ?? {}, created_at: NU,
          };
          BEREKENINGEN.unshift(nieuw);
          return { berekening: nieuw };
        }
        const staat = BEREKENINGEN.find((b) => b.id === id);
        if (!staat) return { fout: 'Deze berekening bestaat niet.', status: 404 };
        if (methode === 'DELETE') { BEREKENINGEN.splice(BEREKENINGEN.indexOf(staat), 1); return { weg: true }; }
        if (methode === 'PATCH') {
          if ('project_id' in body) staat.project_id = body.project_id;
          return { berekening: staat };
        }
      }

      if (onderdeel === 'offertes') {
        if (methode === 'POST') {
          const nieuw = {
            ...(body ?? {}),
            id: 'o' + (++TELLERS.offerte) + 'x',
            nummer: volgnummer('quote'),
            customer_id: body?.klant_id ?? null,
            versie: 1, status: 'concept', created_at: NU,
          };
          delete nieuw.regels;
          delete nieuw.klant_id;
          OFFERTES.unshift(nieuw);
          OFFERTEREGELS[nieuw.id] = (body?.regels ?? []).map((r, i) => ({
            ...r, id: 'ol' + (++TELLERS.regel) + 'x', quote_id: nieuw.id, volgorde: i,
          }));
          return { offerte: nieuw };
        }
        const staat = OFFERTES.find((o) => o.id === id);
        if (!staat) return { fout: 'Deze offerte bestaat niet.', status: 404 };
        if (methode === 'DELETE') {
          OFFERTES.splice(OFFERTES.indexOf(staat), 1);
          delete OFFERTEREGELS[id];
          /* Facturen blijven staan en raken alleen hun verwijzing kwijt (set null in het schema). */
          FACTUREN.forEach((f) => { if (f.quote_id === id) f.quote_id = null; });
          return { weg: true };
        }
        if (methode === 'PATCH') {
          const toegestaan = ['concept', 'verstuurd', 'gewonnen', 'verloren', 'verlopen', 'besteld'];
          /* De inhoud mag alleen zolang hij concept is; daarna is wijzigen een nieuwe versie. */
          if (Array.isArray(body.regels)) {
            if (staat.status !== 'concept') {
              return { fout: 'Deze offerte is al verstuurd. Maak er een kopie van als je hem wilt wijzigen.', status: 409 };
            }
            ['klant_naam', 'klant_adres', 'klant_postcode', 'klant_plaats', 'project',
              'materiaal_advies', 'materiaal_verkoop', 'materiaal_inkoop', 'werk_totaal',
              'subtotaal', 'btw_bedrag', 'totaal', 'berekening', 'geldig_tot'].forEach((v) => {
              if (v in body) staat[v] = body[v];
            });
            if ('klant_id' in body) staat.customer_id = body.klant_id ?? null;
            OFFERTEREGELS[staat.id] = body.regels.map((r, i) => ({
              ...r, id: 'ol' + (++TELLERS.regel) + 'x', quote_id: staat.id, volgorde: i,
            }));
          }
          if ('status' in body) {
            if (!toegestaan.includes(String(body.status))) return { fout: 'Onbekende status.', status: 400 };
            const wordtOfficieel = body.status !== 'concept' && staat.status === 'concept';
            staat.status = body.status;
            if (body.status === 'verstuurd') staat.verstuurd_op = NU;
            if (body.status === 'gewonnen' || body.status === 'verloren') staat.beslist_op = NU;
            if (wordtOfficieel) bevriesDocument(staat);
          }
          if ('project_id' in body) staat.project_id = body.project_id;
          return { offerte: staat };
        }
      }

      if (onderdeel === 'facturen') {
        if (methode === 'POST') {
          const regels = (body?.regels ?? []).map((r, i) => regelUitInvoer(r, i));
          const som = totalenVan(regels);
          const factuurdatum = NU.slice(0, 10);
          const klant = KLANTEN.find((k) => k.id === body?.klant_id);
          const nieuw = {
            id: 'f' + (++TELLERS.factuur) + 'x',
            nummer: volgnummer('factuur'),
            soort: body?.soort ?? 'materiaal',
            status: 'concept',
            project_id: body?.project_id ?? null,
            quote_id: body?.quote_id ?? null,
            customer_id: body?.klant_id ?? null,
            klant_naam: body?.klant_naam ?? klant?.naam ?? null,
            klant_adres: body?.klant_adres ?? klant?.adres ?? null,
            klant_postcode: body?.klant_postcode ?? klant?.postcode ?? null,
            klant_plaats: body?.klant_plaats ?? klant?.plaats ?? null,
            omschrijving: body?.omschrijving ?? null,
            iban: PARTNER.iban, betaalkenmerk: null,
            factuurdatum,
            vervaldatum: vervaldatumVan(factuurdatum, PARTNER.betaaltermijn ?? 14),
            ...som,
            betaald_op: null, verstuurd_op: null, notitie: null, created_at: NU,
          };
          FACTUREN.unshift(nieuw);
          FACTUURREGELS[nieuw.id] = regels.map((r) => ({ ...r, id: 'fl' + (++TELLERS.regel) + 'x', invoice_id: nieuw.id }));
          return { factuur: nieuw };
        }
        const staat = FACTUREN.find((f) => f.id === id);
        if (!staat) return { fout: 'Deze factuur bestaat niet.', status: 404 };
        if (methode === 'DELETE') {
          /* Een verstuurde factuur weggooien kan niet: een factuurreeks hoort aaneengesloten te
             zijn, en wat er bij een klant ligt hoort hier ook te staan. */
          if (staat.status !== 'concept') return { fout: 'Een verstuurde factuur kun je niet verwijderen.', status: 409 };
          FACTUREN.splice(FACTUREN.indexOf(staat), 1);
          delete FACTUURREGELS[id];
          return { weg: true };
        }
        if (methode === 'PATCH') {
          const toegestaan = ['concept', 'verstuurd', 'betaald', 'vervallen'];
          if ('status' in body) {
            if (!toegestaan.includes(String(body.status))) return { fout: 'Onbekende status.', status: 400 };
            const wordtOfficieel = body.status !== 'concept' && staat.status === 'concept';
            staat.status = body.status;
            if (body.status === 'verstuurd') staat.verstuurd_op = NU;
            if (body.status === 'betaald' && !body.betaald_op) staat.betaald_op = NU.slice(0, 10);
            if (wordtOfficieel) bevriesDocument(staat);
          }
          ['betaald_op', 'notitie', 'project_id'].forEach((v) => { if (body && v in body) staat[v] = body[v]; });
          return { factuur: staat };
        }
      }

      if (onderdeel === 'documenten') {
        if (methode === 'POST') {
          const nieuw = {
            id: 'd' + (++TELLERS.document) + 'x',
            soort: body?.soort ?? 'offerte', nummer: body?.nummer ?? null,
            bestandsnaam: body?.bestandsnaam ?? 'document.pdf', mediatype: 'application/pdf',
            bytes: Math.round(String(body?.inhoud ?? '').length * 0.75),
            quote_id: body?.quote_id ?? null, invoice_id: body?.invoice_id ?? null,
            project_id: body?.project_id ?? null, created_at: NU,
          };
          DOCUMENTEN.unshift(nieuw);
          return { document: nieuw };
        }
        const staat = DOCUMENTEN.find((d) => d.id === id);
        if (!staat) return { fout: 'Dit document bestaat niet.', status: 404 };
        if (methode === 'DELETE') { DOCUMENTEN.splice(DOCUMENTEN.indexOf(staat), 1); return { weg: true }; }
      }

      return { fout: `onbekend adres ${methode} ${pad}`, status: 404 };
    }

    switch (onderdeel) {
      case 'mij': return { partner: { ...PARTNER, modules: MODULES_UIT }, werkregels: WERKREGELS };
      case 'prijzen': return PRIJZEN;
      case 'projecten': {
        if (!id) return { projecten: PROJECTEN.map(projectRij) };
        const project = PROJECTEN.find((p) => p.id === id);
        return project ? { project: projectRij(project) } : { fout: 'Deze klus bestaat niet.', status: 404 };
      }
      case 'registry': return registry ?? { fout: 'De registry van de motor is hier niet geladen.', status: 500 };
      case 'inmetingen': {
        if (!id) return { inmetingen: INMETINGEN.map(inmetingRij) };
        const inmeting = INMETINGEN.find((i) => i.id === id);
        if (!inmeting) return { fout: 'Deze inmeting bestaat niet.', status: 404 };
        if (delen[2] === 'instellingen') return rijenVan(id);
        return { inmeting: inmetingRij(inmeting) };
      }
      case 'berekeningen': {
        if (!id) return { berekeningen: BEREKENINGEN };
        if (id === 'voorstel') return voorstelVanInmeting(zoek.inmeting);
        const berekening = BEREKENINGEN.find((b) => b.id === id);
        return berekening ? { berekening } : { fout: 'Deze berekening bestaat niet.', status: 404 };
      }
      case 'offertes': {
        if (!id) return { offertes: OFFERTES };
        const offerte = OFFERTES.find((o) => o.id === id);
        if (!offerte) return { fout: 'Deze offerte bestaat niet.', status: 404 };
        if (delen[2] === 'te-factureren') {
          /* Welke offerteregels al op een factuur staan. De motor kijkt daarvoor naar
             portal_invoice_lines.quote_line_id; hier doet de nagebouwde motor hetzelfde, anders is
             de restfactuur-bewaking niet te beoordelen. */
          const gefactureerd = new Set(
            Object.values(FACTUURREGELS).flat().map((r) => r.quote_line_id).filter(Boolean),
          );
          return {
            offerte,
            regels: (OFFERTEREGELS[offerte.id] ?? [])
              .slice().sort((a, b) => (a.volgorde ?? 0) - (b.volgorde ?? 0))
              .map((r) => ({ ...r, gefactureerd: gefactureerd.has(r.id) })),
          };
        }
        return { offerte: { ...offerte, portal_quote_lines: OFFERTEREGELS[offerte.id] ?? [] } };
      }
      case 'facturen': {
        /* De lijst draagt de regels mee, zoals de motor (select met portal_invoice_lines); de
           PDF-knop leest de factuur uit de lijst en tekende hier anders een leeg vel. */
        if (!id) return { facturen: FACTUREN.map((f) => ({ ...f, portal_invoice_lines: FACTUURREGELS[f.id] ?? [] })) };
        const factuur = FACTUREN.find((f) => f.id === id);
        if (!factuur) return { fout: 'Deze factuur bestaat niet.', status: 404 };
        return { factuur: { ...factuur, portal_invoice_lines: FACTUURREGELS[factuur.id] ?? [] } };
      }
      case 'klanten': {
        if (!id) return { klanten: KLANTEN };
        const klant = KLANTEN.find((k) => k.id === id);
        if (!klant) return { fout: 'Deze klant bestaat niet.', status: 404 };
        return {
          klant,
          projecten: PROJECTEN.filter((p) => p.customer_id === klant.id).map(projectRij),
          inmetingen: INMETINGEN.filter((i) => i.customer_id === klant.id).map(inmetingRij),
          offertes: OFFERTES.filter((o) => o.customer_id === klant.id),
          facturen: FACTUREN.filter((f) => f.customer_id === klant.id),
        };
      }
      case 'bestellingen': return { bestellingen: [] };
      case 'documenten': {
        if (!id) return { documenten: DOCUMENTEN };
        const doc = DOCUMENTEN.find((d) => d.id === id);
        if (!doc) return { fout: 'Dit document bestaat niet.', status: 404 };
        return { document: { ...doc, mediatype: 'application/pdf', inhoud: VOORBEELD_PDF } };
      }
      default: return { fout: `onbekend adres ${pad}` };
    }
  }

  /* ---------- de stand, voor de proefstand in de browser ---------- */

  /* Alles wat in deze instantie kan veranderen, als een platte kopie om weg te zetten (de
     proefstand bewaart hem in sessionStorage zolang het tabblad open is) en weer terug te laden.
     De lijsten worden ter plekke gevuld, want de functies hierboven houden ze bij naam vast. */
  const LIJSTEN = { KLANTEN, PROJECTEN, INMETINGEN, OFFERTES, FACTUREN, BEREKENINGEN, DOCUMENTEN, WERKREGELS };
  const BAKKEN = { OFFERTEREGELS, FACTUURREGELS, RIJEN, TELLERS, PARTNER };

  function stand() {
    return JSON.parse(JSON.stringify({ ...LIJSTEN, ...BAKKEN, MODULES_UIT }));
  }

  function laad(bewaard) {
    if (!bewaard || typeof bewaard !== 'object') return;
    for (const [naam, lijst] of Object.entries(LIJSTEN)) {
      if (!Array.isArray(bewaard[naam])) continue;
      lijst.length = 0;
      lijst.push(...bewaard[naam]);
    }
    for (const [naam, bak] of Object.entries(BAKKEN)) {
      if (!bewaard[naam] || typeof bewaard[naam] !== 'object') continue;
      for (const sleutel of Object.keys(bak)) delete bak[sleutel];
      Object.assign(bak, bewaard[naam]);
    }
    if (bewaard.MODULES_UIT && typeof bewaard.MODULES_UIT === 'object') MODULES_UIT = bewaard.MODULES_UIT;
  }

  return { aanroep: nepMotor, stand, laad };
}
