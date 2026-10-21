/*
  De registry van instellingen en werkzaamheden, en de resolver die eroverheen leest.

  Dit is de ene plek waar staat welke instellingen bestaan. Zonder deze lijst wordt
  portal_measurement_settings een vuilnisbak van losse sleutels, en dat is precies wat we niet
  willen (besluit Jelle 02-09-2026). De motor weigert een sleutel die hier niet staat.

  Twee soorten, en die worden bewust niet door elkaar getrokken:

    TAAK     gebeurt dit werk wel of niet.        egaliseren = aan
    SETTING  hoe wordt dat werk uitgevoerd.       egaliseren.laagdikte_mm = 3

  Staat een taak uit, dan doen zijn instellingen niets. De calculator bepaalt dus eerst welke
  taken aanstaan en leest daarna pas de instellingen die daarbij horen.

  Overerving werkt per eigenschap, niet per niveau. Een ruimte die alleen zijn vloer overschrijft
  blijft de ondergrond van zijn zone volgen, ook als die zone later verandert. Er wordt nooit iets
  gekopieerd: de resolver loopt bij elke vraag de keten opnieuw af, zodat een ruimte die naar een
  andere zone verhuist vanzelf de waarden van die nieuwe zone erft.

  Drie toestanden per sleutel:

    geen rij            erven van een niveau hoger, en anders de standaard hieronder
    rij met een waarde  eigen keuze, stopt de erving
    rij met een lege     expliciet leeg, alleen waar de registry dat toestaat

  Het onderscheid zit in het bestaan van de rij, niet in de vorm van de leegte. Dat is bewust:
  een eerdere opzet wilde JSON null in een NOT NULL-kolom, maar een client stuurt null als SQL
  NULL en dan werd de rij helemaal niet weggeschreven, waarna de instelling stilzwijgend terugviel
  op de geerfde waarde (gevonden 02-09-2026 in de C1-regressieset).

  Die derde is bewust niet overal toegestaan. Bij een boolean is `false` de echte waarde en niet
  "leeg"; bij een productverwijzing betekent leeg wel iets, namelijk: hier bewust geen product,
  ook al staat er op de verdieping wel een. De registry bepaalt dat per sleutel in plaats van er
  een technische truc overheen te leggen.
*/

                                                    

                          
                  
                                                              
                
                    
                                                                                                
                                                                       
                    
                     
                                                                               
                   
                                               
               
               
                    
  

const ALLE           = ['inmeting', 'zone', 'ruimte'];

/* De zes vaststel-vragen die de inmeetkaart al kent, nu met een naamruimte ervoor, plus wat er
   bij hoort om per ruimte te kunnen afwijken. De waarden zijn ongewijzigd overgenomen zodat de
   bestaande inmetingen er zonder vertaling in passen. */
