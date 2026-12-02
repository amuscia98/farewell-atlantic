// ---------------------------------------------------------------------------
// Blocco per data.
//
// Il contenuto è cifrato comunque: il blocco serve a non far aprire la casella
// del 24 il 2 dicembre. Si attiva da config.json ("dateLock": { "enabled":
// true, ... }). L'ora di riferimento è quella del server (oravera.js), non
// l'orologio del computer, che chiunque può spostare in avanti.
//
// Chi ci prova trova il carbone: se l'orologio del computer è avanti di più
// di SOGLIA_TRUCCO e "aprirebbe" una casella che in realtà è ancora chiusa,
// quella casella diventa un pacchetto di carbone.
// ---------------------------------------------------------------------------

const MESI = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
];

// Un orologio avanti di qualche minuto è normale: sotto questa soglia la
// casella resta semplicemente chiusa, senza carbone.
const SOGLIA_TRUCCO = 10 * 60 * 1000;

export function nomeMese(mese1based) {
  return MESI[mese1based - 1] ?? '';
}

/** true se il giorno non è ancora arrivato. */
export function giornoBloccato(day, dateLock, adesso = new Date()) {
  if (!dateLock?.enabled) return false;
  const apertura = new Date(dateLock.year, dateLock.month - 1, day, 0, 0, 0, 0);
  return adesso < apertura;
}

/**
 * Stato di una casella: 'libera', 'bloccata' oppure 'carbone' (bloccata, e il
 * visitatore ha spostato avanti l'orologio per aprirla).
 * @param ora il risultato di oraVera(), oppure null per l'orologio locale
 */
export function statoCasella(day, dateLock, ora = null) {
  const adesso = ora ? ora.adesso() : new Date();
  if (!giornoBloccato(day, dateLock, adesso)) return 'libera';
  const truccato =
    ora?.affidabile && ora.avanti > SOGLIA_TRUCCO && !giornoBloccato(day, dateLock, new Date());
  return truccato ? 'carbone' : 'bloccata';
}

/** "il 15 dicembre", ma "l'1 dicembre", "l'8 dicembre", "l'11 dicembre". */
function conArticolo(giorno, testo) {
  return ([1, 8, 11].includes(giorno) ? "l'" : 'il ') + testo;
}

/** "il 15 dicembre 2026", "l'8 dicembre 2026". */
export function ilGiorno(day, dateLock) {
  return conArticolo(day, dataApertura(day, dateLock));
}

/** Una data qualsiasi, senza anno: "il 24 novembre", "l'1 dicembre". */
export function ilGiornoDi(data) {
  return conArticolo(data.getDate(), `${data.getDate()} ${nomeMese(data.getMonth() + 1)}`);
}

export function dataApertura(day, dateLock) {
  return `${day} ${nomeMese(dateLock.month)} ${dateLock.year}`;
}
