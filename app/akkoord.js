/* Het akkoord bij het aanmelden (Jelle, 20-10-2026): wie een account aanmaakt, gaat akkoord met de
   gebruiksvoorwaarden en de verwerkersovereenkomst en heeft de privacyverklaring kunnen lezen. Het
   portaal bewaart dat als user_metadata op de Supabase-gebruiker: welke versie, en wanneer. Zo is
   later aan te tonen waar iemand mee instemde, ook als de teksten intussen veranderd zijn.

   De teksten staan op de site. Verandert er iets wezenlijks, dan krijgt de nieuwe tekst een nieuwe
   versie hieronder; wie op een oude versie staat, weet je dan uit de metadata. */

export const VOORWAARDEN_VERSIE = '2026-10-20';

export const SITE = 'https://framr.one';
export const LINKS = {
  voorwaarden: `${SITE}/voorwaarden.html`,
  verwerkers: `${SITE}/verwerkersovereenkomst.html`,
  privacy: `${SITE}/privacy.html`,
};

/* De metadata die bij het aanmelden meegaat. De zeef in de motor (partners.ts) laat deze velden
   bewust niet door naar de partnerrij: het akkoord hoort bij de login, niet bij de bedrijfsgegevens. */
export function akkoordGegevens(nu = new Date()) {
  return { voorwaarden_versie: VOORWAARDEN_VERSIE, voorwaarden_akkoord_op: nu.toISOString() };
}
