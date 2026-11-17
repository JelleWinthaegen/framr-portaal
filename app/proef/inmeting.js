/*
  Het rekenwerk van een inmeting: van wat de legger met de rolmaat las naar vierkante meters vloer
  en strekkende meters plint.

  Dit staat apart van index.ts om twee redenen. Ten eerste is dit het enige stuk van de motor met
  echte rekenregels erin, en dat hoort getest te zijn. Ten tweede rekent de browser hetzelfde uit
  om het op het scherm te tonen; door de server het opnieuw te laten doen kan de opslag nooit iets
  anders bevatten dan wat er uit de maten volgt.

  Waarom de server het overdoet en de uitkomst uit de browser niet overneemt: de maten en de aftrek
  zijn invoer, en een inmeting moet over een half jaar nog na te rekenen zijn uit wat er in de
  database staat. Als alleen het scherm de som maakt, is een oude inmeting een getal zonder herkomst.
*/

/* Een binnendeur is 90 centimeter breed. Daar komt geen plint, dus die breedte gaat van de omtrek af.

   Sinds 2026-08-06 vraagt het scherm er niet meer naar: de legger geeft in meters op waar geen plint
   komt, want dat is wat hij ziet staan. Een deur telt daar gewoon in mee, net als een woonkamer die
   open doorloopt in de keuken. Deze maat blijft bestaan voor inmetingen die met het oude veld
   gemaakt zijn; die moeten hetzelfde getal blijven geven. */
export const DEUR_M = 0.9;

                            
                       
                   
                    
                   
                   
                          
                       
                               
                             
                             
  

                      
                   
                      
                 
                  
                 
                        
                     
                    
                 
                              
                            
                            
  

/* Een getal uit de browser is tekst, en een Nederlander tikt een komma. Alles wat geen getal
   oplevert wordt nul, want een lege maat is geen fout: hij is de ruimte nog aan het invullen. */
