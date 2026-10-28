// ---------------------------------------------------------------------------
// Memoria locale dei giorni già aperti.
//
// Per decifrare serve la risposta, quindi è la risposta (normalizzata) che
// viene memorizzata: così chi ha già risolto l'indovinello non lo deve
// risolvere di nuovo. Resta nel browser di quel visitatore, nient'altro.
//
// Tutto in try/catch: in navigazione privata o con i dati dei siti bloccati
// localStorage può lanciare, e il sito deve continuare a funzionare.
// ---------------------------------------------------------------------------

const CHIAVE = 'farewell-atlantic:aperti';

function leggiTutto() {
  try {
    const raw = localStorage.getItem(CHIAVE);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function scriviTutto(mappa) {
  try {
    localStorage.setItem(CHIAVE, JSON.stringify(mappa));
    return true;
  } catch {
    return false;
  }
}

/** Risposta memorizzata per un giorno, oppure null. */
export function rispostaSalvata(day) {
  const valore = leggiTutto()[String(day)];
  return typeof valore === 'string' && valore ? valore : null;
}

/** Elenco dei giorni aperti, come numeri. */
export function giorniAperti() {
  return Object.keys(leggiTutto())
    .map(Number)
    .filter((n) => Number.isInteger(n));
}

export function ricorda(day, answerNormalizzata) {
  const mappa = leggiTutto();
  mappa[String(day)] = answerNormalizzata;
  return scriviTutto(mappa);
}

/** Azzera tutto (usato dal link "ricomincia da zero"). */
export function dimenticaTutto() {
  try {
    localStorage.removeItem(CHIAVE);
    return true;
  } catch {
    return false;
  }
}