export const INSTELLINGEN               = [
  {
    sleutel: 'ondergrond.type',
    soort: 'enum',
    label: 'Ondergrond',
    categorie: 'De vloer eronder',
    niveaus: ALLE,
    standaard: null,
    leegMag: false,
    opties: [
      { waarde: 'beton', label: 'Beton' },
      { waarde: 'anhydriet', label: 'Anhydriet' },
      { waarde: 'zandcement', label: 'Zandcement' },
      { waarde: 'hout', label: 'Houten vloer' },
      { waarde: 'tegels', label: 'Tegels' },
      { waarde: 'oud', label: 'Oude pvc of laminaat' },
    ],
  },
  {
    sleutel: 'ondergrond.vlakheid',
    soort: 'enum',
    label: 'Hoe vlak ligt het',
    categorie: 'De vloer eronder',
    niveaus: ALLE,
    standaard: null,
    leegMag: false,
    opties: [
      { waarde: 'goed', label: 'Goed' },
      { waarde: 'licht', label: 'Licht onvlak' },
      { waarde: 'slecht', label: 'Slecht' },
    ],
  },
  {
    sleutel: 'ondergrond.vloerverwarming',
    soort: 'ja-nee',
    label: 'Vloerverwarming',
    categorie: 'De vloer eronder',
    niveaus: ALLE,
    standaard: false,
    leegMag: false,
  },
  {
    sleutel: 'woning.soort',
    soort: 'enum',
    label: 'Wat voor woning',
    categorie: 'De woning',
    niveaus: ['inmeting', 'zone'],
    standaard: null,
    leegMag: false,
    opties: [
      { waarde: 'na94', label: 'Woning na 1994' },
      { waarde: 'voor94', label: 'Woning voor 1994' },
      { waarde: 'vve', label: 'Appartement met VvE' },
    ],
  },
  {
    sleutel: 'vloer.soort',
    soort: 'enum',
    label: 'Soort vloer',
    categorie: 'De vloer',
    niveaus: ALLE,
    standaard: null,
    leegMag: false,
    opties: [
      { waarde: 'pvc-lijm', label: 'PVC lijm' },
      { waarde: 'pvc-klik', label: 'PVC klik' },
      { waarde: 'laminaat', label: 'Laminaat' },
    ],
  },
  {
    sleutel: 'vloer.legpatroon',
    soort: 'enum',
    label: 'Legpatroon',
    categorie: 'De vloer',
    niveaus: ALLE,
    standaard: 'recht',
    leegMag: false,
    opties: [
      { waarde: 'recht', label: 'Recht' },
      { waarde: 'visgraat', label: 'Visgraat' },
      { waarde: 'chevron', label: 'Chevron' },
    ],
  },
  {
    /* Een productverwijzing is bij uitstek de sleutel waar expliciet leeg iets betekent: op de
       verdieping staat een vloer, in de bijkeuken bewust geen. */
    sleutel: 'vloer.product',
    soort: 'verwijzing',
    label: 'Welke vloer',
    categorie: 'De vloer',
    niveaus: ALLE,
    standaard: null,
    leegMag: true,
  },
  {
    sleutel: 'vloer.band_bies',
    soort: 'ja-nee',
    label: 'Band en bies',
    categorie: 'De vloer',
    niveaus: ALLE,
    standaard: false,
    leegMag: false,
  },
  {
    sleutel: 'egaliseren.laagdikte_mm',
    soort: 'getal',
    label: 'Laagdikte egaline',
    categorie: 'Voorbereiding',
    niveaus: ALLE,
    standaard: 3,
    leegMag: false,
    min: 0,
    max: 60,
    hoortBij: 'egaliseren',
  },
  {
    sleutel: 'plint.toepassen',
    soort: 'ja-nee',
    label: 'Plint rondom',
    categorie: 'Plinten',
    niveaus: ALLE,
    standaard: true,
    leegMag: false,
    hoortBij: 'plinten',
  },
  {
    sleutel: 'plint.product',
    soort: 'verwijzing',
    label: 'Welke plint',
    categorie: 'Plinten',
    niveaus: ALLE,
    standaard: null,
    leegMag: true,
    hoortBij: 'plinten',
  },
];

/* De werkzaamheden. De id's zijn een op een die van de checklist op de inmeetkaart, zodat een
   bestaande inmeting zonder vertaling meekomt en er geen tweede woordenlijst ontstaat.

   Sinds stap 1 van de schermbouw (03-09-2026) staat hier de hele definitie en niet alleen het id:
   het scherm tekent de checklist hieruit en de motor leidt er de werkregels uit af. Daarvoor stond
   dezelfde lijst nog een keer in framr-portaal/app/inmeten.js, en twee lijsten van hetzelfde lopen
   uit elkaar.

     eenheid    hoe de werkregel telt: m2 over het netto oppervlak, m over de plintmeters, vast een
                keer per opname, stuks een aantal. Leeg is een let-op zonder werkregel.
     regel      de omschrijving op de offerte; leeg is een let-op.
     standaard  staat aan zonder dat er een rij voor nodig is, net als de standaard van een
                instelling. Vloer leggen en plinten plaatsen horen bij elke klus; ze uitzetten is
                een keuze en dus een rij, ze aan hebben niet. Zo blijft de slaapkamer twee rijen.

   Bij vast en stuks hoort een aantal; dat is een instelling `<taak>.aantal` (zie AANTALLEN
   hieronder), want een taak zegt of het werk gebeurt en een instelling hoe. */
                            
             
                
                
                 
                       
                                                
                     
  

const W = (
  groep        , id        , label        , uitleg        ,
  regel                = null, eenheid                          = null, standaard = false,
)               => ({ id, groep, label, uitleg, regel, eenheid, standaard });

