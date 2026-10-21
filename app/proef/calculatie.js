/*
  De calculatielaag: van een ingemeten woning naar rekengroepen, met herkomst.

  Twee dingen die dit stuk anders maken dan de oude calculator.

  EEN GROEP IS EEN REKENCONTEXT, GEEN PRODUCT. Een groep is een stel ruimtes dat technisch
  hetzelfde is: dezelfde vloer, hetzelfde legpatroon, wel of geen band en bies. Daarbinnen kunnen
  regels van verschillende herkomst staan, en elke regel mag zijn eigen materiaalbron hebben. De
  bron op de groep is een standaard voor het gemak, geen keurslijf: de vloer kan bij een externe
  leverancier vandaan komen terwijl de lijm via Framr.One gaat en de plinten van de klant zijn.

  ELKE REGEL WEET WAAR HIJ VANDAAN KOMT. Herkomst is geen vrije blob maar een vaste vorm, zodat
  over een jaar nog te beantwoorden is waarom er 62 vierkante meter egaline op staat. Zonder dat
  is opnieuw doorrekenen een sprong in het duister.

  Wat hier NIET gebeurt is prijzen ophalen. Een bewaarde calculatie houdt de prijzen waarmee hij
  gerekend heeft; de catalogus mag morgen veranderen zonder dat de marge van gisteren meebeweegt.
  Zie prijsbasis op de regel.
*/

import { INSTELLINGEN, resolveer, resolveerTaken, werkzaamheid,                        } from './instellingen.js';

/* Het label van een vloersoort (PVC lijm, Laminaat) uit de registry, voor de naam van een groep. */
function soortLabel(waarde         )                {
  if (waarde === null || waarde === undefined) return null;
  const opties = (INSTELLINGEN.find((i) => i.sleutel === 'vloer.soort')                                                                 )?.opties ?? [];
  return opties.find((o) => o.waarde === waarde)?.label ?? null;
}

/* Waar het materiaal vandaan komt. Dit staat per regel en niet alleen per groep, want een
   normale klus mengt: de vloer extern, de egaline bij ons, de plinten van de klant. */
export const BRONNEN = ['framr', 'extern', 'klant', 'onbekend']         ;
                                          
export const bronBestaat = (b         )            => BRONNEN.includes(b        );

/* Hoe een regel is ontstaan. Het verschil bepaalt wat opnieuw doorrekenen met hem mag doen:
   een automatische regel wordt vervangen, een handmatige blijft, en een aangepaste blijft ook
   maar wordt gemeld zodat de gebruiker kan kiezen. */
export const OORSPRONGEN = ['automatisch', 'handmatig', 'aangepast']         ;
                                                   

/* De vaste vorm van herkomst. Niet alles hoeft gevuld te zijn, maar de velden liggen vast zodat
   een lezer over een jaar weet wat hij voor zich heeft. */
                        
                                
                                    
                     
                     
                      
                     
                         
                                  
  

export function herkomst(deel                    = {})           {
  return {
    measurement_id: deel.measurement_id ?? null,
    measurement_versie: deel.measurement_versie ?? null,
    zone_ids: deel.zone_ids ?? [],
    room_ids: deel.room_ids ?? [],
    taak: deel.taak ?? null,
    sleutels: deel.sleutels ?? [],
    formule: deel.formule ?? null,
    invoer: deel.invoer ?? {},
  };
}

/* De prijsbasis van een regel: met welke prijs er gerekend is en waar die vandaan kwam.

   Hierdoor kan het portaal later zeggen "de catalogusprijs is sindsdien 27 in plaats van 25"
   zonder de bewaarde calculatie stilletjes te herschrijven. Dat is dezelfde regel als bij een
   verstuurd document: wat vastligt, ligt vast tot iemand bewust ververst. */
                          
             
                      
                              
                        
                         
                        
             
  

