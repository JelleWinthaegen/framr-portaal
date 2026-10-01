/* Het vel op het scherm.

   Dezelfde documentbeschrijving die pdf.js tot bytes maakt, hier getekend als HTML. Zo ziet hij
   tijdens het invullen precies wat de klant straks krijgt, en kan het scherm niets anders tonen
   dan het bestand. Wens van Jelle, 17-09-2026: de offerte hoort zichtbaar te zijn terwijl je erin
   werkt, want dan zie je meteen het resultaat van wat je invult.

   De maten zijn een op een die van pdf.js: een punt op papier is hier een pixel, en het hele vel
   wordt daarna als geheel geschaald naar de ruimte die het krijgt. Daarom klopt de verhouding
   altijd, ook op een breed scherm.

   Wat hier bewust NIET gebeurt: uitrekenen waar de bladgrens valt. Dat weet pdf.js, en die hoort
   het te blijven weten; een tweede paginabouwer zou vroeg of laat iets anders zeggen dan het
   bestand. Het vel loopt gewoon door en trekt een lijn op de bladgrens zodra de aanroeper meldt
   dat het er meer dan een is (PDF.telPaginas). */

export const A4 = { breedte: 595.28, hoogte: 841.89 };
const KANT = { links: 48, rechts: 48, boven: 52, onder: 56 };
const BREED = A4.breedte - KANT.links - KANT.rechts;

/* Van de grijswaarde van de PDF (0 is zwart, 1 is wit) naar een kleur voor het scherm. */
function grijs(g) {
  const n = Math.round((g === undefined ? 0 : g) * 255);
  const h = n.toString(16).padStart(2, '0');
  return `#${h}${h}${h}`;
}