export const WERKZAAMHEDEN                 = [
  W('Voorbereiding', 'plintenweg', 'Bestaande plinten eraf', 'verwijderen en afvoeren', 'Bestaande plinten verwijderen', 'm'),
  W('Voorbereiding', 'sloop', 'Oude vloer eruit', 'verwijderen en afvoeren', 'Oude vloer verwijderen en afvoeren', 'm2'),
  W('Voorbereiding', 'lijmrest', 'Lijmresten verwijderen', 'schuren of frezen na een lijmvloer', 'Lijmresten verwijderen', 'm2'),
  W('Voorbereiding', 'vochtmeting', 'Vochtmeting ondergrond', 'voor je lijmt op beton of anhydriet'),
  W('Voorbereiding', 'egaliseren', 'Ondergrond egaliseren', 'ook bij klik als de vloer niet vlak is', 'Ondergrond egaliseren', 'm2'),
  W('Voorbereiding', 'folie', 'Dampremmende folie', 'op beton of bij vocht van onderaf', 'Dampremmende folie aanbrengen', 'm2'),
  W('Voorbereiding', 'primer', 'Primer aanbrengen', 'hoort bij egaliseren en bij lijmen', 'Primer aanbrengen', 'm2'),
  W('Voorbereiding', 'meubels', 'Meubels verplaatsen', 'ruimte leegmaken en terugzetten', 'Meubels verplaatsen', 'vast'),
  W('Voorbereiding', 'container', 'Container of stortkosten', 'afvoer van oude vloer en verpakking', 'Container en stortkosten', 'vast'),
  W('Voorbereiding', 'afplakken', 'Afplakken en beschermen', 'trap, kozijnen en aangrenzende ruimtes', 'Afplakken en beschermen', 'vast'),
  W('Voorbereiding', 'deuren', 'Deuren afkorten', 'de nieuwe vloer wordt hoger', 'Deuren afkorten', 'stuks'),

  W('Leggen', 'leggen', 'Vloer leggen', 'de klus zelf', 'Vloer leggen', 'm2', true),
  W('Leggen', 'ondervloer', 'Ondervloer aanbrengen', 'bij een klikvloer', 'Ondervloer aanbrengen', 'm2'),
  W('Leggen', 'patroon', 'Visgraat of chevron', 'toeslag, kost meer tijd en snijverlies', 'Toeslag visgraat of chevron', 'm2'),
  W('Leggen', 'trap', 'Trap bekleden', 'per trede, met laminaat of pvc', 'Trap bekleden', 'stuks'),
  W('Leggen', 'plinten', 'Plinten plaatsen', 'nieuwe plinten zetten', 'Plinten plaatsen', 'm', true),
  W('Leggen', 'kozijnen', 'Kozijnen inkorten', 'onderkant deurstijl uitzagen', 'Kozijnen en deurstijlen inkorten', 'stuks'),
  W('Leggen', 'kruipluik', 'Kruipluik uitsparen', 'bereikbaar houden en netjes afwerken', 'Kruipluik uitsparen en afwerken', 'stuks'),
  W('Leggen', 'rozetten', 'Rozetten om leidingen', 'radiatorbuizen netjes afwerken', 'Rozetten om leidingen', 'stuks'),
  W('Leggen', 'profielen', 'Profielen en overgangen', 'naar tegels, hal of buiten', 'Profielen en overgangsstrips', 'stuks'),
  W('Leggen', 'uitsparing', 'Uitsparingen op maat', 'haard, kast, leidingen, radiatorbuizen', 'Uitsparingen op maat', 'stuks'),

  W('Afronding', 'kitwerk', 'Kitwerk langs de plinten', 'afkitten of afschilderen', 'Kitwerk en afwerking', 'm'),
  W('Afronding', 'opruimen', 'Opruimen en afvoeren', 'restmateriaal en verpakking mee', 'Opruimen en afvoeren restmateriaal', 'vast'),
  W('Afronding', 'nazorg', 'Uitleg aan de klant', 'onderhoud en garantie doornemen'),

  W('Waar je op moet letten', 'vve', 'Appartement met een VvE', 'vaak een geluidseis van 10 dB'),
  W('Waar je op moet letten', 'asbest', 'Vloer of lijm van voor 1994', 'kan asbest bevatten, niet zelf slopen'),
  W('Waar je op moet letten', 'acclim', 'Vloer moet acclimatiseren', 'pakken 48 uur in de ruimte laten liggen'),
  W('Waar je op moet letten', 'sleutel', 'Sleutel en werktijden', 'wie doet open, wanneer mag je werken'),
  W('Waar je op moet letten', 'vw', 'Vloerverwarming aanwezig', 'let op opbouw, lijmkeuze en opstoken'),
  W('Waar je op moet letten', 'bereik', 'Lastig te bereiken', 'trap, lift, of ver dragen', 'Extra werk aanvoer materiaal', 'vast'),
  W('Waar je op moet letten', 'parkeren', 'Geen laad- en losplek', 'parkeervergunning of ver sjouwen'),
  W('Waar je op moet letten', 'stroom', 'Geen stroom of water', 'aggregaat of jerrycan meenemen'),
];

