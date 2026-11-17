/* Welke toebehoren de calculator gebruikt, nu er een tweede leverancier komt (17-11-2026).

   De motor geeft sinds 17-11-2026 bij elke vloer en elk toebehoren de leverancier mee (lev). Er komt
   een tweede leverancier naast de eerste (wiki ppc-integratie op oaklyn), en een artikel van die
   tweede leverancier is een tweede levering. De calculator rekent die bezorging nog niet per
   leverancier; dat komt in stap 6 van het plan, samen met de plint in de kleur van de vloer.

   Tot die tijd gebruikt de calculator alleen toebehoren van de leverancier van de vloeren. Twee
   redenen. De motor sorteert op soort en code en de calculator neemt de eerste plint, lijm en
   ondervloer als standaard, dus een artikel van de tweede leverancier kan zomaar de standaard
   worden. En elk artikel van de tweede leverancier geeft een levering die nergens in de som staat,
   terwijl er nooit verlies op een bestelling mag zitten (besluit Jelle, 09-11-2026).

   De leverancier van de vloeren is die van de meeste vloeren. Een vloer of artikel zonder
   leverancier (een motor van voor 17-11-2026, of de proefmotor) telt als die van de vloeren, zodat
   er niets verandert waar de motor de leverancier nog niet meegeeft. */

export function leverancierVanDeVloeren(vloeren) {
  const telling = new Map();
  for (const v of vloeren ?? []) {
    if (!v || !v.lev) continue;
    telling.set(v.lev, (telling.get(v.lev) ?? 0) + 1);
  }
  let beste = null;
  let meeste = 0;
  /* Bij een gelijke stand wint de naam die als eerste komt, zodat de uitkomst niet afhangt van de
     volgorde waarin de motor de vloeren geeft. */
  for (const [lev, aantal] of [...telling.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (aantal > meeste) { beste = lev; meeste = aantal; }
  }
  return beste;
}

export function toebehorenVoorDeCalculator(vloeren, toebehoren) {
  const lijst = toebehoren ?? [];
  const lev = leverancierVanDeVloeren(vloeren);
  if (!lev) return lijst;
  return lijst.filter((t) => !t.lev || t.lev === lev);
}
