// ---------------------------------------------------------------------------
// Blocco per data: puro effetto scenico.
//
// Il contenuto è cifrato comunque, quindi questo non protegge niente: serve
// solo a non far aprire la casella del 24 il 2 dicembre. Si attiva da
// config.json ("dateLock": { "enabled": true, ... }) e usa l'ora locale
// del visitatore.
// ---------------------------------------------------------------------------

const MESI = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
];

export function nomeMese(mese1based) {
  return MESI[mese1based - 1] ?? '';
}

/** true se il giorno non è ancora arrivato. */
export function giornoBloccato(day, dateLock, adesso = new Date()) {
  if (!dateLock?.enabled) return false;
  const apertura = new Date(dateLock.year, dateLock.month - 1, day, 0, 0, 0, 0);
  return adesso < apertura;
}

/** "il 15 dicembre 2026", ma "l'1 dicembre", "l'8 dicembre", "l'11 dicembre". */
export function ilGiorno(day, dateLock) {
  const articolo = [1, 8, 11].includes(day) ? "l'" : 'il ';
  return articolo + dataApertura(day, dateLock);
}

export function dataApertura(day, dateLock) {
  return `${day} ${nomeMese(dateLock.month)} ${dateLock.year}`;
}