export const TAKEN = WERKZAAMHEDEN.map((w) => w.id);

const OP_TAAK = new Map(WERKZAAMHEDEN.map((w) => [w.id, w]));
export function werkzaamheid(taak        )                           {
  return OP_TAAK.get(taak);
}

const TAKEN_SET = new Set(TAKEN);
export const taakBestaat = (taak        ) => TAKEN_SET.has(taak);

/* Het aantal bij een taak die per stuk of per keer telt. Een eigen instelling per taak, langs
   dezelfde ketenregel als al het andere, en met een afspraak over wat een aantal betekent: het
   geldt voor het niveau waar het staat. Drie deuren op de opname zijn drie deuren voor de hele
   opname, niet drie per ruimte; zet de hal er zelf twee bij, dan zijn dat er twee voor de hal. De
   werkregel telt elke plek waar een aantal staat een keer mee. */
for (const w of WERKZAAMHEDEN) {
  if (w.eenheid !== 'vast' && w.eenheid !== 'stuks') continue;
  INSTELLINGEN.push({
    sleutel: `${w.id}.aantal`,
    soort: 'getal',
    label: `Aantal bij ${w.label.toLowerCase()}`,
    categorie: 'Aantallen',
    niveaus: ALLE,
    standaard: 1,
    leegMag: false,
    min: 1,
    max: 999,
    hoortBij: w.id,
  });
}

const OP_SLEUTEL = new Map(INSTELLINGEN.map((i) => [i.sleutel, i]));

export function instelling(sleutel        )                         {
  return OP_SLEUTEL.get(sleutel);
}

/* Wat een antwoord aan werk voorstelt. Een voorstel zet alleen aan, nooit uit, en raakt nooit
   een vinkje waar de vakman zelf aan heeft gezeten; dat bewaakt het scherm. De sleutel is
   `instelling:waarde`. Dit stond tot 03-09-2026 alleen in de inmeetkaart; het staat hier omdat
   het bij de registry hoort en het scherm het hier vandaan haalt. */
export const VOORSTELLEN                           = {
  'vloer.legpatroon:visgraat': ['patroon'],
  'vloer.legpatroon:chevron': ['patroon'],
  'vloer.soort:pvc-klik': ['ondervloer'],
  'vloer.soort:laminaat': ['ondervloer'],
  'vloer.soort:pvc-lijm': ['primer'],
  'ondergrond.type:beton': ['vochtmeting', 'primer'],
  'ondergrond.type:anhydriet': ['vochtmeting', 'primer'],
  'ondergrond.type:zandcement': ['vochtmeting', 'primer'],
  'ondergrond.type:hout': ['folie'],
  'ondergrond.type:tegels': ['sloop', 'egaliseren', 'container'],
  'ondergrond.type:oud': ['sloop', 'lijmrest', 'container'],
  'ondergrond.vlakheid:licht': ['egaliseren'],
  'ondergrond.vlakheid:slecht': ['egaliseren', 'primer'],
  'ondergrond.vloerverwarming:true': ['vw'],
  'woning.soort:voor94': ['asbest'],
  'woning.soort:vve': ['vve', 'ondervloer'],
};

/* ---------- valideren ---------- */

                                                                                   

/* Een waarde nakijken tegen de registry. Dit gebeurt bij het schrijven, zodat er nooit iets in
   de tabel komt dat de resolver later niet kan lezen. */
export function keurWaarde(sleutel        , ruw         , niveau        )           {
  const def = instelling(sleutel);
  if (!def) return { ok: false, fout: `Onbekende instelling ${sleutel}.` };
  if (!def.niveaus.includes(niveau)) {
    return { ok: false, fout: `${def.label} kan niet op ${niveau}-niveau gezet worden.` };
  }
  if (ruw === null) {
    if (!def.leegMag) return { ok: false, fout: `${def.label} kan niet expliciet leeg gezet worden.` };
    return { ok: true, waarde: null };
  }
  switch (def.soort) {
    case 'ja-nee':
      if (typeof ruw !== 'boolean') return { ok: false, fout: `${def.label} moet ja of nee zijn.` };
      return { ok: true, waarde: ruw };
    case 'getal': {
      const n = typeof ruw === 'number' ? ruw : Number(String(ruw).replace(',', '.'));
      if (!Number.isFinite(n)) return { ok: false, fout: `${def.label} moet een getal zijn.` };
      if (def.min !== undefined && n < def.min) return { ok: false, fout: `${def.label} kan niet onder ${def.min}.` };
      if (def.max !== undefined && n > def.max) return { ok: false, fout: `${def.label} kan niet boven ${def.max}.` };
      return { ok: true, waarde: n };
    }
    case 'enum': {
      const s = String(ruw);
      if (!(def.opties ?? []).some((o) => o.waarde === s)) {
        return { ok: false, fout: `${s} is geen geldige keuze voor ${def.label}.` };
      }
      return { ok: true, waarde: s };
    }
    case 'verwijzing':
    case 'tekst': {
      const s = String(ruw).trim();
      if (!s) return { ok: false, fout: `${def.label} mag niet leeg zijn; gebruik expliciet leeg als je dat bedoelt.` };
      return { ok: true, waarde: s };
    }
  }
}