export function prijsbasis(deel                      = {})             {
  return {
    bron: deel.bron ?? 'onbekend',
    code: deel.code ?? null,
    omschrijving: deel.omschrijving ?? null,
    inkoop: deel.inkoop ?? null,
    verkoop: deel.verkoop ?? null,
    advies: deel.advies ?? null,
    op: deel.op ?? new Date().toISOString(),
  };
}

/* ---------- groeperen ---------- */

                              
             
                      
                         
                    
                       
  

                     
                  
               
             
                         
                            
                            
                     
                    
                       
                     
                     
  

                         
               
                       
                                         
                 
                     
                                        
  

/* De ruimtes verdelen over rekengroepen.

   Een groep is een stel ruimtes waarvoor het materiaal hetzelfde uitpakt: dezelfde vloer,
   hetzelfde patroon, wel of geen band en bies. Een ruimte zonder gekozen vloer valt in een groep
   met bron onbekend; die kan gewoon doorgerekend worden op zijn werkzaamheden en krijgt later
   materiaal, zonder dat de inmeting of de calculatie opnieuw hoeft.

   Er wordt bewust niet op ondergrond gegroepeerd. Dat bepaalt de voorbereiding en niet de vloer,
   en die voorbereiding komt als werkregel met zijn eigen herkomst. */
export function groepeer(
  ruimtes                  ,
  instellingen       ,
  measurementId        ,
  zoneNamen                         = {},
)          {
  const groepen = new Map               ();
  for (const r of ruimtes) {
    const keten = { ruimte: r.id, zone: r.zone_id, inmeting: measurementId };
    const product = resolveer('vloer.product', instellingen, keten);
    const soort = resolveer('vloer.soort', instellingen, keten);
    const patroon = resolveer('vloer.legpatroon', instellingen, keten);
    const bies = resolveer('vloer.band_bies', instellingen, keten);

    const productWaarde = (product.waarde ?? null)                 ;
    const sleutel = [
      productWaarde ?? '(geen)',
      (soort.waarde ?? '(geen)')          ,
      (patroon.waarde ?? 'recht')          ,
      bies.waarde === true ? 'bies' : 'geen-bies',
    ].join('|');

    const bestaand = groepen.get(sleutel);
    if (bestaand) {
      bestaand.oppervlak = afgerond(bestaand.oppervlak + r.oppervlak);
      bestaand.plint_meters = afgerond(bestaand.plint_meters + r.plint_meters);
      bestaand.room_ids.push(r.id);
      if (r.zone_id && !bestaand.zone_ids.includes(r.zone_id)) bestaand.zone_ids.push(r.zone_id);
      continue;
    }
    const zone = r.zone_id ? zoneNamen[r.zone_id] : null;
    /* Zonder gekozen product heet de groep naar zijn vloersoort (16-10-2026): twee vloeren zonder
       product heetten allebei Zonder vloerkeuze, en dan zag de vakman in de calculator niet welke
       welke was. Het product wint, want dat is wat hij zelf koos. */
    const stukken = [
      zone,
      productWaarde ?? soortLabel(soort.waarde),
      patroon.waarde && patroon.waarde !== 'recht' ? String(patroon.waarde) : null,
      bies.waarde === true ? 'band en bies' : null,
    ].filter(Boolean);
    groepen.set(sleutel, {
      sleutel,
      naam: stukken.length ? stukken.join(', ') : 'Zonder vloerkeuze',
      /* Zonder gekozen product weten we de bron nog niet; dat is een echte toestand en geen fout. */
      bron: productWaarde ? 'framr' : 'onbekend',
      product: productWaarde,
      vloersoort: (soort.waarde ?? null)                 ,
      legpatroon: (patroon.waarde ?? null)                 ,
      band_bies: bies.waarde === true,
      oppervlak: afgerond(r.oppervlak),
      plint_meters: afgerond(r.plint_meters),
      room_ids: [r.id],
      zone_ids: r.zone_id ? [r.zone_id] : [],
    });
  }
  return [...groepen.values()];
}

