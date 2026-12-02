// ---------------------------------------------------------------------------
// L'ora "vera", presa dal server invece che dall'orologio del computer.
//
// Ogni risposta HTTP porta l'intestazione Date con l'ora del server (su GitHub
// Pages è aggiornata al secondo anche quando il file arriva dalla cache). Basta
// una richiesta HEAD alla pagina stessa per saperla: così cambiare la data del
// computer non serve ad aprire le caselle prima del tempo.
//
// Se la richiesta non va a buon fine (niente rete, intestazione assente) si
// torna all'orologio del computer: "affidabile" è false.
// ---------------------------------------------------------------------------

const ATTESA_MASSIMA = 2500; // ms: oltre, si usa l'orologio del computer

let promessa = null;

/**
 * @returns {Promise<{ adesso: () => Date, affidabile: boolean, avanti: number }>}
 *   adesso(): l'ora vera in questo momento;
 *   avanti: di quanti ms l'orologio del computer è avanti rispetto al server
 *   (negativo se è indietro).
 */
export function oraVera() {
  promessa ??= chiediAlServer();
  return promessa;
}

async function chiediAlServer() {
  const controllo = new AbortController();
  const timer = setTimeout(() => controllo.abort(), ATTESA_MASSIMA);
  try {
    const partenza = Date.now();
    const risposta = await fetch(`${location.pathname}?ora=${partenza}`, {
      method: 'HEAD',
      cache: 'no-store',
      signal: controllo.signal,
    });
    const arrivo = Date.now();
    const server = Date.parse(risposta.headers.get('Date') ?? '');
    if (!Number.isFinite(server)) return orologioLocale();

    // L'intestazione è al secondo: si aggiunge metà del viaggio di andata e
    // ritorno per stimare l'ora del server al momento dell'arrivo.
    const scarto = arrivo - (server + (arrivo - partenza) / 2);
    return {
      adesso: () => new Date(Date.now() - scarto),
      affidabile: true,
      avanti: scarto,
    };
  } catch {
    return orologioLocale();
  } finally {
    clearTimeout(timer);
  }
}

function orologioLocale() {
  return { adesso: () => new Date(), affidabile: false, avanti: 0 };
}