/* ---------- de resolver ---------- */

                                                                                          
                                                                                                

                        
                  
                              
                          
                  
  

/* De keten voor een ruimte: eerst de ruimte zelf, dan zijn zone, dan de opname. Wie er geen
   ruimte bij geeft vraagt naar het niveau erboven; dan is de keten korter. */
function keten(niveaus                                                                    ) {
  const uit                                   = [];
  if (niveaus.ruimte) uit.push({ niveau: 'ruimte', id: niveaus.ruimte });
  if (niveaus.zone) uit.push({ niveau: 'zone', id: niveaus.zone });
  uit.push({ niveau: 'inmeting', id: niveaus.inmeting });
  return uit;
}

/* Wat er geldt voor een sleutel, en waar dat vandaan komt.

   Er wordt bewust niets gekopieerd. Verhuist een ruimte naar een andere zone, dan loopt deze
   functie bij de eerstvolgende vraag gewoon de nieuwe keten af en klopt het antwoord vanzelf. */
export function resolveer(
  sleutel        ,
  rijen       ,
  niveaus                                                                    ,
)           {
  const def = instelling(sleutel);
  const stappen = keten(niveaus);
  for (let i = 0; i < stappen.length; i++) {
    const stap = stappen[i];
    const rij = rijen.find((r) => r.niveau === stap.niveau && r.niveau_id === stap.id && r.sleutel === sleutel);
    if (rij) {
      return { waarde: rij.waarde, vanaf: stap.niveau, vanaf_id: stap.id, geerfd: i > 0 };
    }
  }
  return { waarde: def ? def.standaard : null, vanaf: 'standaard', vanaf_id: null, geerfd: true };
}

/* Alle instellingen die voor een ruimte gelden, met herkomst erbij. */
export function resolveerAlles(
  rijen       ,
  niveaus                                                                    ,
)                           {
  const uit                           = {};
  for (const def of INSTELLINGEN) {
    if (niveaus.ruimte && !def.niveaus.includes('ruimte') && !def.niveaus.includes('zone')) {
      /* Een sleutel die alleen op de opname mag, geldt daar wel voor iedereen eronder. */
    }
    uit[def.sleutel] = resolveer(def.sleutel, rijen, niveaus);
  }
  return uit;
}

/* Welke werkzaamheden er gelden. Zelfde ketenregel, met een expliciete uit die een geerfde aan
   overrulet. Dat is het geval van de hal die juist niet geegaliseerd wordt.

   Een taak die standaard aan staat komt terug met vanaf standaard, net als een instelling zonder
   rij. Een taak die nergens staat en niet standaard is komt niet in de uitkomst voor. */
                                                                                                                   

export function resolveerTaken(
  rijen           ,
  niveaus                                                                    ,
)                               {
  const uit                               = {};
  const stappen = keten(niveaus);
  for (const w of WERKZAAMHEDEN) {
    let gevonden = false;
    for (let i = 0; i < stappen.length; i++) {
      const stap = stappen[i];
      const rij = rijen.find((r) => r.niveau === stap.niveau && r.niveau_id === stap.id && r.taak === w.id);
      if (rij) {
        uit[w.id] = { aan: rij.staat === 'aan', vanaf: stap.niveau, vanaf_id: stap.id, geerfd: i > 0 };
        gevonden = true;
        break;
      }
    }
    if (!gevonden && w.standaard) {
      uit[w.id] = { aan: true, vanaf: 'standaard', vanaf_id: null, geerfd: true };
    }
  }
  return uit;
}

/* De instellingen die bij een taak horen. Staat de taak uit, dan hoort de calculator er niets
   mee te doen; die scheiding zit hier zodat hij niet op elke plek opnieuw bedacht wordt. */
export function instellingenVanTaak(taak        )               {
  return INSTELLINGEN.filter((i) => i.hoortBij === taak);
}