function veilig(tekst) {
  return String(tekst == null ? '' : tekst)
    .replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

const TEKENAARS = {
  kop(el) {
    /* De PDF krijgt het logo als beeldbytes (el.logo), het scherm als bron (el.logoUrl). Is er
       geen logo, dan staat er een vakje met de eerste letter, zodat de kop niet leeg oogt. */
    const merk = el.logoUrl
      ? `<img class="v-logo" src="${veilig(el.logoUrl)}" alt="">`
      : `<div class="v-logovak">${veilig((el.bedrijfsnaam || '?').trim().charAt(0).toUpperCase())}</div>`;
    const rechts = (el.rechts || []).filter(Boolean).map((r) => veilig(r)).join('<br>');
    return `<div class="v-kop">
      <div class="v-kop-links">${merk}<div class="v-bedrijf">${veilig(el.bedrijfsnaam)}</div></div>
      <div class="v-kop-rechts">${rechts}</div>
    </div><div class="v-kopstreep"></div>`;
  },

  titel(el) {
    return `<div class="v-titel">
      <span class="v-titel-tekst">${veilig(el.tekst)}</span>
      ${el.rechts ? `<span class="v-titel-rechts">${veilig(el.rechts)}</span>` : ''}
    </div>`;
  },

  kolommen(el) {
    const kolommen = el.kolommen || [];
    return `<div class="v-kolommen">${kolommen.map((k) => `<div class="v-kolom">
      <div class="v-kolomkop">${veilig(k.kop)}</div>
      ${(k.regels || []).filter((r) => r !== null && r !== undefined && r !== '')
        .map((r, i) => `<div class="v-kolomregel${i === 0 ? ' eerste' : ''}">${veilig(r)}</div>`).join('')}
    </div>`).join('')}</div>`;
  },

  tabel(el) {
    const kolommen = el.kolommen || [];
    const totaalDeel = kolommen.reduce((s, k) => s + (k.deel || 1), 0);
    const stijl = (k) => `flex:${(k.deel || 1) / totaalDeel} 1 0;${k.rechts ? 'text-align:right' : ''}`;
    const kop = kolommen.map((k) => `<div class="v-cel" style="${stijl(k)}">${veilig(k.titel)}</div>`).join('');

    const rijen = (el.rijen || []).map((rij) => {
      if (rij.groep) return `<div class="v-groep">${veilig(rij.groep)}</div>`;
      const cellen = (rij.cellen || []).map((cel, i) => {
        const k = kolommen[i] || {};
        const inhoud = i === 0 && rij.sub
          ? `${veilig(cel)}<div class="v-sub">${veilig(rij.sub)}</div>`
          : veilig(cel);
        return `<div class="v-cel${rij.dik ? ' dik' : ''}" style="${stijl(k)}">${inhoud}</div>`;
      }).join('');
      return `<div class="v-rij">${cellen}</div>`;
    }).join('');

    return `<div class="v-tabelkop">${kop}</div>${rijen}`;
  },

  kader(el) {
    return `<div class="v-kader">
      <div class="v-kader-kop">${veilig(el.kop)}</div>
      <div class="v-kader-vakken">${(el.vakken || []).map((v) => `<div>
        <div class="v-kader-label">${veilig(v.label)}</div>
        <div class="v-kader-waarde${v.groot ? ' groot' : ''}">${veilig(v.waarde)}</div>
      </div>`).join('')}</div>
    </div>`;
  },

  totalen(el) {
    return `<div class="v-totalen">${(el.regels || []).filter(Boolean).map((r) => `
      <div class="v-totaalrij${r.groot ? ' groot' : ''}${r.dik ? ' dik' : ''}">
        <span>${veilig(r.label)}</span><span>${veilig(r.waarde)}</span>
      </div>`).join('')}</div>`;
  },

  tekst(el) {
    return `<div class="v-tekst${el.klein ? ' klein' : ''}">${veilig(el.tekst)}</div>`;
  },

  ondertekening(el) {
    return `<div class="v-ondertekening">
      <div>${veilig(el.links)}</div><div>${veilig(el.rechts)}</div>
    </div>`;
  },

  ruimte(el) {
    return `<div style="height:${Number(el.hoogte || 14)}px"></div>`;
  },

  /* Op papier houdt bijeen een groep bij elkaar op een pagina. Op het scherm is er geen
     paginabreuk, dus hier is het gewoon de inhoud, onderaan het vel gezet. */
  bijeen(el) {
    return `<div class="v-voet">${tekenElementen(el.elementen || [])}</div>`;
  },
};

function tekenElementen(elementen) {
  return (elementen || [])
    .filter((el) => el && TEKENAARS[el.soort])
    .map((el) => TEKENAARS[el.soort](el))
    .join('');
}

/* Het vel als HTML. Zet dit in een doos en roep pasSchaal aan om het passend te maken. */
export function velHtml(doc) {
  zorgVoorStijl();
  return `<div class="v-vel" data-vel>
    <div class="v-binnen">${tekenElementen(doc.elementen)}</div>
  </div>`;
}

/* De stijl van het vel hangt zichzelf eenmalig in de pagina. Dat scheelt een regel in index.html
   en houdt het vel een geheel: wie vel.js gebruikt, krijgt de maten er vanzelf bij. */
let stijlStaat = false;
export function zorgVoorStijl() {
  if (stijlStaat || typeof document === 'undefined') return;
  const blad = document.createElement('style');
  blad.id = 'fr-vel-stijl';
  blad.textContent = VEL_CSS;
  document.head.appendChild(blad);
  stijlStaat = true;
}

/* Het vel schalen naar de ruimte die het krijgt.

   De doos houdt de plek in de bladspiegel bezet (een geschaald element neemt zijn eigen ruimte
   niet mee), het vel erin wordt geschaald. Zonder grenzen zou het vel op een breed scherm groter
   worden dan papier ooit is, en op een smal scherm onleesbaar klein. */
export function pasSchaal(doos, { min = 0.6, max = 1.35, paginas = 0 } = {}) {
  if (!doos) return 0;
  const vel = doos.querySelector('[data-vel]');
  if (!vel) return 0;
  const ruimte = doos.parentElement ? doos.parentElement.clientWidth : A4.breedte;
  const schaal = Math.max(min, Math.min(max, (ruimte || A4.breedte) / A4.breedte));
  vel.style.transform = `scale(${schaal})`;

  /* De doos houdt de plek in de bladspiegel bezet. Hij krijgt de echte hoogte van het vel mee,
     want een geschaald element neemt zijn eigen ruimte niet in; zonder dit zou een offerte van
     twee bladen onder de volgende alinea door schuiven. */
  const hoog = Math.max(A4.hoogte, vel.offsetHeight);

  /* De bladgrens tekenen we alleen als het bestand er echt een heeft. Hoeveel bladen dat zijn
     weet pdf.js, niet dit vel: een natekening in HTML komt op een paar pixels na uit, en op die
     paar pixels zou een offerte van een blad hier ten onrechte als twee bladen verschijnen.
     De aanroeper geeft de telling mee (PDF.telPaginas); zonder telling valt het terug op de
     eigen hoogte, wat voor een los vel zonder PDF ernaast goed genoeg is. */
  const meer = paginas ? paginas > 1 : hoog > A4.hoogte + 1;
  vel.classList.toggle('v-meer', meer);
  doos.style.width = Math.round(A4.breedte * schaal) + 'px';
  doos.style.height = Math.round(hoog * schaal) + 'px';
  return schaal;
}

/* De maten en kleuren van het vel, als stijlblad. Staat hier en niet in framr.css omdat het geen
   ontwerpkeuze is maar een omrekening van de PDF: wie in pdf.js een maat verandert, verandert hem
   hier mee. De letter is Helvetica, net als in het bestand. */
export const VEL_CSS = `
.v-doos { position: relative; flex: none; }
/* Het vel is minstens een A4 en groeit mee met wat erop staat. Eerst stond de inhoud met een
   vaste boven- en ondermaat vast, en dan viel alles wat niet op een blad paste buiten beeld: op
   17-09-2026 zag Jelle een offerte waarvan het totaal en de handtekeningregels er gewoon af waren
   gesneden. Een vel dat de laatste regel verzwijgt is erger dan geen vel, want de PDF loopt wel
   netjes door op een tweede blad. Nu doet het vel dat ook, met een lijn op de bladgrens. */
.v-vel {
  position: absolute; top: 0; left: 0;
  width: ${A4.breedte}px; min-height: ${A4.hoogte}px; background: #fff; color: #000;
  padding: ${KANT.boven}px ${KANT.rechts}px ${KANT.onder}px ${KANT.links}px;
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; font-size: 9.5px; line-height: 1.35;
  transform-origin: top left; display: flex; flex-direction: column;
  box-shadow: 0 1px 2px rgba(27, 27, 31, .06), 0 10px 30px rgba(27, 27, 31, .09);
}
.v-binnen { display: flex; flex-direction: column; flex: 1 1 auto; }
/* De bladgrens, alleen zichtbaar zodra er echt een tweede blad is. De lijn valt precies op de
   onderkant van elk vel, zodat je ziet wat er nog op pagina een past. */
.v-vel.v-meer {
  background-image: repeating-linear-gradient(to bottom,
    transparent 0, transparent ${A4.hoogte - 1}px, #E2E2E6 ${A4.hoogte - 1}px, #E2E2E6 ${A4.hoogte}px);
}
.v-kop { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }
.v-logovak {
  width: 42px; height: 42px; border-radius: 5px; background: #1B1B1F; color: #fff;
  display: flex; align-items: center; justify-content: center; font-size: 17px; font-weight: 600;
}
.v-logo { max-width: 150px; max-height: 42px; display: block; }
.v-bedrijf { font-size: 15px; font-weight: 700; margin-top: 10px; }
.v-kop-rechts { text-align: right; font-size: 8.5px; color: ${grijs(0.35)}; line-height: 1.45; }
.v-kopstreep { border-top: 1.1px solid ${grijs(0.1)}; margin-top: 8px; }
.v-titel { display: flex; align-items: baseline; justify-content: space-between; margin-top: 20px; }
.v-titel-tekst { font-size: 21px; }
.v-titel-rechts { font-size: 10px; color: ${grijs(0.4)}; }
.v-kolommen { display: flex; margin-top: 20px; }
.v-kolom { flex: 1 1 0; padding-right: 12px; min-width: 0; }
.v-kolomkop { font-size: 7.5px; letter-spacing: .06em; text-transform: uppercase; color: ${grijs(0.45)}; margin-bottom: 8px; }
.v-kolomregel { font-size: 9.5px; }
.v-kolomregel.eerste { font-weight: 700; }
.v-tabelkop {
  display: flex; font-size: 7.5px; letter-spacing: .06em; text-transform: uppercase;
  color: ${grijs(0.45)}; border-bottom: .6px solid ${grijs(0.55)}; padding-bottom: 5px; margin-top: 18px;
}
.v-groep { font-size: 7.5px; letter-spacing: .06em; text-transform: uppercase; font-weight: 700; color: ${grijs(0.25)}; margin: 9px 0 4px; }
.v-rij { display: flex; padding: 3px 0; border-bottom: .4px solid ${grijs(0.86)}; }
.v-cel { padding-right: 8px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.v-cel.dik { font-weight: 700; }
.v-sub { font-size: 8px; color: ${grijs(0.45)}; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.v-kader {
  margin-top: 12px; padding: 11px 14px; background: ${grijs(0.965)}; border: .6px solid ${grijs(0.72)};
}
.v-kader-kop { font-size: 7.5px; letter-spacing: .06em; text-transform: uppercase; color: ${grijs(0.35)}; margin-bottom: 8px; }
.v-kader-vakken { display: flex; }
.v-kader-vakken > div { flex: 1 1 0; min-width: 0; }
.v-kader-label { font-size: 8px; color: ${grijs(0.45)}; }
.v-kader-waarde { font-size: 11px; margin-top: 2px; }
.v-kader-waarde.groot { font-size: 14px; font-weight: 700; }
.v-totalen { margin-top: 12px; margin-left: ${BREED - 230}px; }
.v-totaalrij { display: flex; justify-content: space-between; gap: 16px; padding: 3px 0; border-bottom: .4px solid ${grijs(0.86)}; }
.v-totaalrij.dik { font-weight: 700; }
.v-totaalrij.groot { font-size: 12px; border-bottom-color: ${grijs(0.4)}; padding-top: 6px; }
.v-tekst { font-size: 9.5px; margin-top: 8px; }
.v-tekst.klein { font-size: 8.5px; color: ${grijs(0.4)}; line-height: 1.5; }
.v-ondertekening { display: flex; gap: 28px; margin-top: 22px; }
.v-ondertekening > div { flex: 1 1 0; border-top: .5px solid ${grijs(0.6)}; padding-top: 4px; font-size: 8.5px; color: ${grijs(0.4)}; }
.v-voet { margin-top: auto; padding-top: 14px; }
`;
