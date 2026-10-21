/* Wachtwoorden: de controle bij het kiezen en het lezen van de herstellink.

   Losse functies zonder scherm, zodat de test ze zonder browser kan nalopen. framr.js doet de
   schermen en de ritten naar Supabase Auth. */

export const MINSTE_TEKENS = 8;

/* Twee keer hetzelfde wachtwoord (Jelle, 19-10-2026): een tikfout bij het aanmaken of herstellen
   sluit iemand anders buiten zijn eigen account. Geeft de fouttekst terug, of null als het goed is. */
export function controleerWachtwoorden(wachtwoord, herhaling) {
  const w = String(wachtwoord ?? '');
  if (w.length < MINSTE_TEKENS) return `Kies een wachtwoord van minstens ${MINSTE_TEKENS} tekens.`;
  if (w !== String(herhaling ?? '')) return 'De twee wachtwoorden zijn niet gelijk. Typ ze nog eens.';
  return null;
}

/* Supabase weigert een wachtwoord met de code weak_password en zegt in weak_password.reasons
   waarom. Sinds 21-10-2026 staat de controle op gelekte wachtwoorden aan (reden pwned); dan is
   "minstens 8 tekens" de verkeerde uitleg, want het wachtwoord is lang genoeg. */
export function zwakWachtwoordMelding(antwoord) {
  const redenen = antwoord?.weak_password?.reasons ?? [];
  if (redenen.includes('pwned')) {
    return 'Dit wachtwoord staat in lijsten van gelekte wachtwoorden. Kies een ander wachtwoord.';
  }
  return `Kies een wachtwoord van minstens ${MINSTE_TEKENS} tekens.`;
}

/* De herstellink uit de mail komt via Supabase terug met alles achter het hekje: bij succes de
   sessie met type=recovery, bij een verlopen of al gebruikte link een foutcode. Geeft null als het
   hekje niets met herstellen te maken heeft, zodat de rest van de app gewoon opstart. */
export function leesHerstelLink(hekje) {
  const p = new URLSearchParams(String(hekje ?? '').replace(/^#/, ''));
  if (p.get('error') || p.get('error_code')) {
    const verlopen = p.get('error_code') === 'otp_expired';
    return {
      fout: verlopen
        ? 'Deze herstellink is verlopen of al gebruikt. Vraag hieronder een nieuwe aan.'
        : 'Deze herstellink werkt niet. Vraag hieronder een nieuwe aan.',
    };
  }
  if (p.get('type') !== 'recovery' || !p.get('access_token')) return null;
  return {
    access_token: p.get('access_token'),
    refresh_token: p.get('refresh_token') || '',
    expires_in: Number(p.get('expires_in')) || 3600,
  };
}