export function nummer(waarde         )         {
  const n = Number(String(waarde ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

/* Afronden op twee decimalen. Zonder dit levert 5,1 maal 3,3 een getal met zeventien cijfers op,
   en dat is geen maat maar ruis. */
function afgerond(n        )         {
  return Math.round(n * 100) / 100;
}

/* Een ruimte uit de invoer, met de som er meteen bij.

   Beide uitkomsten worden op nul afgekapt. Wie zich vertikt in de aftrek en meer wegneemt dan er
   ligt, hoort geen negatieve vierkante meters op zijn offerte te krijgen die stilletjes van het
   totaal aftrekken. */
export function ruimteUitInvoer(invoer              , volgorde = 0)         {
  const lengte = nummer(invoer.lengte);
  const breedte = nummer(invoer.breedte);
  const aftrek = nummer(invoer.aftrek);
  const deuren = Math.max(0, Math.round(nummer(invoer.deuren ?? invoer.deuropeningen)));
  const plintEraf = Math.max(0, nummer(invoer.plint_eraf));
  return {
    volgorde,
    naam: invoer.naam ?? null,
    lengte,
    breedte,
    aftrek,
    deuropeningen: deuren,
    plint_eraf: plintEraf,
    oppervlak: afgerond(Math.max(0, lengte * breedte - aftrek)),
    /* Alle drie de aftrekken tellen mee. Nieuwe inmetingen gebruiken alleen plint_eraf; oude hebben
       hun deuropeningen en die mogen niet stil verdwijnen. */
    omtrek: afgerond(Math.max(0, 2 * (lengte + breedte) - deuren * DEUR_M - plintEraf)),
    vloer_handle: invoer.vloer_handle ?? null,
    /* De naam zoals hij hem intikte, ook als het geen product uit de winkel is. */
    vloer_naam: invoer.vloer_naam ?? null,
    legpatroon: invoer.legpatroon ?? null,
  };
}

export function ruimtesUitInvoer(invoer         )           {
  if (!Array.isArray(invoer)) return [];
  return invoer.map((r, i) => ruimteUitInvoer(r ?? {}, i));
}

/* ---------- meetvlakken ---------- */

                          
                       
                        
                       
                   
                    
                          
  

                    
                   
                      
                        
                    
                 
                  
                    
                         
  

/* Een meetvlak uit de invoer. Het oppervlak wordt hier uitgerekend en niet overgenomen, om
   dezelfde reden als bij een ruimte: de maten zijn de invoer en het getal moet daar altijd uit
   volgen. Een min-vlak bewaart zijn oppervlak positief; het teken zegt wat ermee gebeurt. */
export function vlakUitInvoer(invoer            , volgorde = 0)       {
  const lengte = Math.max(0, nummer(invoer.lengte));
  const breedte = Math.max(0, nummer(invoer.breedte));
  return {
    volgorde,
    naam: (invoer.naam ?? '').toString().trim() || null,
    teken: invoer.teken === 'min' ? 'min' : 'plus',
    vorm: 'rechthoek',
    lengte,
    breedte,
    oppervlak: afgerond(lengte * breedte),
    notitie: invoer.notitie ?? null,
  };
}

export function vlakkenUitInvoer(invoer         )         {
  if (!Array.isArray(invoer)) return [];
  return invoer.map((v, i) => vlakUitInvoer(v ?? {}, i));
}

/* Het netto oppervlak van een ruimte. Dit is de ene plek waar dat bepaald wordt.

   De volgorde is bewust strikt, zodat er nooit twee getallen naast elkaar kunnen bestaan:

     1. een met de hand ingevoerd oppervlak wint van alles, en wordt als zodanig getoond;
     2. anders de rechthoek (lengte maal breedte min de aftrek) met de meetvlakken erop: de
        plus-vlakken erbij, de min-vlakken eraf.

   Tot 29-09-2026 vervingen de vlakken de rechthoek zodra er een stond. Dat is niet hoe een legger
   meet (testronde van Myron): zij nam de kamer als rechthoek van 6,50 bij 4,00 en haalde daar de
   hoek en het trapgat vanaf, en kreeg 0 m2 omdat er geen plus-vlak was. Nu telt de rechthoek
   altijd mee, en wie geen rechthoek invult krijgt gewoon de som van zijn vlakken.

   Nooit onder nul: wie zich vertikt in een aftrek hoort geen negatieve vierkante meters op zijn
   offerte te krijgen die stilletjes van het totaal aftrekken.

   Wat hier NIET in zit is snijverlies. Dat is een keuze van de calculator over deze maat heen; de
   inmeting blijft de gemeten werkelijkheid. */
export function nettoOppervlak(
  ruimte                                                                                          ,
  vlakken                                          = [],
)                                                                                                  {
  const handmatig = ruimte.oppervlak_handmatig;
  if (handmatig !== null && handmatig !== undefined && handmatig !== '') {
    const n = nummer(handmatig);
    if (n > 0) return { oppervlak: afgerond(n), bron: 'handmatig', bruto: afgerond(n), eraf: 0 };
  }
  const erbij = vlakken.filter((v) => v.teken !== 'min').reduce((s, v) => s + nummer(v.oppervlak), 0);
  const vlakkenEraf = vlakken.filter((v) => v.teken === 'min').reduce((s, v) => s + nummer(v.oppervlak), 0);
  const bruto = nummer(ruimte.lengte) * nummer(ruimte.breedte) + erbij;
  const eraf = nummer(ruimte.aftrek) + vlakkenEraf;
  return {
    oppervlak: afgerond(Math.max(0, bruto - eraf)),
    bron: vlakken.length ? 'vlakken' : 'rechthoek',
    bruto: afgerond(bruto),
    eraf: afgerond(eraf),
  };
}

/* ---------- wanden en plinten ---------- */

                          
                        
                   
                        
                          
                                                                                     
  

                    
                   
                       
                 
                              
                         
                                                                                                  
  

/* De vier wanden van een rechthoek, zoals ze gegenereerd worden zodra iemand de plint per wand
   wil regelen. Tot dat moment bestaan ze niet: een gewone kamer met plint rondom hoeft er niets
   van te zien. */
export function wandenVanRechthoek(lengte         , breedte         )         {
  const l = Math.max(0, nummer(lengte));
  const b = Math.max(0, nummer(breedte));
  return [
    { volgorde: 0, label: 'A', lengte: l, plint: null, notitie: null, openingen: [] },
    { volgorde: 1, label: 'B', lengte: b, plint: null, notitie: null, openingen: [] },
    { volgorde: 2, label: 'C', lengte: l, plint: null, notitie: null, openingen: [] },
    { volgorde: 3, label: 'D', lengte: b, plint: null, notitie: null, openingen: [] },
  ];
}

export function wandUitInvoer(invoer            , volgorde = 0)       {
  const plint = invoer.plint === 'aan' || invoer.plint === 'uit' ? invoer.plint : null;
  return {
    volgorde,
    label: (invoer.label ?? '').toString().trim() || null,
    lengte: Math.max(0, nummer(invoer.lengte)),
    plint,
    notitie: invoer.notitie ?? null,
    openingen: (Array.isArray(invoer.openingen) ? invoer.openingen : []).map((o, i) => ({
      volgorde: i,
      lengte: Math.max(0, nummer(o?.lengte)),
      reden: (o?.reden ?? '').toString().trim() || null,
      notitie: o?.notitie ?? null,
    })),
  };
}

export function wandenUitInvoer(invoer         )         {
  if (!Array.isArray(invoer)) return [];
  return invoer.map((w, i) => wandUitInvoer(w ?? {}, i));
}

/* De plintmeters van een ruimte. Dit is de ene plek waar dat bepaald wordt.

   Twee getallen die uit elkaar moeten blijven, want ze zijn niet hetzelfde:

     wand_meters   de gemeten wandlengte. Geometrie, verandert niet als de plintkeuze verandert.
     plint_meters  wat je nodig hebt. Alleen wanden met plint, min hun onderbrekingen.

   Waarom plintmeters nooit uit de meetvlakken komen: een trapgat haalt vierkante meters weg
   zonder een meter plint toe te voegen, en een uitbouw voegt wanden toe die je niet uit een
   oppervlak kunt terugrekenen. Oppervlak en omtrek zijn losse werelden.

   De volgorde, dezelfde vorm als bij het oppervlak (migration 0114, wens van Jelle 17-09-2026):
   met de hand gezet wint, dan de wanden, dan de rechthoekregel met plint_eraf, precies zoals hij
   altijd al werkte, zodat een bestaande inmeting hetzelfde getal blijft geven.

   Met de hand gezet is null wanneer er niets gezet is; nul is dan een echte keuze en betekent dat
   er hier geen plint komt. Daarom is dit geen waarheidstoets maar een vergelijking met null: bij
   nul zou een waarheidstoets hem stil laten terugvallen op de rechthoek, en dan zou het portaal
   plint blijven rekenen waar de vakman zei dat er geen komt. */
export function plintMeters(
  ruimte   
                                                                                       
                              
   ,
  wanden                                                                                  = [],
  plintAan = true,
)                                                                                            {
  /* De gemeten wandlengte blijft wat hij is, ook als de plintmeters met de hand gezet zijn: het
     is geometrie, geen keuze. Zijn er wanden, dan komt hij daarvandaan, anders uit de rechthoek. */
  const wandMeters = wanden.length
    ? wanden.reduce((s, w) => s + Math.max(0, nummer(w.lengte)), 0)
    : 2 * (nummer(ruimte.lengte) + nummer(ruimte.breedte));

  if (ruimte.plint_handmatig !== null && ruimte.plint_handmatig !== undefined && ruimte.plint_handmatig !== '') {
    const hand = nummer(ruimte.plint_handmatig);
    return {
      wand_meters: afgerond(wandMeters),
      plint_meters: afgerond(Math.max(0, hand)),
      bron: 'handmatig',
    };
  }

  if (wanden.length) {
    const gemeten = wanden.reduce((s, w) => s + Math.max(0, nummer(w.lengte)), 0);
    const netto = wanden.reduce((s, w) => {
      /* Leeg is erven van de ruimte; aan of uit is een keuze voor deze wand. */
      const aan = w.plint === 'aan' ? true : w.plint === 'uit' ? false : plintAan;
      if (!aan) return s;
      const eraf = (w.openingen ?? []).reduce((t, o) => t + Math.max(0, nummer(o.lengte)), 0);
      return s + Math.max(0, nummer(w.lengte) - eraf);
    }, 0);
    return { wand_meters: afgerond(gemeten), plint_meters: afgerond(netto), bron: 'wanden' };
  }
  const gemeten = 2 * (nummer(ruimte.lengte) + nummer(ruimte.breedte));
  if (!plintAan) return { wand_meters: afgerond(gemeten), plint_meters: 0, bron: 'rechthoek' };
  const deuren = Math.max(0, Math.round(nummer(ruimte.deuropeningen)));
  const netto = gemeten - deuren * DEUR_M - Math.max(0, nummer(ruimte.plint_eraf));
  return { wand_meters: afgerond(gemeten), plint_meters: afgerond(Math.max(0, netto)), bron: 'rechthoek' };
}

/* De totalen van een inmeting. Optellen gebeurt over de afgeronde ruimtes, zodat het totaal op het
   scherm klopt met de regels eronder en er nergens een cent verdwijnt in een decimaal. */
export function totalen(ruimtes          )                                 {
  return {
    m2: afgerond(ruimtes.reduce((s, r) => s + r.oppervlak, 0)),
    omtrek: afgerond(ruimtes.reduce((s, r) => s + r.omtrek, 0)),
  };
}