/* De werkzaamheden, opgeteld over de ruimtes waar ze gelden.

   Dit gaat bewust over de vloergroepen heen: egaliseren van de hele begane grond is een regel,
   ook als daar twee verschillende vloeren liggen. Welke ruimtes eraan bijdragen staat in de
   herkomst, zodat de vraag "waar komt die 62 vandaan" te beantwoorden is.

   Ruimtes met een afwijkende instelling die het werk raakt, zoals een andere laagdikte, komen in
   een eigen regel terecht. Anders zou een gemiddelde ontstaan dat nergens klopt.

   Hoe een taak telt staat in de registry (WERKZAAMHEDEN): m2 over het netto oppervlak, m over de
   plintmeters. Een taak per keer of per stuk telt niet per ruimte maar per plek waar een aantal
   staat: drie deuren op de opname zijn drie deuren, ook al erven vier ruimtes dat getal. Een
   let-op zonder werkregel levert hier niets op; die blijft een vinkje op de kaart. */
export function werkregels(
  ruimtes                  ,
  instellingen       ,
  taken           ,
  measurementId        ,
)              {
  const uit = new Map                   ();
  const geteld = new Map                     ();
  for (const r of ruimtes) {
    const keten = { ruimte: r.id, zone: r.zone_id, inmeting: measurementId };
    const actief = resolveerTaken(taken, keten);
    for (const [taak, staat] of Object.entries(actief)) {
      if (!staat.aan) continue;
      const def = werkzaamheid(taak);
      if (!def || !def.eenheid || !def.regel) continue;
      /* Instellingen die bij deze taak horen maken deel uit van de sleutel: twee laagdiktes
         horen niet in een regel opgeteld te worden. */
      const extra                          = {};
      if (taak === 'egaliseren') {
        extra['egaliseren.laagdikte_mm'] = resolveer('egaliseren.laagdikte_mm', instellingen, keten).waarde;
      }
      const sleutel = taak + '|' + JSON.stringify(extra);
      let regel = uit.get(sleutel);
      if (!regel) {
        regel = { taak, omschrijving: def.regel, eenheid: def.eenheid, aantal: 0, room_ids: [], instellingen: extra };
        uit.set(sleutel, regel);
        geteld.set(sleutel, new Set());
      }
      regel.room_ids.push(r.id);
      if (def.eenheid === 'm2') {
        regel.aantal = afgerond(regel.aantal + r.oppervlak);
      } else if (def.eenheid === 'm') {
        regel.aantal = afgerond(regel.aantal + r.plint_meters);
      } else {
        const n = resolveer(`${taak}.aantal`, instellingen, keten);
        const bron = n.vanaf === 'standaard' ? 'standaard' : `${n.vanaf}:${n.vanaf_id}`;
        const bronnen = geteld.get(sleutel) ;
        if (!bronnen.has(bron)) {
          bronnen.add(bron);
          regel.aantal += Math.max(1, Math.round(Number(n.waarde) || 1));
        }
      }
    }
  }
  return [...uit.values()];
}

function afgerond(n        )         {
  return Math.round(n * 100) / 100;
}

/* Wat opnieuw doorrekenen met een bestaande regel mag doen.

   De regel die Jelle stelde: handmatig werk mag niet stilletjes verdwijnen. Een automatische
   regel wordt vervangen; een handmatige blijft onaangeroerd; een aangepaste blijft ook staan maar
   wordt gemeld, zodat de gebruiker zelf kan kiezen of hij het verse getal wil. */
export function magVervangen(oorsprong           )          {
  return oorsprong === 'automatisch';
}

/* Is een calculatie achterhaald door een wijziging in de inmeting. */
export function isVerouderd(gebaseerdOp               , inhoudVersie               )          {
  if (gebaseerdOp === null || gebaseerdOp === undefined) return false;
  if (inhoudVersie === null || inhoudVersie === undefined) return false;
  return inhoudVersie > gebaseerdOp;
}
